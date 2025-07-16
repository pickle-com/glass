# Refactor Plan: Non-Window Logic Migration from windowManager.js

## Goal
`windowManager.js`를 순수 창 관리 모듈로 만들기 위해 비즈니스 로직을 해당 서비스와 `featureBridge.js`로 이전.

## Steps (based on initial plan)
1. **Shortcuts**: Completed. Logic moved to `shortcutsService.js` and IPC to `featureBridge.js`. Used `internalBridge` for coordination.

2. **Screenshot**: Next. Move `captureScreenshot` function and related IPC handlers from `windowManager.js` to `askService.js` (since it's primarily used there). Update `askService.js` to use its own screenshot method. Add IPC handlers to `featureBridge.js` if needed.

3. **System Permissions**: Create new `permissionService.js` in `src/features/common/services/`. Move all permission-related logic (check, request, open preferences, mark completed, etc.) and IPC handlers from `windowManager.js` to the new service and `featureBridge.js`.

4. **API Key / Model State**: Completely remove from `windowManager.js` (e.g., `setupApiKeyIPC` and helpers). Ensure all usages (e.g., in `askService.js`) directly require and use `modelStateService.js` instead.

## Notes
- Maintain original logic without changes.
- Break circular dependencies if found.
- Use `internalBridge` for inter-module communication where appropriate.
- After each step, verify no errors and test functionality. 