const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const showNotification = require('./resources/js/notification').default

let mainWindow;
const isDev = process.env.NODE_ENV === 'development';

const configPath = isDev 
    ? path.join(__dirname, 'config.json') 
    : path.join(__dirname, '..', 'config.json');

// Function to load the configuration
function loadConfig() {
    if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath);
        return JSON.parse(data);
    }
    return { mp3Folder: '', publicOutputDeviceLabel: '', favoriteSound: '', applicationTheme: 'light'}; // Default config
}

// Function to save the configuration
function saveConfig(config) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
}

// Create the main window
async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 855,
        height: 650,
        webPreferences: {
            preload: path.join(__dirname, 'resources', 'js', 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: true,
        },
        autoHideMenuBar: true,
        icon: path.join(__dirname, 'resources', 'images', 'soundboard.ico'),
    });

    mainWindow.loadFile('index.html');

    globalShortcut.register('Control+F12', () => {
        mainWindow.webContents.send('play-fav-sound');
    });
}

// IPC handler for folder dialog
ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    return result.filePaths[0];
});

// IPC handler for getting mp3 files
ipcMain.handle('mp3:getFiles', async (event, directoryPath) => {
    try {
        const files = fs.readdirSync(directoryPath);
        const mp3Files = files.filter(file => path.extname(file).toLowerCase() === '.mp3' ||  path.extname(file).toLowerCase() === '.wav');
        return mp3Files;
    } catch (error) {
        console.error('Error reading directory:', error);
        return []; // Return an empty array if there's an error
    }
});

// IPC handler for getting the config
ipcMain.handle('config:get', () => {
    return loadConfig();
});

// IPC handler for saving the config
ipcMain.handle('config:set', (event, key, value) => {
    const config = loadConfig();
    config[key] = value;
    saveConfig(config);
    mainWindow.webContents.reload();
});

ipcMain.handle('config:location', () => {
    return configPath;
});

app.whenReady().then(() => { 
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
