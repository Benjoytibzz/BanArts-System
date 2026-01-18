// Settings page JavaScript

function getUserProfileImageKey() {
    const userId = localStorage.getItem('userId');
    const userEmail = localStorage.getItem('userEmail');
    return `userProfileImage_${userId || userEmail || 'default'}`;
}

function validatePassword(password) {
    const minLength = 8;
    const maxLength = 32;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength || password.length > maxLength) {
        return { valid: false, message: `Password must be between ${minLength} and ${maxLength} characters long.` };
    }
    if (!hasUppercase) {
        return { valid: false, message: 'Password must contain at least one uppercase letter.' };
    }
    if (!hasLowercase) {
        return { valid: false, message: 'Password must contain at least one lowercase letter.' };
    }
    if (!hasNumbers) {
        return { valid: false, message: 'Password must contain at least one number.' };
    }
    if (!hasSpecialChar) {
        return { valid: false, message: 'Password must contain at least one special character (!@#$%^&*(),.?":{}|<>).' };
    }
    return { valid: true };
}

async function checkAuthProviderStatus(email) {
    if (!email) return;

    try {
        const response = await fetch(`/user-auth-status/${encodeURIComponent(email)}`);
        const data = await response.json();

        if (data.success) {
            if (data.hasOAuthProvider) {
                const changePasswordSection = document.getElementById('change-password-section');
                if (changePasswordSection) {
                    changePasswordSection.style.display = 'none';
                    console.log('Hiding Change Password section for OAuth user');
                }
            } else {
                // If not OAuth, fetch security question
                fetchSecurityQuestion(email);
            }
        }
    } catch (error) {
        console.error('Error checking auth provider status:', error);
    }
}

async function fetchSecurityQuestion(email) {
    try {
        const response = await fetch('/auth/forgot-password/get-question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await response.json();
        
        if (response.ok && data.security_question) {
            // Populate Change Password security question
            const pwContainer = document.getElementById('security-question-container');
            const pwDisplay = document.getElementById('display-security-question');
            if (pwContainer && pwDisplay) {
                pwDisplay.textContent = data.security_question;
                pwContainer.style.display = 'block';
                document.getElementById('security-answer').required = true;
            }

            // Populate Edit Profile security question
            const profileContainer = document.getElementById('profile-security-question-container');
            const profileDisplay = document.getElementById('profile-display-security-question');
            if (profileContainer && profileDisplay) {
                profileDisplay.textContent = data.security_question;
                profileContainer.style.display = 'block';
                document.getElementById('profile-security-answer').required = true;
            }

            // Populate Delete Account security question
            const deleteDisplay = document.getElementById('delete-display-security-question');
            if (deleteDisplay) {
                deleteDisplay.textContent = data.security_question;
            }
        }
    } catch (error) {
        console.error('Error fetching security question:', error);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const settingsForm = document.getElementById('settings-form');
    const settingsName = document.getElementById('settings-name');
    const settingsLocation = document.getElementById('settings-location');
    const settingsBio = document.getElementById('settings-bio');
    const dropdownProfileName = document.querySelector('.dropdown-profile-name');
    const navProfileAvatar = document.getElementById('nav-profile-avatar');
    const dropdownProfileIcon = document.getElementById('dropdown-profile-icon');

    // Check if user is logged in
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    
    // Load current values from localStorage
    const savedName = localStorage.getItem('userName') || 'John Doe';
    const savedLocation = localStorage.getItem('userLocation') || 'Philippines';
    const savedBio = localStorage.getItem('userBio') || '';
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
    if (settingsBio) settingsBio.value = savedBio;
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

    settingsForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const name = settingsName.value.trim();
        const location = settingsLocation.value.trim();
        const bio = settingsBio ? settingsBio.value.trim() : '';
        const securityAnswer = document.getElementById('profile-security-answer').value.trim();
        const settingsMessage = document.getElementById('settings-message');

        const securityContainer = document.getElementById('profile-security-question-container');
        if (securityContainer && securityContainer.style.display !== 'none' && !securityAnswer) {
            showSettingsMessage('Please provide the answer to your security question', 'error');
            return;
        }

        const userId = localStorage.getItem('userId');
        const userEmail = localStorage.getItem('userEmail');

        if (!userId) {
            showSettingsMessage('Please log in first to update your profile', 'error');
            return;
        }

        try {
            showSettingsMessage('Updating profile...', 'info');

            // Split name into first and last
            const nameParts = name.split(' ');
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ');

            const response = await fetch(`/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    first_name: firstName,
                    last_name: lastName,
                    location: location,
                    bio: bio,
                    security_answer: securityAnswer,
                    email: userEmail // Also send email for identification if needed
                })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('userName', name);
                localStorage.setItem('userLocation', location);
                localStorage.setItem('userBio', bio);
                const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
                localStorage.setItem('userInitials', initials);
                
                showSettingsMessage('Profile updated successfully! Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = 'profile.html';
                }, 2000);
            } else {
                showSettingsMessage(data.message || 'Failed to update profile', 'error');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            showSettingsMessage('Error: ' + error.message, 'error');
        }
    });

    function showSettingsMessage(message, type) {
        const settingsMessage = document.getElementById('settings-message');
        if (!settingsMessage) return;
        settingsMessage.textContent = message;
        settingsMessage.className = `password-message ${type}`;
        settingsMessage.style.display = 'block';
        setTimeout(() => {
            if (type === 'success') {
                settingsMessage.style.display = 'none';
            }
        }, 5000);
    }

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
        const securityAnswer = document.getElementById('security-answer').value.trim();

        if (!currentPassword || !newPassword || !confirmPassword) {
            showPasswordMessage('All fields are required', 'error');
            return;
        }

        const securityContainer = document.getElementById('security-question-container');
        if (securityContainer && securityContainer.style.display !== 'none' && !securityAnswer) {
            showPasswordMessage('Please provide the answer to your security question', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showPasswordMessage('New passwords do not match', 'error');
            return;
        }

        const passwordCheck = validatePassword(newPassword);
        if (!passwordCheck.valid) {
            showPasswordMessage(passwordCheck.message, 'error');
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
                    newPassword: newPassword,
                    security_answer: securityAnswer
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

    // Delete Account Logic
    const showDeleteBtn = document.getElementById('show-delete-confirm-btn');
    const deleteConfirmContainer = document.getElementById('delete-confirm-container');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const deleteSecurityAnswer = document.getElementById('delete-security-answer');

    if (showDeleteBtn) {
        showDeleteBtn.addEventListener('click', () => {
            deleteConfirmContainer.style.display = 'block';
            showDeleteBtn.style.display = 'none';
        });
    }

    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', () => {
            deleteConfirmContainer.style.display = 'none';
            showDeleteBtn.style.display = 'block';
            deleteSecurityAnswer.value = '';
        });
    }

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            const answer = deleteSecurityAnswer.value.trim();
            const userId = localStorage.getItem('userId');
            
            if (!answer) {
                alert('Please provide your security answer to confirm account deletion.');
                return;
            }

            if (!confirm('FINAL CONFIRMATION: Are you sure you want to permanently delete your account? This cannot be undone.')) {
                return;
            }

            try {
                const response = await fetch(`/users/${userId}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ security_answer: answer })
                });

                const data = await response.json();

                if (response.ok) {
                    alert('Your account has been successfully deleted.');
                    localStorage.clear();
                    window.location.href = '/';
                } else {
                    alert(data.message || 'Failed to delete account.');
                }
            } catch (error) {
                console.error('Error deleting account:', error);
                alert('An error occurred while deleting your account.');
            }
        });
    }
});