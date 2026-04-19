const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { processVideos, stopProcessing, generatePreview, listFonts } = require('./processor');

// ─── Preset storage ───────────────────────────────────────────────────────────

function presetsFilePath() {
  return path.join(app.getPath('userData'), 'text-style-presets.json');
}

function readPresets() {
  try {
    return JSON.parse(fs.readFileSync(presetsFilePath(), 'utf8'));
  } catch (_) {
    return [];
  }
}

function writePresets(presets) {
  fs.writeFileSync(presetsFilePath(), JSON.stringify(presets, null, 2), 'utf8');
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0a0f',
  });

  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ─── File / directory dialogs ─────────────────────────────────────────────────

ipcMain.handle('dialog:openFile', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog:openFiles', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('shell:showItemInFolder', (event, filePath) => {
  shell.showItemInFolder(filePath);
});

// ─── Video processing ─────────────────────────────────────────────────────────

ipcMain.handle('videos:process', async (event, tasks) => {
  try {
    const results = await processVideos(tasks, (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('videos:progress', progress);
      }
    });
    return { success: true, results };
  } catch (error) {
    if (error.message === '__CANCELLED__') {
      return { success: false, cancelled: true };
    }
    console.error('Processing error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('videos:stop', () => {
  stopProcessing();
});

// ─── Hook texts import ───────────────────────────────────────────────────────

ipcMain.handle('hooks:importTexts', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Hook Texts',
    properties: ['openFile'],
    filters: [
      { name: 'Hookz Export', extensions: ['json'] },
      { name: 'All Files',    extensions: ['*'] },
    ],
  });
  if (result.canceled || !result.filePaths[0]) return null;

  const raw = fs.readFileSync(result.filePaths[0], 'utf8');
  const data = JSON.parse(raw);

  // Accept both formats:
  // 1. Array of hook objects:  [{ filename, text, ... }, ...]
  // 2. Wrapper object:          { hooks: [...] }
  const hooks = Array.isArray(data) ? data : (data.hooks || []);

  return hooks.map((h) => ({
    filename: h.filename || h.file || h.video_filename || null,
    text:     h.text     || h.overlay_text || h.hook_text || '',
  }));
});

ipcMain.handle('fonts:list', () => listFonts());

// ─── Text-style presets ───────────────────────────────────────────────────────

ipcMain.handle('presets:list', () => readPresets());

ipcMain.handle('presets:save', (event, { name, params }) => {
  const presets = readPresets();
  const idx = presets.findIndex((p) => p.name === name);
  if (idx >= 0) {
    presets[idx].params = params; // overwrite existing
  } else {
    presets.push({ name, params });
  }
  writePresets(presets);
  return presets;
});

ipcMain.handle('presets:delete', (event, name) => {
  const presets = readPresets().filter((p) => p.name !== name);
  writePresets(presets);
  return presets;
});

ipcMain.handle('videos:preview', async (event, { videoPath, text, params }) => {
  try {
    const dataUrl = await generatePreview(videoPath, text, params);
    return { success: true, dataUrl };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
