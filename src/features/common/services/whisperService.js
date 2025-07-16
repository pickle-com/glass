const { EventEmitter } = require('events');
const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const crypto = require('crypto');
const { spawnAsync } = require('../utils/spawnHelper');
const { DOWNLOAD_CHECKSUMS } = require('../config/checksums');

const execAsync = promisify(exec);

const fsPromises = fs.promises;

class WhisperService extends EventEmitter {
    constructor() {
        super();
        this.serviceName = 'WhisperService';
        
        // 경로 및 디렉토리
        this.whisperPath = null;
        this.modelsDir = null;
        this.tempDir = null;
        
        // 세션 관리 (세션 풀 내장)
        this.sessionPool = [];
        this.activeSessions = new Map();
        this.maxSessions = 3;
        
        // 설치 상태
        this.installState = {
            isInstalled: false,
            isInitialized: false
        };
        
        // 사용 가능한 모델
        this.availableModels = {
            'whisper-tiny': {
                name: 'Tiny',
                size: '39M',
                url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin'
            },
            'whisper-base': {
                name: 'Base',
                size: '74M',
                url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin'
            },
            'whisper-small': {
                name: 'Small',
                size: '244M',
                url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin'
            },
            'whisper-medium': {
                name: 'Medium',
                size: '769M',
                url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin'
            }
        };
    }


    // Base class methods integration
    getPlatform() {
        return process.platform;
    }

    async checkCommand(command) {
        try {
            const platform = this.getPlatform();
            const checkCmd = platform === 'win32' ? 'where' : 'which';
            const { stdout } = await execAsync(`${checkCmd} ${command}`);
            return stdout.trim();
        } catch (error) {
            return null;
        }
    }

    async waitForService(checkFn, maxAttempts = 30, delayMs = 1000) {
        for (let i = 0; i < maxAttempts; i++) {
            if (await checkFn()) {
                console.log(`[${this.serviceName}] Service is ready`);
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        throw new Error(`${this.serviceName} service failed to start within timeout`);
    }

    async downloadFile(url, destination, options = {}) {
        const { 
            onProgress = null,
            headers = { 'User-Agent': 'Glass-App' },
            timeout = 300000,
            modelId = null
        } = options;

        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(destination);
            let downloadedSize = 0;
            let totalSize = 0;

            const request = https.get(url, { headers }, (response) => {
                if ([301, 302, 307, 308].includes(response.statusCode)) {
                    file.close();
                    fs.unlink(destination, () => {});
                    
                    if (!response.headers.location) {
                        reject(new Error('Redirect without location header'));
                        return;
                    }
                    
                    console.log(`[${this.serviceName}] Following redirect from ${url} to ${response.headers.location}`);
                    this.downloadFile(response.headers.location, destination, options)
                        .then(resolve)
                        .catch(reject);
                    return;
                }

                if (response.statusCode !== 200) {
                    file.close();
                    fs.unlink(destination, () => {});
                    reject(new Error(`Download failed: ${response.statusCode} ${response.statusMessage}`));
                    return;
                }

                totalSize = parseInt(response.headers['content-length'], 10) || 0;

                response.on('data', (chunk) => {
                    downloadedSize += chunk.length;
                    
                    if (totalSize > 0) {
                        const progress = Math.round((downloadedSize / totalSize) * 100);
                        
                        if (onProgress) {
                            onProgress(progress, downloadedSize, totalSize);
                        }
                    }
                });

                response.pipe(file);

                file.on('finish', () => {
                    file.close(() => {
                        resolve({ success: true, size: downloadedSize });
                    });
                });
            });

            request.on('timeout', () => {
                request.destroy();
                file.close();
                fs.unlink(destination, () => {});
                reject(new Error('Download timeout'));
            });

            request.on('error', (err) => {
                file.close();
                fs.unlink(destination, () => {});
                this.emit('download-error', { url, error: err, modelId });
                reject(err);
            });

            request.setTimeout(timeout);

            file.on('error', (err) => {
                fs.unlink(destination, () => {});
                reject(err);
            });
        });
    }

    async downloadWithRetry(url, destination, options = {}) {
        const { 
            maxRetries = 3, 
            retryDelay = 1000, 
            expectedChecksum = null,
            modelId = null,
            ...downloadOptions 
        } = options;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await this.downloadFile(url, destination, { 
                    ...downloadOptions, 
                    modelId 
                });
                
                if (expectedChecksum) {
                    const isValid = await this.verifyChecksum(destination, expectedChecksum);
                    if (!isValid) {
                        fs.unlinkSync(destination);
                        throw new Error('Checksum verification failed');
                    }
                    console.log(`[${this.serviceName}] Checksum verified successfully`);
                }
                
                return result;
            } catch (error) {
                if (attempt === maxRetries) {
                    throw error;
                }
                
                console.log(`Download attempt ${attempt} failed, retrying in ${retryDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }

    async verifyChecksum(filePath, expectedChecksum) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = fs.createReadStream(filePath);
            
            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => {
                const fileChecksum = hash.digest('hex');
                console.log(`[${this.serviceName}] File checksum: ${fileChecksum}`);
                console.log(`[${this.serviceName}] Expected checksum: ${expectedChecksum}`);
                resolve(fileChecksum === expectedChecksum);
            });
            stream.on('error', reject);
        });
    }

    async autoInstall(onProgress) {
        const platform = this.getPlatform();
        console.log(`[${this.serviceName}] Starting auto-installation for ${platform}`);
        
        try {
            switch(platform) {
                case 'darwin':
                    return await this.installMacOS(onProgress);
                case 'win32':
                    return await this.installWindows(onProgress);
                case 'linux':
                    return await this.installLinux();
                default:
                    throw new Error(`Unsupported platform: ${platform}`);
            }
        } catch (error) {
            console.error(`[${this.serviceName}] Auto-installation failed:`, error);
            throw error;
        }
    }

    async shutdown(force = false) {
        console.log(`[${this.serviceName}] Starting ${force ? 'forced' : 'graceful'} shutdown...`);
        
        const isRunning = await this.isServiceRunning();
        if (!isRunning) {
            console.log(`[${this.serviceName}] Service not running, nothing to shutdown`);
            return true;
        }

        const platform = this.getPlatform();
        
        try {
            switch(platform) {
                case 'darwin':
                    return await this.shutdownMacOS(force);
                case 'win32':
                    return await this.shutdownWindows(force);
                case 'linux':
                    return await this.shutdownLinux(force);
                default:
                    console.warn(`[${this.serviceName}] Unsupported platform for shutdown: ${platform}`);
                    return false;
            }
        } catch (error) {
            console.error(`[${this.serviceName}] Error during shutdown:`, error);
            return false;
        }
    }

    async initialize() {
        if (this.installState.isInitialized) return;

        try {
            const homeDir = os.homedir();
            const whisperDir = path.join(homeDir, '.glass', 'whisper');
            
            this.modelsDir = path.join(whisperDir, 'models');
            this.tempDir = path.join(whisperDir, 'temp');
            
            // Windows에서는 .exe 확장자 필요
            const platform = this.getPlatform();
            const whisperExecutable = platform === 'win32' ? 'whisper-whisper.exe' : 'whisper';
            this.whisperPath = path.join(whisperDir, 'bin', whisperExecutable);

            await this.ensureDirectories();
            await this.ensureWhisperBinary();
            
            this.installState.isInitialized = true;
            console.log('[WhisperService] Initialized successfully');
        } catch (error) {
            console.error('[WhisperService] Initialization failed:', error);
            // Emit error event - LocalAIManager가 처리
            this.emit('error', {
                errorType: 'initialization-failed',
                error: error.message
            });
            throw error;
        }
    }

    async ensureDirectories() {
        await fsPromises.mkdir(this.modelsDir, { recursive: true });
        await fsPromises.mkdir(this.tempDir, { recursive: true });
        await fsPromises.mkdir(path.dirname(this.whisperPath), { recursive: true });
    }

    //  local stt session
    async getSession(config) {
        // check available session
        const availableSession = this.sessionPool.find(s => !s.inUse);
        if (availableSession) {
            availableSession.inUse = true;
            await availableSession.reconfigure(config);
            return availableSession;
        }

        // create new session
        if (this.activeSessions.size >= this.maxSessions) {
            throw new Error('Maximum session limit reached');
        }

        const session = new WhisperSession(config, this);
        await session.initialize();
        this.activeSessions.set(session.id, session);
        
        return session;
    }

    async releaseSession(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (session) {
            await session.cleanup();
            session.inUse = false;
            
            // add to session pool
            if (this.sessionPool.length < 2) {
                this.sessionPool.push(session);
            } else {
                // remove session
                await session.destroy();
                this.activeSessions.delete(sessionId);
            }
        }
    }

    //cleanup
    async cleanup() {
        // cleanup all sessions
        for (const session of this.activeSessions.values()) {
            await session.destroy();
        }
        
        this.activeSessions.clear();
        this.sessionPool = [];
    }

    async ensureWhisperBinary() {
        const whisperCliPath = await this.checkCommand('whisper-cli');
        if (whisperCliPath) {
            this.whisperPath = whisperCliPath;
            console.log(`[WhisperService] Found whisper-cli at: ${this.whisperPath}`);
            return;
        }

        const whisperPath = await this.checkCommand('whisper');
        if (whisperPath) {
            this.whisperPath = whisperPath;
            console.log(`[WhisperService] Found whisper at: ${this.whisperPath}`);
            return;
        }

        try {
            await fsPromises.access(this.whisperPath, fs.constants.X_OK);
            console.log('[WhisperService] Custom whisper binary found');
            return;
        } catch (error) {
            // Continue to installation
        }

        const platform = this.getPlatform();
        if (platform === 'darwin') {
            console.log('[WhisperService] Whisper not found, trying Homebrew installation...');
            try {
                await this.installViaHomebrew();
                // verify installation
                const verified = await this.verifyInstallation();
                if (!verified.success) {
                    throw new Error(verified.error);
                }
                return;
            } catch (error) {
                console.log('[WhisperService] Homebrew installation failed:', error.message);
            }
        }

        await this.autoInstall();
        
        // verify installation
        const verified = await this.verifyInstallation();
        if (!verified.success) {
            throw new Error(`Whisper installation verification failed: ${verified.error}`);
        }
    }

    async installViaHomebrew() {
        const brewPath = await this.checkCommand('brew');
        if (!brewPath) {
            throw new Error('Homebrew not found. Please install Homebrew first.');
        }

        console.log('[WhisperService] Installing whisper-cpp via Homebrew...');
        await spawnAsync('brew', ['install', 'whisper-cpp']);
        
        const whisperCliPath = await this.checkCommand('whisper-cli');
        if (whisperCliPath) {
            this.whisperPath = whisperCliPath;
            console.log(`[WhisperService] Whisper-cli installed via Homebrew at: ${this.whisperPath}`);
        } else {
            const whisperPath = await this.checkCommand('whisper');
            if (whisperPath) {
                this.whisperPath = whisperPath;
                console.log(`[WhisperService] Whisper installed via Homebrew at: ${this.whisperPath}`);
            }
        }
    }


    async ensureModelAvailable(modelId) {
        if (!this.installState.isInitialized) {
            console.log('[WhisperService] Service not initialized, initializing now...');
            await this.initialize();
        }

        const modelInfo = this.availableModels[modelId];
        if (!modelInfo) {
            throw new Error(`Unknown model: ${modelId}. Available models: ${Object.keys(this.availableModels).join(', ')}`);
        }

        const modelPath = await this.getModelPath(modelId);
        try {
            await fsPromises.access(modelPath, fs.constants.R_OK);
            console.log(`[WhisperService] Model ${modelId} already available at: ${modelPath}`);
        } catch (error) {
            console.log(`[WhisperService] Model ${modelId} not found, downloading...`);
            await this.downloadModel(modelId);
        }
    }

    async downloadModel(modelId) {
        const modelInfo = this.availableModels[modelId];
        const modelPath = await this.getModelPath(modelId);
        const checksumInfo = DOWNLOAD_CHECKSUMS.whisper.models[modelId];
        
        // Emit progress event - LocalAIManager가 처리
        this.emit('install-progress', { 
            model: modelId, 
            progress: 0 
        });
        
        await this.downloadWithRetry(modelInfo.url, modelPath, {
            expectedChecksum: checksumInfo?.sha256,
            modelId, // pass modelId to LocalAIServiceBase for event handling
            onProgress: (progress) => {
                // Emit progress event - LocalAIManager가 처리
                this.emit('install-progress', { 
                    model: modelId, 
                    progress 
                });
            }
        });
        
        console.log(`[WhisperService] Model ${modelId} downloaded successfully`);
        this.emit('model-download-complete', { modelId });
    }

    async handleDownloadModel(modelId) {
        try {
            console.log(`[WhisperService] Handling download for model: ${modelId}`);

            if (!this.installState.isInitialized) {
                await this.initialize();
            }

            await this.ensureModelAvailable(modelId);
            
            return { success: true };
        } catch (error) {
            console.error(`[WhisperService] Failed to handle download for model ${modelId}:`, error);
            return { success: false, error: error.message };
        }
    }

    async handleGetInstalledModels() {
        try {
            if (!this.installState.isInitialized) {
                await this.initialize();
            }
            const models = await this.getInstalledModels();
            return { success: true, models };
        } catch (error) {
            console.error('[WhisperService] Failed to get installed models:', error);
            return { success: false, error: error.message };
        }
    }

    async getModelPath(modelId) {
        if (!this.installState.isInitialized || !this.modelsDir) {
            throw new Error('WhisperService is not initialized. Call initialize() first.');
        }
        return path.join(this.modelsDir, `${modelId}.bin`);
    }

    async getWhisperPath() {
        return this.whisperPath;
    }

    async saveAudioToTemp(audioBuffer, sessionId = '') {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 6);
        const sessionPrefix = sessionId ? `${sessionId}_` : '';
        const tempFile = path.join(this.tempDir, `audio_${sessionPrefix}${timestamp}_${random}.wav`);
        
        const wavHeader = this.createWavHeader(audioBuffer.length);
        const wavBuffer = Buffer.concat([wavHeader, audioBuffer]);
        
        await fsPromises.writeFile(tempFile, wavBuffer);
        return tempFile;
    }

    createWavHeader(dataSize) {
        const header = Buffer.alloc(44);
        const sampleRate = 16000;
        const numChannels = 1;
        const bitsPerSample = 16;
        
        header.write('RIFF', 0);
        header.writeUInt32LE(36 + dataSize, 4);
        header.write('WAVE', 8);
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16);
        header.writeUInt16LE(1, 20);
        header.writeUInt16LE(numChannels, 22);
        header.writeUInt32LE(sampleRate, 24);
        header.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28);
        header.writeUInt16LE(numChannels * bitsPerSample / 8, 32);
        header.writeUInt16LE(bitsPerSample, 34);
        header.write('data', 36);
        header.writeUInt32LE(dataSize, 40);
        
        return header;
    }

    async cleanupTempFile(filePath) {
        if (!filePath || typeof filePath !== 'string') {
            console.warn('[WhisperService] Invalid file path for cleanup:', filePath);
            return;
        }

        const filesToCleanup = [
            filePath,
            filePath.replace('.wav', '.txt'),
            filePath.replace('.wav', '.json')
        ];

        for (const file of filesToCleanup) {
            try {
                // Check if file exists before attempting to delete
                await fsPromises.access(file, fs.constants.F_OK);
                await fsPromises.unlink(file);
                console.log(`[WhisperService] Cleaned up: ${file}`);
            } catch (error) {
                // File doesn't exist or already deleted - this is normal
                if (error.code !== 'ENOENT') {
                    console.warn(`[WhisperService] Failed to cleanup ${file}:`, error.message);
                }
            }
        }
    }

    async getInstalledModels() {
        if (!this.installState.isInitialized) {
            console.log('[WhisperService] Service not initialized for getInstalledModels, initializing now...');
            await this.initialize();
        }

        const models = [];
        for (const [modelId, modelInfo] of Object.entries(this.availableModels)) {
            try {
                const modelPath = await this.getModelPath(modelId);
                await fsPromises.access(modelPath, fs.constants.R_OK);
                models.push({
                    id: modelId,
                    name: modelInfo.name,
                    size: modelInfo.size,
                    installed: true
                });
            } catch (error) {
                models.push({
                    id: modelId,
                    name: modelInfo.name,
                    size: modelInfo.size,
                    installed: false
                });
            }
        }
        return models;
    }

    async isServiceRunning() {
        return this.installState.isInitialized;
    }

    async startService() {
        if (!this.installState.isInitialized) {
            await this.initialize();
        }
        return true;
    }

    async stopService() {
        return true;
    }

    async isInstalled() {
        try {
            const whisperPath = await this.checkCommand('whisper-cli') || await this.checkCommand('whisper');
            return !!whisperPath;
        } catch (error) {
            return false;
        }
    }

    async installMacOS() {
        throw new Error('Binary installation not available for macOS. Please install Homebrew and run: brew install whisper-cpp');
    }

    async installWindows() {
        console.log('[WhisperService] Installing Whisper on Windows...');
        const version = 'v1.7.6';
        const binaryUrl = `https://github.com/ggml-org/whisper.cpp/releases/download/${version}/whisper-bin-x64.zip`;
        const tempFile = path.join(this.tempDir, 'whisper-binary.zip');
        
        try {
            console.log('[WhisperService] Step 1: Downloading Whisper binary...');
            await this.downloadWithRetry(binaryUrl, tempFile);
            
            console.log('[WhisperService] Step 2: Extracting archive...');
            const extractDir = path.join(this.tempDir, 'extracted');
            
            // 임시 압축 해제 디렉토리 생성
            await fsPromises.mkdir(extractDir, { recursive: true });
            
            // PowerShell 명령에서 경로를 올바르게 인용
            const expandCommand = `Expand-Archive -Path "${tempFile}" -DestinationPath "${extractDir}" -Force`;
            await spawnAsync('powershell', ['-command', expandCommand]);
            
            console.log('[WhisperService] Step 3: Finding and moving whisper executable...');
            
            // 압축 해제된 디렉토리에서 whisper.exe 파일 찾기
            const whisperExecutables = await this.findWhisperExecutables(extractDir);
            
            if (whisperExecutables.length === 0) {
                throw new Error('whisper.exe not found in extracted files');
            }
            
            // 첫 번째로 찾은 whisper.exe를 목표 위치로 복사
            const sourceExecutable = whisperExecutables[0];
            const targetDir = path.dirname(this.whisperPath);
            await fsPromises.mkdir(targetDir, { recursive: true });
            await fsPromises.copyFile(sourceExecutable, this.whisperPath);
            
            console.log('[WhisperService] Step 4: Verifying installation...');
            
            // 설치 검증
            await fsPromises.access(this.whisperPath, fs.constants.F_OK);
            
            // whisper.exe 실행 테스트
            try {
                await spawnAsync(this.whisperPath, ['--help']);
                console.log('[WhisperService] Whisper executable verified successfully');
            } catch (testError) {
                console.warn('[WhisperService] Whisper executable test failed, but file exists:', testError.message);
            }
            
            console.log('[WhisperService] Step 5: Cleanup...');
            
            // 임시 파일 정리
            await fsPromises.unlink(tempFile).catch(() => {});
            await this.removeDirectory(extractDir).catch(() => {});
            
            console.log('[WhisperService] Whisper installed successfully on Windows');
            return true;
            
        } catch (error) {
            console.error('[WhisperService] Windows installation failed:', error);
            
            // 실패 시 임시 파일 정리
            await fsPromises.unlink(tempFile).catch(() => {});
            await this.removeDirectory(path.join(this.tempDir, 'extracted')).catch(() => {});
            
            throw new Error(`Failed to install Whisper on Windows: ${error.message}`);
        }
    }
    
    // 압축 해제된 디렉토리에서 whisper.exe 파일들을 재귀적으로 찾기
    async findWhisperExecutables(dir) {
        const executables = [];
        
        try {
            const items = await fsPromises.readdir(dir, { withFileTypes: true });
            
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                
                if (item.isDirectory()) {
                    const subExecutables = await this.findWhisperExecutables(fullPath);
                    executables.push(...subExecutables);
                } else if (item.isFile() && (item.name === 'whisper-whisper.exe' || item.name === 'whisper.exe' || item.name === 'main.exe')) {
                    executables.push(fullPath);
                }
            }
        } catch (error) {
            console.warn('[WhisperService] Error reading directory:', dir, error.message);
        }
        
        return executables;
    }
    
    // 디렉토리 재귀적 삭제
    async removeDirectory(dir) {
        try {
            const items = await fsPromises.readdir(dir, { withFileTypes: true });
            
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                
                if (item.isDirectory()) {
                    await this.removeDirectory(fullPath);
                } else {
                    await fsPromises.unlink(fullPath);
                }
            }
            
            await fsPromises.rmdir(dir);
        } catch (error) {
            console.warn('[WhisperService] Error removing directory:', dir, error.message);
        }
    }

    async installLinux() {
        console.log('[WhisperService] Installing Whisper on Linux...');
        const version = 'v1.7.6';
        const binaryUrl = `https://github.com/ggml-org/whisper.cpp/releases/download/${version}/whisper-cpp-${version}-linux-x64.tar.gz`;
        const tempFile = path.join(this.tempDir, 'whisper-binary.tar.gz');
        
        try {
            await this.downloadWithRetry(binaryUrl, tempFile);
            const extractDir = path.dirname(this.whisperPath);
            await spawnAsync('tar', ['-xzf', tempFile, '-C', extractDir, '--strip-components=1']);
            await spawnAsync('chmod', ['+x', this.whisperPath]);
            await fsPromises.unlink(tempFile);
            console.log('[WhisperService] Whisper installed successfully on Linux');
            return true;
        } catch (error) {
            console.error('[WhisperService] Linux installation failed:', error);
            throw new Error(`Failed to install Whisper on Linux: ${error.message}`);
        }
    }

    async shutdownMacOS(force) {
        return true;
    }

    async shutdownWindows(force) {
        return true;
    }

    async shutdownLinux(force) {
        return true;
    }
}

// WhisperSession class
class WhisperSession {
    constructor(config, service) {
        this.id = `session_${Date.now()}_${Math.random()}`;
        this.config = config;
        this.service = service;
        this.process = null;
        this.inUse = true;
        this.audioBuffer = Buffer.alloc(0);
    }

    async initialize() {
        await this.service.ensureModelAvailable(this.config.model);
        this.startProcessingLoop();
    }

    async reconfigure(config) {
        this.config = config;
        await this.service.ensureModelAvailable(this.config.model);
    }

    startProcessingLoop() {
        // TODO: 실제 처리 루프 구현
    }

    async cleanup() {
        // 임시 파일 정리
        await this.cleanupTempFiles();
    }

    async cleanupTempFiles() {
        // TODO: 임시 파일 정리 구현
    }

    async destroy() {
        if (this.process) {
            this.process.kill();
        }
        // 임시 파일 정리
        await this.cleanupTempFiles();
    }
}

// verify installation
WhisperService.prototype.verifyInstallation = async function() {
    try {
        console.log('[WhisperService] Verifying installation...');
        
        // 1. check binary
        if (!this.whisperPath) {
            return { success: false, error: 'Whisper binary path not set' };
        }
        
        try {
            await fsPromises.access(this.whisperPath, fs.constants.X_OK);
        } catch (error) {
            return { success: false, error: 'Whisper binary not executable' };
        }
        
        // 2. check version
        try {
            const { stdout } = await spawnAsync(this.whisperPath, ['--help']);
            if (!stdout.includes('whisper')) {
                return { success: false, error: 'Invalid whisper binary' };
            }
        } catch (error) {
            return { success: false, error: 'Whisper binary not responding' };
        }
        
        // 3. check directories
        try {
            await fsPromises.access(this.modelsDir, fs.constants.W_OK);
            await fsPromises.access(this.tempDir, fs.constants.W_OK);
        } catch (error) {
            return { success: false, error: 'Required directories not accessible' };
        }
        
        console.log('[WhisperService] Installation verified successfully');
        return { success: true };
        
    } catch (error) {
        console.error('[WhisperService] Verification failed:', error);
        return { success: false, error: error.message };
    }
};

// Export singleton instance
const whisperService = new WhisperService();
module.exports = whisperService;