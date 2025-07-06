const { BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const { createSTT } = require('../../../common/ai/factory');
const { getStoredApiKey, getStoredProvider } = require('../../../electron/windowManager');

const COMPLETION_DEBOUNCE_MS = 2000;

class SttService {
    constructor() {
        this.mySttSession = null;
        this.theirSttSession = null;
        this.myCurrentUtterance = '';
        this.theirCurrentUtterance = '';
        
        this.myLastPartialText = '';
        this.theirLastPartialText = '';
        this.myInactivityTimer = null;
        this.theirInactivityTimer = null;
        
        // Turn-completion debouncing
        this.myCompletionBuffer = '';
        this.theirCompletionBuffer = '';
        this.myCompletionTimer = null;
        this.theirCompletionTimer = null;
        
        // System audio capture
        this.systemAudioProc = null;
        
        // Callbacks
        this.onTranscriptionComplete = null;
        this.onStatusUpdate = null;
    }

    setCallbacks({ onTranscriptionComplete, onStatusUpdate }) {
        this.onTranscriptionComplete = onTranscriptionComplete;
        this.onStatusUpdate = onStatusUpdate;
    }

    async getApiKey() {
        const storedKey = await getStoredApiKey();
        if (storedKey) {
            console.log('[SttService] Using stored API key');
            return storedKey;
        }

        const envKey = process.env.OPENAI_API_KEY;
        if (envKey) {
            console.log('[SttService] Using environment API key');
            return envKey;
        }

        console.error('[SttService] No API key found in storage or environment');
        return null;
    }

    async getAiProvider() {
        try {
            const { ipcRenderer } = require('electron');
            const provider = await ipcRenderer.invoke('get-ai-provider');
            return provider || 'openai';
        } catch (error) {
            return getStoredProvider ? getStoredProvider() : 'openai';
        }
    }

    sendToRenderer(channel, data) {
        BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) {
                win.webContents.send(channel, data);
            }
        });
    }

    flushMyCompletion() {
        if (!this.myCompletionBuffer.trim()) return;

        const finalText = this.myCompletionBuffer.trim();
        
        // Notify completion callback
        if (this.onTranscriptionComplete) {
            this.onTranscriptionComplete('Me', finalText);
        }
        
        // Send to renderer as final
        this.sendToRenderer('stt-update', {
            speaker: 'Me',
            text: finalText,
            isPartial: false,
            isFinal: true,
            timestamp: Date.now(),
        });

        this.myCompletionBuffer = '';
        this.myCompletionTimer = null;
        this.myCurrentUtterance = '';
        
        if (this.onStatusUpdate) {
            this.onStatusUpdate('Listening...');
        }
    }

    flushTheirCompletion() {
        if (!this.theirCompletionBuffer.trim()) return;

        const finalText = this.theirCompletionBuffer.trim();
        
        // Notify completion callback
        if (this.onTranscriptionComplete) {
            this.onTranscriptionComplete('Them', finalText);
        }
        
        // Send to renderer as final
        this.sendToRenderer('stt-update', {
            speaker: 'Them',
            text: finalText,
            isPartial: false,
            isFinal: true,
            timestamp: Date.now(),
        });

        this.theirCompletionBuffer = '';
        this.theirCompletionTimer = null;
        this.theirCurrentUtterance = '';
        
        if (this.onStatusUpdate) {
            this.onStatusUpdate('Listening...');
        }
    }

    debounceMyCompletion(text) {
        // 상대방이 말하고 있던 경우, 화자가 변경되었으므로 즉시 상대방의 말풍선을 완성합니다.
        if (this.theirCompletionTimer) {
            clearTimeout(this.theirCompletionTimer);
            this.flushTheirCompletion();
        }

        this.myCompletionBuffer += (this.myCompletionBuffer ? ' ' : '') + text;

        if (this.myCompletionTimer) clearTimeout(this.myCompletionTimer);
        this.myCompletionTimer = setTimeout(() => this.flushMyCompletion(), COMPLETION_DEBOUNCE_MS);
    }

    debounceTheirCompletion(text) {
        // 내가 말하고 있던 경우, 화자가 변경되었으므로 즉시 내 말풍선을 완성합니다.
        if (this.myCompletionTimer) {
            clearTimeout(this.myCompletionTimer);
            this.flushMyCompletion();
        }

        this.theirCompletionBuffer += (this.theirCompletionBuffer ? ' ' : '') + text;

        if (this.theirCompletionTimer) clearTimeout(this.theirCompletionTimer);
        this.theirCompletionTimer = setTimeout(() => this.flushTheirCompletion(), COMPLETION_DEBOUNCE_MS);
    }

    async initializeSttSessions(language = 'en') {
        const effectiveLanguage = process.env.OPENAI_TRANSCRIBE_LANG || language || 'en';
        
        const API_KEY = await this.getApiKey();
        if (!API_KEY) {
            throw new Error('No API key available');
        }

        const provider = await this.getAiProvider();
        const isGemini = provider === 'gemini';
        console.log(`[SttService] Initializing STT for provider: ${provider}`);

        const handleMyMessage = message => {
            if (isGemini) {
                const text = message.serverContent?.inputTranscription?.text || '';
                if (text && text.trim()) {
                    const finalUtteranceText = text.trim().replace(/<noise>/g, '').trim();
                    if (finalUtteranceText && finalUtteranceText !== '.') {
                        this.debounceMyCompletion(finalUtteranceText);
                    }
                }
            } else {
                const type = message.type;
                const text = message.transcript || message.delta || (message.alternatives && message.alternatives[0]?.transcript) || '';

                if (type === 'conversation.item.input_audio_transcription.delta') {
                    if (this.myCompletionTimer) clearTimeout(this.myCompletionTimer);
                    this.myCompletionTimer = null;
                    this.myCurrentUtterance += text;
                    const continuousText = this.myCompletionBuffer + (this.myCompletionBuffer ? ' ' : '') + this.myCurrentUtterance;
                    if (text && !text.includes('vq_lbr_audio_')) {
                        this.sendToRenderer('stt-update', {
                            speaker: 'Me',
                            text: continuousText,
                            isPartial: true,
                            isFinal: false,
                            timestamp: Date.now(),
                        });
                    }
                } else if (type === 'conversation.item.input_audio_transcription.completed') {
                    if (text && text.trim()) {
                        const finalUtteranceText = text.trim();
                        this.myCurrentUtterance = '';
                        this.debounceMyCompletion(finalUtteranceText);
                    }
                }
            }

            if (message.error) {
                console.error('[Me] STT Session Error:', message.error);
            }
        };

        const handleTheirMessage = message => {
            if (isGemini) {
                const text = message.serverContent?.inputTranscription?.text || '';
                if (text && text.trim()) {
                    const finalUtteranceText = text.trim().replace(/<noise>/g, '').trim();
                    if (finalUtteranceText && finalUtteranceText !== '.') {
                        this.debounceTheirCompletion(finalUtteranceText);
                    }
                }
            } else {
                const type = message.type;
                const text = message.transcript || message.delta || (message.alternatives && message.alternatives[0]?.transcript) || '';
                if (type === 'conversation.item.input_audio_transcription.delta') {
                    if (this.theirCompletionTimer) clearTimeout(this.theirCompletionTimer);
                    this.theirCompletionTimer = null;
                    this.theirCurrentUtterance += text;
                    const continuousText = this.theirCompletionBuffer + (this.theirCompletionBuffer ? ' ' : '') + this.theirCurrentUtterance;
                    if (text && !text.includes('vq_lbr_audio_')) {
                        this.sendToRenderer('stt-update', {
                            speaker: 'Them',
                            text: continuousText,
                            isPartial: true,
                            isFinal: false,
                            timestamp: Date.now(),
                        });
                    }
                } else if (type === 'conversation.item.input_audio_transcription.completed') {
                    if (text && text.trim()) {
                        const finalUtteranceText = text.trim();
                        this.theirCurrentUtterance = '';
                        this.debounceTheirCompletion(finalUtteranceText);
                    }
                }
            }
            
            if (message.error) {
                console.error('[Them] STT Session Error:', message.error);
            }
        };

        const mySttConfig = {
            language: effectiveLanguage,
            callbacks: {
                onmessage: handleMyMessage,
                onerror: error => console.error('My STT session error:', error.message),
                onclose: event => console.log('My STT session closed:', event.reason),
            },
        };
        
        const theirSttConfig = {
            language: effectiveLanguage,
            callbacks: {
                onmessage: handleTheirMessage,
                onerror: error => console.error('Their STT session error:', error.message),
                onclose: event => console.log('Their STT session closed:', event.reason),
            },
        };

        // Determine auth options for providers that support it
        const authService = require('../../../common/services/authService');
        const userState = authService.getCurrentUser();
        const loggedIn = userState.isLoggedIn;
        
        const sttOptions = {
            apiKey: API_KEY,
            language: effectiveLanguage,
            usePortkey: !isGemini && loggedIn, // Only OpenAI supports Portkey
            portkeyVirtualKey: loggedIn ? API_KEY : undefined
        };

        [this.mySttSession, this.theirSttSession] = await Promise.all([
            createSTT(provider, { ...sttOptions, callbacks: mySttConfig.callbacks }),
            createSTT(provider, { ...sttOptions, callbacks: theirSttConfig.callbacks }),
        ]);

        console.log('✅ Both STT sessions initialized successfully.');
        return true;
    }

    async sendAudioContent(data, mimeType) {
        const provider = await this.getAiProvider();
        const isGemini = provider === 'gemini';
        
        if (!this.mySttSession) {
            throw new Error('User STT session not active');
        }

        const payload = isGemini
            ? { audio: { data, mimeType: mimeType || 'audio/pcm;rate=24000' } }
            : data;

        await this.mySttSession.sendRealtimeInput(payload);
    }

    killExistingSystemAudioDump() {
        return new Promise(resolve => {
            console.log('Checking for existing SystemAudioDump processes...');

            const killProc = spawn('pkill', ['-f', 'SystemAudioDump'], {
                stdio: 'ignore',
            });

            killProc.on('close', code => {
                if (code === 0) {
                    console.log('Killed existing SystemAudioDump processes');
                } else {
                    console.log('No existing SystemAudioDump processes found');
                }
                resolve();
            });

            killProc.on('error', err => {
                console.log('Error checking for existing processes (this is normal):', err.message);
                resolve();
            });

            setTimeout(() => {
                killProc.kill();
                resolve();
            }, 2000);
        });
    }

    async startMacOSAudioCapture() {
        if (process.platform !== 'darwin' || !this.theirSttSession) return false;

        await this.killExistingSystemAudioDump();
        console.log('Starting macOS audio capture for "Them"...');

        const { app } = require('electron');
        const path = require('path');
        const systemAudioPath = app.isPackaged
            ? path.join(process.resourcesPath, 'app.asar.unpacked', 'src', 'assets', 'SystemAudioDump')
            : path.join(app.getAppPath(), 'src', 'assets', 'SystemAudioDump');

        console.log('SystemAudioDump path:', systemAudioPath);

        this.systemAudioProc = spawn(systemAudioPath, [], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        if (!this.systemAudioProc.pid) {
            console.error('Failed to start SystemAudioDump');
            return false;
        }

        console.log('SystemAudioDump started with PID:', this.systemAudioProc.pid);

        const CHUNK_DURATION = 0.1;
        const SAMPLE_RATE = 24000;
        const BYTES_PER_SAMPLE = 2;
        const CHANNELS = 2;
        const CHUNK_SIZE = SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS * CHUNK_DURATION;

        let audioBuffer = Buffer.alloc(0);

        const provider = await this.getAiProvider();
        const isGemini = provider === 'gemini';

        this.systemAudioProc.stdout.on('data', async data => {
            audioBuffer = Buffer.concat([audioBuffer, data]);

            while (audioBuffer.length >= CHUNK_SIZE) {
                const chunk = audioBuffer.slice(0, CHUNK_SIZE);
                audioBuffer = audioBuffer.slice(CHUNK_SIZE);

                const monoChunk = CHANNELS === 2 ? this.convertStereoToMono(chunk) : chunk;
                const base64Data = monoChunk.toString('base64');

                this.sendToRenderer('system-audio-data', { data: base64Data });

                if (this.theirSttSession) {
                    try {
                        const payload = isGemini
                            ? { audio: { data: base64Data, mimeType: 'audio/pcm;rate=24000' } }
                            : base64Data;
                        await this.theirSttSession.sendRealtimeInput(payload);
                    } catch (err) {
                        console.error('Error sending system audio:', err.message);
                    }
                }
            }
        });

        this.systemAudioProc.stderr.on('data', data => {
            console.error('SystemAudioDump stderr:', data.toString());
        });

        this.systemAudioProc.on('close', code => {
            console.log('SystemAudioDump process closed with code:', code);
            this.systemAudioProc = null;
        });

        this.systemAudioProc.on('error', err => {
            console.error('SystemAudioDump process error:', err);
            this.systemAudioProc = null;
        });

        return true;
    }

    convertStereoToMono(stereoBuffer) {
        const samples = stereoBuffer.length / 4;
        const monoBuffer = Buffer.alloc(samples * 2);

        for (let i = 0; i < samples; i++) {
            const leftSample = stereoBuffer.readInt16LE(i * 4);
            monoBuffer.writeInt16LE(leftSample, i * 2);
        }

        return monoBuffer;
    }

    stopMacOSAudioCapture() {
        if (this.systemAudioProc) {
            console.log('Stopping SystemAudioDump...');
            this.systemAudioProc.kill('SIGTERM');
            this.systemAudioProc = null;
        }
    }

    isSessionActive() {
        return !!this.mySttSession && !!this.theirSttSession;
    }

    async closeSessions() {
        this.stopMacOSAudioCapture();

        // Clear timers
        if (this.myInactivityTimer) {
            clearTimeout(this.myInactivityTimer);
            this.myInactivityTimer = null;
        }
        if (this.theirInactivityTimer) {
            clearTimeout(this.theirInactivityTimer);
            this.theirInactivityTimer = null;
        }
        if (this.myCompletionTimer) {
            clearTimeout(this.myCompletionTimer);
            this.myCompletionTimer = null;
        }
        if (this.theirCompletionTimer) {
            clearTimeout(this.theirCompletionTimer);
            this.theirCompletionTimer = null;
        }

        const closePromises = [];
        if (this.mySttSession) {
            closePromises.push(this.mySttSession.close());
            this.mySttSession = null;
        }
        if (this.theirSttSession) {
            closePromises.push(this.theirSttSession.close());
            this.theirSttSession = null;
        }

        await Promise.all(closePromises);
        console.log('All STT sessions closed.');

        // Reset state
        this.myCurrentUtterance = '';
        this.theirCurrentUtterance = '';
        this.myLastPartialText = '';
        this.theirLastPartialText = '';
        this.myCompletionBuffer = '';
        this.theirCompletionBuffer = '';
    }
}

module.exports = SttService; 