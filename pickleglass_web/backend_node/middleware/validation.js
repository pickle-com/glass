const validator = require('validator');
const DOMPurify = require('isomorphic-dompurify');

// Configuration constants
const VALIDATION_LIMITS = {
    // Text field limits
    DISPLAY_NAME: { min: 1, max: 100 },
    EMAIL: { min: 5, max: 254 },
    TITLE: { min: 1, max: 255 },
    PROMPT: { min: 1, max: 10000 },
    SEARCH_QUERY: { min: 1, max: 255 },
    API_KEY: { min: 15, max: 200 },
    
    // Array limits
    INCLUDE_PARAMS: { max: 10 },
    
    // ID formats
    UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    UID_REGEX: /^[a-zA-Z0-9_-]{1,128}$/,
    
    // API key formats
    OPENAI_KEY_REGEX: /^sk-[A-Za-z0-9_-]+$/,
    GEMINI_KEY_REGEX: /^[A-Za-z0-9_-]+$/,
};

/**
 * Sanitize text input to prevent XSS attacks
 * @param {string} input - The input to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} - Sanitized input
 */
function sanitizeInput(input, options = {}) {
    if (typeof input !== 'string') {
        return input;
    }
    
    // Remove null bytes and control characters
    let sanitized = input.replace(/\x00/g, '').replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    // HTML escape special characters to prevent XSS
    sanitized = validator.escape(sanitized);
    
    // Additional DOMPurify sanitization if HTML content is expected
    if (options.allowHTML) {
        sanitized = DOMPurify.sanitize(sanitized, {
            ALLOWED_TAGS: options.allowedTags || [],
            ALLOWED_ATTR: options.allowedAttributes || []
        });
    }
    
    return sanitized;
}

/**
 * Validate string length
 * @param {string} value - The value to validate
 * @param {Object} limits - Object with min and max properties
 * @returns {Object} - Validation result
 */
function validateLength(value, limits) {
    if (typeof value !== 'string') {
        return { isValid: false, error: 'Value must be a string' };
    }
    
    const length = value.length;
    
    if (limits.min && length < limits.min) {
        return { isValid: false, error: `Value must be at least ${limits.min} characters long` };
    }
    
    if (limits.max && length > limits.max) {
        return { isValid: false, error: `Value must be no more than ${limits.max} characters long` };
    }
    
    return { isValid: true };
}

/**
 * Validate email format
 * @param {string} email - The email to validate
 * @returns {Object} - Validation result
 */
function validateEmail(email) {
    if (!validator.isEmail(email)) {
        return { isValid: false, error: 'Invalid email format' };
    }
    
    return { isValid: true };
}

/**
 * Validate UUID format
 * @param {string} uuid - The UUID to validate
 * @returns {Object} - Validation result
 */
function validateUUID(uuid) {
    if (!VALIDATION_LIMITS.UUID_REGEX.test(uuid)) {
        return { isValid: false, error: 'Invalid UUID format' };
    }
    
    return { isValid: true };
}

/**
 * Validate UID format
 * @param {string} uid - The UID to validate
 * @returns {Object} - Validation result
 */
function validateUID(uid) {
    if (!VALIDATION_LIMITS.UID_REGEX.test(uid)) {
        return { isValid: false, error: 'Invalid UID format' };
    }
    
    return { isValid: true };
}

/**
 * Validate API key format
 * @param {string} apiKey - The API key to validate
 * @param {string} provider - The provider (openai, gemini)
 * @returns {Object} - Validation result
 */
function validateAPIKey(apiKey, provider = 'openai') {
    const lengthCheck = validateLength(apiKey, VALIDATION_LIMITS.API_KEY);
    if (!lengthCheck.isValid) {
        return lengthCheck;
    }
    
    if (provider === 'openai' && !VALIDATION_LIMITS.OPENAI_KEY_REGEX.test(apiKey)) {
        return { isValid: false, error: 'Invalid OpenAI API key format' };
    }
    
    if (provider === 'gemini' && !VALIDATION_LIMITS.GEMINI_KEY_REGEX.test(apiKey)) {
        return { isValid: false, error: 'Invalid Gemini API key format' };
    }
    
    return { isValid: true };
}

/**
 * Validation schemas for different endpoints
 */
const VALIDATION_SCHEMAS = {
    // User profile validation
    updateProfile: {
        displayName: {
            required: true,
            type: 'string',
            sanitize: true,
            limits: VALIDATION_LIMITS.DISPLAY_NAME,
            validator: (value) => {
                if (!value || typeof value !== 'string') {
                    return { isValid: false, error: 'Display name is required and must be a string' };
                }
                return validateLength(value, VALIDATION_LIMITS.DISPLAY_NAME);
            }
        }
    },
    
    // User creation validation
    createUser: {
        uid: {
            required: true,
            type: 'string',
            sanitize: true,
            validator: validateUID
        },
        displayName: {
            required: true,
            type: 'string',
            sanitize: true,
            limits: VALIDATION_LIMITS.DISPLAY_NAME,
            validator: (value) => validateLength(value, VALIDATION_LIMITS.DISPLAY_NAME)
        },
        email: {
            required: true,
            type: 'string',
            sanitize: true,
            limits: VALIDATION_LIMITS.EMAIL,
            validator: validateEmail
        }
    },
    
    // API key validation
    apiKey: {
        apiKey: {
            required: true,
            type: 'string',
            sanitize: true,
            limits: VALIDATION_LIMITS.API_KEY,
            validator: validateAPIKey
        }
    },
    
    // Preset validation
    createPreset: {
        title: {
            required: true,
            type: 'string',
            sanitize: true,
            limits: VALIDATION_LIMITS.TITLE,
            validator: (value) => validateLength(value, VALIDATION_LIMITS.TITLE)
        },
        prompt: {
            required: true,
            type: 'string',
            sanitize: true,
            limits: VALIDATION_LIMITS.PROMPT,
            validator: (value) => validateLength(value, VALIDATION_LIMITS.PROMPT)
        }
    },
    
    // Conversation validation
    createConversation: {
        title: {
            required: false,
            type: 'string',
            sanitize: true,
            limits: VALIDATION_LIMITS.TITLE,
            validator: (value) => {
                if (!value) return { isValid: true }; // Optional field
                return validateLength(value, VALIDATION_LIMITS.TITLE);
            }
        }
    },
    
    // Search validation
    search: {
        q: {
            required: true,
            type: 'string',
            sanitize: true,
            limits: VALIDATION_LIMITS.SEARCH_QUERY,
            validator: (value) => {
                const lengthCheck = validateLength(value, VALIDATION_LIMITS.SEARCH_QUERY);
                if (!lengthCheck.isValid) return lengthCheck;
                
                // Additional search-specific validation
                if (value.length < 3) {
                    return { isValid: false, error: 'Search query must be at least 3 characters long' };
                }
                
                return { isValid: true };
            }
        }
    },
    
    // Batch query validation
    batchQuery: {
        include: {
            required: false,
            type: 'string',
            sanitize: true,
            validator: (value) => {
                if (!value) return { isValid: true }; // Optional field
                
                const includes = value.split(',').map(item => item.trim());
                if (includes.length > VALIDATION_LIMITS.INCLUDE_PARAMS.max) {
                    return { isValid: false, error: `Too many include parameters (max ${VALIDATION_LIMITS.INCLUDE_PARAMS.max})` };
                }
                
                const validIncludes = ['profile', 'presets', 'sessions'];
                const invalidIncludes = includes.filter(inc => !validIncludes.includes(inc));
                if (invalidIncludes.length > 0) {
                    return { isValid: false, error: `Invalid include parameters: ${invalidIncludes.join(', ')}` };
                }
                
                return { isValid: true };
            }
        }
    }
};

/**
 * Validation middleware factory
 * @param {string} schemaName - Name of the validation schema to use
 * @returns {Function} - Express middleware function
 */
function createValidationMiddleware(schemaName) {
    return (req, res, next) => {
        const schema = VALIDATION_SCHEMAS[schemaName];
        if (!schema) {
            return res.status(500).json({ error: 'Invalid validation schema' });
        }
        
        const errors = [];
        const sanitizedData = {};
        
        // Validate body parameters
        for (const [fieldName, fieldSchema] of Object.entries(schema)) {
            const value = req.body[fieldName];
            
            // Check if required field is present
            if (fieldSchema.required && (value === undefined || value === null || value === '')) {
                errors.push(`${fieldName} is required`);
                continue;
            }
            
            // Skip validation for optional fields that are not provided
            if (!fieldSchema.required && (value === undefined || value === null || value === '')) {
                continue;
            }
            
            // Type validation
            if (fieldSchema.type && typeof value !== fieldSchema.type) {
                errors.push(`${fieldName} must be of type ${fieldSchema.type}`);
                continue;
            }
            
            // Sanitize input
            let sanitizedValue = value;
            if (fieldSchema.sanitize && typeof value === 'string') {
                sanitizedValue = sanitizeInput(value);
            }
            
            // Custom validation
            if (fieldSchema.validator) {
                const validationResult = fieldSchema.validator(sanitizedValue);
                if (!validationResult.isValid) {
                    errors.push(`${fieldName}: ${validationResult.error}`);
                    continue;
                }
            }
            
            sanitizedData[fieldName] = sanitizedValue;
        }
        
        // Validate query parameters if schema includes them
        if (req.query && Object.keys(req.query).length > 0) {
            // Handle query parameter validation for specific endpoints
            if (schemaName === 'search' && req.query.q) {
                const qSchema = schema.q;
                const queryValue = req.query.q;
                
                let sanitizedQuery = queryValue;
                if (qSchema.sanitize && typeof queryValue === 'string') {
                    sanitizedQuery = sanitizeInput(queryValue);
                }
                
                if (qSchema.validator) {
                    const validationResult = qSchema.validator(sanitizedQuery);
                    if (!validationResult.isValid) {
                        errors.push(`q: ${validationResult.error}`);
                    } else {
                        req.query.q = sanitizedQuery;
                    }
                }
            }
            
            if (schemaName === 'batchQuery' && req.query.include) {
                const includeSchema = schema.include;
                const includeValue = req.query.include;
                
                let sanitizedInclude = includeValue;
                if (includeSchema.sanitize && typeof includeValue === 'string') {
                    sanitizedInclude = sanitizeInput(includeValue);
                }
                
                if (includeSchema.validator) {
                    const validationResult = includeSchema.validator(sanitizedInclude);
                    if (!validationResult.isValid) {
                        errors.push(`include: ${validationResult.error}`);
                    } else {
                        req.query.include = sanitizedInclude;
                    }
                }
            }
        }
        
        // Validate path parameters
        if (req.params) {
            for (const [paramName, paramValue] of Object.entries(req.params)) {
                if (paramName === 'session_id' || paramName === 'id') {
                    // Validate UUID format for IDs
                    const sanitizedParam = sanitizeInput(paramValue);
                    const validationResult = validateUUID(sanitizedParam);
                    if (!validationResult.isValid) {
                        errors.push(`${paramName}: ${validationResult.error}`);
                    } else {
                        req.params[paramName] = sanitizedParam;
                    }
                }
            }
        }
        
        // Return validation errors if any
        if (errors.length > 0) {
            return res.status(400).json({ 
                error: 'Validation failed',
                details: errors 
            });
        }
        
        // Replace req.body with sanitized data
        req.body = { ...req.body, ...sanitizedData };
        
        next();
    };
}

/**
 * General input sanitization middleware for all requests
 */
function generalSanitization(req, res, next) {
    // Sanitize common headers
    const dangerousHeaders = ['x-forwarded-for', 'user-agent', 'referer'];
    dangerousHeaders.forEach(header => {
        if (req.headers[header]) {
            req.headers[header] = sanitizeInput(req.headers[header]);
        }
    });
    
    // Prevent parameter pollution
    if (req.body && typeof req.body === 'object') {
        for (const [key, value] of Object.entries(req.body)) {
            if (Array.isArray(value)) {
                // Limit array length to prevent memory exhaustion
                if (value.length > 100) {
                    return res.status(400).json({ error: 'Array parameters are limited to 100 items' });
                }
            }
        }
    }
    
    next();
}

module.exports = {
    createValidationMiddleware,
    generalSanitization,
    sanitizeInput,
    validateLength,
    validateEmail,
    validateUUID,
    validateUID,
    validateAPIKey,
    VALIDATION_LIMITS,
    VALIDATION_SCHEMAS
}; 