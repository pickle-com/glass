const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Local Whisper client for speech-to-text transcription
 * This replaces the OpenAI Realtime API with local Whisper CLI
 */
class LocalWhisperClient {
    constructor() {
        this.isInitialized = false;
        this.audioBuffer = [];
        this.isProcessing = false;
        this.callbacks = {};
        this.sampleRate = 24000;
        this.model = 'base'; // Default model
        this.tempDir = path.join(os.tmpdir(), 'glass-whisper');
        this.audioChunkCounter = 0;
        
        // Ensure temp directory exists
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    /**
     * Initialize the local Whisper client
     * @param {Object} config - Configuration object
     * @param {string} config.model - Whisper model to use (base, small, medium, large, etc.)
     * @param {string} config.language - Language code (optional)
     * @param {Object} config.callbacks - Callback functions for events
     */
    async initialize(config = {}) {
        this.model = config.model || 'base';
        this.language = config.language || null;
        this.callbacks = config.callbacks || {};
        
        // Test if whisper is available
        try {
            await this.testWhisperAvailability();
            this.isInitialized = true;
            console.log(` Local Whisper initialized with model: ${this.model}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize local Whisper:', error);
            throw error;
        }
    }

    /**
     * Test if Whisper CLI is available
     */
    async testWhisperAvailability() {
        return new Promise((resolve, reject) => {
            const testProcess = spawn('whisper', ['--help'], { stdio: 'pipe' });
            
            testProcess.on('close', (code) => {
                if (code === 0) {
                    resolve(true);
                } else {
                    reject(new Error('Whisper CLI not found or not working'));
                }
            });

            testProcess.on('error', (error) => {
                reject(new Error(`Whisper CLI error: ${error.message}`));
            });
        });
    }

    /**
     * Send audio data for transcription
     * @param {string} audioData - Base64 encoded PCM audio data
     */
    async sendRealtimeInput(audioData) {
        if (!this.isInitialized) {
            throw new Error('Local Whisper client not initialized');
        }

        // Add audio to buffer
        this.audioBuffer.push(audioData);

        // Process audio in chunks to avoid overwhelming the system
        if (this.audioBuffer.length >= 10 && !this.isProcessing) {
            this.processAudioBuffer();
        }
    }

    /**
     * Process accumulated audio buffer
     */
    async processAudioBuffer() {
        if (this.isProcessing || this.audioBuffer.length === 0) {
            return;
        }

        this.isProcessing = true;
        
        try {
            // Combine all buffered audio chunks
            const combinedAudio = this.audioBuffer.join('');
            this.audioBuffer = []; // Clear buffer
            
            // Generate unique filename
            const timestamp = Date.now();
            const audioFileName = `audio_${timestamp}_${this.audioChunkCounter++}.wav`;
            const audioFilePath = path.join(this.tempDir, audioFileName);
            
            // Convert base64 PCM to WAV file
            await this.convertPCMToWav(combinedAudio, audioFilePath);
            
            // Transcribe with Whisper
            const transcription = await this.transcribeWithWhisper(audioFilePath);
            
            // Clean up temp file
            if (fs.existsSync(audioFilePath)) {
                fs.unlinkSync(audioFilePath);
            }
            
            // Send transcription result via callback in OpenAI-compatible format
            if (this.callbacks.onmessage && transcription.text.trim()) {
                // Send a completed transcription message in OpenAI format
                this.callbacks.onmessage({
                    type: 'conversation.item.input_audio_transcription.completed',
                    transcript: transcription.text.trim(),
                    item_id: `whisper_${timestamp}`,
                    content_index: 0,
                    response_id: `whisper_response_${timestamp}`
                });
                
                console.log(`📝 Whisper transcription: "${transcription.text.trim()}"`);
            }
            
        } catch (error) {
            console.error('Error processing audio buffer:', error);
            if (this.callbacks.onerror) {
                this.callbacks.onerror(error);
            }
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Convert base64 PCM data to WAV file
     * @param {string} base64PCM - Base64 encoded PCM data
     * @param {string} outputPath - Path to save WAV file
     */
    async convertPCMToWav(base64PCM, outputPath) {
        return new Promise((resolve, reject) => {
            // Decode base64 to buffer
            const pcmBuffer = Buffer.from(base64PCM, 'base64');
            
            // Create WAV header for 16-bit PCM, mono, 24kHz
            const wavHeader = this.createWavHeader(pcmBuffer.length, this.sampleRate, 1, 16);
            const wavBuffer = Buffer.concat([wavHeader, pcmBuffer]);
            
            // Write to file
            fs.writeFile(outputPath, wavBuffer, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(outputPath);
                }
            });
        });
    }

    /**
     * Create WAV header for PCM data
     */
    createWavHeader(dataLength, sampleRate, channels, bitsPerSample) {
        const header = Buffer.alloc(44);
        const bytesPerSample = bitsPerSample / 8;
        const blockAlign = channels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        
        // RIFF header
        header.write('RIFF', 0);
        header.writeUInt32LE(36 + dataLength, 4);
        header.write('WAVE', 8);
        
        // fmt chunk
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16); // chunk size
        header.writeUInt16LE(1, 20);  // audio format (PCM)
        header.writeUInt16LE(channels, 22);
        header.writeUInt32LE(sampleRate, 24);
        header.writeUInt32LE(byteRate, 28);
        header.writeUInt16LE(blockAlign, 32);
        header.writeUInt16LE(bitsPerSample, 34);
        
        // data chunk
        header.write('data', 36);
        header.writeUInt32LE(dataLength, 40);
        
        return header;
    }

    /**
     * Transcribe audio file using Whisper CLI
     * @param {string} audioFilePath - Path to audio file
     * @returns {Promise<Object>} Transcription result
     */
    async transcribeWithWhisper(audioFilePath) {
        return new Promise((resolve, reject) => {
            const args = [
                audioFilePath,
                '--model', this.model,
                '--output_format', 'json',
                '--verbose', 'False'
            ];

            // Add language if specified
            if (this.language) {
                args.push('--language', this.language);
            }

            console.log(`🎤 Transcribing with Whisper: ${audioFilePath}`);
            
            const whisperProcess = spawn('whisper', args, {
                stdio: 'pipe',
                cwd: this.tempDir
            });

            let stdout = '';
            let stderr = '';

            whisperProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            whisperProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            whisperProcess.on('close', (code) => {
                if (code === 0) {
                    try {
                        // Read the JSON output file
                        const baseFileName = path.basename(audioFilePath, path.extname(audioFilePath));
                        const jsonFilePath = path.join(this.tempDir, `${baseFileName}.json`);
                        
                        if (fs.existsSync(jsonFilePath)) {
                            const jsonContent = fs.readFileSync(jsonFilePath, 'utf8');
                            const result = JSON.parse(jsonContent);
                            
                            // Clean up JSON file
                            fs.unlinkSync(jsonFilePath);
                            
                            resolve(result);
                        } else {
                            resolve({ text: '', language: 'en' });
                        }
                    } catch (error) {
                        console.error('Error parsing Whisper output:', error);
                        resolve({ text: '', language: 'en' });
                    }
                } else {
                    console.error(`Whisper process exited with code ${code}`);
                    console.error('stderr:', stderr);
                    reject(new Error(`Whisper transcription failed: ${stderr}`));
                }
            });

            whisperProcess.on('error', (error) => {
                reject(new Error(`Whisper process error: ${error.message}`));
            });
        });
    }

    /**
     * Close the client and clean up
     */
    async close() {
        console.log('🔄 Closing local Whisper client...');
        
        // Process any remaining audio in buffer
        if (this.audioBuffer.length > 0) {
            await this.processAudioBuffer();
        }
        
        // Clean up temp directory
        if (fs.existsSync(this.tempDir)) {
            const files = fs.readdirSync(this.tempDir);
            files.forEach(file => {
                const filePath = path.join(this.tempDir, file);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            });
        }
        
        this.isInitialized = false;
        
        if (this.callbacks.onclose) {
            this.callbacks.onclose({ code: 1000, reason: 'Client closed' });
        }
    }
}

/**
 * Connect to local Whisper session (mimics OpenAI session interface)
 * @param {Object} config - Configuration object
 * @returns {Promise<LocalWhisperClient>} A promise that resolves to the session object
 */
async function connectToLocalWhisperSession(config) {
    const client = new LocalWhisperClient();
    await client.initialize(config);
    return client;
}

module.exports = {
    LocalWhisperClient,
    connectToLocalWhisperSession
};
