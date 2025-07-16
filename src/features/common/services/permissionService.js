const { systemPreferences, shell, desktopCapturer } = require('electron');
const permissionRepository = require('../repositories/permission');

class PermissionService {
  _getAuthService() {
    return require('./authService');
  }

  async checkSystemPermissions() {
    const permissions = {
      microphone: 'unknown',
      screen: 'unknown',
      keychain: 'unknown',
      needsSetup: true
    };

    try {
      if (process.platform === 'darwin') {
        permissions.microphone = systemPreferences.getMediaAccessStatus('microphone');
        permissions.screen = systemPreferences.getMediaAccessStatus('screen');
        permissions.keychain = await this.checkKeychainCompleted(this._getAuthService().getCurrentUserId()) ? 'granted' : 'unknown';
        permissions.needsSetup = permissions.microphone !== 'granted' || permissions.screen !== 'granted' || permissions.keychain !== 'granted';
      } else {
        permissions.microphone = 'granted';
        permissions.screen = 'granted';
        permissions.keychain = 'granted';
        permissions.needsSetup = false;
      }

      console.log('[Permissions] System permissions status:', permissions);
      return permissions;
    } catch (error) {
      console.error('[Permissions] Error checking permissions:', error);
      return {
        microphone: 'unknown',
        screen: 'unknown',
        keychain: 'unknown',
        needsSetup: true,
        error: error.message
      };
    }
  }

  async requestMicrophonePermission() {
    if (process.platform !== 'darwin') {
      return { success: true };
    }

    try {
      const status = systemPreferences.getMediaAccessStatus('microphone');
      console.log('[Permissions] Microphone status:', status);
      if (status === 'granted') {
        return { success: true, status: 'granted' };
      }

      const granted = await systemPreferences.askForMediaAccess('microphone');
      return {
        success: granted,
        status: granted ? 'granted' : 'denied'
      };
    } catch (error) {
      console.error('[Permissions] Error requesting microphone permission:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async openSystemPreferences(section) {
    if (process.platform !== 'darwin') {
      return { success: false, error: 'Not supported on this platform' };
    }

    try {
      if (section === 'screen-recording') {
        try {
          console.log('[Permissions] Triggering screen capture request to register app...');
          await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 1, height: 1 }
          });
          console.log('[Permissions] App registered for screen recording');
        } catch (captureError) {
          console.log('[Permissions] Screen capture request triggered (expected to fail):', captureError.message);
        }
        
        // await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
      }
      return { success: true };
    } catch (error) {
      console.error('[Permissions] Error opening system preferences:', error);
      return { success: false, error: error.message };
    }
  }

  async markKeychainCompleted() {
    try {
      await permissionRepository.markKeychainCompleted(this._getAuthService().getCurrentUserId());
      console.log('[Permissions] Marked keychain as completed');
      return { success: true };
    } catch (error) {
      console.error('[Permissions] Error marking keychain as completed:', error);
      return { success: false, error: error.message };
    }
  }

  async checkKeychainCompleted(uid) {
    if (uid === "default_user") {
      return true;
    }
    try {
      const completed = permissionRepository.checkKeychainCompleted(uid);
      console.log('[Permissions] Keychain completed status:', completed);
      return completed;
    } catch (error) {
      console.error('[Permissions] Error checking keychain completed status:', error);
      return false;
    }
  }
}

const permissionService = new PermissionService();
module.exports = permissionService; 