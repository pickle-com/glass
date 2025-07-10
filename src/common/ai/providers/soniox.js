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

function createSTT(opts) {
    return new SonioxSTTSession(opts.apiKey, opts.model);
}

module.exports = {
    createSTT,
    SonioxSTTSession
};
