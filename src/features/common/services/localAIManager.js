const { EventEmitter } = require('events');
const ollamaService = require('./ollamaService');
const whisperService = require('./whisperService');


//Central manager for managing Ollama and Whisper services 
class LocalAIManager extends EventEmitter {
    constructor() {
        super();
        
        // service map
        this.services = {
            ollama: ollamaService,
            whisper: whisperService
        };
        
        // unified state management
        this.state = {
            ollama: {
                installed: false,
                running: false,
                models: []
            },
            whisper: {
                installed: false,
                initialized: false,
                models: []
            }
        };
        
        // setup event listeners
        this.setupEventListeners();
    }
    
    
    // subscribe to events from each service and re-emit as unified events
    setupEventListeners() {
        // ollama events
        ollamaService.on('install-progress', (data) => {
            this.emit('install-progress', 'ollama', data);
        });
        
        ollamaService.on('installation-complete', () => {
            this.emit('installation-complete', 'ollama');
            this.updateServiceState('ollama');
        });
        
        ollamaService.on('error', (error) => {
            this.emit('error', { service: 'ollama', ...error });
        });
        
        ollamaService.on('model-pull-complete', (data) => {
            this.emit('model-ready', { service: 'ollama', ...data });
            this.updateServiceState('ollama');
        });
        
        ollamaService.on('state-changed', (state) => {
            this.emit('state-changed', 'ollama', state);
        });
        
        // Whisper 이벤트
        whisperService.on('install-progress', (data) => {
            this.emit('install-progress', 'whisper', data);
        });
        
        whisperService.on('installation-complete', () => {
            this.emit('installation-complete', 'whisper');
            this.updateServiceState('whisper');
        });
        
        whisperService.on('error', (error) => {
            this.emit('error', { service: 'whisper', ...error });
        });
        
        whisperService.on('model-download-complete', (data) => {
            this.emit('model-ready', { service: 'whisper', ...data });
            this.updateServiceState('whisper');
        });
    }
    
    /**
     * 서비스 설치
     */
    async installService(serviceName, options = {}) {
        const service = this.services[serviceName];
        if (!service) {
            throw new Error(`Unknown service: ${serviceName}`);
        }
        
        try {
            if (serviceName === 'ollama') {
                return await service.handleInstall();
            } else if (serviceName === 'whisper') {
                // Whisper는 자동 설치
                await service.initialize();
                return { success: true };
            }
        } catch (error) {
            this.emit('error', {
                service: serviceName,
                errorType: 'installation-failed',
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * 서비스 상태 조회
     */
    async getServiceStatus(serviceName) {
        const service = this.services[serviceName];
        if (!service) {
            throw new Error(`Unknown service: ${serviceName}`);
        }
        
        if (serviceName === 'ollama') {
            return await service.getStatus();
        } else if (serviceName === 'whisper') {
            const installed = await service.isInstalled();
            const running = await service.isServiceRunning();
            const models = await service.getInstalledModels();
            return {
                success: true,
                installed,
                running,
                models
            };
        }
    }
    
    /**
     * 서비스 시작
     */
    async startService(serviceName) {
        const service = this.services[serviceName];
        if (!service) {
            throw new Error(`Unknown service: ${serviceName}`);
        }
        
        const result = await service.startService();
        await this.updateServiceState(serviceName);
        return { success: result };
    }
    
    /**
     * 서비스 중지
     */
    async stopService(serviceName) {
        const service = this.services[serviceName];
        if (!service) {
            throw new Error(`Unknown service: ${serviceName}`);
        }
        
        let result;
        if (serviceName === 'ollama') {
            result = await service.shutdown(false);
        } else if (serviceName === 'whisper') {
            result = await service.stopService();
        }
        
        // 서비스 중지 후 상태 업데이트
        await this.updateServiceState(serviceName);
        
        return result;
    }
    
    /**
     * 모델 설치/다운로드
     */
    async installModel(serviceName, modelId, options = {}) {
        const service = this.services[serviceName];
        if (!service) {
            throw new Error(`Unknown service: ${serviceName}`);
        }
        
        if (serviceName === 'ollama') {
            return await service.pullModel(modelId);
        } else if (serviceName === 'whisper') {
            return await service.downloadModel(modelId);
        }
    }
    
    /**
     * 설치된 모델 목록 조회
     */
    async getInstalledModels(serviceName) {
        const service = this.services[serviceName];
        if (!service) {
            throw new Error(`Unknown service: ${serviceName}`);
        }
        
        if (serviceName === 'ollama') {
            return await service.getAllModelsWithStatus();
        } else if (serviceName === 'whisper') {
            return await service.getInstalledModels();
        }
    }
    
    /**
     * 모델 워밍업 (Ollama 전용)
     */
    async warmUpModel(modelName, forceRefresh = false) {
        return await ollamaService.warmUpModel(modelName, forceRefresh);
    }
    
    /**
     * 자동 워밍업 (Ollama 전용)
     */
    async autoWarmUp() {
        return await ollamaService.autoWarmUpSelectedModel();
    }
    
    /**
     * 진단 실행
     */
    async runDiagnostics(serviceName) {
        const service = this.services[serviceName];
        if (!service) {
            throw new Error(`Unknown service: ${serviceName}`);
        }
        
        const diagnostics = {
            service: serviceName,
            timestamp: new Date().toISOString(),
            checks: {}
        };
        
        try {
            // 1. 설치 상태 확인
            diagnostics.checks.installation = {
                check: 'Installation',
                status: await service.isInstalled() ? 'pass' : 'fail',
                details: {}
            };
            
            // 2. 서비스 실행 상태
            diagnostics.checks.running = {
                check: 'Service Running',
                status: await service.isServiceRunning() ? 'pass' : 'fail',
                details: {}
            };
            
            // 3. 포트 연결 테스트 및 상세 health check (Ollama)
            if (serviceName === 'ollama') {
                try {
                    // Use comprehensive health check
                    const health = await service.healthCheck();
                    diagnostics.checks.health = {
                        check: 'Service Health',
                        status: health.healthy ? 'pass' : 'fail',
                        details: health
                    };
                    
                    // Legacy port check for compatibility
                    diagnostics.checks.port = {
                        check: 'Port Connectivity',
                        status: health.checks.apiResponsive ? 'pass' : 'fail',
                        details: { connected: health.checks.apiResponsive }
                    };
                } catch (error) {
                    diagnostics.checks.health = {
                        check: 'Service Health',
                        status: 'fail',
                        details: { error: error.message }
                    };
                    diagnostics.checks.port = {
                        check: 'Port Connectivity',
                        status: 'fail',
                        details: { error: error.message }
                    };
                }
                
                // 4. 모델 목록
                if (diagnostics.checks.running.status === 'pass') {
                    try {
                        const models = await service.getInstalledModels();
                        diagnostics.checks.models = {
                            check: 'Installed Models',
                            status: 'pass',
                            details: { count: models.length, models: models.map(m => m.name) }
                        };
                        
                        // 5. 워밍업 상태
                        const warmupStatus = await service.getWarmUpStatus();
                        diagnostics.checks.warmup = {
                            check: 'Model Warm-up',
                            status: 'pass',
                            details: warmupStatus
                        };
                    } catch (error) {
                        diagnostics.checks.models = {
                            check: 'Installed Models',
                            status: 'fail',
                            details: { error: error.message }
                        };
                    }
                }
            }
            
            // 4. Whisper 특화 진단
            if (serviceName === 'whisper') {
                // 바이너리 확인
                diagnostics.checks.binary = {
                    check: 'Whisper Binary',
                    status: service.whisperPath ? 'pass' : 'fail',
                    details: { path: service.whisperPath }
                };
                
                // 모델 디렉토리
                diagnostics.checks.modelDir = {
                    check: 'Model Directory',
                    status: service.modelsDir ? 'pass' : 'fail',
                    details: { path: service.modelsDir }
                };
            }
            
            // 전체 진단 결과
            const allChecks = Object.values(diagnostics.checks);
            diagnostics.summary = {
                total: allChecks.length,
                passed: allChecks.filter(c => c.status === 'pass').length,
                failed: allChecks.filter(c => c.status === 'fail').length,
                overallStatus: allChecks.every(c => c.status === 'pass') ? 'healthy' : 'unhealthy'
            };
            
        } catch (error) {
            diagnostics.error = error.message;
            diagnostics.summary = {
                overallStatus: 'error'
            };
        }
        
        return diagnostics;
    }
    
    /**
     * 서비스 복구
     */
    async repairService(serviceName) {
        const service = this.services[serviceName];
        if (!service) {
            throw new Error(`Unknown service: ${serviceName}`);
        }
        
        console.log(`[LocalAIManager] Starting repair for ${serviceName}...`);
        const repairLog = [];
        
        try {
            // 1. 진단 실행
            repairLog.push('Running diagnostics...');
            const diagnostics = await this.runDiagnostics(serviceName);
            
            if (diagnostics.summary.overallStatus === 'healthy') {
                repairLog.push('Service is already healthy, no repair needed');
                return {
                    success: true,
                    repairLog,
                    diagnostics
                };
            }
            
            // 2. 설치 문제 해결
            if (diagnostics.checks.installation?.status === 'fail') {
                repairLog.push('Installation missing, attempting to install...');
                try {
                    await this.installService(serviceName);
                    repairLog.push('Installation completed');
                } catch (error) {
                    repairLog.push(`Installation failed: ${error.message}`);
                    throw error;
                }
            }
            
            // 3. 서비스 재시작
            if (diagnostics.checks.running?.status === 'fail') {
                repairLog.push('Service not running, attempting to start...');
                
                // 종료 시도
                try {
                    await this.stopService(serviceName);
                    repairLog.push('Stopped existing service');
                } catch (error) {
                    repairLog.push('Service was not running');
                }
                
                // 잠시 대기
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // 시작
                try {
                    await this.startService(serviceName);
                    repairLog.push('Service started successfully');
                } catch (error) {
                    repairLog.push(`Failed to start service: ${error.message}`);
                    throw error;
                }
            }
            
            // 4. 포트 문제 해결 (Ollama)
            if (serviceName === 'ollama' && diagnostics.checks.port?.status === 'fail') {
                repairLog.push('Port connectivity issue detected');
                
                // 프로세스 강제 종료
                if (process.platform === 'darwin') {
                    try {
                        const { exec } = require('child_process');
                        const { promisify } = require('util');
                        const execAsync = promisify(exec);
                        await execAsync('pkill -f ollama');
                        repairLog.push('Killed stale Ollama processes');
                    } catch (error) {
                        repairLog.push('No stale processes found');
                    }
                }
                else if (process.platform === 'win32') {
                    try {
                        const { exec } = require('child_process');
                        const { promisify } = require('util');
                        const execAsync = promisify(exec);
                        await execAsync('taskkill /F /IM ollama.exe');
                        repairLog.push('Killed stale Ollama processes');
                    } catch (error) {
                        repairLog.push('No stale processes found');
                    }
                }
                else if (process.platform === 'linux') {
                    try {
                        const { exec } = require('child_process');
                        const { promisify } = require('util');
                        const execAsync = promisify(exec);
                        await execAsync('pkill -f ollama');
                        repairLog.push('Killed stale Ollama processes');
                    } catch (error) {
                        repairLog.push('No stale processes found');
                    }
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // 재시작
                await this.startService(serviceName);
                repairLog.push('Restarted service after port cleanup');
            }
            
            // 5. Whisper 특화 복구
            if (serviceName === 'whisper') {
                // 세션 정리
                if (diagnostics.checks.running?.status === 'pass') {
                    repairLog.push('Cleaning up Whisper sessions...');
                    await service.cleanup();
                    repairLog.push('Sessions cleaned up');
                }
                
                // 초기화
                if (!service.installState.isInitialized) {
                    repairLog.push('Re-initializing Whisper...');
                    await service.initialize();
                    repairLog.push('Whisper re-initialized');
                }
            }
            
            // 6. 최종 상태 확인
            repairLog.push('Verifying repair...');
            const finalDiagnostics = await this.runDiagnostics(serviceName);
            
            const success = finalDiagnostics.summary.overallStatus === 'healthy';
            repairLog.push(success ? 'Repair successful!' : 'Repair failed - manual intervention may be required');
            
            // 성공 시 상태 업데이트
            if (success) {
                await this.updateServiceState(serviceName);
            }
            
            return {
                success,
                repairLog,
                diagnostics: finalDiagnostics
            };
            
        } catch (error) {
            repairLog.push(`Repair error: ${error.message}`);
            return {
                success: false,
                repairLog,
                error: error.message
            };
        }
    }
    
    /**
     * 상태 업데이트
     */
    async updateServiceState(serviceName) {
        try {
            const status = await this.getServiceStatus(serviceName);
            this.state[serviceName] = status;
            
            // 상태 변경 이벤트 발행
            this.emit('state-changed', serviceName, status);
        } catch (error) {
            console.error(`[LocalAIManager] Failed to update ${serviceName} state:`, error);
        }
    }
    
    /**
     * 전체 상태 조회
     */
    async getAllServiceStates() {
        const states = {};
        
        for (const serviceName of Object.keys(this.services)) {
            try {
                states[serviceName] = await this.getServiceStatus(serviceName);
            } catch (error) {
                states[serviceName] = {
                    success: false,
                    error: error.message
                };
            }
        }
        
        return states;
    }
    
    /**
     * 주기적 상태 동기화 시작
     */
    startPeriodicSync(interval = 30000) {
        if (this.syncInterval) {
            return;
        }
        
        this.syncInterval = setInterval(async () => {
            for (const serviceName of Object.keys(this.services)) {
                await this.updateServiceState(serviceName);
            }
        }, interval);
        
        // 각 서비스의 주기적 동기화도 시작
        ollamaService.startPeriodicSync();
    }
    
    /**
     * 주기적 상태 동기화 중지
     */
    stopPeriodicSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        
        // 각 서비스의 주기적 동기화도 중지
        ollamaService.stopPeriodicSync();
    }
    
    /**
     * 전체 종료
     */
    async shutdown() {
        this.stopPeriodicSync();
        
        const results = {};
        for (const [serviceName, service] of Object.entries(this.services)) {
            try {
                if (serviceName === 'ollama') {
                    results[serviceName] = await service.shutdown(false);
                } else if (serviceName === 'whisper') {
                    await service.cleanup();
                    results[serviceName] = true;
                }
            } catch (error) {
                results[serviceName] = false;
                console.error(`[LocalAIManager] Failed to shutdown ${serviceName}:`, error);
            }
        }
        
        return results;
    }
    
    /**
     * 에러 처리
     */
    async handleError(serviceName, errorType, details = {}) {
        console.error(`[LocalAIManager] Error in ${serviceName}: ${errorType}`, details);
        
        // 서비스별 에러 처리
        switch(errorType) {
            case 'installation-failed':
                // 설치 실패 시 이벤트 발생
                this.emit('error-occurred', {
                    service: serviceName,
                    errorType,
                    error: details.error || 'Installation failed',
                    canRetry: true
                });
                break;
                
            case 'model-pull-failed':
            case 'model-download-failed':
                // 모델 다운로드 실패
                this.emit('error-occurred', {
                    service: serviceName,
                    errorType,
                    model: details.model,
                    error: details.error || 'Model download failed',
                    canRetry: true
                });
                break;
                
            case 'service-not-responding':
                // 서비스 반응 없음
                console.log(`[LocalAIManager] Attempting to repair ${serviceName}...`);
                const repairResult = await this.repairService(serviceName);
                
                this.emit('error-occurred', {
                    service: serviceName,
                    errorType,
                    error: details.error || 'Service not responding',
                    repairAttempted: true,
                    repairSuccessful: repairResult.success
                });
                break;
                
            default:
                // 기타 에러
                this.emit('error-occurred', {
                    service: serviceName,
                    errorType,
                    error: details.error || `Unknown error: ${errorType}`,
                    canRetry: false
                });
        }
    }
}

// 싱글톤
const localAIManager = new LocalAIManager();
module.exports = localAIManager;