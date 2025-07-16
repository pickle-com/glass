// src/bridge/internalBridge.js
const { EventEmitter } = require('events');

// FeatureCore와 WindowCore를 잇는 내부 이벤트 버스
const internalBridge = new EventEmitter();
module.exports = internalBridge;

// 예시 이벤트
// internalBridge.on('content-protection-changed', (enabled) => {
//   // windowManager에서 처리
// });