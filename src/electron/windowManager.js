const { BrowserWindow, globalShortcut, ipcMain, screen, app, shell, desktopCapturer } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('os');
const util = require('util');
const execFile = util.promisify(require('child_process').execFile);
const sharp = require('sharp');
const sqliteClient = require('../common/services/sqliteClient');
const fetch = require('node-fetch');

let currentFirebaseUser = null;
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

const windowDefinitions = {
    header: {
        file: 'header.html',
        options: {
            /*…*/
        },
        allowedStates: ['apikey', 'app'],
    },
    ask: {
        file: 'ask.html',
        options: {
            /*…*/
        },
        allowedStates: ['app'],
    },
    listen: {
        file: 'assistant.html',
        options: {
            /*…*/
        },
        allowedStates: ['app'],
    },
    settings: {
        file: 'settings.html',
        options: {
            /*…*/
        },
        allowedStates: ['app'],
    },
};

const featureWindows = ['listen','ask','settings'];

function createFeatureWindows(header) {
    if (windowPool.has('listen')) return;

    const commonChildOptions = {
        parent: header,
        show: false,
        frame: false,
        transparent: true,
        hasShadow: false,
        skipTaskbar: true,
        hiddenInMissionControl: true,
        resizable: false,
        webPreferences: { nodeIntegration: true, contextIsolation: false },
    };

    // listen
    const listen = new BrowserWindow({
        ...commonChildOptions, width:400,height:300,minWidth:400,maxWidth:400,
        minHeight:200,maxHeight:700,
    });
    listen.setContentProtection(isContentProtectionOn);
    listen.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
    listen.loadFile(path.join(__dirname,'../app/content.html'),{query:{view:'listen'}});
    windowPool.set('listen', listen);

    // ask
    const ask = new BrowserWindow({ ...commonChildOptions, width:600, height:350 });
    ask.setContentProtection(isContentProtectionOn);
    ask.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
    ask.loadFile(path.join(__dirname,'../app/content.html'),{query:{view:'ask'}});
    ask.on('blur',()=>ask.webContents.send('window-blur'));
    windowPool.set('ask', ask);

    // settings
    const settings = new BrowserWindow({ ...commonChildOptions, width:240, height:450, parent:undefined });
    settings.setContentProtection(isContentProtectionOn);
    settings.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
    settings.loadFile(path.join(__dirname,'../app/content.html'),{query:{view:'customize'}})
        .catch(console.error);
    windowPool.set('settings', settings);
}

function destroyFeatureWindows() {
    featureWindows.forEach(name=>{
        const win = windowPool.get(name);
        if (win && !win.isDestroyed()) win.destroy();
        windowPool.delete(name);
    });
}

function isAllowed(name) {
    const def = windowDefinitions[name];
    return def && def.allowedStates.includes(currentHeaderState);
}

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

        const PAD = 8;

        /* ① 헤더 중심 X를 "디스플레이 기준 상대좌표"로 변환  */
        const headerCenterXRel = headerBounds.x - workAreaX + headerBounds.width / 2;

        let askBounds = askVisible ? ask.getBounds() : null;
        let listenBounds = listenVisible ? listen.getBounds() : null;

        /* ------------------------------------------------- */
        /* 두 창 모두 보이는 경우 */
        /* ------------------------------------------------- */
        if (askVisible && listenVisible) {
            const combinedWidth = listenBounds.width + PAD + askBounds.width;

            /* ② 모든 X 좌표를 상대좌표로 계산 */
            let groupStartXRel = headerCenterXRel - combinedWidth / 2;
            let listenXRel = groupStartXRel;
            let askXRel = groupStartXRel + listenBounds.width + PAD;

            /* 좌우 화면 여백 클램프 – 역시 상대좌표로 */
            if (listenXRel < PAD) {
                listenXRel = PAD;
                askXRel = listenXRel + listenBounds.width + PAD;
            }
            if (askXRel + askBounds.width > screenWidth - PAD) {
                askXRel = screenWidth - PAD - askBounds.width;
                listenXRel = askXRel - listenBounds.width - PAD;
            }

            /* Y 좌표는 이미 상대값으로 계산돼 있음 */
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
                    yRel = headerBounds.y - workAreaY + headerBounds.height + PAD;
                    break;
                case 'above':
                    yRel = headerBounds.y - workAreaY - winBounds.height - PAD;
                    break;
                default:
                    yRel = headerBounds.y - workAreaY + headerBounds.height + PAD;
                    break;
            }

            /* 화면 경계 클램프 */
            xRel = Math.max(PAD, Math.min(screenWidth - winBounds.width - PAD, xRel));
            yRel = Math.max(PAD, Math.min(screenHeight - winBounds.height - PAD, yRel));

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
        this.currentAnimationTimer = null;
        this.animationAbortController = null; 
        this.animationFrameRate = 16; // ~60fps
    }

    safeSetPosition(window, x, y) {
        if (!window || window.isDestroyed()) {
            return false;
        }
        
        let safeX = Number.isFinite(x) ? Math.round(x) : 0;
        let safeY = Number.isFinite(y) ? Math.round(y) : 0;
        
        if (Object.is(safeX, -0)) safeX = 0;
        if (Object.is(safeY, -0)) safeY = 0;
        
        safeX = parseInt(safeX, 10);
        safeY = parseInt(safeY, 10);
        
        if (!Number.isInteger(safeX) || !Number.isInteger(safeY)) {
            console.error('[Movement] Invalid position after conversion:', { x: safeX, y: safeY, originalX: x, originalY: y });
            return false;
        }
        
        try {
            window.setPosition(safeX, safeY);
            return true;
        } catch (err) {
            console.error('[Movement] setPosition failed with values:', { x: safeX, y: safeY }, err);
            return false;
        }
    }

    cancelCurrentAnimation() {
        if (this.currentAnimationTimer) {
            clearTimeout(this.currentAnimationTimer);
            this.currentAnimationTimer = null;
        }
        if (this.animationAbortController) {
            this.animationAbortController.abort();
            this.animationAbortController = null;
        }
        this.isAnimating = false;
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

    hideToEdge(edge, callback) {
        const header = windowPool.get('header');
        if (!header || header.isDestroyed()) {
          if (typeof callback === 'function') callback();
          return;
        }
      
        const { x, y } = header.getBounds();
        this.lastVisiblePosition = { x, y };
        this.hiddenPosition     = { edge };
      
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
      
        if (this.lastVisiblePosition) {
          header.setPosition(
            this.lastVisiblePosition.x,
            this.lastVisiblePosition.y,
            false   // animate: false
          );
        }
      
        header.show();
        header.webContents.send('window-show-animation');
      
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
        // cancel animation
        this.cancelCurrentAnimation();
        
        this.isAnimating = true;

        const startX = this.headerPosition.x;
        const startY = this.headerPosition.y;
        const startTime = Date.now();

        if (!Number.isFinite(targetX) || !Number.isFinite(targetY) || !Number.isFinite(startX) || !Number.isFinite(startY)) {
            console.error('[Movement] Invalid position values:', { startX, startY, targetX, targetY });
            this.isAnimating = false;
            return;
        }


        this.animationAbortController = new AbortController();
        const signal = this.animationAbortController.signal;

        const animate = () => {
            if (signal.aborted || !header || header.isDestroyed()) {
                this.isAnimating = false;
                this.currentAnimationTimer = null;
                return;
            }

            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / this.animationDuration, 1);

            const eased = 1 - Math.pow(1 - progress, 3);

            const currentX = startX + (targetX - startX) * eased;
            const currentY = startY + (targetY - startY) * eased;

            const success = this.safeSetPosition(header, currentX, currentY);
            if (!success) {
                this.isAnimating = false;
                this.currentAnimationTimer = null;
                return;
            }

            if (progress < 1) {
                this.currentAnimationTimer = setTimeout(animate, this.animationFrameRate);
            } else {
                this.headerPosition = { x: targetX, y: targetY };
                

                this.safeSetPosition(header, targetX, targetY);
                
                this.isAnimating = false;
                this.currentAnimationTimer = null;
                this.animationAbortController = null;

                updateLayout();

                console.log(`[Movement] Step completed to (${targetX}, ${targetY})`);
            }
        };

        animate();
    }

    moveToEdge(direction) {
        const header = windowPool.get('header');
        if (!header || !header.isVisible()) return;
        this.cancelCurrentAnimation();

        console.log(`[Movement] Move to edge: ${direction}`);

        const display = getCurrentDisplay(header);
        const { width, height } = display.workAreaSize;
        const { x: workAreaX, y: workAreaY } = display.workArea;
        
        let currentBounds;
        try {
            currentBounds = header.getBounds();
        } catch (err) {
            console.error('[Movement] Failed to get header bounds:', err);
            return;
        }

        let targetX = currentBounds.x;
        let targetY = currentBounds.y;

        switch (direction) {
            case 'left':
                targetX = workAreaX;
                break;
            case 'right':
                targetX = workAreaX + width - currentBounds.width;
                break;
            case 'up':
                targetY = workAreaY;
                break;
            case 'down':
                targetY = workAreaY + height - currentBounds.height;
                break;
        }

        this.headerPosition = { x: currentBounds.x, y: currentBounds.y };

        this.animationAbortController = new AbortController();
        const signal = this.animationAbortController.signal;

        this.isAnimating = true;
        const startX = this.headerPosition.x;
        const startY = this.headerPosition.y;
        const duration = 350;
        const startTime = Date.now();

        if (!Number.isFinite(targetX) || !Number.isFinite(targetY) || !Number.isFinite(startX) || !Number.isFinite(startY)) {
            console.error('[Movement] Invalid edge position values:', { startX, startY, targetX, targetY });
            this.isAnimating = false;
            return;
        }

        const animate = () => {
            if (signal.aborted || !header || header.isDestroyed()) {
                this.isAnimating = false;
                this.currentAnimationTimer = null;
                return;
            }

            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const eased = 1 - Math.pow(1 - progress, 4);

            const currentX = startX + (targetX - startX) * eased;
            const currentY = startY + (targetY - startY) * eased;


            const success = this.safeSetPosition(header, currentX, currentY);
            if (!success) {
                this.isAnimating = false;
                this.currentAnimationTimer = null;
                return;
            }

            if (progress < 1) {
                this.currentAnimationTimer = setTimeout(animate, this.animationFrameRate);
            } else {

                this.safeSetPosition(header, targetX, targetY);
                
                this.headerPosition = { x: targetX, y: targetY };
                this.isAnimating = false;
                this.currentAnimationTimer = null;
                this.animationAbortController = null;

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
        this.cancelCurrentAnimation();
        this.isAnimating = false;
        console.log('[Movement] Destroyed');
    }
}

const layoutManager = new WindowLayoutManager();
let movementManager = null;

function isWindowSafe(window) {
    return window && !window.isDestroyed() && typeof window.getBounds === 'function';
}

function safeWindowOperation(window, operation, fallback = null) {
    if (!isWindowSafe(window)) {
        console.warn('[WindowManager] Window not safe for operation');
        return fallback;
    }
    
    try {
        return operation(window);
    } catch (error) {
        console.error('[WindowManager] Window operation failed:', error);
        return fallback;
    }
}

function safeSetPosition(window, x, y) {
    return safeWindowOperation(window, (win) => {
        win.setPosition(Math.round(x), Math.round(y));
        return true;
    }, false);
}

function safeGetBounds(window) {
    return safeWindowOperation(window, (win) => win.getBounds(), null);
}

function safeShow(window) {
    return safeWindowOperation(window, (win) => {
        win.show();
        return true;
    }, false);
}

function safeHide(window) {
    return safeWindowOperation(window, (win) => {
        win.hide();
        return true;
    }, false);
}

let toggleState = {
    isToggling: false,
    lastToggleTime: 0,
    pendingToggle: null,
    toggleDebounceTimer: null,
    failsafeTimer: null
};

function toggleAllWindowsVisibility() {
    const now = Date.now();
    const timeSinceLastToggle = now - toggleState.lastToggleTime;
    
    if (timeSinceLastToggle < 30) {
        console.log('[Visibility] Toggle ignored - too fast (debounced)');
        return;
    }
    if (toggleState.isToggling) {
        console.log('[Visibility] Toggle in progress, queueing request');
        
        if (toggleState.toggleDebounceTimer) {
            clearTimeout(toggleState.toggleDebounceTimer);
        }
        
        toggleState.toggleDebounceTimer = setTimeout(() => {
            toggleState.toggleDebounceTimer = null;
            if (!toggleState.isToggling) {
                toggleAllWindowsVisibility();
            }
        }, 30);
        
        return;
    }
    
    const header = windowPool.get('header');
    if (!header || header.isDestroyed()) {
        console.error('[Visibility] Header window not found or destroyed');
        return;
    }

    toggleState.isToggling = true;
    toggleState.lastToggleTime = now;
    const resetToggleState = () => {
        toggleState.isToggling = false;
        if (toggleState.toggleDebounceTimer) {
            clearTimeout(toggleState.toggleDebounceTimer);
            toggleState.toggleDebounceTimer = null;
        }
        if (toggleState.failsafeTimer) {
            clearTimeout(toggleState.failsafeTimer);
            toggleState.failsafeTimer = null;
        }
    };
    toggleState.failsafeTimer = setTimeout(() => {
        console.warn('[Visibility] Toggle operation timed out, resetting state');
        resetToggleState();
    }, 2000);

    try {
        if (header.isVisible()) {
            console.log('[Visibility] Smart hiding - calculating nearest edge');

            const headerBounds = header.getBounds();
            const display = getCurrentDisplay(header);
            const { width: screenWidth, height: screenHeight } = display.workAreaSize;
            const { x: workAreaX, y: workAreaY } = display.workArea;

            const centerX = headerBounds.x + headerBounds.width / 2 - workAreaX;
            const centerY = headerBounds.y + headerBounds.height / 2 - workAreaY;

            const distances = {
                top: centerY,
                bottom: screenHeight - centerY,
                left: centerX,
                right: screenWidth - centerX,
            };

            const nearestEdge = Object.keys(distances).reduce((nearest, edge) => 
                (distances[edge] < distances[nearest] ? edge : nearest)
            );

            console.log(`[Visibility] Nearest edge: ${nearestEdge} (distance: ${distances[nearestEdge].toFixed(1)}px)`);

            lastVisibleWindows.clear();
            lastVisibleWindows.add('header');

            const hidePromises = [];
            windowPool.forEach((win, name) => {
                if (win && !win.isDestroyed() && win.isVisible() && name !== 'header') {
                    lastVisibleWindows.add(name);
                    
                    // win.webContents.send('window-hide-animation');
                    
                    // hidePromises.push(new Promise(resolve => {
                    //     setTimeout(() => {
                    //         if (!win.isDestroyed()) {
                    //             win.hide();
                    //         }
                    //         resolve();
                    //     }, 180); // 200ms ->180ms
                    // }));

                    hidePromises.push(new Promise(resolve => {
                        if (!win.isDestroyed()) win.hide();   // 바로 hide
                        resolve();                            // 즉시 완료
                    }));
                }
            });

            console.log('[Visibility] Visible windows before hide:', Array.from(lastVisibleWindows));

            Promise.all(hidePromises).then(() => {
                if (!movementManager || header.isDestroyed()) {
                    resetToggleState();
                    return;
                }
                
                movementManager.hideToEdge(nearestEdge, () => {
                    if (!header.isDestroyed()) {
                        header.hide();
                    }
                    resetToggleState();
                    console.log('[Visibility] Smart hide completed');
                }, (error) => {
                    console.error('[Visibility] Error in hideToEdge:', error);
                    resetToggleState();
                });
            }).catch(err => {
                console.error('[Visibility] Error during hide:', err);
                resetToggleState();
            });
            
        } else {
            console.log('[Visibility] Smart showing from hidden position');
            console.log('[Visibility] Restoring windows:', Array.from(lastVisibleWindows));
            header.show();

            if (!movementManager) {
                console.error('[Visibility] Movement manager not initialized');
                resetToggleState();
                return;
            }

            movementManager.showFromEdge(() => {
                const showPromises = [];
                lastVisibleWindows.forEach(name => {
                    if (name === 'header') return;
                    
                    const win = windowPool.get(name);
                    if (win && !win.isDestroyed()) {
                        showPromises.push(new Promise(resolve => {
                            win.show();
                            win.webContents.send('window-show-animation');
                            setTimeout(resolve, 100);
                        }));
                    }
                });

                Promise.all(showPromises).then(() => {
                    setImmediate(updateLayout);
                    setTimeout(updateLayout, 100);
                    
                    resetToggleState();
                    console.log('[Visibility] Smart show completed');
                }).catch(err => {
                    console.error('[Visibility] Error during show:', err);
                    resetToggleState();
                });
            }, (error) => {
                console.error('[Visibility] Error in showFromEdge:', error);
                resetToggleState();
            });
        }
    } catch (error) {
        console.error('[Visibility] Unexpected error in toggle:', error);
        resetToggleState();
    }
}

function ensureDataDirectories() {
    const homeDir = os.homedir();
    const pickleGlassDir = path.join(homeDir, '.pickle-glass');
    const dataDir = path.join(pickleGlassDir, 'data');
    const imageDir = path.join(dataDir, 'image');
    const audioDir = path.join(dataDir, 'audio');

    [pickleGlassDir, dataDir, imageDir, audioDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    return { imageDir, audioDir };
}

function createWindows() {
    if (movementManager) {
        movementManager.destroy();
        movementManager = null;
    }
    
    toggleState.isToggling = false;
    if (toggleState.toggleDebounceTimer) {
        clearTimeout(toggleState.toggleDebounceTimer);
        toggleState.toggleDebounceTimer = null;
    }
    if (toggleState.failsafeTimer) {
        clearTimeout(toggleState.failsafeTimer);
        toggleState.failsafeTimer = null;
    }
    
    const primaryDisplay = screen.getPrimaryDisplay();
    const { y: workAreaY, width: screenWidth } = primaryDisplay.workArea;

    const initialX = Math.round((screenWidth - DEFAULT_WINDOW_WIDTH) / 2);
    const initialY = workAreaY + 21;
    movementManager = new SmoothMovementManager();

    const header = new BrowserWindow({
        width: DEFAULT_WINDOW_WIDTH,
        height: HEADER_HEIGHT,
        x: initialX,
        y: initialY,
        frame: false,
        transparent: true,
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

    windowPool.set('header', header);

    if (currentHeaderState === 'app') {
        createFeatureWindows(header);
    }


    windowPool.set('header', header);

    if (currentHeaderState === 'app') {
        createFeatureWindows(header);
    }

    header.setContentProtection(isContentProtectionOn);
    header.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    header.loadFile(path.join(__dirname, '../app/header.html'));

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

    header.webContents.once('dom-ready', () => {
        loadAndRegisterShortcuts();
    });

    ipcMain.handle('toggle-all-windows-visibility', () => {
        try {
            toggleAllWindowsVisibility();
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
            
            if (!windowPool.get(featureName) && currentHeaderState === 'app') {
                createFeatureWindows(header);
            }

            if (!windowPool.get(featureName) && currentHeaderState === 'app') {
                createFeatureWindows(windowPool.get('header'));
            }

            const windowToToggle = windowPool.get(featureName);

            if (windowToToggle) {
                if (featureName === 'listen') {
                    const liveSummaryService = require('../features/listen/liveSummaryService');
                    if (liveSummaryService.isSessionActive()) {
                        console.log('[WindowManager] Listen session is active, closing it via toggle.');
                        await liveSummaryService.closeSession();
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
            toggleState.isToggling = false;
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

    setupIpcHandlers();

    return windowPool;
}

function loadAndRegisterShortcuts() {
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

    const openaiSessionRef = { current: null };

    if (!header) {
        return updateGlobalShortcuts(defaultKeybinds, undefined, sendToRenderer, openaiSessionRef);
    }

    header.webContents
        .executeJavaScript(`(() => localStorage.getItem('customKeybinds'))()`)
        .then(saved => (saved ? JSON.parse(saved) : {}))
        .then(savedKeybinds => {
            const keybinds = { ...defaultKeybinds, ...savedKeybinds };
            updateGlobalShortcuts(keybinds, header, sendToRenderer, openaiSessionRef);
        })
        .catch(() => updateGlobalShortcuts(defaultKeybinds, header, sendToRenderer, openaiSessionRef));
}

function updateLayout() {
    if (layoutManager._updateTimer) {
        clearTimeout(layoutManager._updateTimer);
    }
    
    layoutManager._updateTimer = setTimeout(() => {
        layoutManager._updateTimer = null;
        layoutManager.updateLayout();
    }, 16);
}

function setupIpcHandlers(openaiSessionRef) {
    const layoutManager = new WindowLayoutManager();
    // const movementManager = new SmoothMovementManager();
    
    //cleanup
    app.on('before-quit', () => {
        console.log('[WindowManager] App is quitting, cleaning up...');
        
        if (movementManager) {
            movementManager.destroy();
        }
        
        if (toggleState.toggleDebounceTimer) {
            clearTimeout(toggleState.toggleDebounceTimer);
            toggleState.toggleDebounceTimer = null;
        }
        
        if (toggleState.failsafeTimer) {
            clearTimeout(toggleState.failsafeTimer);
            toggleState.failsafeTimer = null;
        }
        
        if (settingsHideTimer) {
            clearTimeout(settingsHideTimer);
            settingsHideTimer = null;
        }
        
        windowPool.forEach((win, name) => {
            if (win && !win.isDestroyed()) {
                win.destroy();
            }
        });
        windowPool.clear();
    });

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
                let y = Math.round(headerBounds.y + (bounds?.y ?? 0) + (bounds?.height ?? 0) + 31);

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
                    window.setAlwaysOnTop(false);
                    window.hide();
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

    ipcMain.handle('message-sending', async event => {
        console.log('📨 Main: Received message-sending signal');
        const askWindow = windowPool.get('ask');
        if (askWindow && !askWindow.isDestroyed()) {
            console.log('📤 Main: Sending hide-text-input to ask window');
            askWindow.webContents.send('hide-text-input');
            return { success: true };
        }
        return { success: false };
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

        if (state === 'app') {
            createFeatureWindows(windowPool.get('header'));
        } else {         // 'apikey'
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

                    updateGlobalShortcuts(keybinds, header, sendToRenderer, { current: null });
                })
                .catch(console.error);
        }
    });

    ipcMain.handle('get-available-screens', async () => {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: 300, height: 200 },
            });

            const displays = screen.getAllDisplays();

            return sources.map((source, index) => {
                const display = displays[index] || displays[0];
                return {
                    id: source.id,
                    name: source.name,
                    thumbnail: source.thumbnail.toDataURL(),
                    display: {
                        id: display.id,
                        bounds: display.bounds,
                        workArea: display.workArea,
                        scaleFactor: display.scaleFactor,
                        isPrimary: display.id === screen.getPrimaryDisplay().id,
                    },
                };
            });
        } catch (error) {
            console.error('Failed to get available screens:', error);
            return [];
        }
    });

    ipcMain.handle('set-capture-source', (event, sourceId) => {
        selectedCaptureSourceId = sourceId;
        console.log(`[Capture] Selected source: ${sourceId}`);
        return { success: true };
    });

    ipcMain.handle('get-capture-source', () => {
        return selectedCaptureSourceId;
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

    ipcMain.on('move-to-edge', (event, direction) => {
        if (movementManager) {
            movementManager.moveToEdge(direction);
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

    ipcMain.handle('firebase-auth-state-changed', (event, user) => {
        console.log('[WindowManager] Firebase auth state changed:', user ? user.email : 'null');
        const previousUser = currentFirebaseUser;

        // 🛡️  Guard: ignore duplicate events where auth state did not actually change
        const sameUser = user && previousUser && user.uid && previousUser.uid && user.uid === previousUser.uid;
        const bothNull = !user && !previousUser;
        if (sameUser || bothNull) {
            // No real state change ➜ skip further processing
            console.log('[WindowManager] No real state change, skipping further processing');
            return;
        }

        currentFirebaseUser = user;

        if (user && user.email) {
            (async () => {
                try {
                    const existingKey = getStoredApiKey();
                    if (existingKey) {
                        console.log('[WindowManager] Virtual key already exists, skipping fetch');
                        return;
                    }

                    if (!user.idToken) {
                        console.warn('[WindowManager] No ID token available, cannot fetch virtual key');
                        return;
                    }

                    console.log('[WindowManager] Fetching virtual key via onAuthStateChanged');
                    const vKey = await getVirtualKeyByEmail(user.email, user.idToken);
                    console.log('[WindowManager] Virtual key fetched successfully');

                    setApiKey(vKey)
                        .then(() => {
                            windowPool.forEach(win => {
                                if (win && !win.isDestroyed()) {
                                    win.webContents.send('api-key-updated');
                                }
                            });
                        })
                        .catch(err => console.error('[WindowManager] Failed to save virtual key:', err));
                } catch (err) {
                    console.error('[WindowManager] Virtual key fetch failed:', err);

                    if (err.message.includes('token') || err.message.includes('Authentication')) {
                        windowPool.forEach(win => {
                            if (win && !win.isDestroyed()) {
                                win.webContents.send('auth-error', {
                                    message: 'Authentication expired. Please login again.',
                                    shouldLogout: true,
                                });
                            }
                        });
                    }
                }
            })();
        }

        // If the user logged out, also hide the settings window
        if (!user && previousUser) {
            // ADDED: Only trigger on actual state change from logged in to logged out
            console.log('[WindowManager] User logged out, clearing API key and notifying renderers');

            setApiKey(null)
                .then(() => {
                    console.log('[WindowManager] API key cleared successfully after logout');
                    windowPool.forEach(win => {
                        if (win && !win.isDestroyed()) {
                            win.webContents.send('api-key-removed');
                        }
                    });
                })
                .catch(err => {
                    console.error('[WindowManager] setApiKey error:', err);
                    windowPool.forEach(win => {
                        if (win && !win.isDestroyed()) {
                            win.webContents.send('api-key-removed');
                        }
                    });
                });

            const settingsWindow = windowPool.get('settings');
            if (settingsWindow && settingsWindow.isVisible()) {
                settingsWindow.hide();
                console.log('[WindowManager] Settings window hidden after logout.');
            }
        }
        // Broadcast to all windows
        windowPool.forEach(win => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('firebase-user-updated', user);
            }
        });
    });

    ipcMain.handle('get-current-firebase-user', () => {
        return currentFirebaseUser;
    });

    ipcMain.handle('firebase-logout', () => {
        console.log('[WindowManager] Received request to log out.');
        // setApiKey(null)
        //     .then(() => {
        //         console.log('[WindowManager] API key cleared successfully after logout');
        //         windowPool.forEach(win => {
        //             if (win && !win.isDestroyed()) {
        //                 win.webContents.send('api-key-removed');
        //             }
        //         });
        //     })
        //     .catch(err => {
        //         console.error('[WindowManager] setApiKey error:', err);
        //         windowPool.forEach(win => {
        //             if (win && !win.isDestroyed()) {
        //                 win.webContents.send('api-key-removed');
        //             }
        //         });
        //     });

        const header = windowPool.get('header');
        if (header && !header.isDestroyed()) {
            console.log('[WindowManager] Header window exists, sending to renderer...');
            header.webContents.send('request-firebase-logout');
        }
    });

    ipcMain.handle('check-system-permissions', async () => {
        const { systemPreferences } = require('electron');
        const permissions = {
            microphone: false,
            screen: false,
            needsSetup: false
        };

        try {
            if (process.platform === 'darwin') {
                // Check microphone permission on macOS
                const micStatus = systemPreferences.getMediaAccessStatus('microphone');
                permissions.microphone = micStatus === 'granted';

                try {
                    const sources = await desktopCapturer.getSources({ 
                        types: ['screen'], 
                        thumbnailSize: { width: 1, height: 1 } 
                    });
                    permissions.screen = sources && sources.length > 0;
                } catch (err) {
                    console.log('[Permissions] Screen capture test failed:', err);
                    permissions.screen = false;
                }

                permissions.needsSetup = !permissions.microphone || !permissions.screen;
            } else {
                permissions.microphone = true;
                permissions.screen = true;
                permissions.needsSetup = false;
            }

            console.log('[Permissions] System permissions status:', permissions);
            return permissions;
        } catch (error) {
            console.error('[Permissions] Error checking permissions:', error);
            return {
                microphone: false,
                screen: false,
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
            if (status === 'granted') {
                return { success: true, status: 'already-granted' };
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
            // Open System Preferences to Privacy & Security > Screen Recording
            if (section === 'screen-recording') {
                await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
            } else if (section === 'microphone') {
                await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
            } else {
                await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy');
            }
            return { success: true };
        } catch (error) {
            console.error('[Permissions] Error opening system preferences:', error);
            return { success: false, error: error.message };
        }
    });
}

let storedApiKey = null;

async function setApiKey(apiKey) {
    storedApiKey = apiKey;
    console.log('[WindowManager] API key stored (and will be persisted to DB)');

    try {
        await sqliteClient.saveApiKey(apiKey);
        console.log('[WindowManager] API key saved to SQLite');
    } catch (err) {
        console.error('[WindowManager] Failed to save API key to SQLite:', err);
    }

    windowPool.forEach(win => {
        if (win && !win.isDestroyed()) {
            const js = apiKey ? `localStorage.setItem('openai_api_key', ${JSON.stringify(apiKey)});` : `localStorage.removeItem('openai_api_key');`;
            win.webContents.executeJavaScript(js).catch(() => {});
        }
    });
}

async function loadApiKeyFromDb() {
    try {
        const user = await sqliteClient.getUser(sqliteClient.defaultUserId);
        if (user && user.api_key) {
            console.log('[WindowManager] API key loaded from SQLite for default user.');
            return user.api_key;
        }
        return null;
    } catch (error) {
        console.error('[WindowManager] Failed to load API key from SQLite:', error);
        return null;
    }
}

function getCurrentFirebaseUser() {
    return currentFirebaseUser;
}

function isFirebaseLoggedIn() {
    return !!currentFirebaseUser;
}

function setCurrentFirebaseUser(user) {
    currentFirebaseUser = user;
    console.log('[WindowManager] Firebase user updated:', user ? user.email : 'null');
}

function getStoredApiKey() {
    return storedApiKey;
}

function setupApiKeyIPC() {
    const { ipcMain } = require('electron');

    ipcMain.handle('get-stored-api-key', async () => {
        if (storedApiKey === null) {
            const dbKey = await loadApiKeyFromDb();
            if (dbKey) {
                await setApiKey(dbKey);
            }
        }
        return storedApiKey;
    });

    ipcMain.handle('api-key-validated', async (event, apiKey) => {
        console.log('[WindowManager] API key validation completed, saving...');
        await setApiKey(apiKey);

        windowPool.forEach((win, name) => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('api-key-validated', apiKey);
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

    ipcMain.handle('get-current-api-key', async () => {
        if (storedApiKey === null) {
            const dbKey = await loadApiKeyFromDb();
            if (dbKey) {
                await setApiKey(dbKey);
            }
        }
        return storedApiKey;
    });

    console.log('[WindowManager] API key related IPC handlers registered (SQLite-backed)');
}

function createWindow(sendToRenderer, openaiSessionRef) {
    const mainWindow = new BrowserWindow({
        width: DEFAULT_WINDOW_WIDTH,
        height: HEADER_HEIGHT,
        x: initialX,
        y: initialY,
        frame: false,
        transparent: false,
        hasShadow: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        hiddenInMissionControl: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            backgroundThrottling: false,
            enableBlinkFeatures: 'GetDisplayMedia',
            webSecurity: true,
            allowRunningInsecureContent: false,
        },
        backgroundColor: '#FF0000',
    });

    const { session, desktopCapturer } = require('electron');
    session.defaultSession.setDisplayMediaRequestHandler(
        (request, callback) => {
            desktopCapturer.getSources({ types: ['screen'] }).then(sources => {
                callback({ video: sources[0], audio: 'loopback' });
            });
        },
        { useSystemPicker: true }
    );

    mainWindow.setResizable(false);
    mainWindow.setContentProtection(true);
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth } = primaryDisplay.workAreaSize;
    const x = Math.floor((screenWidth - DEFAULT_WINDOW_WIDTH) / 2);
    const y = 0;
    mainWindow.setPosition(x, y);

    if (process.platform === 'win32') {
        mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    }

    mainWindow.loadFile(path.join(__dirname, '../index.html'));

    mainWindow.webContents.once('dom-ready', () => {
        setTimeout(() => {
            const defaultKeybinds = getDefaultKeybinds();
            let keybinds = defaultKeybinds;

            mainWindow.webContents
                .executeJavaScript(
                    `
                (() => {
                    try {
                        const savedKeybinds = localStorage.getItem('customKeybinds');
                        const savedContentProtection = localStorage.getItem('contentProtection');
                        
                        return {
                            keybinds: savedKeybinds ? JSON.parse(savedKeybinds) : null,
                            contentProtection: savedContentProtection !== null ? savedContentProtection === 'true' : true
                        };
                    } catch (e) {
                        return { keybinds: null, contentProtection: true };
                    }
                })()
            `
                )
                .then(savedSettings => {
                    if (savedSettings.keybinds) {
                        keybinds = { ...defaultKeybinds, ...savedSettings.keybinds };
                    }
                    mainWindow.setContentProtection(savedSettings.contentProtection);
                    updateGlobalShortcuts(keybinds, mainWindow, sendToRenderer, openaiSessionRef);
                })
                .catch(() => {
                    mainWindow.setContentProtection(true);
                    updateGlobalShortcuts(defaultKeybinds, mainWindow, sendToRenderer, openaiSessionRef);
                });
        }, 150);
    });

    setupWindowIpcHandlers(mainWindow, sendToRenderer, openaiSessionRef);

    return mainWindow;
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

function updateGlobalShortcuts(keybinds, mainWindow, sendToRenderer, openaiSessionRef) {
    console.log('Updating global shortcuts with:', keybinds);

    // Unregister all existing shortcuts
    globalShortcut.unregisterAll();

    if (movementManager) {
        movementManager.destroy();
    }
    movementManager = new SmoothMovementManager();

    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Cmd' : 'Ctrl';

    if (keybinds.toggleVisibility) {
        try {
            globalShortcut.register(keybinds.toggleVisibility, toggleAllWindowsVisibility);
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
                    if (movementManager) {
                        movementManager.moveToDisplay(display.id);
                    }
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
                    customize: 600,
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

function clearApiKey() {
    setApiKey(null);
}

async function getVirtualKeyByEmail(email, idToken) {
    if (!idToken) {
        throw new Error('Firebase ID token is required for virtual key request');
    }

    const resp = await fetch('https://serverless-api-sf3o.vercel.app/api/virtual_key', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
        redirect: 'follow',
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        console.error('[VK] API request failed:', json.message || 'Unknown error');
        throw new Error(json.message || `HTTP ${resp.status}: Virtual key request failed`);
    }

    const vKey = json?.data?.virtualKey || json?.data?.virtual_key || json?.data?.newVKey?.slug;

    if (!vKey) throw new Error('virtual key missing in response');
    return vKey;
}

// Helper function to avoid code duplication
async function captureScreenshotInternal(options = {}) {
    try {
        const quality = options.quality || 'medium';

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
        const thumbnail = source.thumbnail;

        let jpegQuality;
        switch (quality) {
            case 'high':
                jpegQuality = 90;
                break;
            case 'low':
                jpegQuality = 50;
                break;
            case 'medium':
            default:
                jpegQuality = 70;
                break;
        }

        const buffer = thumbnail.toJPEG(jpegQuality);
        const base64 = buffer.toString('base64');

        const size = thumbnail.getSize();

        return {
            success: true,
            base64,
            width: size.width,
            height: size.height,
        };
    } catch (error) {
        throw error;
    }
}

module.exports = {
    createWindows,
    windowPool,
    fixedYPosition,
    setApiKey,
    getStoredApiKey,
    clearApiKey,
    getCurrentFirebaseUser,
    isFirebaseLoggedIn,
    setCurrentFirebaseUser,
    getVirtualKeyByEmail,
};
