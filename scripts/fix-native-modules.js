const { execSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

console.log('Fixing native modules for your platform...');

const isWindows = os.platform() === 'win32';
const isMacOS = os.platform() === 'darwin';

try {
  // First, make sure we have the electron-rebuild tool
  if (!fs.existsSync(path.join('node_modules', '.bin', 'electron-rebuild'))) {
    console.log('Installing electron-rebuild...');
    execSync('npm install electron-rebuild --save-dev', { stdio: 'inherit' });
  }

  // Rebuild native modules for Electron
  console.log('Rebuilding native modules for Electron...');
  execSync('npx electron-rebuild -f -w better-sqlite3 sqlite3', { stdio: 'inherit' });
  
  if (isWindows) {
    console.log('Applying Windows-specific fixes...');
    // Windows-specific fixes can go here
  }
  
  if (isMacOS) {
    console.log('Applying macOS-specific fixes...');
    // macOS-specific fixes can go here
  }
  
  console.log('✅ Native modules successfully rebuilt for your platform!');
} catch (error) {
  console.error('❌ Failed to rebuild native modules:', error.message);
  process.exit(1);
}