// layoutUtils.js

function determineLayoutStrategy(headerBounds, screenWidth, screenHeight, relativeX, relativeY) {
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

function boundsOverlap(bounds1, bounds2) {
    const margin = 10;
    return !(
        bounds1.x + bounds1.width + margin < bounds2.x ||
        bounds2.x + bounds2.width + margin < bounds1.x ||
        bounds1.y + bounds1.height + margin < bounds2.y ||
        bounds2.y + bounds2.height + margin < bounds1.y
    );
}

module.exports = { determineLayoutStrategy, boundsOverlap }; 