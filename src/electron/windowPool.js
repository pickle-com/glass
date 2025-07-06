// windowPool.js

const windowPool = new Map();

function addWindow(name, win) {
    windowPool.set(name, win);
}

function removeWindow(name) {
    windowPool.delete(name);
}

function getWindow(name) {
    return windowPool.get(name);
}

function clearWindows() {
    windowPool.clear();
}

module.exports = {
    windowPool,
    addWindow,
    removeWindow,
    getWindow,
    clearWindows,
}; 