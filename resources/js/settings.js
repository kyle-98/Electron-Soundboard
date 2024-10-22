document.addEventListener('DOMContentLoaded', async () => {
    const folderButton = document.getElementById('select-folder-button');
    const saveButton = document.getElementById('save-settings-button');
    const folderPathDisplay = document.getElementById('folder-path-display');

    // Load the existing config
    const config = await window.electron.config.get();
    folderPathDisplay.innerText = config.mp3Folder || 'No folder selected';

    // Handle folder selection
    folderButton.addEventListener('click', async () => {
        const result = await window.electron.dialog.openFolder();
        if (!result.canceled && result.filePaths.length > 0) {
            const folderPath = result.filePaths[0];
            folderPathDisplay.innerText = folderPath;
            await window.electron.config.set('mp3Folder', folderPath);
        }
    });

    saveButton.addEventListener('click', async () => {
        alert('Settings saved!');
    });
});
