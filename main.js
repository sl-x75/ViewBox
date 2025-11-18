// main.js

import { app, BrowserWindow, session, ipcMain, shell, protocol, dialog, Menu, nativeTheme } from 'electron';
import path from 'path';
import fs from "fs/promises";
import mime from 'mime';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';

// Setup __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register custom protocol before app.ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'bonsai-file',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      allowServiceWorkers: true,
      corsEnabled: true,
    },
  },
]);

// Global flags and constants
// app.commandLine.appendSwitch('disable-gpu-vsync');
let projectWatcher = null;

// Determine if running in development or production
const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

// --- RECENT PROJECTS & SETTINGS LOGIC ---
const userDataPath = app.getPath('userData');
const recentProjectsPath = path.join(userDataPath, 'recent-projects.json');
const settingsPath = path.join(userDataPath, 'settings.json');

async function readUserSettings() {
  try {
     await fs.access(settingsPath);
     const data = await fs.readFile(settingsPath, 'utf8');
     return JSON.parse(data);
   } catch (error) {
     return {}; // Return empty object on error
   }
 }

async function readRecentProjects() {
  try {
    await fs.access(recentProjectsPath);
    const data = await fs.readFile(recentProjectsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

async function writeRecentProjects(projects) {
  try {
    await fs.writeFile(recentProjectsPath, JSON.stringify(projects, null, 2));
  } catch (error) {
    console.error("Failed to write recent projects:", error);
  }
}

async function addProjectToRecent(projectPath) {
  if (!projectPath) return;
  const userSettings = await readUserSettings();
  const recentProjectsCount = userSettings?.startPage?.recentProjectsCount || 10; // Default to 10
  const newProjectObject = { projectPath, projectName: path.basename(projectPath) };
  let projects = await readRecentProjects();
  projects = projects.filter(p => p.projectPath !== projectPath);
  projects.unshift(newProjectObject);
  await writeRecentProjects(projects.slice(0, recentProjectsCount));
}

// --- IPC HANDLERS ---
function registerIpcHandlers() {
  // Window Controls
  ipcMain.on('minimize-window', () => BrowserWindow.getFocusedWindow()?.minimize());
  ipcMain.on('maximize-window', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.isMaximized() ? win.unmaximize() : win.maximize();
  });
  ipcMain.on('close-window', () => BrowserWindow.getFocusedWindow()?.close());
  ipcMain.on('toggle-always-on-top', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setAlwaysOnTop(!win.isAlwaysOnTop());
  });

  // File/Project Operations
  ipcMain.handle('get-recent-projects', async () => readRecentProjects());
  ipcMain.handle('get-app-info', () => ({
    isPackaged: app.isPackaged,
    appPath: app.getAppPath(),
    platform: process.platform,
    version: app.getVersion()
  }));
  ipcMain.handle('open-project-dialog', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
    if (result.canceled || !result.filePaths.length) return null;
    const projectPath = result.filePaths[0];
    await addProjectToRecent(projectPath);
    return projectPath;
  });
  ipcMain.handle('open-folder', async (event, folderPath) => {
    try {
      await shell.openPath(folderPath);
      return { success: true };
    } catch (error) {
      console.error(`Failed to open path: ${folderPath}`, error);
      return { success: false, error: error.message };
    }
  });

  // Settings Handlers
  ipcMain.handle('get-user-settings', async () => {
    return readUserSettings();
  });
  ipcMain.handle('save-user-settings', async (event, settings) => {
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
  });

  // File Watcher
 // --- THIS IS THE FINAL, CORRECTED VERSION ---
 ipcMain.on('set-project-to-watch', (event, projectPath) => {
   const win = BrowserWindow.fromWebContents(event.sender);
   if (projectWatcher) projectWatcher.close();
   if (!projectPath || !win) return;

   // 1. Revert to the original, reliable method of watching directories.
   const ifcFileName = `${path.basename(projectPath)}.ifc`;
   const pathsToWatch = [
     path.join(projectPath, 'drawings'),
     path.join(projectPath, 'layouts'),
     path.join(projectPath, 'sheets'),
     path.join(projectPath, ifcFileName)
   ];

   projectWatcher = chokidar.watch(pathsToWatch, {
     ignored: /(^|[\/\\])\../,
     persistent: true,
     ignoreInitial: true,
     // depth: 1, // Let chokidar handle depth automatically for robustness
     awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
   });

   const notify = (channel, payload) => {
     if (!win.isDestroyed()) win.webContents.send(channel, payload);
   };

   projectWatcher
     .on('add', () => {
       addProjectToRecent(projectPath);
       notify('project-files-updated', { projectPath });
     })
     .on('unlink', () => {
       addProjectToRecent(projectPath);
       notify('project-files-updated', { projectPath });
     })
     .on('change', (filePath) => {
     addProjectToRecent(projectPath);
     
     const fileExtension = path.extname(filePath).toLowerCase();
     
     if (fileExtension === '.ifc') {
       notify('ifc-file-updated', { projectPath });
     } else if (['.png', '.jpg', '.jpeg', '.gif', '.bmp'].includes(fileExtension)) {
       // Send a specific event for image updates with the full path
       notify('underlay-image-updated', { imagePath: filePath });
     } else {
       // For .svg and .css changes, send the specific path
       notify('current-file-updated', { changedFilePath: filePath });
     }
   })   ;
 });
}

// --- APPLICATION MENU ---
function createMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Speech',
            submenu: [
              { role: 'startSpeaking' },
              { role: 'stopSpeaking' }
            ]
          }
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' }
        ])
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        {
         role: 'toggleDevTools',
         accelerator: process.platform === 'darwin' ? 'Cmd+Option+I' : 'Ctrl+Shift+I'
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// --- CREATE WINDOW ---
async function createWindow() {
  // Define your background colors
  const LIGHT_BG = '#f9fafb';
  const DARK_BG = '#282828';

  // Read settings to determine the correct background color
  const userSettings = await readUserSettings();
  const themeMode = userSettings?.theme?.mode || 'system';
  
  let finalBackgroundColor = LIGHT_BG;
  if (themeMode === 'dark') {
    finalBackgroundColor = DARK_BG;
  } else if (themeMode === 'system') {
    if (nativeTheme.shouldUseDarkColors) {
      finalBackgroundColor = DARK_BG;
    }
  }

  const mainWindow = new BrowserWindow({
    show: false,
    backgroundColor: finalBackgroundColor,
    frame: false,
    titleBarStyle: "hiddenInset",
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // CSP for security
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const csp = [
      "default-src 'self' file: bonsai-file:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' bonsai-file:",
      "style-src 'self' 'unsafe-inline' bonsai-file:",
      "img-src 'self' data: file: bonsai-file:",
      "font-src 'self' data: file: bonsai-file:",
      "connect-src 'self' ws://localhost:8080 " + (VITE_DEV_SERVER_URL || ''),
    ].join("; ");

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp],
      },
    });
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadURL('bonsai-file://dist/index.html');
  }

  // Only show the window when the content is ready.
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

// --- APP LIFECYCLE ---
app.whenReady().then(async () => {
  // Register handlers and menu
  registerIpcHandlers();
  createMenu();

  // Register custom protocol handler
protocol.handle('bonsai-file', async (request) => {
  const url = new URL(request.url);
  
  // Strip query params before resolving path
  let decodedPath = decodeURI(url.pathname);

    // Combine host + pathname if host exists
    if (url.host && !decodedPath.startsWith(`/${url.host}`)) {
      decodedPath = `/${url.host}${decodedPath}`;
    }

    // Normalize /users/ → /Users/ on macOS
    decodedPath = decodedPath.replace(/^\/users\//i, '/Users/');

    // Detect absolute system paths
    const isAbsoluteSystemPath =
      decodedPath.startsWith('/Users/') ||
      decodedPath.startsWith('/home/') ||
      decodedPath.startsWith('/Volumes/') ||
      decodedPath.startsWith('/tmp/') ||
      /^[A-Z]:/i.test(decodedPath);

    let filePath;
    if (isAbsoluteSystemPath) {
      // Load directly from filesystem (user's project files)
      filePath = decodedPath;
    } else {
      // App-internal file: resolve relative to app root
      if (decodedPath.startsWith('/')) decodedPath = decodedPath.slice(1);
      
      if (app.isPackaged) {
        const resourcesPath = process.resourcesPath;
        filePath = path.join(resourcesPath, decodedPath);
        
        try {
          await fs.access(filePath);
        } catch {
          filePath = path.join(__dirname, '..', decodedPath);
        }
      } else {
        filePath = path.join(__dirname, '..', decodedPath);
      }
    }

    console.log('[bonsai-file]', { 
      url: request.url, 
      decodedPath, 
      filePath,
      isPackaged: app.isPackaged 
    });

     try {
       const data = await fs.readFile(filePath);
       const type = mime.getType(filePath) || 'text/plain';
       
       // Add no-cache headers for image files
       const headers = { 'Content-Type': type };
       if (['.png', '.jpg', '.jpeg', '.gif', '.bmp'].includes(path.extname(filePath).toLowerCase())) {
         headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
         headers['Pragma'] = 'no-cache';
         headers['Expires'] = '0';
       }
       
       return new Response(data, { headers });
     } catch (err) {
      console.error('[bonsai-file] failed to load', filePath, err);
      return new Response('File not found', { status: 404 });
    }
  });

  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

app.on("window-all-closed", () => {
  if (projectWatcher) projectWatcher.close();
  if (process.platform !== "darwin") app.quit();
});