/**
 * Rate limiting middleware for API endpoints
 * Prevents DoS attacks and excessive input on input-heavy endpoints
 */

// Simple in-memory store for rate limiting
// In production, consider using Redis or similar for distributed systems
const rateLimitStore = new Map();

/**
 * Rate limiting configuration
 */
const RATE_LIMIT_CONFIG = {
    // General API rate limits
    general: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // limit each IP to 100 requests per windowMs
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
    },
    
    // Input-heavy endpoints (creating/updating data)
    inputHeavy: {
        windowMs: 5 * 60 * 1000, // 5 minutes
        max: 20, // limit each IP to 20 requests per windowMs
        message: 'Too many input requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
    },
    
    // Search endpoints
    search: {
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 30, // limit each IP to 30 search requests per minute
        message: 'Too many search requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
    },
    
    // Authentication endpoints
    auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // limit each IP to 5 auth requests per windowMs
        message: 'Too many authentication attempts from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
    },
    
    // Profile updates (more restrictive)
    profile: {
        windowMs: 5 * 60 * 1000, // 5 minutes
        max: 10, // limit each IP to 10 profile updates per 5 minutes
        message: 'Too many profile update requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
    }
};

/**
 * Get client IP address
 * @param {Object} req - Express request object
 * @returns {string} - Client IP address
 */
function getClientIP(req) {
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           req.headers['x-forwarded-for']?.split(',')[0] ||
           req.headers['x-real-ip'] ||
           '127.0.0.1';
}

/**
 * Clean expired entries from rate limit store
 */
function cleanExpiredEntries() {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
        if (now > entry.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}

/**
 * Rate limiting middleware factory
 * @param {string} configName - Name of the rate limit configuration to use
 * @returns {Function} - Express middleware function
 */
function createRateLimitMiddleware(configName = 'general') {
    const config = RATE_LIMIT_CONFIG[configName];
    if (!config) {
        throw new Error(`Invalid rate limit configuration: ${configName}`);
    }
    
    return (req, res, next) => {
        // Clean expired entries periodically
        if (Math.random() < 0.01) { // 1% chance on each request
            cleanExpiredEntries();
        }
        
        const clientIP = getClientIP(req);
        const key = `${configName}:${clientIP}`;
        const now = Date.now();
        
        // Get or create entry for this IP
        let entry = rateLimitStore.get(key);
        if (!entry) {
            entry = {
                count: 0,
                resetTime: now + config.windowMs,
                firstRequest: now
            };
            rateLimitStore.set(key, entry);
        }
        
        // Check if window has expired
        if (now > entry.resetTime) {
            entry.count = 0;
            entry.resetTime = now + config.windowMs;
            entry.firstRequest = now;
        }
        
        // Increment request count
        entry.count++;
        
        // Set rate limit headers
        if (config.standardHeaders) {
            res.set({
                'RateLimit-Limit': config.max,
                'RateLimit-Remaining': Math.max(0, config.max - entry.count),
                'RateLimit-Reset': new Date(entry.resetTime).toISOString()
            });
        }
        
        // Check if limit exceeded
        if (entry.count > config.max) {
            res.status(429).json({
                error: 'Rate limit exceeded',
                message: config.message,
                retryAfter: Math.ceil((entry.resetTime - now) / 1000)
            });
            return;
        }
        
        next();
    };
}

/**
 * Progressive rate limiting for repeated violations
 * Increases the penalty for IPs that repeatedly hit rate limits
 */
function createProgressiveRateLimitMiddleware(configName = 'general') {
    const config = RATE_LIMIT_CONFIG[configName];
    if (!config) {
        throw new Error(`Invalid rate limit configuration: ${configName}`);
    }
    
    return (req, res, next) => {
        const clientIP = getClientIP(req);
        const key = `${configName}:${clientIP}`;
        const violationKey = `violations:${clientIP}`;
        const now = Date.now();
        
        // Get violation count for this IP
        let violations = rateLimitStore.get(violationKey);
        if (!violations) {
            violations = { count: 0, lastViolation: 0 };
            rateLimitStore.set(violationKey, violations);
        }
        
        // Reset violation count if it's been more than 1 hour
        if (now - violations.lastViolation > 60 * 60 * 1000) {
            violations.count = 0;
        }
        
        // Calculate adjusted limits based on violation history
        const penaltyMultiplier = Math.max(1, violations.count);
        const adjustedMax = Math.max(1, Math.floor(config.max / penaltyMultiplier));
        const adjustedWindowMs = config.windowMs * penaltyMultiplier;
        
        // Apply standard rate limiting with adjusted limits
        let entry = rateLimitStore.get(key);
        if (!entry) {
            entry = {
                count: 0,
                resetTime: now + adjustedWindowMs,
                firstRequest: now
            };
            rateLimitStore.set(key, entry);
        }
        
        if (now > entry.resetTime) {
            entry.count = 0;
            entry.resetTime = now + adjustedWindowMs;
            entry.firstRequest = now;
        }
        
        entry.count++;
        
        // Set rate limit headers
        if (config.standardHeaders) {
            res.set({
                'RateLimit-Limit': adjustedMax,
                'RateLimit-Remaining': Math.max(0, adjustedMax - entry.count),
                'RateLimit-Reset': new Date(entry.resetTime).toISOString(),
                'RateLimit-Policy': `${adjustedMax};w=${adjustedWindowMs/1000}`
            });
        }
        
        // Check if limit exceeded
        if (entry.count > adjustedMax) {
            // Record violation
            violations.count++;
            violations.lastViolation = now;
            
            res.status(429).json({
                error: 'Rate limit exceeded',
                message: config.message,
                retryAfter: Math.ceil((entry.resetTime - now) / 1000),
                violationCount: violations.count
            });
            return;
        }
        
        next();
    };
}

/**
 * Burst protection middleware
 * Prevents sudden spikes in requests
 */
function createBurstProtectionMiddleware(options = {}) {
    const {
        burstLimit = 10,
        burstWindow = 10 * 1000, // 10 seconds
        message = 'Too many requests in a short time, please slow down.'
    } = options;
    
    return (req, res, next) => {
        const clientIP = getClientIP(req);
        const key = `burst:${clientIP}`;
        const now = Date.now();
        
        let entry = rateLimitStore.get(key);
        if (!entry) {
            entry = {
                requests: [],
                blocked: false,
                blockedUntil: 0
            };
            rateLimitStore.set(key, entry);
        }
        
        // Check if still blocked
        if (entry.blocked && now < entry.blockedUntil) {
            res.status(429).json({
                error: 'Burst limit exceeded',
                message: message,
                retryAfter: Math.ceil((entry.blockedUntil - now) / 1000)
            });
            return;
        }
        
        // Reset if block period expired
        if (entry.blocked && now >= entry.blockedUntil) {
            entry.blocked = false;
            entry.requests = [];
        }
        
        // Clean old requests outside the burst window
        entry.requests = entry.requests.filter(timestamp => now - timestamp < burstWindow);
        
        // Add current request
        entry.requests.push(now);
        
        // Check if burst limit exceeded
        if (entry.requests.length > burstLimit) {
            entry.blocked = true;
            entry.blockedUntil = now + burstWindow;
            
            res.status(429).json({
                error: 'Burst limit exceeded',
                message: message,
                retryAfter: Math.ceil(burstWindow / 1000)
            });
            return;
        }
        
        next();
    };
}

/**
 * Clear rate limit data for testing purposes
 */
function clearRateLimitData() {
    rateLimitStore.clear();
}

/**
 * Get rate limit stats for monitoring
 */
function getRateLimitStats() {
    const stats = {
        totalEntries: rateLimitStore.size,
        activeIPs: new Set(),
        topViolators: []
    };
    
    const violationCounts = new Map();
    
    for (const [key, entry] of rateLimitStore.entries()) {
        const ip = key.split(':')[1];
        if (ip) {
            stats.activeIPs.add(ip);
            
            if (key.startsWith('violations:')) {
                violationCounts.set(ip, entry.count);
            }
        }
    }
    
    stats.activeIPs = stats.activeIPs.size;
    stats.topViolators = Array.from(violationCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([ip, count]) => ({ ip, violations: count }));
    
    return stats;
}

module.exports = {
    createRateLimitMiddleware,
    createProgressiveRateLimitMiddleware,
    createBurstProtectionMiddleware,
    clearRateLimitData,
    getRateLimitStats,
    RATE_LIMIT_CONFIG
}; 