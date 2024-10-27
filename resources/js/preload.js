const { contextBridge, ipcRenderer } = require('electron');

// Expose methods to the renderer process
contextBridge.exposeInMainWorld('erm', {
    config: {
        get: async () => await ipcRenderer.invoke('config:get'),
        set: async (key, value) => await ipcRenderer.invoke('config:set', key, value),
        location: async () => await ipcRenderer.invoke('config:location')
    },
    dialog: {
        openFolder: async () => {
            return await ipcRenderer.invoke('dialog:openFolder');
        }
    },
    selectFolder: () => ipcRenderer.invoke('dialog:openFolder'),
    saveSettings: (settings) => ipcRenderer.invoke('config:set', settings.key, settings.value),
    getMP3Files: (directoryPath) => ipcRenderer.invoke('mp3:getFiles', directoryPath),
    playFavSound: (callback) => ipcRenderer.on('play-fav-sound', callback)
});
