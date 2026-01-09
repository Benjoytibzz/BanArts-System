// Settings page JavaScript

function getUserProfileImageKey() {
    const userId = localStorage.getItem('userId');
    const userEmail = localStorage.getItem('userEmail');
    return `userProfileImage_${userId || userEmail || 'default'}`;
}

async function checkAuthProviderStatus(email) {
    if (!email) return;

    try {
        const response = await fetch(`/user-auth-status/${encodeURIComponent(email)}`);
        const data = await response.json();

        if (data.success && data.hasOAuthProvider) {
            const changePasswordSection = document.getElementById('change-password-section');
            if (changePasswordSection) {
                changePasswordSection.style.display = 'none';
                console.log('Hiding Change Password section for OAuth user');
            }
        }
    } catch (error) {
        console.error('Error checking auth provider status:', error);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const settingsForm = document.getElementById('settings-form');
    const settingsName = document.getElementById('settings-name');
    const settingsLocation = document.getElementById('settings-location');
    const dropdownProfileName = document.querySelector('.dropdown-profile-name');
    const navProfileAvatar = document.getElementById('nav-profile-avatar');
    const dropdownProfileIcon = document.getElementById('dropdown-profile-icon');

    // Check if user is logged in
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    
    // Load current values from localStorage
    const savedName = localStorage.getItem('userName') || 'John Doe';
    const savedLocation = localStorage.getItem('userLocation') || 'Philippines';
    const savedInitials = localStorage.getItem('userInitials') || 'JD';
    const savedProfileImage = localStorage.getItem(getUserProfileImageKey());
    const userEmail = localStorage.getItem('userEmail') || localStorage.getItem('registeredEmail');
    
    console.log('Settings page - User logged in:', isLoggedIn);
    console.log('Settings page - User email:', userEmail);

    checkAuthProviderStatus(userEmail);
    
    // Test server button
    const testServerBtn = document.getElementById('test-server-btn');
    const testResultDiv = document.getElementById('test-result');
    if (testServerBtn) {
        testServerBtn.addEventListener('click', async function() {
            testResultDiv.style.display = 'block';
            testResultDiv.textContent = 'Testing server connection...';
            testResultDiv.style.backgroundColor = '#d1ecf1';
            testResultDiv.style.color = '#0c5460';
            
            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: 'test@test.com', password: 'test' })
                });
                
                const data = await response.json();
                console.log('Test response:', data);
                
                if (response.status) {
                    testResultDiv.textContent = '✓ Server is responding correctly! (Status: ' + response.status + ')';
                    testResultDiv.style.backgroundColor = '#d4edda';
                    testResultDiv.style.color = '#155724';
                } else {
                    testResultDiv.textContent = '✗ Server is not responding properly';
                    testResultDiv.style.backgroundColor = '#f8d7da';
                    testResultDiv.style.color = '#721c24';
                }
            } catch (error) {
                testResultDiv.textContent = '✗ Server connection failed: ' + error.message;
                testResultDiv.style.backgroundColor = '#f8d7da';
                testResultDiv.style.color = '#721c24';
                console.error('Server test error:', error);
            }
        });
    }
    
    // Display login status
    const loginStatusDiv = document.getElementById('login-status');
    if (loginStatusDiv) {
        if (isLoggedIn && userEmail) {
            loginStatusDiv.innerHTML = `<strong>Logged in as:</strong> ${userEmail}`;
            loginStatusDiv.style.backgroundColor = '#d4edda';
            loginStatusDiv.style.color = '#155724';
        } else {
            loginStatusDiv.innerHTML = '<strong>⚠️ Not logged in!</strong> Please log in first to change your password.';
            loginStatusDiv.style.backgroundColor = '#f8d7da';
            loginStatusDiv.style.color = '#721c24';
        }
    }

    settingsName.value = savedName;
    settingsLocation.value = savedLocation;
    if (dropdownProfileName) dropdownProfileName.textContent = savedName;
    updateProfileIcons(savedProfileImage, savedInitials);

    function updateProfileIcons(imageSrc, initials) {
        if (imageSrc) {
            // Show image
            if (navProfileAvatar) navProfileAvatar.innerHTML = `<img src="${imageSrc}" alt="Profile" class="nav-profile-icon">`;
        } else {
            // Show initials
            if (navProfileAvatar) navProfileAvatar.innerHTML = initials;
        }
        // Update dropdown icon
        if (dropdownProfileIcon) dropdownProfileIcon.src = imageSrc || 'img/profile icon.webp';
    }

    settingsForm.addEventListener('submit', function(e) {
        e.preventDefault();
        localStorage.setItem('userName', settingsName.value);
        localStorage.setItem('userLocation', settingsLocation.value);
        const initials = settingsName.value.split(' ').map(n => n[0]).join('').toUpperCase();
        localStorage.setItem('userInitials', initials);
        alert('Profile updated successfully!');
        window.location.href = 'profile.html';
    });

    const changePasswordForm = document.getElementById('change-password-form');
    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const passwordMessage = document.getElementById('password-message');

    changePasswordForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const changePasswordBtn = document.getElementById('change-password-btn');
        
        if (changePasswordBtn.disabled) {
            showPasswordMessage('Password changes are not allowed for accounts using third-party authentication.', 'error');
            return;
        }

        const currentPassword = currentPasswordInput.value.trim();
        const newPassword = newPasswordInput.value.trim();
        const confirmPassword = confirmPasswordInput.value.trim();

        if (!currentPassword || !newPassword || !confirmPassword) {
            showPasswordMessage('All fields are required', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showPasswordMessage('New passwords do not match', 'error');
            return;
        }

        if (newPassword.length < 4) {
            showPasswordMessage('New password must be at least 4 characters long', 'error');
            return;
        }

        if (newPassword === currentPassword) {
            showPasswordMessage('New password must be different from current password', 'error');
            return;
        }

        let userEmail = localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail');
        
        if (!userEmail) {
            userEmail = localStorage.getItem('registeredEmail');
        }

        if (!userEmail) {
            showPasswordMessage('Please log in first to change your password', 'error');
            return;
        }

        try {
            console.log('Attempting password change for email:', userEmail);
            showPasswordMessage('Processing...', 'info');

            const response = await fetch('/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: userEmail,
                    currentPassword: currentPassword,
                    newPassword: newPassword
                })
            });

            console.log('Response status:', response.status);
            
            const data = await response.json();
            console.log('Response data:', data);

            if (data.success) {
                showPasswordMessage('Password changed successfully! Redirecting to profile...', 'success');
                setTimeout(() => {
                    currentPasswordInput.value = '';
                    newPasswordInput.value = '';
                    confirmPasswordInput.value = '';
                    window.location.href = 'profile.html';
                }, 2000);
            } else {
                const errorMsg = data.message || 'Failed to change password';
                console.error('Password change failed:', errorMsg);
                showPasswordMessage(errorMsg, 'error');
            }
        } catch (error) {
            console.error('Fetch or parse error:', error);
            let errorMsg = error.message;
            if (errorMsg.includes('<!DOCTYPE')) {
                errorMsg = 'Server returned HTML instead of JSON. The server may need to be restarted.';
            }
            showPasswordMessage('Error: ' + errorMsg, 'error');
        }
    });

    function showPasswordMessage(message, type) {
        passwordMessage.textContent = message;
        passwordMessage.className = `password-message ${type}`;
        passwordMessage.style.display = 'block';
        setTimeout(() => {
            if (type === 'success') {
                passwordMessage.style.display = 'none';
            }
        }, 5000);
    }
});