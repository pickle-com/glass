function identifyUser(req, res, next) {
    const userId = req.get('X-User-ID');

    if (userId) {
        req.uid = userId;
    } else {
        req.uid = 'default_user';
    }
    
    next();
}

module.exports = { identifyUser }; 