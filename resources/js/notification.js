// resources/js/notification.js
async function showNotification(message, color = 'green') {
    try {
        const response = await fetch('./resources/html/notification.html');
        const notificationHTML = await response.text();
        
        // Check if the notification already exists and remove it
        const existingBanner = document.getElementById('notification-banner');
        if (existingBanner) {
            existingBanner.remove();
        }

        // Add the notification HTML to the body
        document.body.insertAdjacentHTML('beforeend', notificationHTML);

        const notificationBanner = document.getElementById('notification-banner');
        const notificationText = document.getElementById('notification-text');
        const closeButton = document.getElementById('notification-close');

        // Set the notification text and color
        notificationText.textContent = message;
        notificationBanner.style.backgroundColor = color;

        // Apply additional styles to ensure it displays correctly
        notificationBanner.style.display = 'flex';
        notificationBanner.style.padding = '10px';
        notificationBanner.style.color = 'white';
        notificationBanner.style.textAlign = 'center';
        notificationBanner.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';

        // Close button event listener
        closeButton.addEventListener('click', () => {
            notificationBanner.style.display = 'none';
        });

        // Auto-hide the banner after a set period (e.g., 5 seconds)
        setTimeout(() => {
            notificationBanner.style.display = 'none';
        }, 3500);
    } catch (error) {
        console.error('Error loading notification:', error);
    }
}