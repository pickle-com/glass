// renderer.js
const { ipcRenderer } = require('electron');
const { makeStreamingChatCompletionWithPortkey } = require('../../common/services/aiProviderService.js');

let mediaStream = null;
let screenshotInterval = null;
let audioContext = null;
let audioProcessor = null;
let micMediaStream = null;
let audioBuffer = [];
const SAMPLE_RATE = 24000;
const AUDIO_CHUNK_DURATION = 0.1;
const BUFFER_SIZE = 4096;

let systemAudioBuffer = [];
const MAX_SYSTEM_BUFFER_SIZE = 10;

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

let currentImageQuality = 'medium'; // Store current image quality for manual screenshots
let lastScreenshotBase64 = null; // Store the latest screenshot

let realtimeConversationHistory = [];

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

async function queryLoginState() {
    const userState = await ipcRenderer.invoke('get-current-user');
    return userState;
}

class SimpleAEC {
    constructor() {
        this.adaptiveFilter = new Float32Array(1024);
        this.mu = 0.2;
        this.echoDelay = 100;
        this.sampleRate = 24000;
        this.delaySamples = Math.floor((this.echoDelay / 1000) * this.sampleRate);

        this.echoGain = 0.5;
        this.noiseFloor = 0.01;

        // 🔧 Adaptive-gain parameters (User-tuned, very aggressive)
        this.targetErr = 0.002;
        this.adaptRate  = 0.1;

        console.log('🎯 AEC initialized (hyper-aggressive)');
    }

    process(micData, systemData) {
        if (!systemData || systemData.length === 0) {
            return micData;
        }

        for (let i = 0; i < systemData.length; i++) {
            if (systemData[i] > 0.98) systemData[i] = 0.98;
            else if (systemData[i] < -0.98) systemData[i] = -0.98;

            systemData[i] = Math.tanh(systemData[i] * 4);
        }

        let sum2 = 0;
        for (let i = 0; i < systemData.length; i++) sum2 += systemData[i] * systemData[i];
        const rms = Math.sqrt(sum2 / systemData.length);
        const targetRms = 0.08;                   // 🔧 기준 RMS (기존 0.1)
        const scale = targetRms / (rms + 1e-6);   // 1e-6: 0-division 방지

        const output = new Float32Array(micData.length);

        const optimalDelay = this.findOptimalDelay(micData, systemData);

        for (let i = 0; i < micData.length; i++) {
            let echoEstimate = 0;

            for (let d = -500; d <= 500; d += 100) {
                const delayIndex = i - optimalDelay - d;
                if (delayIndex >= 0 && delayIndex < systemData.length) {
                    const weight = Math.exp(-Math.abs(d) / 1000);
                    echoEstimate += systemData[delayIndex] * scale * this.echoGain * weight;
                }
            }

            output[i] = micData[i] - echoEstimate * 0.9;

            if (Math.abs(output[i]) < this.noiseFloor) {
                output[i] *= 0.5;
            }

            if (this.isSimilarToSystem(output[i], systemData, i, optimalDelay)) {
                output[i] *= 0.25;
            }

            output[i] = Math.max(-1, Math.min(1, output[i]));
        }


        let errSum = 0;
        for (let i = 0; i < output.length; i++) errSum += output[i] * output[i];
        const errRms = Math.sqrt(errSum / output.length);

        const err = errRms - this.targetErr;
        this.echoGain += this.adaptRate * err;      // 비례 제어
        this.echoGain  = Math.max(0, Math.min(1, this.echoGain));

        return output;
    }

    findOptimalDelay(micData, systemData) {
        let maxCorr = 0;
        let optimalDelay = this.delaySamples;

        for (let delay = 0; delay < 5000 && delay < systemData.length; delay += 200) {
            let corr = 0;
            let count = 0;

            for (let i = 0; i < Math.min(500, micData.length); i++) {
                if (i + delay < systemData.length) {
                    corr += micData[i] * systemData[i + delay];
                    count++;
                }
            }

            if (count > 0) {
                corr = Math.abs(corr / count);
                if (corr > maxCorr) {
                    maxCorr = corr;
                    optimalDelay = delay;
                }
            }
        }

        return optimalDelay;
    }

    isSimilarToSystem(sample, systemData, index, delay) {
        const windowSize = 50;
        let similarity = 0;

        for (let i = -windowSize; i <= windowSize; i++) {
            const sysIndex = index - delay + i;
            if (sysIndex >= 0 && sysIndex < systemData.length) {
                similarity += Math.abs(sample - systemData[sysIndex]);
            }
        }

        return similarity / (2 * windowSize + 1) < 0.15;
    }
}

let aecProcessor = new SimpleAEC();

const isLinux = process.platform === 'linux';
const isMacOS = process.platform === 'darwin';

window.pickleGlass = window.pickleGlass || {};

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

function pickleGlassElement() {
    return document.getElementById('pickle-glass');
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

async function initializeopenai(profile = 'interview', language = 'en') {
    // The API key is now handled in the main process from .env file.
    // We just need to trigger the initialization.
    try {
        console.log(`Requesting OpenAI initialization with profile: ${profile}, language: ${language}`);
        const success = await ipcRenderer.invoke('initialize-openai', profile, language);
        if (success) {
            // The status will be updated via 'update-status' event from the main process.
            console.log('OpenAI initialization successful.');
        } else {
            console.error('OpenAI initialization failed.');
            const appElement = pickleGlassElement();
            if (appElement && typeof appElement.setStatus === 'function') {
                appElement.setStatus('Initialization Failed');
            }
        }
    } catch (error) {
        console.error('Error during OpenAI initialization IPC call:', error);
        const appElement = pickleGlassElement();
        if (appElement && typeof appElement.setStatus === 'function') {
            appElement.setStatus('Error');
        }
    }
}


ipcRenderer.on('system-audio-data', (event, { data }) => {
    systemAudioBuffer.push({
        data: data,
        timestamp: Date.now(),
    });

    // 오래된 데이터 제거
    if (systemAudioBuffer.length > MAX_SYSTEM_BUFFER_SIZE) {
        systemAudioBuffer = systemAudioBuffer.slice(-MAX_SYSTEM_BUFFER_SIZE);
    }

    console.log('📥 Received system audio for AEC reference');
});

// Listen for status updates
ipcRenderer.on('update-status', (event, status) => {
    console.log('Status update:', status);
    pickleGlass.e().setStatus(status);
});

// Listen for real-time STT updates
ipcRenderer.on('stt-update', (event, data) => {
    console.log('Renderer.js stt-update', data);
    const { speaker, text, isFinal, isPartial, timestamp } = data;

    if (isPartial) {
        console.log(`🔄 [${speaker} - partial]: ${text}`);
    } else if (isFinal) {
        console.log(`✅ [${speaker} - final]: ${text}`);

        const speakerText = speaker.toLowerCase();
        const conversationText = `${speakerText}: ${text.trim()}`;

        realtimeConversationHistory.push(conversationText);

        if (realtimeConversationHistory.length > 30) {
            realtimeConversationHistory = realtimeConversationHistory.slice(-30);
        }

        console.log(`📝 Updated realtime conversation history: ${realtimeConversationHistory.length} texts`);
        console.log(`📋 Latest text: ${conversationText}`);
    }

    if (pickleGlass.e() && typeof pickleGlass.e().updateRealtimeTranscription === 'function') {
        pickleGlass.e().updateRealtimeTranscription({
            speaker,
            text,
            isFinal,
            isPartial,
            timestamp,
        });
    }
});


ipcRenderer.on('update-structured-data', (_, structuredData) => {
    console.log('📥 Received structured data update:', structuredData);
    window.pickleGlass.structuredData = structuredData;
    window.pickleGlass.setStructuredData(structuredData);
});
window.pickleGlass.structuredData = {
    summary: [],
    topic: { header: '', bullets: [] },
    actions: [],
};
window.pickleGlass.setStructuredData = data => {
    window.pickleGlass.structuredData = data;
    pickleGlass.e()?.updateStructuredData?.(data);
};

async function startCapture(screenshotIntervalSeconds = 5, imageQuality = 'medium') {
    // Store the image quality for manual screenshots
    currentImageQuality = imageQuality;

    // Reset token tracker when starting new capture session
    tokenTracker.reset();
    console.log('🎯 Token tracker reset for new capture session');

    try {
        if (isMacOS) {
            // On macOS, use SystemAudioDump for audio and getDisplayMedia for screen
            console.log('Starting macOS capture with SystemAudioDump...');

            // Start macOS audio capture
            const audioResult = await ipcRenderer.invoke('start-macos-audio');
            if (!audioResult.success) {
                throw new Error('Failed to start macOS audio capture: ' + audioResult.error);
            }

            // Initialize screen capture in main process
            const screenResult = await ipcRenderer.invoke('start-screen-capture');
            if (!screenResult.success) {
                throw new Error('Failed to start screen capture: ' + screenResult.error);
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
                setupMicProcessing(micMediaStream);
            } catch (micErr) {
                console.warn('Failed to get microphone on macOS:', micErr);
            }
            ////////// for index & subjects //////////

            console.log('macOS screen capture started - audio handled by SystemAudioDump');
        } else if (isLinux) {
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
            // Windows - use display media for audio, main process for screenshots
            const screenResult = await ipcRenderer.invoke('start-screen-capture');
            if (!screenResult.success) {
                throw new Error('Failed to start screen capture: ' + screenResult.error);
            }

            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: false, // We don't need video in renderer
                audio: {
                    sampleRate: SAMPLE_RATE,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            console.log('Windows capture started with loopback audio');

            // Setup audio processing for Windows loopback audio only
            setupWindowsLoopbackProcessing();
        }

        // console.log('MediaStream obtained:', {
        //     hasVideo: mediaStream.getVideoTracks().length > 0,
        //     hasAudio: mediaStream.getAudioTracks().length > 0,
        //     videoTrack: mediaStream.getVideoTracks()[0]?.getSettings(),
        // });

        // Start capturing screenshots - check if manual mode
        if (screenshotIntervalSeconds === 'manual' || screenshotIntervalSeconds === 'Manual') {
            console.log('Manual mode enabled - screenshots will be captured on demand only');
            // Don't start automatic capture in manual mode
        } else {
            // 스크린샷 기능 활성화 (chatModel에서 사용)
            const intervalMilliseconds = parseInt(screenshotIntervalSeconds) * 1000;
            screenshotInterval = setInterval(() => captureScreenshot(imageQuality), intervalMilliseconds);

            // Capture first screenshot immediately
            setTimeout(() => captureScreenshot(imageQuality), 100);
            console.log(`📸 Screenshot capture enabled with ${screenshotIntervalSeconds}s interval`);
        }
    } catch (err) {
        console.error('Error starting capture:', err);
        pickleGlass.e().setStatus('error');
    }
}

function setupMicProcessing(micStream) {
    const micAudioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const micSource = micAudioContext.createMediaStreamSource(micStream);
    const micProcessor = micAudioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    micProcessor.onaudioprocess = async e => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioBuffer.push(...inputData);

        while (audioBuffer.length >= samplesPerChunk) {
            let chunk = audioBuffer.splice(0, samplesPerChunk);
            let processedChunk = new Float32Array(chunk);

            // Check for system audio and apply AEC only if voice is active
            if (aecProcessor && systemAudioBuffer.length > 0) {
                const latestSystemAudio = systemAudioBuffer[systemAudioBuffer.length - 1];
                const systemFloat32 = base64ToFloat32Array(latestSystemAudio.data);

                // Apply AEC only when system audio has active speech
                if (isVoiceActive(systemFloat32)) {
                    processedChunk = aecProcessor.process(new Float32Array(chunk), systemFloat32);
                    console.log('🔊 Applied AEC because system audio is active');
                }
            }

            const pcmData16 = convertFloat32ToInt16(processedChunk);
            const base64Data = arrayBufferToBase64(pcmData16.buffer);

            await ipcRenderer.invoke('send-audio-content', {
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            });
        }
    };

    micSource.connect(micProcessor);
    micProcessor.connect(micAudioContext.destination);

    audioProcessor = micProcessor;
}
////////// for index & subjects //////////

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

            await ipcRenderer.invoke('send-audio-content', {
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

function setupWindowsLoopbackProcessing() {
    // Setup audio processing for Windows loopback audio only
    audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const source = audioContext.createMediaStreamSource(mediaStream);
    audioProcessor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    audioProcessor.onaudioprocess = async e => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioBuffer.push(...inputData);

        // Process audio in chunks
        while (audioBuffer.length >= samplesPerChunk) {
            const chunk = audioBuffer.splice(0, samplesPerChunk);
            const pcmData16 = convertFloat32ToInt16(chunk);
            const base64Data = arrayBufferToBase64(pcmData16.buffer);

            await ipcRenderer.invoke('send-audio-content', {
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            });
        }
    };

    source.connect(audioProcessor);
    audioProcessor.connect(audioContext.destination);
}

async function captureScreenshot(imageQuality = 'medium', isManual = false) {
    console.log(`Capturing ${isManual ? 'manual' : 'automated'} screenshot...`);

    // Check rate limiting for automated screenshots only
    if (!isManual && tokenTracker.shouldThrottle()) {
        console.log('⚠️ Automated screenshot skipped due to rate limiting');
        return;
    }

    try {
        // Request screenshot from main process
        const result = await ipcRenderer.invoke('capture-screenshot', {
            quality: imageQuality,
        });

        if (result.success && result.base64) {
            // Store the latest screenshot
            lastScreenshotBase64 = result.base64;

            if (sendResult.success) {
                // Track image tokens after successful send
                const imageTokens = tokenTracker.calculateImageTokens(result.width || 1920, result.height || 1080);
                tokenTracker.addTokens(imageTokens, 'image');
                console.log(`📊 Image sent successfully - ${imageTokens} tokens used (${result.width}x${result.height})`);
            } else {
                console.error('Failed to send image:', sendResult.error);
            }
        } else {
            console.error('Failed to capture screenshot:', result.error);
        }
    } catch (error) {
        console.error('Error capturing screenshot:', error);
    }
}

async function captureManualScreenshot(imageQuality = null) {
    console.log('Manual screenshot triggered');
    const quality = imageQuality || currentImageQuality;
    await captureScreenshot(quality, true);
}

// Expose functions to global scope for external access
window.captureManualScreenshot = captureManualScreenshot;

function stopCapture() {
    if (screenshotInterval) {
        clearInterval(screenshotInterval);
        screenshotInterval = null;
    }

    if (audioProcessor) {
        audioProcessor.disconnect();
        audioProcessor = null;
    }

    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    if (micMediaStream) {
        micMediaStream.getTracks().forEach(t => t.stop());
        micMediaStream = null;
    }

    // Stop screen capture in main process
    ipcRenderer.invoke('stop-screen-capture').catch(err => {
        console.error('Error stopping screen capture:', err);
    });

    // Stop macOS audio capture if running
    if (isMacOS) {
        ipcRenderer.invoke('stop-macos-audio').catch(err => {
            console.error('Error stopping macOS audio:', err);
        });
    }
}

async function getCurrentScreenshot() {
    try {
        // First try to get a fresh screenshot from main process
        const result = await ipcRenderer.invoke('get-current-screenshot');

        if (result.success && result.base64) {
            console.log('📸 Got fresh screenshot from main process');
            return result.base64;
        }

        // If no screenshot available, capture one now
        console.log('📸 No screenshot available, capturing new one');
        const captureResult = await ipcRenderer.invoke('capture-screenshot', {
            quality: currentImageQuality,
        });

        if (captureResult.success && captureResult.base64) {
            lastScreenshotBase64 = captureResult.base64;
            return captureResult.base64;
        }

        // Fallback to last stored screenshot
        if (lastScreenshotBase64) {
            console.log('📸 Using cached screenshot');
            return lastScreenshotBase64;
        }

        throw new Error('Failed to get screenshot');
    } catch (error) {
        console.error('Error getting current screenshot:', error);
        return null;
    }
}

function formatRealtimeConversationHistory() {
    if (realtimeConversationHistory.length === 0) return 'No conversation history available.';

    return realtimeConversationHistory.slice(-30).join('\n');
}

window.pickleGlass = {
    initializeopenai,
    startCapture,
    stopCapture,
    isLinux: isLinux,
    isMacOS: isMacOS,
    e: pickleGlassElement,
};

// -------------------------------------------------------
// 🔔 React to session state changes from the main process
// When the session ends (isActive === false), ensure we stop
// all local capture pipelines (mic, screen, etc.).
// -------------------------------------------------------
ipcRenderer.on('session-state-changed', (_event, { isActive }) => {
    if (!isActive) {
        console.log('[Renderer] Session ended – stopping local capture');
        stopCapture();
    } else {
        console.log('[Renderer] New session started – clearing in-memory history and summaries');

        // Reset live conversation & analysis caches
        realtimeConversationHistory = [];

        const blankData = {
            summary: [],
            topic: { header: '', bullets: [] },
            actions: [],
            followUps: [],
        };
        window.pickleGlass.setStructuredData(blankData);
    }
});
