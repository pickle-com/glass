// animationUtils.js

function animateToPosition(manager, header, targetX, targetY) {
    if (!manager._isWindowValid(header)) return;
    
    manager.isAnimating = true;
    const startX = manager.headerPosition.x;
    const startY = manager.headerPosition.y;
    const startTime = Date.now();

    if (!Number.isFinite(targetX) || !Number.isFinite(targetY) || !Number.isFinite(startX) || !Number.isFinite(startY)) {
        manager.isAnimating = false;
        return;
    }

    const animate = () => {
        if (!manager._isWindowValid(header)) return;

        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / manager.animationDuration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentX = startX + (targetX - startX) * eased;
        const currentY = startY + (targetY - startY) * eased;

        if (!Number.isFinite(currentX) || !Number.isFinite(currentY)) {
            manager.isAnimating = false;
            return;
        }

        if (!manager._isWindowValid(header)) return;
        header.setPosition(Math.round(currentX), Math.round(currentY));

        if (progress < 1) {
            manager.animationFrameId = setTimeout(animate, 8);
        } else {
            manager.animationFrameId = null;
            manager.headerPosition = { x: targetX, y: targetY };
            if (Number.isFinite(targetX) && Number.isFinite(targetY)) {
                if (!manager._isWindowValid(header)) return;
                header.setPosition(Math.round(targetX), Math.round(targetY));
            }
            manager.isAnimating = false;
            manager.updateLayout();
        }
    };
    animate();
}

module.exports = { animateToPosition }; 