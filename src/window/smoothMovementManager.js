const { screen } = require('electron');

class SmoothMovementManager {
    constructor(windowPool) {
        this.windowPool = windowPool;
        this.stepSize = 80;
        this.animationDuration = 300;
        this.headerPosition = { x: 0, y: 0 };
        this.isAnimating = false;
        this.hiddenPosition = null;
        this.lastVisiblePosition = null;
        this.currentDisplayId = null;
        this.animationFrameId = null;

        this.animationTimers = new Map();
    }

    /**
     * @param {BrowserWindow} win
     * @returns {boolean}
     */
    _isWindowValid(win) {
        if (!win || win.isDestroyed()) {
            // 해당 창의 타이머가 있으면 정리
            if (this.animationTimers.has(win)) {
                clearTimeout(this.animationTimers.get(win));
                this.animationTimers.delete(win);
            }
            return false;
        }
        return true;
    }

    /**
     * 
     * @param {BrowserWindow} win
     * @param {number} targetX
     * @param {number} targetY
     * @param {object} [options]
     * @param {object} [options.sizeOverride]
     * @param {function} [options.onComplete]
     * @param {number} [options.duration]
     */
    animateWindow(win, targetX, targetY, options = {}) {
        if (!this._isWindowValid(win)) {
            if (options.onComplete) options.onComplete();
            return;
        }

        const { sizeOverride, onComplete, duration: animDuration } = options;
        const start = win.getBounds();
        const startTime = Date.now();
        const duration = animDuration || this.animationDuration;
        const { width, height } = sizeOverride || start;

        const step = () => {
            if (!this._isWindowValid(win)) {
                if (onComplete) onComplete();
                return;
            }

            const p = Math.min((Date.now() - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3); // ease-out-cubic
            const x = start.x + (targetX - start.x) * eased;
            const y = start.y + (targetY - start.y) * eased;

            win.setBounds({ x: Math.round(x), y: Math.round(y), width, height });

            if (p < 1) {
                setTimeout(step, 8);
            } else {
                this.layoutManager.updateLayout();
                if (onComplete) {
                    onComplete();
                }
            }
        };
        step();
    }

    fade(win, { from, to, duration = 250, onComplete }) {
        if (!this._isWindowValid(win)) {
          if (onComplete) onComplete();
          return;
        }
        const startOpacity = from ?? win.getOpacity();
        const startTime = Date.now();
        
        const step = () => {
            if (!this._isWindowValid(win)) {
                if (onComplete) onComplete(); return;
            }
            const progress = Math.min(1, (Date.now() - startTime) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            win.setOpacity(startOpacity + (to - startOpacity) * eased);
    
            if (progress < 1) {
                setTimeout(step, 8);
            } else {
                win.setOpacity(to);
                if (onComplete) onComplete();
            }
        };
        step();
    }
    
    animateWindowBounds(win, targetBounds, options = {}) {
        if (this.animationTimers.has(win)) {
            clearTimeout(this.animationTimers.get(win));
        }

        if (!this._isWindowValid(win)) {
            if (options.onComplete) options.onComplete();
            return;
        }

        this.isAnimating = true;

        const startBounds = win.getBounds();
        const startTime = Date.now();
        const duration = options.duration || this.animationDuration;
    
        const step = () => {
            if (!this._isWindowValid(win)) {
                if (options.onComplete) options.onComplete();
                return;
            }
            
            const progress = Math.min(1, (Date.now() - startTime) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
    
            const newBounds = {
                x: Math.round(startBounds.x + (targetBounds.x - startBounds.x) * eased),
                y: Math.round(startBounds.y + (targetBounds.y - startBounds.y) * eased),
                width: Math.round(startBounds.width + ((targetBounds.width ?? startBounds.width) - startBounds.width) * eased),
                height: Math.round(startBounds.height + ((targetBounds.height ?? startBounds.height) - startBounds.height) * eased),
            };
            win.setBounds(newBounds);
    
            if (progress < 1) {
                const timerId = setTimeout(step, 8);
                this.animationTimers.set(win, timerId);
            } else {
                win.setBounds(targetBounds);
                this.animationTimers.delete(win);
                
                if (this.animationTimers.size === 0) {
                    this.isAnimating = false;
                }
                
                if (options.onComplete) options.onComplete();
            }
        };
        step();
    }
    
    animateWindowPosition(win, targetPosition, options = {}) {
        if (!this._isWindowValid(win)) {
            if (options.onComplete) options.onComplete();
            return;
        }
        const currentBounds = win.getBounds();
        const targetBounds = { ...currentBounds, ...targetPosition };
        this.animateWindowBounds(win, targetBounds, options);
    }
    
    animateLayout(layout, animated = true) {
        if (!layout) return;
        for (const winName in layout) {
            const win = this.windowPool.get(winName);
            const targetBounds = layout[winName];
            if (win && !win.isDestroyed() && targetBounds) {
                if (animated) {
                    this.animateWindowBounds(win, targetBounds);
                } else {
                    win.setBounds(targetBounds);
                }
            }
        }
    }

    destroy() {
        if (this.animationFrameId) {
            clearTimeout(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.isAnimating = false;
        console.log('[Movement] Manager destroyed');
    }
}

module.exports = SmoothMovementManager;
