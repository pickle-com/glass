const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET_KEY || 'change-me';
const EXPIRE = 60 * 24; // minutes

exports.sign = (sub, extra = {}) => jwt.sign({ sub, ...extra }, SECRET, { algorithm: 'HS256', expiresIn: `${EXPIRE}m` });

exports.verify = token => {
    try {
        return jwt.verify(token, SECRET).sub;
    } catch {
        return null;
    }
};
