const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const showNotification = require('./resources/js/notification').default

let mainWindow;
const configPath = path.join(__dirname, 'config.json');

// Function to load the configuration
function loadConfig() {
    if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath);
        return JSON.parse(data);
    }
    return { mp3Folder: '', publicOutputDeviceLabel: '' }; // Default config
}

// Function to save the configuration
function saveConfig(config) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
}

// Create the main window
async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'resources', 'js', 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: true,
        }
    });

    mainWindow.loadFile('index.html');

    // await voicemeeter.init().then(() => {
    //     voicemeeter.login();
    //     console.log('Successfully logged into voicemeeter api');
    // }).catch((error) => {
    //     console.log(`Failed to initalize voicemeeter api call: ${error}`);
    // });
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
        const mp3Files = files.filter(file => path.extname(file).toLowerCase() === '.mp3');
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
});


app.whenReady().then(() => { 
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
