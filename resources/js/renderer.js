// resources/js/renderer.js
let selectedMp3Path = '';
let publicSound;
let localSound;
let updateInterval;
let localVolume;
let publicVolume;
let localVolumeSlider;
let outputVolumeSlider;

var config;
var selectedTheme;

const progressBar = document.getElementById('progress-bar');
const audioElement = new Audio();

//create a new sound based on the passed filepath and start playing it
async function playSound(filepath){
    if(localSound) {
        stopSound();
    }

    //handle public facing sound
    const devices = await navigator.mediaDevices.enumerateDevices();
    audioElement.src = filepath;
    await audioElement.setSinkId(config.publicOutputDeviceId);
    const publicAudioContext = new (window.AudioContext || window.webkitAudioContext)();

    //update currently set volumes
    localVolume = parseFloat(localVolumeSlider.value);
    publicVolume = parseFloat(outputVolumeSlider.value);

    publicSound = new Howl({
        src: [filepath],
        volume: publicVolume,
        onplay: () => {
            // Create a MediaElementAudioSourceNode for the public sound
            const sourceNode = publicAudioContext.createMediaElementSource(audioElement);

            // Connect the source node to Voicemeeter's Stereo Input 2
            sourceNode.connect(publicAudioContext.destination);
        }
    });

    audioElement.play().catch((error) => {
        console.error('Error playing public audio:', error); //TODO: log this to an in app notification later
    });


    //handle local audio sound
    localSound = new Howl({
        src: [filepath],
        volume: localVolume,
        onplay: () => {
            startProgressBarUpdate();
            console.log(`Playing: ${filepath}`);
        },
        onend: () => {
            stopProgressBarUpdate();
            resetProgressBar();
        },
        onstop: () => {
            console.log(`Stopping: ${filepath}`);
        }
    });
    localSound.play();
}

//stop playing the current sound if one is playing
async function stopSound(){ 
    localSound.stop();
    audioElement.pause();
    stopProgressBarUpdate();
    resetProgressBar();
}

//stop the progressbar from updating
function stopProgressBarUpdate() {
    clearInterval(updateInterval);
}

//reset the progress bar
function resetProgressBar() {
    progressBar.value = 0;
}

function startProgressBarUpdate() {
    updateInterval = setInterval(() => {
        if(localSound && localSound.playing()){
            const seek = localSound.seek();
            const duration = localSound.duration();
            const progress = (seek / duration) * 100;
            progressBar.value = progress;
        }
    }, 100);
}


//handle events that need to happen ONLY after the DOM content loads
document.addEventListener('DOMContentLoaded', async () => {
    const settingsButton = document.getElementById('settings-button');
    const modalBody = document.getElementById('settings-modal-body');
    const settingsModal = document.getElementById('settings-modal'); 
    const modalContent = document.getElementById('modal-content');
    localVolumeSlider = document.getElementById('local-volume-slider');
    outputVolumeSlider = document.getElementById('output-volume-slider');
    
    //fetch audio levels
    localVolume = parseFloat(localVolumeSlider.value);
    publicVolume = parseFloat(outputVolumeSlider.value);

    try {
        const response = await fetch(await window.erm.config.location());
        config = await response.json();
    } catch (error) {
        console.error('Error loading config:', error);
        config = {};
    }
    selectedTheme = config.applicationTheme;
    document.documentElement.setAttribute('app-theme', selectedTheme);


    // SETTINGS BUTTON EVENTS
    settingsButton.addEventListener('click', async () => {
        try {
            const response = await fetch('./resources/html/settings.html');
            const settingsHTML = await response.text();
            modalBody.innerHTML = settingsHTML;
            settingsModal.style.display = 'block';

            // Set the folder input to the current setting if available
            const selectedFolderPathDisplay = modalBody.querySelector('#selected-folder-path');
            if (selectedFolderPathDisplay) {
                selectedFolderPathDisplay.textContent = config.mp3Folder || 'No folder selected'; // Display saved folder or default text
            }

            // Event listener for the folder selection button
            const selectFolderButton = modalBody.querySelector('#select-folder-button');
            if (selectFolderButton) {
                selectFolderButton.addEventListener('click', async () => {
                    const folderPath = await window.erm.selectFolder();
                    if (folderPath) {
                        selectedFolderPathDisplay.textContent = folderPath; // Update the display
                    }
                });
            }

            const audioDeviceDropdown = document.getElementById("audio-device-dropdown");
            const loadAudioDevices = async () => {
                try {
                    const devices = await navigator.mediaDevices.enumerateDevices();
                
                    // Filter and add audio input devices to the dropdown
                    devices
                    .filter(device => device.kind === "audiooutput")
                    .forEach(device => {
                        const option = document.createElement("option");
                        option.value = device.deviceId;
                        option.textContent = device.label;
                        audioDeviceDropdown.appendChild(option);
                    });
                } catch (error) {
                    console.error("Failed to load audio devices:", error);
                    showNotification(`Failed to load audio devices: ${error}`, '#cf5151');
                }
            };

            await loadAudioDevices();

            const setSelectedDevice = async () => {
                const cConfig = await window.erm.config.get();
                const savedDeviceId = cConfig.publicOutputDeviceId;
                
                if (savedDeviceId) {
                    audioDeviceDropdown.value = savedDeviceId;
                }
            };

            await setSelectedDevice();

            //select application theme
            const appThemeDropdown = modalBody.querySelector('#app-theme-dropdown');
            if(appThemeDropdown){
                appThemeDropdown.addEventListener('change', (event) => {
                    selectedTheme = event.target.value;
                    document.documentElement.setAttribute('app-theme', selectedTheme);
                });
            }

            //set current application theme from config
            appThemeDropdown.value = config.applicationTheme;


            // Add event listener for the save settings button
            const saveButton = modalBody.querySelector('#save-settings-button');
            if (saveButton) {
                saveButton.addEventListener('click', async () => {
                    const mp3Folder = selectedFolderPathDisplay.textContent;
                    // Save settings to config.json
                    await window.erm.config.set('mp3Folder', mp3Folder)
                    await window.erm.config.set('publicOutputDeviceId', audioDeviceDropdown.value)
                    await window.erm.config.set('applicationTheme', selectedTheme);
                    config = await window.erm.config.get();
                    showNotification('Settings saved successfully', '#40b35e');
                });
            }

            const closeButton = modalContent.querySelector('#close-settings');
            if (closeButton) {
                closeButton.addEventListener('click', () => {
                    let configTheme = config.applicationTheme;
                    if (configTheme != selectedTheme){
                        selectedTheme = configTheme;
                        document.documentElement.setAttribute('app-theme', selectedTheme);
                        showNotification('Theme settings not saved', '#cf5151')
                    }
                    settingsModal.style.display = 'none';
                });
            }

        } catch (error) {
            console.error('Error loading settings:', error);
        }
    });

    //FAVORITE A SOUND
    const favButton = document.getElementById('fav-button');
    const favSoundDisplay = document.getElementById('fav-sound');
    favButton.addEventListener('click', async () => {
        const selectedMP3Name = mp3ListDisplay.querySelector('li.selected');
        if(selectedMP3Name){
            const mp3FileName = selectedMP3Name.textContent;
            const fullPath = `${config.mp3Folder}\\${mp3FileName}`;
            favSoundDisplay.textContent = mp3FileName;
            window.erm.config.set('favoriteSound', fullPath);
            config = await window.erm.config.get();
        } else {
            showNotification('No sound selected to favorite', '#cf5151');
        }
    });

    //set display of favorite text
    favSoundDisplay.textContent = config.favoriteSound.split('\\').at(-1) || 'Select a favorite sound';

    //play favorite sound when global keybinds are pressed
    window.erm.playFavSound(() => {
        if(config.favoriteSound != ''){
            playSound(config.favoriteSound);
        }
    });

    // DISPLAY MP3 FILES EVENTS
    const mp3ListDisplay = document.getElementById('mp3-list'); 
    // Function to fetch and display MP3 files
    async function loadMP3Files(folderPath) {
        const mp3Files = await window.erm.getMP3Files(folderPath);
        if (mp3Files && mp3Files.length > 0) {
            mp3ListDisplay.innerHTML = mp3Files.map(file => `<li>${file}</li>`).join(''); // Populate the list with MP3 files
            mp3ListDisplay.addEventListener('click', (event) => {
                if (event.target.tagName === 'LI') {
                    // Remove 'selected' class from all items
                    const items = mp3ListDisplay.querySelectorAll('li');
                    items.forEach(item => item.classList.remove('selected'));

                    // Add 'selected' class to the clicked item
                    event.target.classList.add('selected');
                }
            });
        } else {
            mp3ListDisplay.innerHTML = 'Edit folder path in settings'; // Handle case where no MP3 files are found
        }
    }

    await loadMP3Files(config.mp3Folder);

    //PLAY MP3 FILE
    const playButton = document.getElementById('play-button');
    if (playButton) {
        playButton.addEventListener('click', () => {
            const selectedMP3Name = mp3ListDisplay.querySelector('li.selected');
            if (selectedMP3Name) {
                // Get the file name from the selected list item
                const mp3FileName = selectedMP3Name.textContent;
                
                // Concatenate the folder path with the selected MP3 file name
                const fullPath = `${config.mp3Folder}\\${mp3FileName}`;
                playSound(fullPath);
            } else {
                console.log('No MP3 file selected.');
            }
        });
    }

    //STOP SOUND
    const stopButton = document.getElementById('stop-button');
    if(stopButton){
        stopButton.addEventListener('click', () => {
            stopSound();
        });
    }

    //ADJUST LOCAL VOLUME
    localVolumeSlider.addEventListener('input', (event) => {
        const volumeValue = event.target.value;
        const volumePercent = document.getElementById('local-volume-slider-percent');
        if(localSound) {
            localSound.volume(volumeValue);
        }
        volumePercent.textContent = String(Math.round(volumeValue * 100)) + '%';
        
        //set percentage label

    });

    //ADJUST PUBLIC VOLUME
    outputVolumeSlider.addEventListener('input', (event) => {
        const volumeValue = event.target.value;
        const volumePercent = document.getElementById('output-volume-slider-percent');
        if(audioElement) {
            audioElement.volume = volumeValue;
        }
        volumePercent.textContent = String(Math.round(volumeValue * 100)) + '%';
    });

    //ALLOW SEEKING
    progressBar.addEventListener('click', (event) => {
        const progressWidth = progressBar.offsetWidth;
        const clickX = event.offsetX;

        //handle public audio
        var duration = audioElement.currentTime;
        var newTime = (clickX / progressWidth) * duration;
        audioElement.currentTime = newTime;

        //handle local audio
        duration = localSound.duration();
        newTime = (clickX / progressWidth) * duration;
        localSound.seek(newTime);
    });

    //SEARCH SOUNDS
    const searchBar = document.getElementById('search-sounds');
    if(searchBar){
        searchBar.addEventListener('input', () => {
            const filter = searchBar.value.toLowerCase();
            const mp3ListItems = document.querySelectorAll('#mp3-list li');
            let hasItems = false;
            mp3ListItems.forEach(function(item) {
                const text = item.textContent.toLowerCase();
                if(text.includes(filter)){
                    item.style.display = '';
                    hasItems = true;
                } else {
                    item.style.display = 'none';
                }
            });
            if(!hasItems){
                showNotification('No sounds found.', '#cf5151');
            }
        });
    }


});
