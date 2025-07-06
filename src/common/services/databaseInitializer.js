const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const sqliteClient = require('./sqliteClient');
const config = require('../config/config');

class DatabaseInitializer {
    constructor() {
        this.isInitialized = false;
        
        // 최종적으로 사용될 DB 경로 (쓰기 가능한 위치)
        const userDataPath = app.getPath('userData');
        this.dbPath = path.join(userDataPath, 'pickleglass.db');
        this.dataDir = userDataPath;

        // 원본 DB 경로 (패키지 내 읽기 전용 위치)
        this.sourceDbPath = app.isPackaged
            ? path.join(process.resourcesPath, 'data', 'pickleglass.db')
            : path.join(app.getAppPath(), 'data', 'pickleglass.db');
    }

    ensureDatabaseExists() {
        if (!fs.existsSync(this.dbPath)) {
            console.log(`[DB] Database not found at ${this.dbPath}. Preparing to create new database...`);

            // userData 디렉토리 생성 (없을 경우)
            if (!fs.existsSync(this.dataDir)) {
                fs.mkdirSync(this.dataDir, { recursive: true });
            }

            // 패키지에 번들된 초기 DB가 있으면 복사, 없으면 빈 파일을 생성하도록 둔다.
            if (fs.existsSync(this.sourceDbPath)) {
                try {
                    fs.copyFileSync(this.sourceDbPath, this.dbPath);
                    console.log(`[DB] Bundled database copied to ${this.dbPath}`);
                } catch (error) {
                    console.error(`[DB] Failed to copy bundled database:`, error);
                    // 복사 실패 시에도 새 DB를 생성할 수 있도록 계속 진행
                }
            } else {
                console.log('[DB] No bundled DB found – a fresh database will be created.');
            }
        }
    }

    async initialize() {
        if (this.isInitialized) {
            console.log('[DB] Already initialized.');
            return true;
        }

        try {
            this.ensureDatabaseExists();

            await sqliteClient.connect(this.dbPath); // DB 경로를 인자로 전달
            
            // This single call will now synchronize the schema and then init default data.
            await sqliteClient.initTables();

            // Clean up any orphaned sessions from previous versions
            await sqliteClient.cleanupEmptySessions();

            this.isInitialized = true;
            console.log('[DB] Database initialized successfully');
            return true;
        } catch (error) {
            console.error('[DB] Database initialization failed:', error);
            this.isInitialized = false;
            throw error; 
        }
    }

    async ensureDataDirectory() {
        try {
            if (!fs.existsSync(this.dataDir)) {
                fs.mkdirSync(this.dataDir, { recursive: true });
                console.log('[DatabaseInitializer] Data directory created:', this.dataDir);
            } else {
                console.log('[DatabaseInitializer] Data directory exists:', this.dataDir);
            }
        } catch (error) {
            console.error('[DatabaseInitializer] Failed to create data directory:', error);
            throw error;
        }
    }

    async checkDatabaseExists() {
        try {
            const exists = fs.existsSync(this.dbPath);
            console.log('[DatabaseInitializer] Database file check:', { path: this.dbPath, exists });
            return exists;
        } catch (error) {
            console.error('[DatabaseInitializer] Error checking database file:', error);
            return false;
        }
    }

    async createNewDatabase() {
        console.log('[DatabaseInitializer] Creating new database...');
        try {
            await sqliteClient.connect(); // Connect and initialize tables/default data
            
            const user = await sqliteClient.getUser(sqliteClient.defaultUserId);
            if (!user) {
                throw new Error('Default user was not created during initialization.');
            }
            
            console.log(`[DatabaseInitializer] Default user check successful, UID: ${user.uid}`);
            return { success: true, user };

        } catch (error) {
            console.error('[DatabaseInitializer] Failed to create new database:', error);
            throw error;
        }
    }

    async connectToExistingDatabase() {
        console.log('[DatabaseInitializer] Connecting to existing database...');
        try {
            await sqliteClient.connect();
            
            const user = await sqliteClient.getUser(sqliteClient.defaultUserId);
            if (!user) {
                console.warn('[DatabaseInitializer] Default user not found in existing DB, attempting recovery.');
                throw new Error('Default user missing');
            }
            
            console.log(`[DatabaseInitializer] Connection to existing DB successful for user: ${user.uid}`);
            return { success: true, user };

        } catch (error) {
            console.error('[DatabaseInitializer] Failed to connect to existing database:', error);
            throw error;
        }
    }

    async validateAndRecoverData() {
        console.log('[DatabaseInitializer] Validating database integrity...');
        try {
            console.log('[DatabaseInitializer] Validating database integrity...');

            // The synchronizeSchema function handles table and column creation now.
            // We just need to ensure default data is present.
            await sqliteClient.synchronizeSchema();

            const defaultUser =  await sqliteClient.getUser(sqliteClient.defaultUserId);
            if (!defaultUser) {
                console.log('[DatabaseInitializer] Default user not found - creating...');
                await sqliteClient.initDefaultData();
            }

            const presetTemplates = await sqliteClient.getPresets('default_user');
            if (!presetTemplates || presetTemplates.length === 0) {
                console.log('[DatabaseInitializer] Preset templates missing - creating...');
                await sqliteClient.initDefaultData();
            }

            console.log('[DatabaseInitializer] Database validation completed');
            return { success: true };

        } catch (error) {
            console.error('[DatabaseInitializer] Database validation failed:', error);
            try {
                await sqliteClient.initDefaultData();
                console.log('[DatabaseInitializer] Default data recovered');
                return { success: true };
            } catch (error) {
                console.error('[DatabaseInitializer] Database validation failed:', error);
                throw error;
            }
        }
    }

    async getStatus() {
        return {
            isInitialized: this.isInitialized,
            dbPath: this.dbPath,
            dbExists: fs.existsSync(this.dbPath),
            enableSQLiteStorage: config.get('enableSQLiteStorage'),
            enableOfflineMode: config.get('enableOfflineMode')
        };
    }

    async reset() {
        try {
            console.log('[DatabaseInitializer] Resetting database...');
            
            sqliteClient.close();
            
            if (fs.existsSync(this.dbPath)) {
                fs.unlinkSync(this.dbPath);
                console.log('[DatabaseInitializer] Database file deleted');
            }

            this.isInitialized = false;
            await this.initialize();

            console.log('[DatabaseInitializer] Database reset completed');
            return true;

        } catch (error) {
            console.error('[DatabaseInitializer] Database reset failed:', error);
            return false;
        }
    }

    close() {
        if (sqliteClient) {
            sqliteClient.close();
        }
        this.isInitialized = false;
        console.log('[DatabaseInitializer] Database connection closed');
    }

    getDatabasePath() {
        return this.dbPath;
    }
}

const databaseInitializer = new DatabaseInitializer();

module.exports = databaseInitializer; 