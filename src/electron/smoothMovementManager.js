const { screen } = require('electron');
const { getCurrentDisplay, getDisplayById } = require('./utils/displayUtils');

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
        const header = this.windowPool.get('header');
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

    hideToEdge(edge, callback, errorCallback) {
        const header = this.windowPool.get('header');
        if (!header || !header.isVisible()) {
            if (errorCallback) errorCallback(new Error('Header not available or not visible'));
            return;
        }
        this.cancelCurrentAnimation();
        console.log(`[Movement] Hiding to ${edge} edge`);
        let currentBounds;
        try {
            currentBounds = header.getBounds();
        } catch (err) {
            console.error('[Movement] Failed to get header bounds:', err);
            if (errorCallback) errorCallback(err);
            return;
        }
        this.lastVisiblePosition = { x: currentBounds.x, y: currentBounds.y };
        this.headerPosition = { x: currentBounds.x, y: currentBounds.y };
        const display = getCurrentDisplay(header);
        const { width: screenWidth, height: screenHeight } = display.workAreaSize;
        const { x: workAreaX, y: workAreaY } = display.workArea;
        let targetX = this.headerPosition.x;
        let targetY = this.headerPosition.y;
        switch (edge) {
            case 'top':
                targetY = workAreaY - currentBounds.height - 20;
                break;
            case 'bottom':
                targetY = workAreaY + screenHeight + 20;
                break;
            case 'left':
                targetX = workAreaX - currentBounds.width - 20;
                break;
            case 'right':
                targetX = workAreaX + screenWidth + 20;
                break;
        }
        if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
            console.error('[Movement] Invalid target position:', { targetX, targetY });
            if (errorCallback) errorCallback(new Error('Invalid target position'));
            return;
        }
        this.hiddenPosition = { x: targetX, y: targetY, edge };
        this.animationAbortController = new AbortController();
        const signal = this.animationAbortController.signal;
        this.isAnimating = true;
        const startX = this.headerPosition.x;
        const startY = this.headerPosition.y;
        const duration = 300;
        const startTime = Date.now();
        const animate = () => {
            if (signal.aborted) {
                this.isAnimating = false;
                if (errorCallback) errorCallback(new Error('Animation aborted'));
                return;
            }
            if (!header || header.isDestroyed()) {
                this.isAnimating = false;
                this.currentAnimationTimer = null;
                if (errorCallback) errorCallback(new Error('Window destroyed during animation'));
                return;
            }
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = progress * progress * progress;
            const currentX = startX + (targetX - startX) * eased;
            const currentY = startY + (targetY - startY) * eased;
            const success = this.safeSetPosition(header, currentX, currentY);
            if (!success) {
                this.isAnimating = false;
                this.currentAnimationTimer = null;
                if (errorCallback) errorCallback(new Error('Failed to set position'));
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
                if (typeof callback === 'function' && !signal.aborted) {
                    try {
                        callback();
                    } catch (err) {
                        console.error('[Movement] Callback error:', err);
                        if (errorCallback) errorCallback(err);
                    }
                }
                console.log(`[Movement] Hide to ${edge} completed`);
            }
        };
        try {
            animate();
        } catch (err) {
            console.error('[Movement] Animation start error:', err);
            this.isAnimating = false;
            if (errorCallback) errorCallback(err);
        }
    }

    showFromEdge(callback, errorCallback) {
        const header = this.windowPool.get('header');
        if (!header || !this.hiddenPosition || !this.lastVisiblePosition) {
            if (errorCallback) errorCallback(new Error('Cannot show - missing required data'));
            return;
        }
        this.cancelCurrentAnimation();
        console.log(`[Movement] Showing from ${this.hiddenPosition.edge} edge`);
        if (!this.safeSetPosition(header, this.hiddenPosition.x, this.hiddenPosition.y)) {
            if (errorCallback) errorCallback(new Error('Failed to set initial position'));
            return;
        }
        this.headerPosition = { x: this.hiddenPosition.x, y: this.hiddenPosition.y };
        const targetX = this.lastVisiblePosition.x;
        const targetY = this.lastVisiblePosition.y;
        if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
            console.error('[Movement] Invalid target position for show:', { targetX, targetY });
            if (errorCallback) errorCallback(new Error('Invalid target position for show'));
            return;
        }
        this.animationAbortController = new AbortController();
        const signal = this.animationAbortController.signal;
        this.isAnimating = true;
        const startX = this.headerPosition.x;
        const startY = this.headerPosition.y;
        const duration = 400;
        const startTime = Date.now();
        const animate = () => {
            if (signal.aborted) {
                this.isAnimating = false;
                if (errorCallback) errorCallback(new Error('Animation aborted'));
                return;
            }
            if (!header || header.isDestroyed()) {
                this.isAnimating = false;
                this.currentAnimationTimer = null;
                if (errorCallback) errorCallback(new Error('Window destroyed during animation'));
                return;
            }
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const c1 = 1.70158;
            const c3 = c1 + 1;
            const eased = 1 + c3 * Math.pow(progress - 1, 3) + c1 * Math.pow(progress - 1, 2);
            const currentX = startX + (targetX - startX) * eased;
            const currentY = startY + (targetY - startY) * eased;
            const success = this.safeSetPosition(header, currentX, currentY);
            if (!success) {
                this.isAnimating = false;
                this.currentAnimationTimer = null;
                if (errorCallback) errorCallback(new Error('Failed to set position'));
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
                this.hiddenPosition = null;
                this.lastVisiblePosition = null;
                if (typeof callback === 'function' && !signal.aborted) {
                    try {
                        callback();
                    } catch (err) {
                        console.error('[Movement] Show callback error:', err);
                        if (errorCallback) errorCallback(err);
                    }
                }
                console.log(`[Movement] Show from edge completed`);
            }
        };
        try {
            animate();
        } catch (err) {
            console.error('[Movement] Animation start error:', err);
            this.isAnimating = false;
            if (errorCallback) errorCallback(err);
        }
    }

    moveStep(direction) {
        const header = this.windowPool.get('header');
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
                if (typeof updateLayout === 'function') updateLayout();
                console.log(`[Movement] Step completed to (${targetX}, ${targetY})`);
            }
        };
        animate();
    }

    moveToEdge(direction) {
        const header = this.windowPool.get('header');
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
                if (typeof updateLayout === 'function') updateLayout();
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

module.exports = SmoothMovementManager; 