const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/status', (req, res) => {
    const user = db.prepare('SELECT uid, display_name FROM users WHERE uid = ?').get('default_user');
    if (!user) {
        return res.status(500).json({ error: 'Default user not initialized' });
    }
    res.json({ 
        authenticated: true, 
        user: {
            id: user.uid,
            name: user.display_name
        }
    });
});

module.exports = router;
