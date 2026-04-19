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

// ─── Manifest import ─────────────────────────────────────────────────────────

ipcMain.handle('manifest:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Hookz Manifest', extensions: ['hookz.json', 'json'] }],
    title: 'Import Hookz Manifest',
  });
  if (result.canceled || !result.filePaths[0]) return { success: false, cancelled: true };

  const manifestPath = result.filePaths[0];
  const manifestDir  = path.dirname(manifestPath);

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    return { success: false, error: 'Invalid manifest file — could not parse JSON.' };
  }

  if (!parsed.version || parsed.version !== '1') {
    return { success: false, error: `Unsupported manifest version: "${parsed.version}". Expected "1".` };
  }
  if (!Array.isArray(parsed.hooks) || parsed.hooks.length === 0) {
    return { success: false, error: 'Manifest contains no hooks.' };
  }

  const hooks = parsed.hooks.map((entry) => {
    const resolvedPath = path.join(manifestDir, entry.filename);
    return {
      filename:     entry.filename,
      resolvedPath: resolvedPath,
      found:        fs.existsSync(resolvedPath),
      text:         entry.text || '',
    };
  });

  return { success: true, hooks, manifestDir };
});
