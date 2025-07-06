const { screen } = require('electron');

/**
 * 주어진 창이 현재 어느 디스플레이에 속해 있는지 반환합니다.
 * @param {BrowserWindow} window - 확인할 창 객체
 * @returns {Display} Electron의 Display 객체
 */
function getCurrentDisplay(window) {
    if (!window || window.isDestroyed()) return screen.getPrimaryDisplay();

    const windowBounds = window.getBounds();
    const windowCenter = {
        x: windowBounds.x + windowBounds.width / 2,
        y: windowBounds.y + windowBounds.height / 2,
    };

    return screen.getDisplayNearestPoint(windowCenter);
}

class WindowLayoutManager {
    /**
     * @param {Map<string, BrowserWindow>} windowPool - 관리할 창들의 맵
     */
    constructor(windowPool) {
        this.windowPool = windowPool;
        this.isUpdating = false;
        this.PADDING = 80;
    }

    /**
     * 모든 창의 레이아웃 업데이트를 요청합니다.
     * 중복 실행을 방지하기 위해 isUpdating 플래그를 사용합니다.
     */
    updateLayout() {
        if (this.isUpdating) return;
        this.isUpdating = true;

        setImmediate(() => {
            this.positionWindows();
            this.isUpdating = false;
        });
    }

    /**
     * 헤더 창을 기준으로 모든 기능 창들의 위치를 계산하고 배치합니다.
     */
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

    /**
     * 헤더 창의 위치에 따라 기능 창들을 배치할 최적의 전략을 결정합니다.
     * @returns {{name: string, primary: string, secondary: string}} 레이아웃 전략
     */
    determineLayoutStrategy(headerBounds, screenWidth, screenHeight, relativeX, relativeY) {
        const spaceBelow = screenHeight - (headerBounds.y + headerBounds.height);
        const spaceAbove = headerBounds.y;
        const spaceLeft = headerBounds.x;
        const spaceRight = screenWidth - (headerBounds.x + headerBounds.width);

        if (spaceBelow >= 400) {
            return { name: 'below', primary: 'below', secondary: relativeX < 0.5 ? 'right' : 'left' };
        } else if (spaceAbove >= 400) {
            return { name: 'above', primary: 'above', secondary: relativeX < 0.5 ? 'right' : 'left' };
        } else if (relativeX < 0.3 && spaceRight >= 800) {
            return { name: 'right-side', primary: 'right', secondary: spaceBelow > spaceAbove ? 'below' : 'above' };
        } else if (relativeX > 0.7 && spaceLeft >= 800) {
            return { name: 'left-side', primary: 'left', secondary: spaceBelow > spaceAbove ? 'below' : 'above' };
        } else {
            return { name: 'adaptive', primary: spaceBelow > spaceAbove ? 'below' : 'above', secondary: spaceRight > spaceLeft ? 'right' : 'left' };
        }
    }

    /**
     * 'ask'와 'listen' 창의 위치를 조정합니다.
     */
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

            let yRel = (strategy.primary === 'above')
                ? headerBounds.y - workAreaY - Math.max(askBounds.height, listenBounds.height) - PAD
                : headerBounds.y - workAreaY + headerBounds.height + PAD;

            listen.setBounds({ x: Math.round(listenXRel + workAreaX), y: Math.round(yRel + workAreaY), width: listenBounds.width, height: listenBounds.height });
            ask.setBounds({ x: Math.round(askXRel + workAreaX), y: Math.round(yRel + workAreaY), width: askBounds.width, height: askBounds.height });
        } else {
            const win = askVisible ? ask : listen;
            const winBounds = askVisible ? askBounds : listenBounds;
            let xRel = headerCenterXRel - winBounds.width / 2;
            let yRel = (strategy.primary === 'above')
                ? headerBounds.y - workAreaY - winBounds.height - PAD
                : headerBounds.y - workAreaY + headerBounds.height + PAD;

            xRel = Math.max(PAD, Math.min(screenWidth - winBounds.width - PAD, xRel));
            yRel = Math.max(PAD, Math.min(screenHeight - winBounds.height - PAD, yRel));

            win.setBounds({ x: Math.round(xRel + workAreaX), y: Math.round(yRel + workAreaY), width: winBounds.width, height: winBounds.height });
        }
    }

    /**
     * 'settings' 창의 위치를 조정합니다.
     */
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
                otherVisibleWindows.push({ name, bounds: win.getBounds() });
            }
        });

        const settingsNewBounds = { x, y, width: settingsBounds.width, height: settingsBounds.height };
        let hasOverlap = otherVisibleWindows.some(otherWin => this.boundsOverlap(settingsNewBounds, otherWin.bounds));

        if (hasOverlap) {
            x = headerBounds.x + headerBounds.width + PAD;
            y = headerBounds.y;
            if (x + settingsBounds.width > screenWidth - 10) {
                x = headerBounds.x - settingsBounds.width - PAD;
            }
            if (x < 10) {
                x = headerBounds.x + headerBounds.width - settingsBounds.width - buttonPadding;
                y = headerBounds.y - settingsBounds.height - PAD;
                if (y < 10) {
                    x = headerBounds.x + headerBounds.width - settingsBounds.width;
                    y = headerBounds.y + headerBounds.height + PAD;
                }
            }
        }

        x = Math.max(workAreaX + 10, Math.min(workAreaX + screenWidth - settingsBounds.width - 10, x));
        y = Math.max(workAreaY + 10, Math.min(workAreaY + screenHeight - settingsBounds.height - 10, y));

        settings.setBounds({ x: Math.round(x), y: Math.round(y) });
        settings.moveTop();
    }
    
    /**
     * 두 사각형 영역이 겹치는지 확인합니다.
     * @param {Rectangle} bounds1
     * @param {Rectangle} bounds2
     * @returns {boolean} 겹침 여부
     */
    boundsOverlap(bounds1, bounds2) {
        const margin = 10;
        return !(
            bounds1.x + bounds1.width + margin < bounds2.x ||
            bounds2.x + bounds2.width + margin < bounds1.x ||
            bounds1.y + bounds1.height + margin < bounds2.y ||
            bounds2.y + bounds2.height + margin < bounds1.y
        );
    }
}

module.exports = WindowLayoutManager;