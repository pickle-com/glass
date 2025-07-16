const createAecModule = require('./aec.js');

let aecModPromise = null;     // 한 번만 로드
let aecMod        = null;
let aecPtr        = 0;        // Rust Aec* 1개만 재사용

/** WASM 모듈 가져오고 1회 초기화 */
async function getAec () {
  if (aecModPromise) return aecModPromise;   // 캐시

    aecModPromise = createAecModule().then((M) => {
        aecMod = M; 

        console.log('WASM Module Loaded:', M); 
        // C 심볼 → JS 래퍼 바인딩 (딱 1번)
        M.newPtr   = M.cwrap('AecNew',        'number',
                            ['number','number','number','number']);
        M.cancel   = M.cwrap('AecCancelEcho', null,
                            ['number','number','number','number','number']);
        M.destroy  = M.cwrap('AecDestroy',    null, ['number']);
        return M;
    });

  return aecModPromise;
}

// 바로 로드-실패 로그를 보기 위해
// getAec().catch(console.error);
// ---------------------------
// Constants & Globals
// ---------------------------
const SAMPLE_RATE = 24000;
const AUDIO_CHUNK_DURATION = 0.1;
const BUFFER_SIZE = 4096;

const isLinux = window.api.platform.isLinux;
const isMacOS = window.api.platform.isMacOS;

let mediaStream = null;
let micMediaStream = null;
let audioContext = null;
let audioProcessor = null;
let systemAudioContext = null;
let systemAudioProcessor = null;

let systemAudioBuffer = [];
const MAX_SYSTEM_BUFFER_SIZE = 10;

// ---------------------------
// Utility helpers (exact from renderer.js)
// ---------------------------
function isVoiceActive(audioFloat32Array, threshold = 0.005) {
    if (!audioFloat32Array || audioFloat32Array.length === 0) {
        return false;
    }

    let sumOfSquares = 0;
    for (let i = 0; i < audioFloat32Array.length; i++) {
        sumOfSquares += audioFloat32Array[i] * audioFloat32Array[i];
    }
    const rms = Math.sqrt(sumOfSquares / audioFloat32Array.length);

    // console.log(`VAD RMS: ${rms.toFixed(4)}`); // For debugging VAD threshold

    return rms > threshold;
}

function base64ToFloat32Array(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);

    for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
    }

    return float32Array;
}

function convertFloat32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        // Improved scaling to prevent clipping
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/* ───────────────────────── JS ↔︎ WASM 헬퍼 ───────────────────────── */
function int16PtrFromFloat32(mod, f32) {
  const len   = f32.length;
  const bytes = len * 2;
  const ptr   = mod._malloc(bytes);
  // HEAP16이 없으면 HEAPU8.buffer로 직접 래핑
  const heapBuf = (mod.HEAP16 ? mod.HEAP16.buffer : mod.HEAPU8.buffer);
  const i16   = new Int16Array(heapBuf, ptr, len);
  for (let i = 0; i < len; ++i) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    i16[i]  = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return { ptr, view: i16 };
}

function float32FromInt16View(i16) {
  const out = new Float32Array(i16.length);
  for (let i = 0; i < i16.length; ++i) out[i] = i16[i] / 32768;
  return out;
}

/* 필요하다면 종료 시 */
function disposeAec () {
  getAec().then(mod => { if (aecPtr) mod.destroy(aecPtr); });
}

// listenCapture.js

function runAecSync(micF32, sysF32) {
    if (!aecMod || !aecPtr || !aecMod.HEAPU8) {
        // console.log('🔊 No AEC module or heap buffer');
        return micF32;
    }

    const frameSize = 160; // AEC 모듈 초기화 시 설정한 프레임 크기
    const numFrames = Math.floor(micF32.length / frameSize);

    // 최종 처리된 오디오 데이터를 담을 버퍼
    const processedF32 = new Float32Array(micF32.length);

    // 시스템 오디오와 마이크 오디오의 길이를 맞춥니다. (안정성 확보)
    let alignedSysF32 = new Float32Array(micF32.length);
    if (sysF32.length > 0) {
        // sysF32를 micF32 길이에 맞게 자르거나 채웁니다.
        const lengthToCopy = Math.min(micF32.length, sysF32.length);
        alignedSysF32.set(sysF32.slice(0, lengthToCopy));
    }


    // 2400개 샘플을 160개 프레임으로 나누어 루프 실행
    for (let i = 0; i < numFrames; i++) {
        const offset = i * frameSize;

        // 현재 프레임에 해당하는 160개 샘플을 잘라냅니다.
        const micFrame = micF32.subarray(offset, offset + frameSize);
        const echoFrame = alignedSysF32.subarray(offset, offset + frameSize);

        // WASM 메모리에 프레임 데이터 쓰기
        const micPtr = int16PtrFromFloat32(aecMod, micFrame);
        const echoPtr = int16PtrFromFloat32(aecMod, echoFrame);
        const outPtr = aecMod._malloc(frameSize * 2); // 160 * 2 bytes

        // AEC 실행 (160개 샘플 단위)
        aecMod.cancel(aecPtr, micPtr.ptr, echoPtr.ptr, outPtr, frameSize);

        // WASM 메모리에서 처리된 프레임 데이터 읽기
        const heapBuf = (aecMod.HEAP16 ? aecMod.HEAP16.buffer : aecMod.HEAPU8.buffer);
        const outFrameI16 = new Int16Array(heapBuf, outPtr, frameSize);
        const outFrameF32 = float32FromInt16View(outFrameI16);

        // 처리된 프레임을 최종 버퍼의 올바른 위치에 복사
        processedF32.set(outFrameF32, offset);

        // 할당된 메모리 해제
        aecMod._free(micPtr.ptr);
        aecMod._free(echoPtr.ptr);
        aecMod._free(outPtr);
    }

    return processedF32;
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
    //                      여기까지가 새로운 로직
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
}


// System audio data handler
window.api.listenCapture.onSystemAudioData((event, { data }) => {
    systemAudioBuffer.push({
        data: data,
        timestamp: Date.now(),
    });

    // 오래된 데이터 제거
    if (systemAudioBuffer.length > MAX_SYSTEM_BUFFER_SIZE) {
        systemAudioBuffer = systemAudioBuffer.slice(-MAX_SYSTEM_BUFFER_SIZE);
    }
});

// ---------------------------
// Complete token tracker (exact from renderer.js)
// ---------------------------
let tokenTracker = {
    tokens: [],
    audioStartTime: null,

    addTokens(count, type = 'image') {
        const now = Date.now();
        this.tokens.push({
            timestamp: now,
            count: count,
            type: type,
        });

        this.cleanOldTokens();
    },

    calculateImageTokens(width, height) {
        const pixels = width * height;
        if (pixels <= 384 * 384) {
            return 85;
        }

        const tiles = Math.ceil(pixels / (768 * 768));
        return tiles * 85;
    },

    trackAudioTokens() {
        if (!this.audioStartTime) {
            this.audioStartTime = Date.now();
            return;
        }

        const now = Date.now();
        const elapsedSeconds = (now - this.audioStartTime) / 1000;

        const audioTokens = Math.floor(elapsedSeconds * 16);

        if (audioTokens > 0) {
            this.addTokens(audioTokens, 'audio');
            this.audioStartTime = now;
        }
    },

    cleanOldTokens() {
        const oneMinuteAgo = Date.now() - 60 * 1000;
        this.tokens = this.tokens.filter(token => token.timestamp > oneMinuteAgo);
    },

    getTokensInLastMinute() {
        this.cleanOldTokens();
        return this.tokens.reduce((total, token) => total + token.count, 0);
    },

    shouldThrottle() {
        const throttleEnabled = localStorage.getItem('throttleTokens') === 'true';
        if (!throttleEnabled) {
            return false;
        }

        const maxTokensPerMin = parseInt(localStorage.getItem('maxTokensPerMin') || '500000', 10);
        const throttleAtPercent = parseInt(localStorage.getItem('throttleAtPercent') || '75', 10);

        const currentTokens = this.getTokensInLastMinute();
        const throttleThreshold = Math.floor((maxTokensPerMin * throttleAtPercent) / 100);

        console.log(`Token check: ${currentTokens}/${maxTokensPerMin} (throttle at ${throttleThreshold})`);

        return currentTokens >= throttleThreshold;
    },

    // Reset the tracker
    reset() {
        this.tokens = [];
        this.audioStartTime = null;
    },
};

// Track audio tokens every few seconds
setInterval(() => {
    tokenTracker.trackAudioTokens();
}, 2000);

// ---------------------------
// Audio processing functions (exact from renderer.js)
// ---------------------------
async function setupMicProcessing(micStream) {
    /* ── WASM 먼저 로드 ───────────────────────── */
    const mod = await getAec();
    if (!aecPtr) aecPtr = mod.newPtr(160, 1600, 24000, 1);


    const micAudioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    await micAudioContext.resume(); 
    const micSource = micAudioContext.createMediaStreamSource(micStream);
    const micProcessor = micAudioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    micProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioBuffer.push(...inputData);
        // console.log('🎤 micProcessor.onaudioprocess');

        // samplesPerChunk(=2400) 만큼 모이면 전송
        while (audioBuffer.length >= samplesPerChunk) {
            let chunk = audioBuffer.splice(0, samplesPerChunk);
            let processedChunk = new Float32Array(chunk); // 기본값

            // ───────────────── WASM AEC ─────────────────
            if (systemAudioBuffer.length > 0) {
                const latest = systemAudioBuffer[systemAudioBuffer.length - 1];
                const sysF32 = base64ToFloat32Array(latest.data);

                // **음성 구간일 때만 런**
                processedChunk = runAecSync(new Float32Array(chunk), sysF32);
                // console.log('🔊 Applied WASM-AEC (speex)');
            } else {
                console.log('🔊 No system audio for AEC reference');
            }

            const pcm16 = convertFloat32ToInt16(processedChunk);
            const b64 = arrayBufferToBase64(pcm16.buffer);

            window.api.listenCapture.sendMicAudioContent({
                data: b64,
                mimeType: 'audio/pcm;rate=24000',
            });
        }
    };

    micSource.connect(micProcessor);
    micProcessor.connect(micAudioContext.destination);

    audioProcessor = micProcessor;
    return { context: micAudioContext, processor: micProcessor };
}

function setupLinuxMicProcessing(micStream) {
    // Setup microphone audio processing for Linux
    const micAudioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const micSource = micAudioContext.createMediaStreamSource(micStream);
    const micProcessor = micAudioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    micProcessor.onaudioprocess = async e => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioBuffer.push(...inputData);

        // Process audio in chunks
        while (audioBuffer.length >= samplesPerChunk) {
            const chunk = audioBuffer.splice(0, samplesPerChunk);
            const pcmData16 = convertFloat32ToInt16(chunk);
            const base64Data = arrayBufferToBase64(pcmData16.buffer);

            await window.api.listenCapture.sendMicAudioContent({
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            });
        }
    };

    micSource.connect(micProcessor);
    micProcessor.connect(micAudioContext.destination);

    // Store processor reference for cleanup
    audioProcessor = micProcessor;
}

function setupSystemAudioProcessing(systemStream) {
    const systemAudioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const systemSource = systemAudioContext.createMediaStreamSource(systemStream);
    const systemProcessor = systemAudioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    systemProcessor.onaudioprocess = async e => {
        const inputData = e.inputBuffer.getChannelData(0);
        if (!inputData || inputData.length === 0) return;
        
        audioBuffer.push(...inputData);

        while (audioBuffer.length >= samplesPerChunk) {
            const chunk = audioBuffer.splice(0, samplesPerChunk);
            const pcmData16 = convertFloat32ToInt16(chunk);
            const base64Data = arrayBufferToBase64(pcmData16.buffer);

            try {
                await window.api.listenCapture.sendSystemAudioContent({
                    data: base64Data,
                    mimeType: 'audio/pcm;rate=24000',
                });
            } catch (error) {
                console.error('Failed to send system audio:', error);
            }
        }
    };

    systemSource.connect(systemProcessor);
    systemProcessor.connect(systemAudioContext.destination);

    return { context: systemAudioContext, processor: systemProcessor };
}

// ---------------------------
// Main capture functions (exact from renderer.js)
// ---------------------------
async function startCapture(screenshotIntervalSeconds = 5, imageQuality = 'medium') {

    // Reset token tracker when starting new capture session
    tokenTracker.reset();
    console.log('🎯 Token tracker reset for new capture session');

    try {
        if (isMacOS) {

            const sessionActive = await window.api.listenCapture.isSessionActive();
            if (!sessionActive) {
                throw new Error('STT sessions not initialized - please wait for initialization to complete');
            }

            // On macOS, use SystemAudioDump for audio and getDisplayMedia for screen
            console.log('Starting macOS capture with SystemAudioDump...');

            // Start macOS audio capture
            const audioResult = await window.api.listenCapture.startMacosSystemAudio();
            if (!audioResult.success) {
                console.warn('[listenCapture] macOS audio start failed:', audioResult.error);

                // 이미 실행 중 → stop 후 재시도
                if (audioResult.error === 'already_running') {
                    await window.api.listenCapture.stopMacosSystemAudio();
                    await new Promise(r => setTimeout(r, 500));
                    const retry = await window.api.listenCapture.startMacosSystemAudio();
                    if (!retry.success) {
                        throw new Error('Retry failed: ' + retry.error);
                    }
                } else {
                    throw new Error('Failed to start macOS audio capture: ' + audioResult.error);
                }
            }

            try {
                micMediaStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        sampleRate: SAMPLE_RATE,
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                    video: false,
                });

                console.log('macOS microphone capture started');
                const { context, processor } = await setupMicProcessing(micMediaStream);
                audioContext = context;
                audioProcessor = processor;
            } catch (micErr) {
                console.warn('Failed to get microphone on macOS:', micErr);
            }
            ////////// for index & subjects //////////

            console.log('macOS screen capture started - audio handled by SystemAudioDump');
        } else if (isLinux) {

            const sessionActive = await window.api.listenCapture.isSessionActive();
            if (!sessionActive) {
                throw new Error('STT sessions not initialized - please wait for initialization to complete');
            }
            
            // Linux - use display media for screen capture and getUserMedia for microphone
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: 1,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false, // Don't use system audio loopback on Linux
            });

            // Get microphone input for Linux
            let micMediaStream = null;
            try {
                micMediaStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        sampleRate: SAMPLE_RATE,
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                    video: false,
                });

                console.log('Linux microphone capture started');

                // Setup audio processing for microphone on Linux
                setupLinuxMicProcessing(micMediaStream);
            } catch (micError) {
                console.warn('Failed to get microphone access on Linux:', micError);
                // Continue without microphone if permission denied
            }

            console.log('Linux screen capture started');
        } else {
            // Windows - capture mic and system audio separately using native loopback
            console.log('Starting Windows capture with native loopback audio...');

            // Ensure STT sessions are initialized before starting audio capture
            const sessionActive = await window.api.listenCapture.isSessionActive();
            if (!sessionActive) {
                throw new Error('STT sessions not initialized - please wait for initialization to complete');
            }

            // 1. Get user's microphone
            try {
                micMediaStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        sampleRate: SAMPLE_RATE,
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                    video: false,
                });
                console.log('Windows microphone capture started');
                const { context, processor } = await setupMicProcessing(micMediaStream);
                audioContext = context;
                audioProcessor = processor;
            } catch (micErr) {
                console.warn('Could not get microphone access on Windows:', micErr);
            }

            // 2. Get system audio using native Electron loopback
            try {
                mediaStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true // This will now use native loopback from our handler
                });
                
                // Verify we got audio tracks
                const audioTracks = mediaStream.getAudioTracks();
                if (audioTracks.length === 0) {
                    throw new Error('No audio track in native loopback stream');
                }
                
                console.log('Windows native loopback audio capture started');
                const { context, processor } = setupSystemAudioProcessing(mediaStream);
                systemAudioContext = context;
                systemAudioProcessor = processor;
            } catch (sysAudioErr) {
                console.error('Failed to start Windows native loopback audio:', sysAudioErr);
                // Continue without system audio
            }
        }
    } catch (err) {
        console.error('Error starting capture:', err);
        // Note: pickleGlass.e() is not available in this context, commenting out
        // pickleGlass.e().setStatus('error');
    }
}

function stopCapture() {
    // Clean up microphone resources
    if (audioProcessor) {
        audioProcessor.disconnect();
        audioProcessor = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }

    // Clean up system audio resources
    if (systemAudioProcessor) {
        systemAudioProcessor.disconnect();
        systemAudioProcessor = null;
    }
    if (systemAudioContext) {
        systemAudioContext.close();
        systemAudioContext = null;
    }

    // Stop and release media stream tracks
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    if (micMediaStream) {
        micMediaStream.getTracks().forEach(t => t.stop());
        micMediaStream = null;
    }

    // Stop macOS audio capture if running
    if (isMacOS) {
        window.api.listenCapture.stopMacosSystemAudio().catch(err => {
            console.error('Error stopping macOS audio:', err);
        });
    }
}

// ---------------------------
// Exports & global registration
// ---------------------------
module.exports = {
    getAec,          // 새로 만든 초기화 함수
    runAecSync,      // sync 버전
    disposeAec,      // 필요시 Rust 객체 파괴
    startCapture,
    stopCapture,
    isLinux,
    isMacOS,
};

// Expose functions to global scope for external access (exact from renderer.js)
if (typeof window !== 'undefined') {
    window.listenCapture = module.exports;
    window.pickleGlass = window.pickleGlass || {};
    window.pickleGlass.startCapture = startCapture;
    window.pickleGlass.stopCapture = stopCapture;
} 