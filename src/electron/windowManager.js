const { BrowserWindow, globalShortcut, ipcMain, screen, app, shell, desktopCapturer } = require('electron');
const WindowLayoutManager = require('./windowLayoutManager');
const SmoothMovementManager = require('./smoothMovementManager');
const path = require('node:path');
const fs = require('node:fs');
const os = require('os');
const util = require('util');
const execFile = util.promisify(require('child_process').execFile);
const sharp = require('sharp');
const authService = require('../common/services/authService');
const systemSettingsRepository = require('../common/repositories/systemSettings');
const userRepository = require('../common/repositories/user');
const fetch = require('node-fetch');


/* ────────────────[ GLASS BYPASS ]─────────────── */
let liquidGlass;
const isLiquidGlassSupported = () => {
    if (process.platform !== 'darwin') {
        return false;
    }
    const majorVersion = parseInt(os.release().split('.')[0], 10);
    return majorVersion >= 26; // macOS 26+ (Darwin 25+)
};
let shouldUseLiquidGlass = isLiquidGlassSupported();
if (shouldUseLiquidGlass) {
    try {
        liquidGlass = require('electron-liquid-glass');
    } catch (e) {
        console.warn('Could not load optional dependency "electron-liquid-glass". The feature will be disabled.');
        shouldUseLiquidGlass = false;
    }
}
/* ────────────────[ GLASS BYPASS ]─────────────── */

let isContentProtectionOn = true;
let currentDisplayId = null;

let mouseEventsIgnored = false;
let lastVisibleWindows = new Set(['header']);
const HEADER_HEIGHT = 60;
const DEFAULT_WINDOW_WIDTH = 345;

let currentHeaderState = 'apikey';
const windowPool = new Map();
let fixedYPosition = 0;
let lastScreenshot = null;

let settingsHideTimer = null;

let selectedCaptureSourceId = null;

let layoutManager = null;
function updateLayout() {
    if (layoutManager) {
        layoutManager.updateLayout();
    }
}

let movementManager = null;

let storedProvider = 'openai';

const toggleState = { isToggling: false };

const featureWindows = ['listen','ask','settings'];
function isAllowed(name) {
    if (name === 'header') return true;
    return featureWindows.includes(name) && currentHeaderState === 'main';
}

function createFeatureWindows(header) {
    if (windowPool.has('listen')) return;

    const commonChildOptions = {
        parent: header,
        show: false,
        frame: false,
        transparent: true,
        vibrancy: false,
        hasShadow: false,
        skipTaskbar: true,
        hiddenInMissionControl: true,
        resizable: false,
        webPreferences: { nodeIntegration: true, contextIsolation: false },
    };

    // listen
    const listen = new BrowserWindow({
        ...commonChildOptions, width:400,minWidth:400,maxWidth:400,
        maxHeight:700,
    });
    listen.setContentProtection(isContentProtectionOn);
    listen.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
    if (process.platform === 'darwin') {
        listen.setWindowButtonVisibility(false);
    }
    const listenLoadOptions = { query: { view: 'listen' } };
    if (!shouldUseLiquidGlass) {
        listen.loadFile(path.join(__dirname, '../app/content.html'), listenLoadOptions);
    }
    else {
        listenLoadOptions.query.glass = 'true';
        listen.loadFile(path.join(__dirname, '../app/content.html'), listenLoadOptions);
        listen.webContents.once('did-finish-load', () => {
            const viewId = liquidGlass.addView(listen.getNativeWindowHandle(), {
                cornerRadius: 12,
                tintColor: '#FF00001A', // Red tint
                opaque: false, 
            });
            if (viewId !== -1) {
                liquidGlass.unstable_setVariant(viewId, 2);
                // liquidGlass.unstable_setScrim(viewId, 1);
                // liquidGlass.unstable_setSubdued(viewId, 1);
            }
        });
    }


    windowPool.set('listen', listen);

    // ask
    const ask = new BrowserWindow({ ...commonChildOptions, width:554, height:350 });
    ask.setContentProtection(isContentProtectionOn);
    ask.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
    if (process.platform === 'darwin') {
        ask.setWindowButtonVisibility(false);
    }
    const askLoadOptions = { query: { view: 'ask' } };
    if (!shouldUseLiquidGlass) {
        ask.loadFile(path.join(__dirname, '../app/content.html'), askLoadOptions);
    }
    else {
        askLoadOptions.query.glass = 'true';
        ask.loadFile(path.join(__dirname, '../app/content.html'), askLoadOptions);
        ask.webContents.once('did-finish-load', () => {
            const viewId = liquidGlass.addView(ask.getNativeWindowHandle(), {
                cornerRadius: 12,
                tintColor: '#FF00001A', // Red tint
                opaque: false, 
            });
            if (viewId !== -1) {
                liquidGlass.unstable_setVariant(viewId, 2);
                // liquidGlass.unstable_setScrim(viewId, 1);
                // liquidGlass.unstable_setSubdued(viewId, 1);
            }
        });
    }

    ask.on('blur',()=>ask.webContents.send('window-blur'));
    
    // Open DevTools in development
    if (!app.isPackaged) {
        ask.webContents.openDevTools({ mode: 'detach' });
    }
    windowPool.set('ask', ask);

    // settings
    const settings = new BrowserWindow({ ...commonChildOptions, width:240, maxHeight:350, parent:undefined });
    settings.setContentProtection(isContentProtectionOn);
    settings.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
    if (process.platform === 'darwin') {
        settings.setWindowButtonVisibility(false);
    }
    const settingsLoadOptions = { query: { view: 'settings' } };
    if (!shouldUseLiquidGlass) {
        settings.loadFile(path.join(__dirname,'../app/content.html'), settingsLoadOptions)
            .catch(console.error);
    }
    else {
        settingsLoadOptions.query.glass = 'true';
        settings.loadFile(path.join(__dirname,'../app/content.html'), settingsLoadOptions)
            .catch(console.error);
        settings.webContents.once('did-finish-load', () => {
            const viewId = liquidGlass.addView(settings.getNativeWindowHandle(), {
                cornerRadius: 12,
                tintColor: '#FF00001A', // Red tint
                opaque: false, 
            });
            if (viewId !== -1) {
                liquidGlass.unstable_setVariant(viewId, 2);
                // liquidGlass.unstable_setScrim(viewId, 1);
                // liquidGlass.unstable_setSubdued(viewId, 1);
            }
        });
    }
    windowPool.set('settings', settings);   
}

function destroyFeatureWindows() {
    if (settingsHideTimer) {
        clearTimeout(settingsHideTimer);
        settingsHideTimer = null;
    }
    featureWindows.forEach(name=>{
        const win = windowPool.get(name);
        if (win && !win.isDestroyed()) win.destroy();
        windowPool.delete(name);
    });
}

<<<<<<< HEAD
=======
function instantHideWindow(win) {
    if (!win || win.isDestroyed() || !win.isVisible()) return;
    try {
      win.webContents.send('cancel-animations'); // ① 렌더러 애니메이션 정지
    } catch (_) {}
    win.hide();                                   // ② 지연 없이 바로 hide
  }

function isAllowed(name) {
    const def = windowDefinitions[name];
    return def && def.allowedStates.includes(currentHeaderState);
}
>>>>>>> 3631817 (show/hide ux improve final)

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
    constructor() {
        this.isUpdating = false;
        this._updateTimer = null;
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
        const header = windowPool.get('header');
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
        const ask = windowPool.get('ask');
        const listen = windowPool.get('listen');
        const askVisible = ask && ask.isVisible() && !ask.isDestroyed();
        const listenVisible = listen && listen.isVisible() && !listen.isDestroyed();

        if (!askVisible && !listenVisible) return;

        const PAD_H = 12;
        const PAD_V = -6;

        /* ① 헤더 중심 X를 "디스플레이 기준 상대좌표"로 변환  */
        const headerCenterXRel = headerBounds.x - workAreaX + headerBounds.width / 2;

        let askBounds = askVisible ? ask.getBounds() : null;
        let listenBounds = listenVisible ? listen.getBounds() : null;

        /* ------------------------------------------------- */
        /* 두 창 모두 보이는 경우 */
        /* ------------------------------------------------- */
        if (askVisible && listenVisible) {
            const combinedWidth = listenBounds.width + PAD_H + askBounds.width;

            /* ② 모든 X 좌표를 상대좌표로 계산 */
            let groupStartXRel = headerCenterXRel - combinedWidth / 2;
            let listenXRel = groupStartXRel;
            let askXRel = groupStartXRel + listenBounds.width + PAD_H;

            /* 좌우 화면 여백 클램프 – 역시 상대좌표로 */
            if (listenXRel < PAD_H) {
                listenXRel = PAD_H;
                askXRel = listenXRel + listenBounds.width + PAD_H;
            }
            if (askXRel + askBounds.width > screenWidth - PAD_H) {
                askXRel = screenWidth - PAD_H - askBounds.width;
                listenXRel = askXRel - listenBounds.width - PAD_H;
            }

            /* Y 좌표는 이미 상대값으로 계산돼 있음 */
            let yRel;
            switch (strategy.primary) {
                case 'below':
                    yRel = headerBounds.y - workAreaY + headerBounds.height + PAD_V;
                    break;
                case 'above':
                    yRel = headerBounds.y - workAreaY - Math.max(askBounds.height, listenBounds.height) - PAD_V;
                    break;
                default:
                    yRel = headerBounds.y - workAreaY + headerBounds.height + PAD_V;
                    break;
            }

            /* ③ setBounds 직전에 workAreaX/Y를 더해 절대좌표로 변환 */
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

            /* ------------------------------------------------- */
            /* 하나만 보이는 경우 */
            /* ------------------------------------------------- */
        } else {
            const win = askVisible ? ask : listen;
            const winBounds = askVisible ? askBounds : listenBounds;

            /* X, Y 둘 다 상대좌표로 계산 */
            let xRel = headerCenterXRel - winBounds.width / 2;
            let yRel;
            switch (strategy.primary) {
                case 'below':
                    yRel = headerBounds.y - workAreaY + headerBounds.height + PAD_V;
                    break;
                case 'above':
                    yRel = headerBounds.y - workAreaY - winBounds.height - PAD_V;
                    break;
                default:
                    yRel = headerBounds.y - workAreaY + headerBounds.height + PAD_V;
                    break;
            }

            /* 화면 경계 클램프 */
            xRel = Math.max(PAD_H, Math.min(screenWidth - winBounds.width - PAD_H, xRel));
            yRel = Math.max(PAD_V, Math.min(screenHeight - winBounds.height - PAD_V, yRel));

            /* 절대좌표로 변환 후 배치 */
            win.setBounds({
                x: Math.round(xRel + workAreaX),
                y: Math.round(yRel + workAreaY),
                width: winBounds.width,
                height: winBounds.height,
            });
        }
    }

    positionSettingsWindow(headerBounds, strategy, screenWidth, screenHeight) {
        const settings = windowPool.get('settings');
        if (!settings?.getBounds || !settings.isVisible()) return;

        // if (settings.__lockedByButton) return;
        if (settings.__lockedByButton) {
            const headerDisplay = getCurrentDisplay(windowPool.get('header'));
            const settingsDisplay = getCurrentDisplay(settings);
            if (headerDisplay.id !== settingsDisplay.id) {
                settings.__lockedByButton = false;
            } else {
                return; // 같은 화면이면 그대로 둔다
            }
        }

        const settingsBounds = settings.getBounds();
        const PAD = 5;

        const buttonPadding = 17;
        let x = headerBounds.x + headerBounds.width - settingsBounds.width - buttonPadding;
        let y = headerBounds.y + headerBounds.height + PAD;

        const otherVisibleWindows = [];
        ['listen', 'ask'].forEach(name => {
            const win = windowPool.get(name);
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

        // console.log(`[Layout] Settings positioned at (${x}, ${y}) ${hasOverlap ? '(adjusted for overlap)' : '(default position)'}`);
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
        const window = windowPool.get(windowName);
        return window && !window.isDestroyed() && window.isVisible();
    }

    destroy() {}
}

class SmoothMovementManager {
    constructor() {
        this.stepSize = 80;
        this.animationDuration = 300;
        this.headerPosition = { x: 0, y: 0 };
        this.isAnimating = false;
        this.hiddenPosition = null;
        this.lastVisiblePosition = null;
        this.currentDisplayId = null;
    }

    moveToDisplay(displayId) {
        const header = windowPool.get('header');
        if (!header || !header.isVisible() || this.isAnimating) return;

        const targetDisplay = getDisplayById(displayId);
        if (!targetDisplay) return;

        const currentBounds = header.getBounds();
        const currentDisplay = getCurrentDisplay(header);

        if (currentDisplay.id === targetDisplay.id) {
            console.log('[Movement] Already on target display');
            return;
        }

        const relativeX = (currentBounds.x - currentDisplay.workArea.x) / currentDisplay.workAreaSize.width;
        const relativeY = (currentBounds.y - currentDisplay.workArea.y) / currentDisplay.workAreaSize.height;

        const targetX = targetDisplay.workArea.x + targetDisplay.workAreaSize.width * relativeX;
        const targetY = targetDisplay.workArea.y + targetDisplay.workAreaSize.height * relativeY;

        const finalX = Math.max(
            targetDisplay.workArea.x,
            Math.min(targetDisplay.workArea.x + targetDisplay.workAreaSize.width - currentBounds.width, targetX)
        );
        const finalY = Math.max(
            targetDisplay.workArea.y,
            Math.min(targetDisplay.workArea.y + targetDisplay.workAreaSize.height - currentBounds.height, targetY)
        );

        this.headerPosition = { x: currentBounds.x, y: currentBounds.y };
        this.animateToPosition(header, finalX, finalY);

        this.currentDisplayId = targetDisplay.id;
    }

    hideToEdge(edge, callback, { instant = false } = {}) {
        const header = windowPool.get('header');
        if (!header || header.isDestroyed()) {
          if (typeof callback === 'function') callback();
          return;
        }
      
        const { x, y } = header.getBounds();
        this.lastVisiblePosition = { x, y };
        this.hiddenPosition     = { edge };
      
        // header.webContents.send('window-hide-animation');
      
        // setTimeout(() => {
        //   if (!header.isDestroyed()) header.hide();
        //   if (typeof callback === 'function') callback();
        // }, 5);
        if (instant) {
            header.hide();
            callback?.();
            return;
        }

        header.webContents.send('window-hide-animation');
      
        setTimeout(() => {
          if (!header.isDestroyed()) header.hide();
          if (typeof callback === 'function') callback();
        }, 5);
    }
      
      showFromEdge(callback) {
        const header = windowPool.get('header');
        if (!header || header.isDestroyed()) {
          if (typeof callback === 'function') callback();
          return;
        }
      
        // 숨기기 전에 기억해둔 위치 복구
        if (this.lastVisiblePosition) {
          header.setPosition(
            this.lastVisiblePosition.x,
            this.lastVisiblePosition.y,
            false   // animate: false
          );
        }
      
        header.show();
        header.webContents.send('window-show-animation');
      
        // 내부 상태 초기화
        this.hiddenPosition      = null;
        this.lastVisiblePosition = null;
      
        if (typeof callback === 'function') callback();
    }

    moveStep(direction) {
        const header = windowPool.get('header');
        if (!header || !header.isVisible() || this.isAnimating) return;

        console.log(`[Movement] Step ${direction}`);

        const currentBounds = header.getBounds();
        this.headerPosition = { x: currentBounds.x, y: currentBounds.y };

        let targetX = this.headerPosition.x;
        let targetY = this.headerPosition.y;

        switch (direction) {
            case 'left':
                targetX -= this.stepSize;
                break;
            case 'right':
                targetX += this.stepSize;
                break;
            case 'up':
                targetY -= this.stepSize;
                break;
            case 'down':
                targetY += this.stepSize;
                break;
            default:
                return;
        }

        const displays = screen.getAllDisplays();
        let validPosition = false;

        for (const display of displays) {
            const { x, y, width, height } = display.workArea;
            const headerBounds = header.getBounds();

            if (targetX >= x && targetX + headerBounds.width <= x + width && targetY >= y && targetY + headerBounds.height <= y + height) {
                validPosition = true;
                break;
            }
        }

        if (!validPosition) {
            const nearestDisplay = screen.getDisplayNearestPoint({ x: targetX, y: targetY });
            const { x, y, width, height } = nearestDisplay.workArea;
            const headerBounds = header.getBounds();

            targetX = Math.max(x, Math.min(x + width - headerBounds.width, targetX));
            targetY = Math.max(y, Math.min(y + height - headerBounds.height, targetY));
        }

        if (targetX === this.headerPosition.x && targetY === this.headerPosition.y) {
            console.log(`[Movement] Already at boundary for ${direction}`);
            return;
        }

        this.animateToPosition(header, targetX, targetY);
    }

    animateToPosition(header, targetX, targetY) {
        this.isAnimating = true;

        const startX = this.headerPosition.x;
        const startY = this.headerPosition.y;
        const startTime = Date.now();

        if (!Number.isFinite(targetX) || !Number.isFinite(targetY) || !Number.isFinite(startX) || !Number.isFinite(startY)) {
            console.error('[Movement] Invalid position values:', { startX, startY, targetX, targetY });
            this.isAnimating = false;
            return;
        }

        const animate = () => {
            if (!header || header.isDestroyed()) {
                this.isAnimating = false;
                return;
            }

            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / this.animationDuration, 1);

            const eased = 1 - Math.pow(1 - progress, 3);

            const currentX = startX + (targetX - startX) * eased;
            const currentY = startY + (targetY - startY) * eased;

            if (!Number.isFinite(currentX) || !Number.isFinite(currentY)) {
                console.error('[Movement] Invalid animation values:', { currentX, currentY, progress, eased });
                this.isAnimating = false;
                return;
            }

            header.setPosition(Math.round(currentX), Math.round(currentY));

            if (progress < 1) {
                setTimeout(animate, 8);
            } else {
                this.headerPosition = { x: targetX, y: targetY };
                if (Number.isFinite(targetX) && Number.isFinite(targetY)) {
                    header.setPosition(Math.round(targetX), Math.round(targetY));
                } else {
                    console.warn('[Movement] Final position invalid, skip setPosition:', { targetX, targetY });
                }
                this.isAnimating = false;

                updateLayout();

                console.log(`[Movement] Step completed to (${targetX}, ${targetY})`);
            }
        };

        animate();
    }

    moveToEdge(direction) {
        const header = windowPool.get('header');
        if (!header || !header.isVisible() || this.isAnimating) return;

        console.log(`[Movement] Move to edge: ${direction}`);

        const display = getCurrentDisplay(header);
        const { width, height } = display.workAreaSize;
        const { x: workAreaX, y: workAreaY } = display.workArea;
        const headerBounds = header.getBounds();

        const currentBounds = header.getBounds();
        let targetX = currentBounds.x;
        let targetY = currentBounds.y;

        switch (direction) {
            case 'left':
                targetX = workAreaX;
                break;
            case 'right':
                targetX = workAreaX + width - headerBounds.width;
                break;
            case 'up':
                targetY = workAreaY;
                break;
            case 'down':
                targetY = workAreaY + height - headerBounds.height;
                break;
        }

        this.headerPosition = { x: currentBounds.x, y: currentBounds.y };

        this.isAnimating = true;
        const startX = this.headerPosition.x;
        const startY = this.headerPosition.y;
        const duration = 400;
        const startTime = Date.now(); // 이 줄을 animate 함수 정의 전으로 이동

        if (!Number.isFinite(targetX) || !Number.isFinite(targetY) || !Number.isFinite(startX) || !Number.isFinite(startY)) {
            console.error('[Movement] Invalid edge position values:', { startX, startY, targetX, targetY });
            this.isAnimating = false;
            return;
        }

        const animate = () => {
            if (!header || header.isDestroyed()) {
                this.isAnimating = false;
                return;
            }

            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const eased = 1 - Math.pow(1 - progress, 4);

            const currentX = startX + (targetX - startX) * eased;
            const currentY = startY + (targetY - startY) * eased;

            if (!Number.isFinite(currentX) || !Number.isFinite(currentY)) {
                console.error('[Movement] Invalid edge animation values:', { currentX, currentY, progress, eased });
                this.isAnimating = false;
                return;
            }

            header.setPosition(Math.round(currentX), Math.round(currentY));

            if (progress < 1) {
                setTimeout(animate, 8);
            } else {
                if (Number.isFinite(targetX) && Number.isFinite(targetY)) {
                    header.setPosition(Math.round(targetX), Math.round(targetY));
                }
                this.headerPosition = { x: targetX, y: targetY };
                this.isAnimating = false;

                updateLayout();

                console.log(`[Movement] Edge movement completed: ${direction}`);
            }
        };

        animate();
    }

    handleKeyPress(direction) {}

    handleKeyRelease(direction) {}

    forceStopMovement() {
        this.isAnimating = false;
    }

    destroy() {
        this.isAnimating = false;
        console.log('[Movement] Destroyed');
    }
}

// layoutManager and movementManager are declared above

function toggleAllWindowsVisibility() {
    const header = windowPool.get('header');
    if (!header) return;

    if (header.isVisible()) {
        console.log('[Visibility] Smart hiding - calculating nearest edge');

        const headerBounds = header.getBounds();
        const display = screen.getPrimaryDisplay();
        const { width: screenWidth, height: screenHeight } = display.workAreaSize;

        const centerX = headerBounds.x + headerBounds.width / 2;
        const centerY = headerBounds.y + headerBounds.height / 2;

        const distances = {
            top: centerY,
            bottom: screenHeight - centerY,
            left: centerX,
            right: screenWidth - centerX,
        };

        const nearestEdge = Object.keys(distances).reduce((nearest, edge) => (distances[edge] < distances[nearest] ? edge : nearest));

        console.log(`[Visibility] Nearest edge: ${nearestEdge} (distance: ${distances[nearestEdge].toFixed(1)}px)`);

        lastVisibleWindows.clear();
        lastVisibleWindows.add('header');

        windowPool.forEach((win, name) => {
            if (win.isVisible()) {
                lastVisibleWindows.add(name);
                if (name !== 'header') {
                    // win.webContents.send('window-hide-animation');
                    // setTimeout(() => {
                    //     if (!win.isDestroyed()) {
                    //         win.hide();
                    //     }
                    // }, 200);
                    instantHideWindow(win);
                }
            }
        });

        console.log('[Visibility] Visible windows before hide:', Array.from(lastVisibleWindows));

        movementManager.hideToEdge(nearestEdge, () => {
            header.hide();
            console.log('[Visibility] Smart hide completed');
        }, { instant: true });
    } else {
        header.webContents.send('cancel-animations');
        windowPool.forEach((win, name) => {
            if (name !== 'header') win.webContents.send('cancel-animations');
        });
        
        console.log('[Visibility] Smart showing from hidden position');
        console.log('[Visibility] Restoring windows:', Array.from(lastVisibleWindows));

        header.show();

        movementManager.showFromEdge(() => {
            lastVisibleWindows.forEach(name => {
                if (name === 'header') return;
                const win = windowPool.get(name);
                if (win && !win.isDestroyed()) {
                    win.show();
                    win.webContents.send('window-show-animation');
                }
            });

            setImmediate(updateLayout);
            setTimeout(updateLayout, 120);

            console.log('[Visibility] Smart show completed');
        });
    }
}


function createWindows() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { y: workAreaY, width: screenWidth } = primaryDisplay.workArea;

    const initialX = Math.round((screenWidth - DEFAULT_WINDOW_WIDTH) / 2);
    const initialY = workAreaY + 21;
    movementManager = new SmoothMovementManager(windowPool, getDisplayById, getCurrentDisplay, updateLayout);
    
    const header = new BrowserWindow({
        width: DEFAULT_WINDOW_WIDTH,
        height: HEADER_HEIGHT,
        x: initialX,
        y: initialY,
        frame: false,
        transparent: true,
        vibrancy: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        hiddenInMissionControl: true,
        resizable: false,
        focusable: true,
        acceptFirstMouse: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            backgroundThrottling: false,
            webSecurity: false,
        },
    });
    if (process.platform === 'darwin') {
        header.setWindowButtonVisibility(false);
    }
    const headerLoadOptions = {};
    if (!shouldUseLiquidGlass) {
        header.loadFile(path.join(__dirname, '../app/header.html'), headerLoadOptions);
    }
    else {
        headerLoadOptions.query = { glass: 'true' };
        header.loadFile(path.join(__dirname, '../app/header.html'), headerLoadOptions);
        header.webContents.once('did-finish-load', () => {
            const viewId = liquidGlass.addView(header.getNativeWindowHandle(), {
                cornerRadius: 12,
                tintColor: '#FF00001A', // Red tint
                opaque: false, 
            });
            if (viewId !== -1) {
                liquidGlass.unstable_setVariant(viewId, 2); 
                // liquidGlass.unstable_setScrim(viewId, 1); 
                // liquidGlass.unstable_setSubdued(viewId, 1);
            }
        });
    }
    windowPool.set('header', header);
    layoutManager = new WindowLayoutManager();

    header.webContents.once('dom-ready', () => {
        loadAndRegisterShortcuts(movementManager);
    });

    setupIpcHandlers(movementManager);

    if (currentHeaderState === 'main') {
        createFeatureWindows(header);
    }

    header.setContentProtection(isContentProtectionOn);
    header.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    
    // Open DevTools in development
    if (!app.isPackaged) {
        header.webContents.openDevTools({ mode: 'detach' });
    }

    header.on('focus', () => {
        console.log('[WindowManager] Header gained focus');
    });

    header.on('blur', () => {
        console.log('[WindowManager] Header lost focus');
    });

    header.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'mouseDown') {
            const target = input.target;
            if (target && (target.includes('input') || target.includes('apikey'))) {
                header.focus();
            }
        }
    });

    header.on('resize', updateLayout);

    // header.webContents.once('dom-ready', () => {
    //     loadAndRegisterShortcuts();
    // });

    ipcMain.handle('toggle-all-windows-visibility', () => {
        try {
            toggleAllWindowsVisibility(movementManager);
        } catch (error) {
            console.error('[WindowManager] Error in toggle-all-windows-visibility:', error);
            toggleState.isToggling = false;
        }
    });

    ipcMain.handle('toggle-feature', async (event, featureName) => {
        try {
            const header = windowPool.get('header');
            if (!header || header.isDestroyed()) {
                console.error('[WindowManager] Header window not available');
                return;
            }
            
            if (!windowPool.get(featureName) && currentHeaderState === 'main') {
                createFeatureWindows(header);
            }

            const windowToToggle = windowPool.get(featureName);

            if (windowToToggle) {
                if (featureName === 'listen') {
                    const listenService = global.listenService;
                    if (listenService && listenService.isSessionActive()) {
                        console.log('[WindowManager] Listen session is active, closing it via toggle.');
                        await listenService.closeSession();
                        return;
                    }
                }
                console.log(`[WindowManager] Toggling feature: ${featureName}`);
            }

            if (featureName === 'ask') {
                let askWindow = windowPool.get('ask');

                if (!askWindow || askWindow.isDestroyed()) {
                    console.log('[WindowManager] Ask window not found, creating new one');
                    return;
                }

                if (askWindow.isVisible()) {
                    try {
                        const hasResponse = await askWindow.webContents.executeJavaScript(`
                            (() => {
                                try {
                                    // PickleGlassApp의 Shadow DOM 내부로 접근
                                    const pickleApp = document.querySelector('pickle-glass-app');
                                    if (!pickleApp || !pickleApp.shadowRoot) {
                                        console.log('PickleGlassApp not found');
                                        return false;
                                    }
                                    
                                    // PickleGlassApp의 shadowRoot 내부에서 ask-view 찾기
                                    const askView = pickleApp.shadowRoot.querySelector('ask-view');
                                    if (!askView) {
                                        console.log('AskView not found in PickleGlassApp shadow DOM');
                                        return false;
                                    }
                                    
                                    console.log('AskView found, checking state...');
                                    console.log('currentResponse:', askView.currentResponse);
                                    console.log('isLoading:', askView.isLoading);
                                    console.log('isStreaming:', askView.isStreaming);
                                    
                                    const hasContent = !!(askView.currentResponse || askView.isLoading || askView.isStreaming);
                                    
                                    if (!hasContent && askView.shadowRoot) {
                                        const responseContainer = askView.shadowRoot.querySelector('.response-container');
                                        if (responseContainer && !responseContainer.classList.contains('hidden')) {
                                            const textContent = responseContainer.textContent.trim();
                                            const hasActualContent = textContent && 
                                                !textContent.includes('Ask a question to see the response here') &&
                                                textContent.length > 0;
                                            console.log('Response container content check:', hasActualContent);
                                            return hasActualContent;
                                        }
                                    }
                                    
                                    return hasContent;
                                } catch (error) {
                                    console.error('Error checking AskView state:', error);
                                    return false;
                                }
                            })()
                        `);

                        console.log(`[WindowManager] Ask window visible, hasResponse: ${hasResponse}`);

                        if (hasResponse) {
                            askWindow.webContents.send('toggle-text-input');
                            console.log('[WindowManager] Sent toggle-text-input command');
                        } else {
                            console.log('[WindowManager] No response found, closing window');
                            askWindow.webContents.send('window-hide-animation');

                            setTimeout(() => {
                                if (!askWindow.isDestroyed()) {
                                    askWindow.hide();
                                    updateLayout();
                                }
                            }, 250);
                        }
                    } catch (error) {
                        console.error('[WindowManager] Error checking Ask window state:', error);
                        console.log('[WindowManager] Falling back to toggle text input');
                        askWindow.webContents.send('toggle-text-input');
                    }
                } else {
                    console.log('[WindowManager] Showing hidden Ask window');
                    askWindow.show();
                    updateLayout();
                    askWindow.webContents.send('window-show-animation');
                    askWindow.webContents.send('window-did-show');
                }
            } else {
                const windowToToggle = windowPool.get(featureName);

                if (windowToToggle) {
                    if (windowToToggle.isDestroyed()) {
                        console.error(`Window ${featureName} is destroyed, cannot toggle`);
                        return;
                    }

                    if (windowToToggle.isVisible()) {
                        if (featureName === 'settings') {
                            windowToToggle.webContents.send('settings-window-hide-animation');
                        } else {
                            windowToToggle.webContents.send('window-hide-animation');
                        }

                        setTimeout(() => {
                            if (!windowToToggle.isDestroyed()) {
                                windowToToggle.hide();
                                updateLayout();
                            }
                        }, 250);
                    } else {
                        try {
                            windowToToggle.show();
                            updateLayout();

                            if (featureName === 'listen') {
                                windowToToggle.webContents.send('start-listening-session');
                            }

                            windowToToggle.webContents.send('window-show-animation');
                        } catch (e) {
                            console.error('Error showing window:', e);
                        }
                    }
                } else {
                    console.error(`Window not found for feature: ${featureName}`);
                    console.error('Available windows:', Array.from(windowPool.keys()));
                }
            }
        } catch (error) {
            console.error('[WindowManager] Error in toggle-feature:', error);
        }
    });

    ipcMain.handle('send-question-to-ask', (event, question) => {
        const askWindow = windowPool.get('ask');
        if (askWindow && !askWindow.isDestroyed()) {
            console.log('📨 Main process: Sending question to AskView', question);
            askWindow.webContents.send('receive-question-from-assistant', question);
            return { success: true };
        } else {
            console.error('❌ Cannot find AskView window');
            return { success: false, error: 'AskView window not found' };
        }
    });

    ipcMain.handle('adjust-window-height', (event, targetHeight) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (senderWindow) {
            const wasResizable = senderWindow.isResizable();
            if (!wasResizable) {
                senderWindow.setResizable(true);
            }

            const currentBounds = senderWindow.getBounds();
            const minHeight = senderWindow.getMinimumSize()[1];
            const maxHeight = senderWindow.getMaximumSize()[1];
            
            let adjustedHeight;
            if (maxHeight === 0) {
                adjustedHeight = Math.max(minHeight, targetHeight);
            } else {
                adjustedHeight = Math.max(minHeight, Math.min(maxHeight, targetHeight));
            }
            
            senderWindow.setSize(currentBounds.width, adjustedHeight, false);

            if (!wasResizable) {
                senderWindow.setResizable(false);
            }

            updateLayout();
        }
    });

    ipcMain.on('session-did-close', () => {
        const listenWindow = windowPool.get('listen');
        if (listenWindow && listenWindow.isVisible()) {
            console.log('[WindowManager] Session closed, hiding listen window.');
            listenWindow.hide();
        }
    });

    // setupIpcHandlers();

    return windowPool;
}

function loadAndRegisterShortcuts(movementManager) {
    const defaultKeybinds = getDefaultKeybinds();
    const header = windowPool.get('header');
    const sendToRenderer = (channel, ...args) => {
        windowPool.forEach(win => {
            try {
                if (win && !win.isDestroyed()) {
                    win.webContents.send(channel, ...args);
                }
            } catch (e) {}
        });
    };


    if (!header) {
        return updateGlobalShortcuts(defaultKeybinds, undefined, sendToRenderer, movementManager);
    }

    header.webContents
        .executeJavaScript(`(() => localStorage.getItem('customKeybinds'))()`)
        .then(saved => (saved ? JSON.parse(saved) : {}))
        .then(savedKeybinds => {
            const keybinds = { ...defaultKeybinds, ...savedKeybinds };
            updateGlobalShortcuts(keybinds, header, sendToRenderer, movementManager);
        })
        .catch(() => updateGlobalShortcuts(defaultKeybinds, header, sendToRenderer, movementManager));
}

function updateLayout() {
    layoutManager.updateLayout();
}

function setupIpcHandlers(movementManager) {
    screen.on('display-added', (event, newDisplay) => {
        console.log('[Display] New display added:', newDisplay.id);
    });

    screen.on('display-removed', (event, oldDisplay) => {
        console.log('[Display] Display removed:', oldDisplay.id);
        const header = windowPool.get('header');
        if (header && getCurrentDisplay(header).id === oldDisplay.id) {
            const primaryDisplay = screen.getPrimaryDisplay();
            movementManager.moveToDisplay(primaryDisplay.id);
        }
    });

    screen.on('display-metrics-changed', (event, display, changedMetrics) => {
        console.log('[Display] Display metrics changed:', display.id, changedMetrics);
        updateLayout();
    });

    // 1. 스트리밍 데이터 조각(chunk)을 받아서 ask 창으로 전달
    ipcMain.on('ask-response-chunk', (event, { token }) => {
        const askWindow = windowPool.get('ask');
        if (askWindow && !askWindow.isDestroyed()) {
            // renderer.js가 보낸 토큰을 AskView.js로 그대로 전달합니다.
            askWindow.webContents.send('ask-response-chunk', { token });
        }
    });

    // 2. 스트리밍 종료 신호를 받아서 ask 창으로 전달
    ipcMain.on('ask-response-stream-end', () => {
        const askWindow = windowPool.get('ask');
        if (askWindow && !askWindow.isDestroyed()) {
            askWindow.webContents.send('ask-response-stream-end');
        }
    });

    ipcMain.on('show-window', (event, args) => {
        const { name, bounds } = typeof args === 'object' && args !== null ? args : { name: args, bounds: null };
        const win = windowPool.get(name);

        if (win && !win.isDestroyed()) {
            if (settingsHideTimer) {
                clearTimeout(settingsHideTimer);
                settingsHideTimer = null;
            }

            if (name === 'settings') {
                // Adjust position based on button bounds
                const header = windowPool.get('header');
                const headerBounds = header?.getBounds() ?? { x: 0, y: 0 };
                const settingsBounds = win.getBounds();

                const disp = getCurrentDisplay(header);
                const { x: waX, y: waY, width: waW, height: waH } = disp.workArea;

                let x = Math.round(headerBounds.x + (bounds?.x ?? 0) + (bounds?.width ?? 0) / 2 - settingsBounds.width / 2);
                let y = Math.round(headerBounds.y + (bounds?.y ?? 0) + (bounds?.height ?? 0) + 21);

                x = Math.max(waX + 10, Math.min(waX + waW - settingsBounds.width - 10, x));
                y = Math.max(waY + 10, Math.min(waY + waH - settingsBounds.height - 10, y));

                win.setBounds({ x, y });
                win.__lockedByButton = true;
                console.log(`[WindowManager] Positioning settings window at (${x}, ${y}) based on button bounds.`);
            }

            win.show();
            win.moveTop();

            if (name === 'settings') {
                win.setAlwaysOnTop(true);
            }
            // updateLayout();
        }
    });

    ipcMain.on('hide-window', (event, name) => {
        const window = windowPool.get(name);
        if (window && !window.isDestroyed()) {
            if (name === 'settings') {
                if (settingsHideTimer) {
                    clearTimeout(settingsHideTimer);
                }
                settingsHideTimer = setTimeout(() => {
                    // window.setAlwaysOnTop(false);
                    // window.hide();
                    if (window && !window.isDestroyed()) {
                        window.setAlwaysOnTop(false);
                        window.hide();
                    }
                    settingsHideTimer = null;
                }, 200);
            } else {
                window.hide();
            }
            window.__lockedByButton = false;
        }
    });

    ipcMain.on('cancel-hide-window', (event, name) => {
        if (name === 'settings' && settingsHideTimer) {
            clearTimeout(settingsHideTimer);
            settingsHideTimer = null;
        }
    });

    ipcMain.handle('hide-all', () => {
        windowPool.forEach(win => {
            if (win.isFocused()) return;
            win.hide();
        });
    });

    ipcMain.handle('quit-application', () => {
        app.quit();
    });

    ipcMain.handle('is-window-visible', (event, windowName) => {
        const window = windowPool.get(windowName);
        if (window && !window.isDestroyed()) {
            return window.isVisible();
        }
        return false;
    });


    ipcMain.handle('toggle-content-protection', () => {
        isContentProtectionOn = !isContentProtectionOn;
        console.log(`[Protection] Content protection toggled to: ${isContentProtectionOn}`);
        windowPool.forEach(win => {
            if (win && !win.isDestroyed()) {
                win.setContentProtection(isContentProtectionOn);
            }
        });
        return isContentProtectionOn;
    });

    ipcMain.handle('get-content-protection-status', () => {
        return isContentProtectionOn;
    });

    ipcMain.on('header-state-changed', (event, state) => {
        console.log(`[WindowManager] Header state changed to: ${state}`);
        currentHeaderState = state;

        if (state === 'main') {
            createFeatureWindows(windowPool.get('header'));
        } else {         // 'apikey' | 'permission'
            destroyFeatureWindows();
        }

        for (const [name, win] of windowPool) {
            if (!isAllowed(name) && !win.isDestroyed()) {
                win.hide();
            }
            if (isAllowed(name) && win.isVisible()) {
                win.show();
            }
        }

        const header = windowPool.get('header');
        if (header && !header.isDestroyed()) {
            header.webContents
                .executeJavaScript(`(() => localStorage.getItem('customKeybinds'))()`)
                .then(saved => {
                    const defaultKeybinds = getDefaultKeybinds();
                    const savedKeybinds = saved ? JSON.parse(saved) : {};
                    const keybinds = { ...defaultKeybinds, ...savedKeybinds };

                    const sendToRenderer = (channel, ...args) => {
                        windowPool.forEach(win => {
                            try {
                                if (win && !win.isDestroyed()) {
                                    win.webContents.send(channel, ...args);
                                }
                            } catch (e) {}
                        });
                    };

                    updateGlobalShortcuts(keybinds, header, sendToRenderer, movementManager);
                })
                .catch(console.error);
        }
    });

    ipcMain.on('update-keybinds', (event, newKeybinds) => {
        updateGlobalShortcuts(newKeybinds);
    });

    ipcMain.handle('open-login-page', () => {
        const webUrl = process.env.pickleglass_WEB_URL || 'http://localhost:3000';
        const personalizeUrl = `${webUrl}/personalize?desktop=true`;
        shell.openExternal(personalizeUrl);
        console.log('Opening personalization page:', personalizeUrl);
    });

    setupApiKeyIPC();

    ipcMain.handle('resize-window', () => {});

    ipcMain.handle('resize-for-view', () => {});

    ipcMain.handle('resize-header-window', (event, { width, height }) => {
        const header = windowPool.get('header');
        if (header) {
            const wasResizable = header.isResizable();
            if (!wasResizable) {
                header.setResizable(true);
            }

            const bounds = header.getBounds();
            const newX = bounds.x + Math.round((bounds.width - width) / 2);

            header.setBounds({ x: newX, y: bounds.y, width, height });

            if (!wasResizable) {
                header.setResizable(false);
            }
            return { success: true };
        }
        return { success: false, error: 'Header window not found' };
    });

    ipcMain.on('header-animation-complete', (event, state) => {
        const header = windowPool.get('header');
        if (!header) return;

        if (state === 'hidden') {
            header.hide();
        } else if (state === 'visible') {
            lastVisibleWindows.forEach(name => {
                if (name === 'header') return;
                const win = windowPool.get(name);
                if (win) win.show();
            });

            setImmediate(updateLayout);
            setTimeout(updateLayout, 120);
        }
    });

    ipcMain.handle('get-header-position', () => {
        const header = windowPool.get('header');
        if (header) {
            const [x, y] = header.getPosition();
            return { x, y };
        }
        return { x: 0, y: 0 };
    });

    ipcMain.handle('move-header', (event, newX, newY) => {
        const header = windowPool.get('header');
        if (header) {
            const currentY = newY !== undefined ? newY : header.getBounds().y;
            header.setPosition(newX, currentY, false);

            updateLayout();
        }
    });

    ipcMain.handle('move-header-to', (event, newX, newY) => {
        const header = windowPool.get('header');
        if (header) {
            const targetDisplay = screen.getDisplayNearestPoint({ x: newX, y: newY });
            const { x: workAreaX, y: workAreaY, width, height } = targetDisplay.workArea;
            const headerBounds = header.getBounds();

            const clampedX = Math.max(workAreaX, Math.min(workAreaX + width - headerBounds.width, newX));
            const clampedY = Math.max(workAreaY, Math.min(workAreaY + height - headerBounds.height, newY));

            header.setPosition(clampedX, clampedY, false);

            updateLayout();
        }
    });

    ipcMain.handle('move-window-step', (event, direction) => {
        if (movementManager) {
            movementManager.moveStep(direction);
        }
    });

    ipcMain.handle('force-close-window', (event, windowName) => {
        const window = windowPool.get(windowName);
        if (window && !window.isDestroyed()) {
            console.log(`[WindowManager] Force closing window: ${windowName}`);

            window.webContents.send('window-hide-animation');

            setTimeout(() => {
                if (!window.isDestroyed()) {
                    window.hide();
                    updateLayout();
                }
            }, 250);
        }
    });

    ipcMain.handle('start-screen-capture', async () => {
        try {
            isCapturing = true;
            console.log('Starting screen capture in main process');
            return { success: true };
        } catch (error) {
            console.error('Failed to start screen capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('stop-screen-capture', async () => {
        try {
            isCapturing = false;
            lastScreenshot = null;
            console.log('Stopped screen capture in main process');
            return { success: true };
        } catch (error) {
            console.error('Failed to stop screen capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('capture-screenshot', async (event, options = {}) => {
        return captureScreenshot(options);
    });

    ipcMain.handle('get-current-screenshot', async event => {
        try {
            if (lastScreenshot && Date.now() - lastScreenshot.timestamp < 1000) {
                console.log('Returning cached screenshot');
                return {
                    success: true,
                    base64: lastScreenshot.base64,
                    width: lastScreenshot.width,
                    height: lastScreenshot.height,
                };
            }
            return {
                success: false,
                error: 'No screenshot available',
            };
        } catch (error) {
            console.error('Failed to get current screenshot:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle('firebase-logout', async () => {
        console.log('[WindowManager] Received request to log out.');
        
        await authService.signOut();
        await setApiKey(null);
        
        windowPool.forEach(win => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('api-key-removed');
            }
        });
    });
    ipcMain.handle('check-system-permissions', async () => {
        const { systemPreferences } = require('electron');
        const permissions = {
            microphone: 'unknown',
            screen: 'unknown',
            needsSetup: true
        };

        try {
            if (process.platform === 'darwin') {
                // Check microphone permission on macOS
                const micStatus = systemPreferences.getMediaAccessStatus('microphone');
                console.log('[Permissions] Microphone status:', micStatus);
                permissions.microphone = micStatus;

                // Check screen recording permission using the system API
                const screenStatus = systemPreferences.getMediaAccessStatus('screen');
                console.log('[Permissions] Screen status:', screenStatus);
                permissions.screen = screenStatus;

                permissions.needsSetup = micStatus !== 'granted' || screenStatus !== 'granted';
            } else {
                permissions.microphone = 'granted';
                permissions.screen = 'granted';
                permissions.needsSetup = false;
            }

            console.log('[Permissions] System permissions status:', permissions);
            return permissions;
        } catch (error) {
            console.error('[Permissions] Error checking permissions:', error);
            return {
                microphone: 'unknown',
                screen: 'unknown',
                needsSetup: true,
                error: error.message
            };
        }
    });

    ipcMain.handle('request-microphone-permission', async () => {
        if (process.platform !== 'darwin') {
            return { success: true };
        }

        const { systemPreferences } = require('electron');
        try {
            const status = systemPreferences.getMediaAccessStatus('microphone');
            console.log('[Permissions] Microphone status:', status);
            if (status === 'granted') {
                return { success: true, status: 'granted' };
            }

            // Req mic permission
            const granted = await systemPreferences.askForMediaAccess('microphone');
            return { 
                success: granted, 
                status: granted ? 'granted' : 'denied'
            };
        } catch (error) {
            console.error('[Permissions] Error requesting microphone permission:', error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    });

    ipcMain.handle('open-system-preferences', async (event, section) => {
        if (process.platform !== 'darwin') {
            return { success: false, error: 'Not supported on this platform' };
        }

        try {
            if (section === 'screen-recording') {
                // First trigger screen capture request to register the app in system preferences
                try {
                    console.log('[Permissions] Triggering screen capture request to register app...');
                    await desktopCapturer.getSources({ 
                        types: ['screen'], 
                        thumbnailSize: { width: 1, height: 1 } 
                    });
                    console.log('[Permissions] App registered for screen recording');
                } catch (captureError) {
                    console.log('[Permissions] Screen capture request triggered (expected to fail):', captureError.message);
                }
                
                // Then open system preferences
                // await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
            }
            // if (section === 'microphone') {
            //     await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
            // }
            return { success: true };
        } catch (error) {
            console.error('[Permissions] Error opening system preferences:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('mark-permissions-completed', async () => {
        try {
            // This is a system-level setting, not user-specific.
            await systemSettingsRepository.markPermissionsAsCompleted();
            console.log('[Permissions] Marked permissions as completed');
            return { success: true };
        } catch (error) {
            console.error('[Permissions] Error marking permissions as completed:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('check-permissions-completed', async () => {
        try {
            const completed = await systemSettingsRepository.checkPermissionsCompleted();
            console.log('[Permissions] Permissions completed status:', completed);
            return completed;
        } catch (error) {
            console.error('[Permissions] Error checking permissions completed status:', error);
            return false;
        }
    });

    ipcMain.handle('close-ask-window-if-empty', async () => {
        const askWindow = windowPool.get('ask');
        if (askWindow && !askWindow.isFocused()) {
            askWindow.hide();
        }
    });
}

async function setApiKey(apiKey, provider = 'openai') {
    console.log('[WindowManager] Persisting API key and provider to DB');

    try {
        await userRepository.saveApiKey(apiKey, authService.getCurrentUserId(), provider);
        console.log('[WindowManager] API key and provider saved to SQLite');
        
        // Notify authService that the key status may have changed
        await authService.updateApiKeyStatus();
    } catch (err) {
        console.error('[WindowManager] Failed to save API key to SQLite:', err);
    }

    windowPool.forEach(win => {
        if (win && !win.isDestroyed()) {
            const js = apiKey ? `
                localStorage.setItem('openai_api_key', ${JSON.stringify(apiKey)});
                localStorage.setItem('ai_provider', ${JSON.stringify(provider)});
            ` : `
                localStorage.removeItem('openai_api_key');
                localStorage.removeItem('ai_provider');
            `;
            win.webContents.executeJavaScript(js).catch(() => {});
        }
    });
}

async function getStoredApiKey() {
    const userId = authService.getCurrentUserId();
    if (!userId) return null;
    const user = await userRepository.getById(userId);
    return user?.api_key || null;
}

async function getStoredProvider() {
    const userId = authService.getCurrentUserId();
    if (!userId) return 'openai';
    const user = await userRepository.getById(userId);
    return user?.provider || 'openai';
}

function setupApiKeyIPC() {
    const { ipcMain } = require('electron');

    // Both handlers now do the same thing: fetch the key from the source of truth.
    ipcMain.handle('get-stored-api-key', getStoredApiKey);

    ipcMain.handle('api-key-validated', async (event, data) => {
        console.log('[WindowManager] API key validation completed, saving...');
        
        // Support both old format (string) and new format (object)
        const apiKey = typeof data === 'string' ? data : data.apiKey;
        const provider = typeof data === 'string' ? 'openai' : (data.provider || 'openai');
        
        await setApiKey(apiKey, provider);

        windowPool.forEach((win, name) => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('api-key-validated', { apiKey, provider });
            }
        });

        return { success: true };
    });

    ipcMain.handle('remove-api-key', async () => {
        console.log('[WindowManager] API key removal requested');
        await setApiKey(null);

        windowPool.forEach((win, name) => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('api-key-removed');
            }
        });

        const settingsWindow = windowPool.get('settings');
        if (settingsWindow && settingsWindow.isVisible()) {
            settingsWindow.hide();
            console.log('[WindowManager] Settings window hidden after clearing API key.');
        }

        return { success: true };
    });
    
    ipcMain.handle('get-ai-provider', getStoredProvider);

    console.log('[WindowManager] API key related IPC handlers registered (SQLite-backed)');
}


function getDefaultKeybinds() {
    const isMac = process.platform === 'darwin';
    return {
        moveUp: isMac ? 'Cmd+Up' : 'Ctrl+Up',
        moveDown: isMac ? 'Cmd+Down' : 'Ctrl+Down',
        moveLeft: isMac ? 'Cmd+Left' : 'Ctrl+Left',
        moveRight: isMac ? 'Cmd+Right' : 'Ctrl+Right',
        toggleVisibility: isMac ? 'Cmd+\\' : 'Ctrl+\\',
        toggleClickThrough: isMac ? 'Cmd+M' : 'Ctrl+M',
        nextStep: isMac ? 'Cmd+Enter' : 'Ctrl+Enter',
        manualScreenshot: isMac ? 'Cmd+Shift+S' : 'Ctrl+Shift+S',
        previousResponse: isMac ? 'Cmd+[' : 'Ctrl+[',
        nextResponse: isMac ? 'Cmd+]' : 'Ctrl+]',
        scrollUp: isMac ? 'Cmd+Shift+Up' : 'Ctrl+Shift+Up',
        scrollDown: isMac ? 'Cmd+Shift+Down' : 'Ctrl+Shift+Down',
    };
}

function updateGlobalShortcuts(keybinds, mainWindow, sendToRenderer, movementManager) {
    console.log('Updating global shortcuts with:', keybinds);

    // Unregister all existing shortcuts
    globalShortcut.unregisterAll();

    if (movementManager) {
        movementManager.destroy();nd
    }
    movementManager = new SmoothMovementManager();

    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Cmd' : 'Ctrl';

    if (keybinds.toggleVisibility) {
        try {
            globalShortcut.register(keybinds.toggleVisibility, () => toggleAllWindowsVisibility(movementManager));
            console.log(`Registered toggleVisibility: ${keybinds.toggleVisibility}`);
        } catch (error) {
            console.error(`Failed to register toggleVisibility (${keybinds.toggleVisibility}):`, error);
        }
    }

    const displays = screen.getAllDisplays();
    if (displays.length > 1) {
        displays.forEach((display, index) => {
            const key = `${modifier}+Shift+${index + 1}`;
            try {
                globalShortcut.register(key, () => {
                    movementManager.moveToDisplay(display.id);
                });
                console.log(`Registered display switch shortcut: ${key} -> Display ${index + 1}`);
            } catch (error) {
                console.error(`Failed to register display switch ${key}:`, error);
            }
        });
    }

    if (currentHeaderState === 'apikey') {
        console.log('ApiKeyHeader is active, skipping conditional shortcuts');
        return;
    }

    const directions = [
        { key: `${modifier}+Left`, direction: 'left' },
        { key: `${modifier}+Right`, direction: 'right' },
        { key: `${modifier}+Up`, direction: 'up' },
        { key: `${modifier}+Down`, direction: 'down' },
    ];

    directions.forEach(({ key, direction }) => {
        try {
            globalShortcut.register(key, () => {
                const header = windowPool.get('header');
                if (header && header.isVisible()) {
                    movementManager.moveStep(direction);
                }
            });
            console.log(`Registered global shortcut: ${key} -> ${direction}`);
        } catch (error) {
            console.error(`Failed to register ${key}:`, error);
        }
    });

    const edgeDirections = [
        { key: `${modifier}+Shift+Left`, direction: 'left' },
        { key: `${modifier}+Shift+Right`, direction: 'right' },
        { key: `${modifier}+Shift+Up`, direction: 'up' },
        { key: `${modifier}+Shift+Down`, direction: 'down' },
    ];

    edgeDirections.forEach(({ key, direction }) => {
        try {
            globalShortcut.register(key, () => {
                const header = windowPool.get('header');
                if (header && header.isVisible()) {
                    movementManager.moveToEdge(direction);
                }
            });
            console.log(`Registered global shortcut: ${key} -> edge ${direction}`);
        } catch (error) {
            console.error(`Failed to register ${key}:`, error);
        }
    });

    if (keybinds.toggleClickThrough) {
        try {
            globalShortcut.register(keybinds.toggleClickThrough, () => {
                mouseEventsIgnored = !mouseEventsIgnored;
                if (mouseEventsIgnored) {
                    mainWindow.setIgnoreMouseEvents(true, { forward: true });
                    console.log('Mouse events ignored');
                } else {
                    mainWindow.setIgnoreMouseEvents(false);
                    console.log('Mouse events enabled');
                }
                mainWindow.webContents.send('click-through-toggled', mouseEventsIgnored);
            });
            console.log(`Registered toggleClickThrough: ${keybinds.toggleClickThrough}`);
        } catch (error) {
            console.error(`Failed to register toggleClickThrough (${keybinds.toggleClickThrough}):`, error);
        }
    }

    if (keybinds.nextStep) {
        try {
            globalShortcut.register(keybinds.nextStep, () => {
                console.log('⌘/Ctrl+Enter Ask shortcut triggered');

                const headerWin = windowPool.get('header');

                if (!headerWin || headerWin.isDestroyed() || !headerWin.isVisible()) {
                    console.error('Header window not found or destroyed');
                    return;
                }

                const askWindow = windowPool.get('ask');
                if (!askWindow || askWindow.isDestroyed()) {
                    console.error('Ask window not found or destroyed');
                    return;
                }

                if (askWindow.isVisible()) {
                    askWindow.webContents.send('ask-global-send');
                } else {
                    try {
                        askWindow.show();

                        askWindow.webContents.send('window-did-show');

                        const header = windowPool.get('header');
                        if (header) {
                            const currentHeaderPosition = header.getBounds();
                            updateLayout();
                            header.setPosition(currentHeaderPosition.x, currentHeaderPosition.y, false);
                        }

                        askWindow.webContents.send('window-show-animation');
                    } catch (e) {
                        console.error('Error showing Ask window:', e);
                    }
                }
            });
            console.log(`Registered Ask shortcut (nextStep): ${keybinds.nextStep}`);
        } catch (error) {
            console.error(`Failed to register Ask shortcut (${keybinds.nextStep}):`, error);
        }
    }

    if (keybinds.manualScreenshot) {
        try {
            globalShortcut.register(keybinds.manualScreenshot, () => {
                console.log('Manual screenshot shortcut triggered');
                mainWindow.webContents.executeJavaScript(`
                    if (window.captureManualScreenshot) {
                        window.captureManualScreenshot();
                    } else {
                        console.log('Manual screenshot function not available');
                    }
                `);
            });
            console.log(`Registered manualScreenshot: ${keybinds.manualScreenshot}`);
        } catch (error) {
            console.error(`Failed to register manualScreenshot (${keybinds.manualScreenshot}):`, error);
        }
    }

    if (keybinds.previousResponse) {
        try {
            globalShortcut.register(keybinds.previousResponse, () => {
                console.log('Previous response shortcut triggered');
                sendToRenderer('navigate-previous-response');
            });
            console.log(`Registered previousResponse: ${keybinds.previousResponse}`);
        } catch (error) {
            console.error(`Failed to register previousResponse (${keybinds.previousResponse}):`, error);
        }
    }

    if (keybinds.nextResponse) {
        try {
            globalShortcut.register(keybinds.nextResponse, () => {
                console.log('Next response shortcut triggered');
                sendToRenderer('navigate-next-response');
            });
            console.log(`Registered nextResponse: ${keybinds.nextResponse}`);
        } catch (error) {
            console.error(`Failed to register nextResponse (${keybinds.nextResponse}):`, error);
        }
    }

    if (keybinds.scrollUp) {
        try {
            globalShortcut.register(keybinds.scrollUp, () => {
                console.log('Scroll up shortcut triggered');
                sendToRenderer('scroll-response-up');
            });
            console.log(`Registered scrollUp: ${keybinds.scrollUp}`);
        } catch (error) {
            console.error(`Failed to register scrollUp (${keybinds.scrollUp}):`, error);
        }
    }

    if (keybinds.scrollDown) {
        try {
            globalShortcut.register(keybinds.scrollDown, () => {
                console.log('Scroll down shortcut triggered');
                sendToRenderer('scroll-response-down');
            });
            console.log(`Registered scrollDown: ${keybinds.scrollDown}`);
        } catch (error) {
            console.error(`Failed to register scrollDown (${keybinds.scrollDown}):`, error);
        }
    }
}

function setupWindowIpcHandlers(mainWindow, sendToRenderer, openaiSessionRef) {
    ipcMain.handle('resize-window', async (event, args) => {
        try {
            const { isMainViewVisible, view } = args;
            let targetHeight = HEADER_HEIGHT;
            let targetWidth = DEFAULT_WINDOW_WIDTH;

            if (isMainViewVisible) {
                const viewHeights = {
                    listen: 400,
                    settings: 600,
                    help: 550,
                    history: 550,
                    setup: 200,
                };
                targetHeight = viewHeights[view] || 400;
            }

            const [currentWidth, currentHeight] = mainWindow.getSize();
            if (currentWidth !== targetWidth || currentHeight !== targetHeight) {
                console.log('Window resize requested but disabled for manual resize prevention');
            }
        } catch (error) {
            console.error('Error resizing window:', error);
        }
    });

    ipcMain.handle('toggle-window-visibility', async event => {
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow.show();
        }
    });

    ipcMain.handle('quit-application', async () => {
        app.quit();
    });

    // Keep other essential IPC handlers
    // ... other handlers like open-external, etc. can be added from the old file if needed
}

async function captureScreenshot(options = {}) {
    if (process.platform === 'darwin') {
        try {
            const tempPath = path.join(os.tmpdir(), `screenshot-${Date.now()}.jpg`);

            await execFile('screencapture', ['-x', '-t', 'jpg', tempPath]);

            const imageBuffer = await fs.promises.readFile(tempPath);
            await fs.promises.unlink(tempPath);

            const resizedBuffer = await sharp(imageBuffer)
                // .resize({ height: 1080 })
                .resize({ height: 384 })
                .jpeg({ quality: 80 })
                .toBuffer();

            const base64 = resizedBuffer.toString('base64');
            const metadata = await sharp(resizedBuffer).metadata();

            lastScreenshot = {
                base64,
                width: metadata.width,
                height: metadata.height,
                timestamp: Date.now(),
            };

            return { success: true, base64, width: metadata.width, height: metadata.height };
        } catch (error) {
            console.error('Failed to capture and resize screenshot:', error);
            return { success: false, error: error.message };
        }
    }

    try {
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: {
                width: 1920,
                height: 1080,
            },
        });

        if (sources.length === 0) {
            throw new Error('No screen sources available');
        }
        const source = sources[0];
        const buffer = source.thumbnail.toJPEG(70);
        const base64 = buffer.toString('base64');
        const size = source.thumbnail.getSize();

        return {
            success: true,
            base64,
            width: size.width,
            height: size.height,
        };
    } catch (error) {
        console.error('Failed to capture screenshot using desktopCapturer:', error);
        return {
            success: false,
            error: error.message,
        };
    }
}

module.exports = {
    createWindows,
    windowPool,
    fixedYPosition,
    setApiKey,
    getStoredApiKey,
    getStoredProvider,
    captureScreenshot,
};
