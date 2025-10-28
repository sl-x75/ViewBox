// preload.js
// Preload scripts run in the renderer context but have access to Node.js APIs
// They CANNOT import main-process-only modules like 'app'

// Expose process.platform to the renderer
window.platform = process.platform;

// Log successful load
console.log('[preload] Loaded successfully', {
  platform: process.platform,
  versions: process.versions
});