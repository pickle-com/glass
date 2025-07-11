// Soniox STT Provider
// https://soniox.com/docs

const https = require('https');
const EventEmitter = require('events');

class SonioxSTTSession extends EventEmitter {
    constructor(apiKey, model = 'en_v2', sessionId) {
        super();
        this.apiKey = apiKey;
        this.model = model;
        this.sessionId = sessionId || `soniox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.isRunning = false;
        this.audioBuffer = Buffer.alloc(0);
        this.lastTranscription = '';
    }

    async initialize() {
        this.isRunning = true;
        // Soniox does not require model download, just API key
        return true;
    }

    async transcribe(audioBuffer) {
        // See https://soniox.com/docs/speech-recognition/api.html#recognize-audio
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.soniox.com',
                path: `/v2/recognize`,
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'audio/wav',
                    'Accept': 'application/json',
                    'soniox-model': this.model
                }
            };
            const req = https.request(options, res => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve(json);
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            req.on('error', reject);
            req.write(audioBuffer);
            req.end();
        });
    }

    async processAudioChunk(audioBuffer) {
        if (!this.isRunning) return;
        try {
            const result = await this.transcribe(audioBuffer);
            const text = result.text || '';
            this.lastTranscription = text;
            this.emit('transcription', { text, isFinal: true });
        } catch (err) {
            this.emit('error', err);
        }
    }

    async sendRealtimeInput(audioBuffer) {
        // Accepts Buffer or base64 string
        if (typeof audioBuffer === 'string') {
            audioBuffer = Buffer.from(audioBuffer, 'base64');
        }
        // Convert to WAV if not already (assume PCM input)
        if (!isWav(audioBuffer)) {
            audioBuffer = pcmToWav(audioBuffer);
        }
        await this.processAudioChunk(audioBuffer);
    }

    stop() {
        this.isRunning = false;
    }

    close() {
        this.stop();
        this.removeAllListeners();
    }
}

// Helper: Convert PCM to WAV (16-bit, mono, 16kHz)
function pcmToWav(buffer, sampleRate = 16000, numChannels = 1) {
    const header = Buffer.alloc(44);
    const dataLength = buffer.length;
    header.write('RIFF', 0); // ChunkID
    header.writeUInt32LE(36 + dataLength, 4); // ChunkSize
    header.write('WAVE', 8); // Format
    header.write('fmt ', 12); // Subchunk1ID
    header.writeUInt32LE(16, 16); // Subchunk1Size
    header.writeUInt16LE(1, 20); // AudioFormat (PCM)
    header.writeUInt16LE(numChannels, 22); // NumChannels
    header.writeUInt32LE(sampleRate, 24); // SampleRate
    header.writeUInt32LE(sampleRate * numChannels * 2, 28); // ByteRate
    header.writeUInt16LE(numChannels * 2, 32); // BlockAlign
    header.writeUInt16LE(16, 34); // BitsPerSample
    header.write('data', 36); // Subchunk2ID
    header.writeUInt32LE(dataLength, 40); // Subchunk2Size
    return Buffer.concat([header, buffer]);
}

// Helper: Check if buffer is already a WAV file
function isWav(buffer) {
    return buffer && buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE';
}

function createSTT(opts) {
    return new SonioxSTTSession(opts.apiKey, opts.model);
}

module.exports = {
    createSTT,
    SonioxSTTSession
};
