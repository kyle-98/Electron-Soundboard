// resources/js/renderer.js
let selectedMp3Path = '';
let publicSound;
let localSound;
let updateInterval;
let localVolume;
let publicVolume;
const progressBar = document.getElementById('progress-bar');
const audioElement = new Audio();
let localVolumeSlider;
let outputVolumeSlider;

// Load settings from config.json on initialization
let config;

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
        const response = await fetch('./config.json');
        config = await response.json();
    } catch (error) {
        console.error('Error loading config:', error);
        config = {};
    }

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
                        console.log(device.deviceId, device.label);
                        option.value = device.deviceId;
                        option.textContent = device.label;
                        audioDeviceDropdown.appendChild(option);
                    });
                } catch (error) {
                    console.error("Failed to load audio devices:", error);
                }
            };

            await loadAudioDevices();

            const setSelectedDevice = async () => {
                const config = await window.erm.config.get();
                const savedDeviceId = config.publicOutputDeviceId;
                
                if (savedDeviceId) {
                    audioDeviceDropdown.value = savedDeviceId;
                }
            };

            await setSelectedDevice();

            // Add event listener for the save settings button
            const saveButton = modalBody.querySelector('#save-settings-button');
            if (saveButton) {
                saveButton.addEventListener('click', async () => {
                    const mp3Folder = selectedFolderPathDisplay.textContent;

                    // Save settings to config.json
                    await window.erm.saveSettings({ key: 'mp3Folder', value: mp3Folder });
                    await window.erm.config.set('publicOutputDeviceId', audioDeviceDropdown.value)
                    
                    showNotification('Settings saved successfully', '#40b35e');
                });
            }

            const closeButton = modalContent.querySelector('#close-settings');
            if (closeButton) {
                closeButton.addEventListener('click', () => {
                    settingsModal.style.display = 'none';
                });
            }

        } catch (error) {
            console.error('Error loading settings:', error);
        }
    });


    // DISPLAY MP3 FILES EVENTS
    const mp3ListContainer = document.getElementById('mp3-list');
    const mp3ListDisplay = document.getElementById('mp3-list'); // Ensure you have an element with this ID to display the list
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
        if(localSound) {
            localSound.volume(volumeValue);
        }
    });

    //ADJUST PUBLIC VOLUME
    outputVolumeSlider.addEventListener('input', (event) => {
        const volumeValue = event.target.value;
        if(audioElement) {
            audioElement.volume = volumeValue;
        }
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
});
