// Profile page JavaScript

function getUserUploadsKey() {
    const userId = localStorage.getItem('userId');
    const userEmail = localStorage.getItem('userEmail');
    return `userUploads_${userId || userEmail || 'default'}`;
}

function getUserProfileImageKey() {
    const userId = localStorage.getItem('userId');
    const userEmail = localStorage.getItem('userEmail');
    return `userProfileImage_${userId || userEmail || 'default'}`;
}

document.addEventListener('DOMContentLoaded', function() {
    const savedBtn = document.getElementById('saved-btn');
    const followedBtn = document.getElementById('followed-btn');
    const uploadsBtn = document.getElementById('uploads-btn');
    const savedContent = document.getElementById('saved-content');
    const followedContent = document.getElementById('followed-content');
    const uploadsContent = document.getElementById('uploads-content');

    // Initially hide all content sections except saved
    savedContent.style.display = 'block';
    followedContent.style.display = 'none';
    uploadsContent.style.display = 'none';

    // Set saved as active
    savedBtn.classList.add('active');

    // Load saved artworks
    loadSavedArtworks();

    // Load followed artists
    loadFollowedArtists();

    // Handle URL hash for direct navigation
    if (window.location.hash === '#saved') {
        showContent(savedContent, savedBtn);
    } else if (window.location.hash === '#followed') {
        showContent(followedContent, followedBtn);
    }

    // Function to show content
    function showContent(contentToShow, activeBtn) {
        savedContent.style.display = 'none';
        followedContent.style.display = 'none';
        uploadsContent.style.display = 'none';
        contentToShow.style.display = 'block';

        // Remove active class from all buttons
        savedBtn.classList.remove('active');
        followedBtn.classList.remove('active');
        uploadsBtn.classList.remove('active');

        // Add active class to clicked button
        activeBtn.classList.add('active');
    }

    // Event listeners
    savedBtn.addEventListener('click', function() {
        showContent(savedContent, savedBtn);
    });

    followedBtn.addEventListener('click', function() {
        showContent(followedContent, followedBtn);
    });

    uploadsBtn.addEventListener('click', function() {
        showContent(uploadsContent, uploadsBtn);
    });

    // Artworks link in dropdown
    const artworksLink = document.querySelector('a[href*="#uploads"]');
    if (artworksLink) {
        artworksLink.addEventListener('click', function(e) {
            e.preventDefault();
            showContent(uploadsContent, uploadsBtn);
            const profileDropdown = document.querySelector('.profile-dropdown');
            if (profileDropdown) profileDropdown.style.display = 'none';
        });
    }

    // Dropdown menu links (for profile dropdown created by script.js)
    function attachDropdownLinks() {
        const savesLink = document.querySelector('a[href*="#saved"]');
        const followsLink = document.querySelector('a[href*="#followed"]');
        const profileDropdown = document.querySelector('.profile-dropdown');
        
        if (savesLink) {
            savesLink.addEventListener('click', function(e) {
                e.preventDefault();
                showContent(savedContent, savedBtn);
                if (profileDropdown) profileDropdown.style.display = 'none';
            });
        }

        if (followsLink) {
            followsLink.addEventListener('click', function(e) {
                e.preventDefault();
                showContent(followedContent, followedBtn);
                if (profileDropdown) profileDropdown.style.display = 'none';
            });
        }
    }

    setTimeout(() => attachDropdownLinks(), 100);

    // Profile image change
    const profileImageContainer = document.querySelector('.profile-image-container');
    const profileImageInput = document.getElementById('profile-image-input');
    const profileImage = document.getElementById('profile-image');
    const navProfileIcon = document.getElementById('nav-profile-icon');
    const dropdownProfileIcon = document.getElementById('dropdown-profile-icon');

    if (profileImageContainer && profileImageInput && profileImage) {
        profileImageContainer.addEventListener('click', function() {
            profileImageInput.click();
        });

        profileImageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const userId = localStorage.getItem('userId');
                if (!userId) {
                    alert('Please log in to change your profile picture.');
                    return;
                }

                const formData = new FormData();
                formData.append('profile_picture', file);
                formData.append('user_id', userId);

                fetch('/upload-profile-picture', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        const profilePictureUrl = data.profile_picture;
                        profileImage.src = profilePictureUrl;
                        localStorage.setItem(getUserProfileImageKey(), profilePictureUrl);
                        updateProfileIcons(profilePictureUrl, savedInitials);
                        alert('Profile picture updated successfully!');
                    } else {
                        alert('Failed to update profile picture: ' + data.message);
                    }
                })
                .catch(err => {
                    console.error('Error uploading profile picture:', err);
                    alert('Error uploading profile picture. Please try again.');
                });
            }
        });
    }

    // Upload functionality
    const uploadBtn = document.getElementById('upload-new-btn');
    const uploadInput = document.getElementById('upload-input');
    const uploadsGrid = document.getElementById('uploads-grid');

    if (uploadBtn && uploadInput && uploadsGrid) {
        uploadBtn.addEventListener('click', function() {
            uploadInput.click();
        });

        uploadInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const dataUrl = e.target.result;
                    // Add to grid
                    const card = document.createElement('div');
                    card.className = 'artwork-card';
                    card.innerHTML = `
                        <img src="${dataUrl}" alt="Uploaded Artwork">
                        <h3>Uploaded Artwork</h3>
                        <p>Uploaded by me</p>
                    `;
                    uploadsGrid.appendChild(card);
                    // Add hover effect to new image
                    const newImg = card.querySelector('img');
                    newImg.addEventListener('mousemove', function(e) {
                        const rect = this.getBoundingClientRect();
                        const x = ((e.clientX - rect.left) / rect.width) * 100;
                        const y = ((e.clientY - rect.top) / rect.height) * 100;
                        this.style.transformOrigin = `${x}% ${y}%`;
                        this.style.transform = 'scale(1.1)';
                    });
                    newImg.addEventListener('mouseleave', function() {
                        this.style.transformOrigin = 'center';
                        this.style.transform = 'scale(1)';
                    });
                    // Add click to open modal
                    newImg.addEventListener('click', function() {
                        openArtworkModal(this.src);
                    });
                    // Save to localStorage
                    const uploadsKey = getUserUploadsKey();
                    let uploads = JSON.parse(localStorage.getItem(uploadsKey) || '[]');
                    uploads.push(dataUrl);
                    localStorage.setItem(uploadsKey, JSON.stringify(uploads));
                };
                reader.readAsDataURL(file);
            }
        });
        
        // Function to open artwork modal
        function openArtworkModal(imageSrc) {
            const modal = document.getElementById('artwork-modal');
            const img = document.getElementById('artwork-modal-img');
        
            if (modal && img) {
                img.src = imageSrc;
                modal.style.display = 'flex';
                modal.style.zIndex = '10000';
                modal.setAttribute('aria-hidden', 'false');
                document.body.classList.add('no-scroll');
            }
        }
        
        // Function to close artwork modal
        function closeArtworkModal() {
            const modal = document.getElementById('artwork-modal');
            if (modal) {
                modal.classList.remove('show');
                modal.setAttribute('aria-hidden', 'true');
                document.body.classList.remove('no-scroll');
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);
            }
        }
        
        // Event listeners for modal
        document.addEventListener('DOMContentLoaded', function() {
            const artworkModal = document.getElementById('artwork-modal');
            if (artworkModal) {
                const closeBtn = artworkModal.querySelector('.close');
                if (closeBtn) {
                    closeBtn.addEventListener('click', closeArtworkModal);
                }
        
                // Close modal when clicking outside
                window.addEventListener('click', function(e) {
                    if (e.target === artworkModal) {
                        closeArtworkModal();
                    }
                });
        
                // Close modal with Escape key
                document.addEventListener('keydown', function(e) {
                    if (e.key === 'Escape' && artworkModal.style.display === 'flex') {
                        closeArtworkModal();
                    }
                });
            }
        });

        // Load from localStorage
        const uploadsKey = getUserUploadsKey();
        let uploads = JSON.parse(localStorage.getItem(uploadsKey) || '[]');
        uploads.forEach((dataUrl, index) => {
            const card = document.createElement('div');
            card.className = 'artwork-card';
            card.innerHTML = `
                <img src="${dataUrl}" alt="Uploaded Artwork">
                <h3>Uploaded Artwork</h3>
                <p>Uploaded by me</p>
                <button class="remove-btn">Remove</button>
            `;
            uploadsGrid.appendChild(card);
            // Add hover effect
            const img = card.querySelector('img');
            img.addEventListener('mousemove', function(e) {
                const rect = this.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                this.style.transformOrigin = `${x}% ${y}%`;
                this.style.transform = 'scale(1.1)';
            });
            img.addEventListener('mouseleave', function() {
                this.style.transformOrigin = 'center';
                this.style.transform = 'scale(1)';
            });
            // Add click to open modal
            img.addEventListener('click', function() {
                openArtworkModal(this.src);
            });
            // Add remove functionality
            const removeBtn = card.querySelector('.remove-btn');
            removeBtn.addEventListener('click', function() {
                const uploadsKey = getUserUploadsKey();
                let uploads = JSON.parse(localStorage.getItem(uploadsKey) || '[]');
                uploads.splice(index, 1);
                localStorage.setItem(uploadsKey, JSON.stringify(uploads));
                // Reload uploads
                const uploadsGrid = document.getElementById('uploads-grid');
                uploadsGrid.innerHTML = '';
                const reloadedUploads = JSON.parse(localStorage.getItem(uploadsKey) || '[]');
                reloadedUploads.forEach((url, idx) => {
                    const newCard = document.createElement('div');
                    newCard.className = 'artwork-card';
                    newCard.innerHTML = `
                        <img src="${url}" alt="Uploaded Artwork">
                        <h3>Uploaded Artwork</h3>
                        <p>Uploaded by me</p>
                        <button class="remove-btn">Remove</button>
                    `;
                    uploadsGrid.appendChild(newCard);
                    // Re-add hover and remove for new cards
                    const newImg = newCard.querySelector('img');
                    newImg.addEventListener('mousemove', function(e) {
                        const rect = this.getBoundingClientRect();
                        const x = ((e.clientX - rect.left) / rect.width) * 100;
                        const y = ((e.clientY - rect.top) / rect.height) * 100;
                        this.style.transformOrigin = `${x}% ${y}%`;
                        this.style.transform = 'scale(1.1)';
                    });
                    newImg.addEventListener('mouseleave', function() {
                        this.style.transformOrigin = 'center';
                        this.style.transform = 'scale(1)';
                    });
                    // Add click to open modal
                    newImg.addEventListener('click', function() {
                        openArtworkModal(this.src);
                    });
                    const newRemoveBtn = newCard.querySelector('.remove-btn');
                    newRemoveBtn.addEventListener('click', function() {
                        const uploadsKey = getUserUploadsKey();
                        let uploads = JSON.parse(localStorage.getItem(uploadsKey) || '[]');
                        uploads.splice(idx, 1);
                        localStorage.setItem(uploadsKey, JSON.stringify(uploads));
                        // Reload the grid
                        const uploadsGrid = document.getElementById('uploads-grid');
                        uploadsGrid.innerHTML = '';
                        const reloadedUploads = JSON.parse(localStorage.getItem(uploadsKey) || '[]');
                        reloadedUploads.forEach((url, idx) => {
                            const newCard = document.createElement('div');
                            newCard.className = 'artwork-card';
                            newCard.innerHTML = `
                                <img src="${url}" alt="Uploaded Artwork">
                                <h3>Uploaded Artwork</h3>
                                <p>Uploaded by me</p>
                                <button class="remove-btn">Remove</button>
                            `;
                            uploadsGrid.appendChild(newCard);
                            // Re-add hover and remove
                            const newImg = newCard.querySelector('img');
                            newImg.addEventListener('mousemove', function(e) {
                                const rect = this.getBoundingClientRect();
                                const x = ((e.clientX - rect.left) / rect.width) * 100;
                                const y = ((e.clientY - rect.top) / rect.height) * 100;
                                this.style.transformOrigin = `${x}% ${y}%`;
                                this.style.transform = 'scale(1.1)';
                            });
                            newImg.addEventListener('mouseleave', function() {
                                this.style.transformOrigin = 'center';
                                this.style.transform = 'scale(1)';
                            });
                            const newRemoveBtn = newCard.querySelector('.remove-btn');
                            newRemoveBtn.addEventListener('click', function() {
                                const uploadsKey = getUserUploadsKey();
                                let uploads = JSON.parse(localStorage.getItem(uploadsKey) || '[]');
                                uploads.splice(idx, 1);
                                localStorage.setItem(uploadsKey, JSON.stringify(uploads));
                                // Reload the grid again - simplified, just reload the page or something, but for now, alert
                                location.reload(); // Simple way to reload
                            });
                        });
                    });
                });
            });
        });

    }

    // Load from localStorage
    const profileName = document.getElementById('profile-name');
    const profileLocation = document.getElementById('profile-location');
    const dropdownProfileName = document.querySelector('.dropdown-profile-name');
    const navProfileAvatar = document.getElementById('nav-profile-avatar');
    const profileIconLink = document.getElementById('profile-icon-link');

    const savedName = localStorage.getItem('userName') || 'John Doe';
    const savedLocation = localStorage.getItem('userLocation') || 'Philippines';
    const savedInitials = localStorage.getItem('userInitials') || 'JD';
    let savedProfileImage = localStorage.getItem(getUserProfileImageKey());
    
    profileName.textContent = savedName;
    profileLocation.textContent = savedLocation;
    if (savedProfileImage) profileImage.src = savedProfileImage;
    if (dropdownProfileName) dropdownProfileName.textContent = savedName;
    updateProfileIcons(savedProfileImage, savedInitials);

    // Fetch latest user data from server
    const userId = localStorage.getItem('userId');
    if (userId) {
        fetch(`/users/${userId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        })
        .then(response => response.json())
        .then(user => {
            if (user && user.user_id) {
                if (user.profile_picture) {
                    profileImage.src = user.profile_picture;
                    localStorage.setItem(getUserProfileImageKey(), user.profile_picture);
                    updateProfileIcons(user.profile_picture, savedInitials);
                }
            }
        })
        .catch(err => console.error('Error fetching user data:', err));
    }

    function updateProfileIcons(imageSrc, initials) {
        if (imageSrc) {
            // Show image
            navProfileAvatar.innerHTML = `<img src="${imageSrc}" alt="Profile" class="nav-profile-icon">`;
        } else {
            // Show initials
            navProfileAvatar.innerHTML = `<span style="font-size: 18px; font-weight: bold;">${initials}</span>`;
        }
        // Update dropdown icon
        if (dropdownProfileIcon) dropdownProfileIcon.src = imageSrc || 'img/profile icon.webp';
    }

    // Name is no longer editable

    profileLocation.addEventListener('blur', function() {
        localStorage.setItem('userLocation', profileLocation.textContent);
    });

    // Save button (only for location since name is not editable)
    const saveProfileBtn = document.getElementById('save-profile-btn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', function() {
            localStorage.setItem('userLocation', profileLocation.textContent);
            alert('Profile saved!');
        });
    }

    // Function to load saved artworks
    function loadSavedArtworks() {
        const userId = localStorage.getItem('userId');
        const artworksGrid = savedContent.querySelector('.artworks-grid');

        // Clear existing cards
        artworksGrid.innerHTML = '';

        if (!userId) {
            artworksGrid.innerHTML = '<p>Please log in to view saved artworks.</p>';
            return;
        }

        // Fetch saved artworks from database
        fetch(`/saved-artworks/${userId}`)
            .then(response => response.json())
            .then(savedArtworks => {
                if (savedArtworks.length === 0) {
                    artworksGrid.innerHTML = '<p>No saved artworks yet.</p>';
                    return;
                }

                savedArtworks.forEach(artwork => {
                    const card = document.createElement('div');
                    card.className = 'artwork-card';
                    card.innerHTML = `
                        <img src="${artwork.image_url || 'img/art1.jpg'}" alt="${artwork.title}">
                        <h3>${artwork.title}</h3>
                        <p>${artwork.medium || 'Artwork'}</p>
                        <button class="save-btn saved" data-artwork-id="${artwork.artwork_id}">♥</button>
                    `;
                    artworksGrid.appendChild(card);

                    // Add hover effect
                    const img = card.querySelector('img');
                    img.addEventListener('mousemove', function(e) {
                        const rect = this.getBoundingClientRect();
                        const x = ((e.clientX - rect.left) / rect.width) * 100;
                        const y = ((e.clientY - rect.top) / rect.height) * 100;
                        this.style.transformOrigin = `${x}% ${y}%`;
                        this.style.transform = 'scale(1.1)';
                    });
                    img.addEventListener('mouseleave', function() {
                        this.style.transformOrigin = 'center';
                        this.style.transform = 'scale(1)';
                    });

                    // Add event listener for unsave button
                    const saveBtn = card.querySelector('.save-btn');
                    saveBtn.addEventListener('click', function() {
                        const artworkId = this.getAttribute('data-artwork-id');
                        fetch('/save-artwork', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'user-id': userId
                            },
                            body: JSON.stringify({ artwork_id: artworkId })
                        })
                        .then(response => response.json())
                        .then(data => {
                            if (data.saved === false) {
                                // Successfully unsaved, reload the list
                                loadSavedArtworks();
                            }
                        })
                        .catch(err => {
                            console.error('Unsave error:', err);
                            alert('Error unsaving artwork. Please try again.');
                        });
                    });
                });
            })
            .catch(err => {
                console.error('Error loading saved artworks:', err);
                artworksGrid.innerHTML = '<p>Error loading saved artworks.</p>';
            });
    }

    // Function to load followed artists
    function loadFollowedArtists() {
        const userId = localStorage.getItem('userId');
        const artistsGrid = followedContent.querySelector('.artworks-grid');

        // Clear existing cards
        artistsGrid.innerHTML = '';

        if (!userId) {
            artistsGrid.innerHTML = '<p>Please log in to view followed artists.</p>';
            return;
        }

        // Fetch followed artists from database
        fetch(`/followed-artists/${userId}`)
            .then(response => response.json())
            .then(followedArtists => {
                if (followedArtists.length === 0) {
                    artistsGrid.innerHTML = '<p>No followed artists yet.</p>';
                    return;
                }

                followedArtists.forEach(artist => {
                    const nameParts = artist.name.split(' ');
                    const first = nameParts[0];
                    const last = nameParts[nameParts.length - 1];
                    const slug = `${first}-${last}`.toLowerCase() + '.html';
                    const card = document.createElement('div');
                    card.className = 'artist-card';
                    card.innerHTML = `
                        <img src="${artist.photo_url || 'img/profile icon.webp'}" alt="${artist.name}">
                        <h3>${artist.name}</h3>
                        <p>${artist.bio || 'Artist description'}</p>
                        <a href="${slug}" class="artist-link view-details">View Profile</a>
                        <button class="follow-btn followed" data-artist-id="${artist.artist_id}">Followed</button>
                    `;
                    artistsGrid.appendChild(card);

                    // Add event listener for unfollow button
                    const followBtn = card.querySelector('.follow-btn');
                    followBtn.addEventListener('click', function() {
                        const artistId = this.getAttribute('data-artist-id');
                        fetch('/follow-artist', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'user-id': userId
                            },
                            body: JSON.stringify({ artist_id: artistId })
                        })
                        .then(response => response.json())
                        .then(data => {
                            if (data.followed === false) {
                                // Successfully unfollowed, reload the list
                                loadFollowedArtists();
                            }
                        })
                        .catch(err => {
                            console.error('Unfollow error:', err);
                            alert('Error unfollowing artist. Please try again.');
                        });
                    });

                    

                    // Hover effects
                    followBtn.addEventListener('mouseenter', function() {
                        if (this.classList.contains('followed')) {
                            this.textContent = 'Unfollow';
                        }
                    });

                    followBtn.addEventListener('mouseleave', function() {
                        if (this.classList.contains('followed')) {
                            this.textContent = 'Followed';
                        }
                    });
                });
            })
            .catch(err => {
                console.error('Error loading followed artists:', err);
                artistsGrid.innerHTML = '<p>Error loading followed artists.</p>';
            });
    }
});