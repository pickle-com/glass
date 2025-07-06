// windowUtils.js
// Window utility functions

function getWindowByName(windowPool, name) {
    return windowPool.get(name);
}

function isWindowVisible(windowPool, name) {
    const win = windowPool.get(name);
    return win && !win.isDestroyed() && win.isVisible();
}

function focusWindow(windowPool, name) {
    const win = windowPool.get(name);
    if (win && !win.isDestroyed()) win.focus();
}

module.exports = {
    getWindowByName,
    isWindowVisible,
    focusWindow,
}; 