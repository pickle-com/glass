const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const db = require('./db');
const { identifyUser } = require('./middleware/auth');
const { generalSanitization } = require('./middleware/validation');
const { createRateLimitMiddleware, createBurstProtectionMiddleware } = require('./middleware/rateLimiting');

function createApp() {
    const app = express();

    const webUrl = process.env.pickleglass_WEB_URL || 'http://localhost:3000';
    console.log(`🔧 Backend CORS configured for: ${webUrl}`);

    // Security middleware
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
            },
        },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" }
    }));

    app.use(cors({
        origin: webUrl,
        credentials: true,
    }));

    // Body parsing with size limits
    app.use(express.json({ 
        limit: '10mb',
        verify: (req, res, buf) => {
            // Additional validation for JSON payloads
            if (buf.length > 0) {
                try {
                    JSON.parse(buf);
                } catch (e) {
                    res.status(400).json({ error: 'Invalid JSON format' });
                    return;
                }
            }
        }
    }));

    app.use(express.urlencoded({ 
        limit: '10mb', 
        extended: true,
        parameterLimit: 100 // Limit number of parameters
    }));

    // General security middleware
    app.use(generalSanitization);
    app.use(createBurstProtectionMiddleware({
        burstLimit: 50,
        burstWindow: 30 * 1000, // 30 seconds
        message: 'Too many requests too quickly. Please slow down.'
    }));

    app.get('/', (req, res) => {
        res.json({ message: "pickleglass API is running" });
    });

    app.use('/api', identifyUser);

    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/user', require('./routes/user'));
    app.use('/api/conversations', require('./routes/conversations'));
    app.use('/api/presets', require('./routes/presets'));

    app.get('/api/sync/status', (req, res) => {
        res.json({
            status: 'online',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    });

    app.post('/api/desktop/set-user', (req, res) => {
        res.json({
            success: true,
            message: "Direct IPC communication is now used. This endpoint is deprecated.",
            user: req.body,
            deprecated: true
        });
    });

    app.get('/api/desktop/status', (req, res) => {
        res.json({
            connected: true,
            current_user: null,
            communication_method: "IPC",
            file_based_deprecated: true
        });
    });

    return app;
}

module.exports = createApp;
