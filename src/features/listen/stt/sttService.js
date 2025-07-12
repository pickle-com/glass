const { BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const { createSTT } = require('../../../common/ai/factory');
const { getStoredApiKey, getStoredProvider, getCurrentModelInfo } = require('../../../electron/windowManager');
const { getSettings } = require('../../settings/settingsService');

const COMPLETION_DEBOUNCE_MS = 2000;

class SttService {
    constructor() {
        this.mySttSession = null;
        this.theirSttSession = null;
        this.myCurrentUtterance = '';
        this.theirCurrentUtterance = '';
        
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

        this.modelInfo = null; 
    }

    setCallbacks({ onTranscriptionComplete, onStatusUpdate }) {
        this.onTranscriptionComplete = onTranscriptionComplete;
        this.onStatusUpdate = onStatusUpdate;
    }

    sendToRenderer(channel, data) {
        BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) {
                win.webContents.send(channel, data);
            }
        });
    }

    flushMyCompletion() {
        const finalText = (this.myCompletionBuffer + this.myCurrentUtterance).trim();
        if (!this.modelInfo || !finalText) return;

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
        const finalText = (this.theirCompletionBuffer + this.theirCurrentUtterance).trim();
        if (!this.modelInfo || !finalText) return;
        
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
        if (this.modelInfo?.provider === 'gemini') {
            this.myCompletionBuffer += text;
        } else {
            this.myCompletionBuffer += (this.myCompletionBuffer ? ' ' : '') + text;
        }

        if (this.myCompletionTimer) clearTimeout(this.myCompletionTimer);
        this.myCompletionTimer = setTimeout(() => this.flushMyCompletion(), COMPLETION_DEBOUNCE_MS);
    }

    debounceTheirCompletion(text) {
        if (this.modelInfo?.provider === 'gemini') {
            this.theirCompletionBuffer += text;
        } else {
            this.theirCompletionBuffer += (this.theirCompletionBuffer ? ' ' : '') + text;
        }

        if (this.theirCompletionTimer) clearTimeout(this.theirCompletionTimer);
        this.theirCompletionTimer = setTimeout(() => this.flushTheirCompletion(), COMPLETION_DEBOUNCE_MS);
    }

    async initializeSttSessions(language = null) {
        // Get language from settings if not provided
        let effectiveLanguage = language;
        if (!effectiveLanguage) {
            try {
                const settings = await getSettings();
                effectiveLanguage = settings.language || 'en';
            } catch (error) {
                console.warn('[SttService] Failed to get language from settings, using default:', error);
                effectiveLanguage = 'en';
            }
        }
        
        // Allow environment override
        effectiveLanguage = process.env.OPENAI_TRANSCRIBE_LANG || effectiveLanguage;
        console.log(`[SttService] Using language: ${effectiveLanguage}`);

        const modelInfo = await getCurrentModelInfo(null, { type: 'stt' });
        if (!modelInfo || !modelInfo.apiKey) {
            throw new Error('AI model or API key is not configured.');
        }
        this.modelInfo = modelInfo;
        console.log(`[SttService] Initializing STT for ${modelInfo.provider} using model ${modelInfo.model}`);

        const handleMyMessage = message => {
            if (!this.modelInfo) {
                console.log('[SttService] Ignoring message - session already closed');
                return;
            }
            
            if (this.modelInfo.provider === 'whisper') {
                // Whisper STT emits 'transcription' events with different structure
                if (message.text && message.text.trim()) {
                    const finalText = message.text.trim();
                    
                    // Filter out Whisper noise transcriptions
                    const noisePatterns = [
                        '[BLANK_AUDIO]',
                        '[INAUDIBLE]',
                        '[MUSIC]',
                        '[SOUND]',
                        '[NOISE]',
                        '(BLANK_AUDIO)',
                        '(INAUDIBLE)',
                        '(MUSIC)',
                        '(SOUND)',
                        '(NOISE)'
                    ];
                    

                    
                    const normalizedText = finalText.toLowerCase().trim();
                    
                    const isNoise = noisePatterns.some(pattern => 
                        finalText.includes(pattern) || finalText === pattern
                    );
                    
                    
                    if (!isNoise && finalText.length > 2) {
                        this.debounceMyCompletion(finalText);
                        
                        this.sendToRenderer('stt-update', {
                            speaker: 'Me',
                            text: finalText,
                            isPartial: false,
                            isFinal: true,
                            timestamp: Date.now(),
                        });
                    } else {
                        console.log(`[Whisper-Me] Filtered noise: "${finalText}"`);
                    }
                }
                return;
            } else if (this.modelInfo.provider === 'gemini') {
                if (!message.serverContent?.modelTurn) {
                    console.log('[Gemini STT - Me]', JSON.stringify(message, null, 2));
                }

                if (message.serverContent?.turnComplete) {
                    if (this.myCompletionTimer) {
                        clearTimeout(this.myCompletionTimer);
                        this.flushMyCompletion();
                    }
                    return;
                }
            
                const transcription = message.serverContent?.inputTranscription;
                if (!transcription || !transcription.text) return;
                
                const textChunk = transcription.text;
                if (!textChunk.trim() || textChunk.trim() === '<noise>') {
                    return; // 1. Ignore whitespace-only chunks or noise
                }
            
                this.debounceMyCompletion(textChunk);
                
                this.sendToRenderer('stt-update', {
                    speaker: 'Me',
                    text: this.myCompletionBuffer,
                    isPartial: true,
                    isFinal: false,
                    timestamp: Date.now(),
                });
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
            if (!message || typeof message !== 'object') return;

            if (!this.modelInfo) {
                console.log('[SttService] Ignoring message - session already closed');
                return;
            }
            
            if (this.modelInfo.provider === 'whisper') {
                // Whisper STT emits 'transcription' events with different structure
                if (message.text && message.text.trim()) {
                    const finalText = message.text.trim();
                    
                    // Filter out Whisper noise transcriptions
                    const noisePatterns = [
                        '[BLANK_AUDIO]',
                        '[INAUDIBLE]',
                        '[MUSIC]',
                        '[SOUND]',
                        '[NOISE]',
                        '(BLANK_AUDIO)',
                        '(INAUDIBLE)',
                        '(MUSIC)',
                        '(SOUND)',
                        '(NOISE)'
                    ];
                    
                    
                    const normalizedText = finalText.toLowerCase().trim();
                    
                    const isNoise = noisePatterns.some(pattern => 
                        finalText.includes(pattern) || finalText === pattern
                    );
                    
                    
                    // Only process if it's not noise, not a false positive, and has meaningful content
                    if (!isNoise && finalText.length > 2) {
                        this.debounceTheirCompletion(finalText);
                        
                        this.sendToRenderer('stt-update', {
                            speaker: 'Them',
                            text: finalText,
                            isPartial: false,
                            isFinal: true,
                            timestamp: Date.now(),
                        });
                    } else {
                        console.log(`[Whisper-Them] Filtered noise: "${finalText}"`);
                    }
                }
                return;
            } else if (this.modelInfo.provider === 'gemini') {
                if (!message.serverContent?.modelTurn) {
                    console.log('[Gemini STT - Them]', JSON.stringify(message, null, 2));
                }

                if (message.serverContent?.turnComplete) {
                    if (this.theirCompletionTimer) {
                        clearTimeout(this.theirCompletionTimer);
                        this.flushTheirCompletion();
                    }
                    return;
                }
            
                const transcription = message.serverContent?.inputTranscription;
                if (!transcription || !transcription.text) return;

                const textChunk = transcription.text;
                if (!textChunk.trim() || textChunk.trim() === '<noise>') {
                    return; // 1. Ignore whitespace-only chunks or noise
                }

                this.debounceTheirCompletion(textChunk);
                
                this.sendToRenderer('stt-update', {
                    speaker: 'Them',
                    text: this.theirCompletionBuffer,
                    isPartial: true,
                    isFinal: false,
                    timestamp: Date.now(),
                });
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
        // const authService = require('../../../common/services/authService');
        // const userState = authService.getCurrentUser();
        // const loggedIn = userState.isLoggedIn;
        
        const sttOptions = {
            apiKey: this.modelInfo.apiKey,
            language: effectiveLanguage,
            usePortkey: this.modelInfo.provider === 'openai-glass',
            portkeyVirtualKey: this.modelInfo.provider === 'openai-glass' ? this.modelInfo.apiKey : undefined,
        };

        // Add sessionType for Whisper to distinguish between My and Their sessions
        const myOptions = { ...sttOptions, callbacks: mySttConfig.callbacks, sessionType: 'my' };
        const theirOptions = { ...sttOptions, callbacks: theirSttConfig.callbacks, sessionType: 'their' };

        [this.mySttSession, this.theirSttSession] = await Promise.all([
            createSTT(this.modelInfo.provider, myOptions),
            createSTT(this.modelInfo.provider, theirOptions),
        ]);

        console.log('✅ Both STT sessions initialized successfully.');
        return true;
    }

    async sendAudioContent(data, mimeType) {
        // const provider = await this.getAiProvider();
        // const isGemini = provider === 'gemini';
        
        if (!this.mySttSession) {
            throw new Error('User STT session not active');
        }

        let modelInfo = this.modelInfo;
        if (!modelInfo) {
            console.warn('[SttService] modelInfo not found, fetching on-the-fly as a fallback...');
            modelInfo = await getCurrentModelInfo(null, { type: 'stt' });
        }
        if (!modelInfo) {
            throw new Error('STT model info could not be retrieved.');
        }

        const payload = modelInfo.provider === 'gemini'
            ? { audio: { data, mimeType: mimeType || 'audio/pcm;rate=24000' } }
            : data;

        await this.mySttSession.sendRealtimeInput(payload);
    }

    async sendSystemAudioContent(data, mimeType) {
        if (!this.theirSttSession) {
            throw new Error('Their STT session not active');
        }

        let modelInfo = this.modelInfo;
        if (!modelInfo) {
            console.warn('[SttService] modelInfo not found, fetching on-the-fly as a fallback...');
            modelInfo = await getCurrentModelInfo(null, { type: 'stt' });
        }
        if (!modelInfo) {
            throw new Error('STT model info could not be retrieved.');
        }

        const payload = modelInfo.provider === 'gemini'
            ? { audio: { data, mimeType: mimeType || 'audio/pcm;rate=24000' } }
            : data;
        
        await this.theirSttSession.sendRealtimeInput(payload);
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

        // const provider = await this.getAiProvider();
        // const isGemini = provider === 'gemini';

        let modelInfo = this.modelInfo;
        if (!modelInfo) {
            console.warn('[SttService] modelInfo not found, fetching on-the-fly as a fallback...');
            modelInfo = await getCurrentModelInfo(null, { type: 'stt' });
        }
        if (!modelInfo) {
            throw new Error('STT model info could not be retrieved.');
        }

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
                        const payload = modelInfo.provider === 'gemini'
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
        this.myCompletionBuffer = '';
        this.theirCompletionBuffer = '';
        this.modelInfo = null; 
    }
}

module.exports = SttService; 