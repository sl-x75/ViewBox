// src/utils/appInfo.js
// Helper to get app information from main process

const { ipcRenderer } = require('electron');

let cachedAppInfo = null;

/**
 * Get application information from the main process
 * @returns {Promise<{isPackaged: boolean, appPath: string, platform: string, version: string}>}
 */
export async function getAppInfo() {
  if (cachedAppInfo) {
    return cachedAppInfo;
  }
  
  try {
    cachedAppInfo = await ipcRenderer.invoke('get-app-info');
    return cachedAppInfo;
  } catch (error) {
    console.error('[appInfo] Failed to get app info:', error);
    // Return defaults if IPC fails
    return {
      isPackaged: false,
      appPath: '',
      platform: window.platform || process.platform,
      version: '1.0.0'
    };
  }
}

/**
 * Get platform information (synchronous)
 * @returns {string} Platform name ('darwin', 'win32', 'linux', etc.)
 */
export function getPlatform() {
  return window.platform || process.platform;
}

/**
 * Check if running on macOS
 * @returns {boolean}
 */
export function isMac() {
  return getPlatform() === 'darwin';
}

/**
 * Check if running on Windows
 * @returns {boolean}
 */
export function isWindows() {
  return getPlatform() === 'win32';
}

/**
 * Check if running on Linux
 * @returns {boolean}
 */
export function isLinux() {
  return getPlatform() === 'linux';
}