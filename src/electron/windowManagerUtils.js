// windowManagerUtils.js

function isAllowed(name, featureWindows, currentHeaderState) {
    if (name === 'header') return true;
    return featureWindows.includes(name) && currentHeaderState === 'main';
}

function updateLayout(layoutManager) {
    if (layoutManager && typeof layoutManager.updateLayout === 'function') {
        layoutManager.updateLayout();
    }
}

module.exports = {
    isAllowed,
    updateLayout,
}; 