const { screen } = require('electron');

function getCurrentDisplay(window) {
    if (!window || window.isDestroyed()) return screen.getPrimaryDisplay();
    const windowBounds = window.getBounds();
    const windowCenter = {
        x: windowBounds.x + windowBounds.width / 2,
        y: windowBounds.y + windowBounds.height / 2,
    };
    return screen.getDisplayNearestPoint(windowCenter);
}

function getDisplayById(displayId) {
    const displays = screen.getAllDisplays();
    return displays.find(d => d.id === displayId) || screen.getPrimaryDisplay();
}

class WindowLayoutManager {
    constructor(windowPool) {
        this.windowPool = windowPool;
        this.isUpdating = false;
        this.PADDING = 80;
    }

    updateLayout() {
        if (this.isUpdating) return;
        this.isUpdating = true;
        setImmediate(() => {
            this.positionWindows();
            this.isUpdating = false;
        });
    }

    positionWindows() {
        const header = this.windowPool.get('header');
        if (!header?.getBounds) return;
        const headerBounds = header.getBounds();
        const display = getCurrentDisplay(header);
        const { width: screenWidth, height: screenHeight } = display.workAreaSize;
        const { x: workAreaX, y: workAreaY } = display.workArea;
        const headerCenterX = headerBounds.x - workAreaX + headerBounds.width / 2;
        const headerCenterY = headerBounds.y - workAreaY + headerBounds.height / 2;
        const relativeX = headerCenterX / screenWidth;
        const relativeY = headerCenterY / screenHeight;
        const strategy = this.determineLayoutStrategy(headerBounds, screenWidth, screenHeight, relativeX, relativeY);
        this.positionFeatureWindows(headerBounds, strategy, screenWidth, screenHeight, workAreaX, workAreaY);
        this.positionSettingsWindow(headerBounds, strategy, screenWidth, screenHeight, workAreaX, workAreaY);
    }

    determineLayoutStrategy(headerBounds, screenWidth, screenHeight, relativeX, relativeY) {
        const spaceBelow = screenHeight - (headerBounds.y + headerBounds.height);
        const spaceAbove = headerBounds.y;
        const spaceLeft = headerBounds.x;
        const spaceRight = screenWidth - (headerBounds.x + headerBounds.width);
        const spaces = {
            below: spaceBelow,
            above: spaceAbove,
            left: spaceLeft,
            right: spaceRight,
        };
        if (spaceBelow >= 400) {
            return {
                name: 'below',
                primary: 'below',
                secondary: relativeX < 0.5 ? 'right' : 'left',
            };
        } else if (spaceAbove >= 400) {
            return {
                name: 'above',
                primary: 'above',
                secondary: relativeX < 0.5 ? 'right' : 'left',
            };
        } else if (relativeX < 0.3 && spaceRight >= 800) {
            return {
                name: 'right-side',
                primary: 'right',
                secondary: spaceBelow > spaceAbove ? 'below' : 'above',
            };
        } else if (relativeX > 0.7 && spaceLeft >= 800) {
            return {
                name: 'left-side',
                primary: 'left',
                secondary: spaceBelow > spaceAbove ? 'below' : 'above',
            };
        } else {
            return {
                name: 'adaptive',
                primary: spaceBelow > spaceAbove ? 'below' : 'above',
                secondary: spaceRight > spaceLeft ? 'right' : 'left',
            };
        }
    }

    positionFeatureWindows(headerBounds, strategy, screenWidth, screenHeight, workAreaX, workAreaY) {
        const ask = this.windowPool.get('ask');
        const listen = this.windowPool.get('listen');
        const askVisible = ask && ask.isVisible() && !ask.isDestroyed();
        const listenVisible = listen && listen.isVisible() && !listen.isDestroyed();

        if (!askVisible && !listenVisible) return;

        const PAD = 8;
        const headerCenterXRel = headerBounds.x - workAreaX + headerBounds.width / 2;
        let askBounds = askVisible ? ask.getBounds() : null;
        let listenBounds = listenVisible ? listen.getBounds() : null;

        if (askVisible && listenVisible) {
            const combinedWidth = listenBounds.width + PAD + askBounds.width;
            let groupStartXRel = headerCenterXRel - combinedWidth / 2;
            let listenXRel = groupStartXRel;
            let askXRel = groupStartXRel + listenBounds.width + PAD;
            if (listenXRel < PAD) {
                listenXRel = PAD;
                askXRel = listenXRel + listenBounds.width + PAD;
            }
            if (askXRel + askBounds.width > screenWidth - PAD) {
                askXRel = screenWidth - PAD - askBounds.width;
                listenXRel = askXRel - listenBounds.width - PAD;
            }
            let yRel;
            switch (strategy.primary) {
                case 'below':
                    yRel = headerBounds.y - workAreaY + headerBounds.height + PAD;
                    break;
                case 'above':
                    yRel = headerBounds.y - workAreaY - Math.max(askBounds.height, listenBounds.height) - PAD;
                    break;
                default:
                    yRel = headerBounds.y - workAreaY + headerBounds.height + PAD;
                    break;
            }
            listen.setBounds({
                x: Math.round(listenXRel + workAreaX),
                y: Math.round(yRel + workAreaY),
                width: listenBounds.width,
                height: listenBounds.height,
            });
            ask.setBounds({
                x: Math.round(askXRel + workAreaX),
                y: Math.round(yRel + workAreaY),
                width: askBounds.width,
                height: askBounds.height,
            });
        } else {
            const win = askVisible ? ask : listen;
            const winBounds = askVisible ? askBounds : listenBounds;
            let xRel = headerCenterXRel - winBounds.width / 2;
            let yRel;
            switch (strategy.primary) {
                case 'below':
                    yRel = headerBounds.y - workAreaY + headerBounds.height + PAD;
                    break;
                case 'above':
                    yRel = headerBounds.y - workAreaY - winBounds.height - PAD;
                    break;
                default:
                    yRel = headerBounds.y - workAreaY + headerBounds.height + PAD;
                    break;
            }
            xRel = Math.max(PAD, Math.min(screenWidth - winBounds.width - PAD, xRel));
            yRel = Math.max(PAD, Math.min(screenHeight - winBounds.height - PAD, yRel));
            win.setBounds({
                x: Math.round(xRel + workAreaX),
                y: Math.round(yRel + workAreaY),
                width: winBounds.width,
                height: winBounds.height,
            });
        }
    }

    positionSettingsWindow(headerBounds, strategy, screenWidth, screenHeight, workAreaX, workAreaY) {
        const settings = this.windowPool.get('settings');
        if (!settings?.getBounds || !settings.isVisible()) return;
        if (settings.__lockedByButton) {
            const headerDisplay = getCurrentDisplay(this.windowPool.get('header'));
            const settingsDisplay = getCurrentDisplay(settings);
            if (headerDisplay.id !== settingsDisplay.id) {
                settings.__lockedByButton = false;
            } else {
                return;
            }
        }
        const settingsBounds = settings.getBounds();
        const PAD = 5;
        const buttonPadding = 17;
        let x = headerBounds.x + headerBounds.width - settingsBounds.width - buttonPadding;
        let y = headerBounds.y + headerBounds.height + PAD;
        const otherVisibleWindows = [];
        ['listen', 'ask'].forEach(name => {
            const win = this.windowPool.get(name);
            if (win && win.isVisible() && !win.isDestroyed()) {
                otherVisibleWindows.push({
                    name,
                    bounds: win.getBounds(),
                });
            }
        });
        const settingsNewBounds = { x, y, width: settingsBounds.width, height: settingsBounds.height };
        let hasOverlap = false;
        for (const otherWin of otherVisibleWindows) {
            if (this.boundsOverlap(settingsNewBounds, otherWin.bounds)) {
                hasOverlap = true;
                break;
            }
        }
        if (hasOverlap) {
            x = headerBounds.x + headerBounds.width + PAD;
            y = headerBounds.y;
            settingsNewBounds.x = x;
            settingsNewBounds.y = y;
            if (x + settingsBounds.width > screenWidth - 10) {
                x = headerBounds.x - settingsBounds.width - PAD;
                settingsNewBounds.x = x;
            }
            if (x < 10) {
                x = headerBounds.x + headerBounds.width - settingsBounds.width - buttonPadding;
                y = headerBounds.y - settingsBounds.height - PAD;
                settingsNewBounds.x = x;
                settingsNewBounds.y = y;
                if (y < 10) {
                    x = headerBounds.x + headerBounds.width - settingsBounds.width;
                    y = headerBounds.y + headerBounds.height + PAD;
                }
            }
        }
        x = Math.max(10, Math.min(screenWidth - settingsBounds.width - 10, x));
        y = Math.max(10, Math.min(screenHeight - settingsBounds.height - 10, y));
        settings.setBounds({ x, y });
        settings.moveTop();
    }

    boundsOverlap(bounds1, bounds2) {
        const margin = 10;
        return !(
            bounds1.x + bounds1.width + margin < bounds2.x ||
            bounds2.x + bounds2.width + margin < bounds1.x ||
            bounds1.y + bounds1.height + margin < bounds2.y ||
            bounds2.y + bounds2.height + margin < bounds1.y
        );
    }

    isWindowVisible(windowName) {
        const window = this.windowPool.get(windowName);
        return window && !window.isDestroyed() && window.isVisible();
    }

    destroy() {}
}

module.exports = WindowLayoutManager; 