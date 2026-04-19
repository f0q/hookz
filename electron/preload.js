const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile:    (options) => ipcRenderer.invoke('dialog:openFile', options),
  selectFiles:   (options) => ipcRenderer.invoke('dialog:openFiles', options),
  selectDirectory: ()      => ipcRenderer.invoke('dialog:openDirectory'),
  showInFolder:  (filePath) => ipcRenderer.invoke('shell:showItemInFolder', filePath),

  processVideos:   (tasks)               => ipcRenderer.invoke('videos:process', tasks),
  stopProcessing:  ()                    => ipcRenderer.invoke('videos:stop'),
  generatePreview: (videoPath, text, params) =>
    ipcRenderer.invoke('videos:preview', { videoPath, text, params }),
  listFonts: () => ipcRenderer.invoke('fonts:list'),
  importHookTexts: () => ipcRenderer.invoke('hooks:importTexts'),

  listPresets:   ()             => ipcRenderer.invoke('presets:list'),
  savePreset:    (name, params) => ipcRenderer.invoke('presets:save', { name, params }),
  deletePreset:  (name)         => ipcRenderer.invoke('presets:delete', name),

  onProgress: (callback) => {
    ipcRenderer.on('videos:progress', (event, data) => callback(data));
  },
  removeProgressListener: () => {
    ipcRenderer.removeAllListeners('videos:progress');
  },
});
