// renderer.js
const listenCapture = require('./listenCapture.js');
const params        = new URLSearchParams(window.location.search);
const isListenView  = params.get('view') === 'listen';


window.pickleGlass = {
    startCapture: listenCapture.startCapture,
    stopCapture: listenCapture.stopCapture,
    isLinux: listenCapture.isLinux,
    isMacOS: listenCapture.isMacOS,
    captureManualScreenshot: listenCapture.captureManualScreenshot,
    getCurrentScreenshot: listenCapture.getCurrentScreenshot,
};


window.api.renderer.onChangeListenCaptureState((_event, { status }) => {
    if (!isListenView) {
        console.log('[Renderer] Non-listen view: ignoring capture-state change');
        return;
    }
    if (status === "stop") {
        console.log('[Renderer] Session ended – stopping local capture');
        listenCapture.stopCapture();
    } else {
        console.log('[Renderer] Session initialized – starting local capture');
        listenCapture.startCapture();
    }
});
