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
    // Load common elements and data first
    const profileName = document.getElementById('profile-name');
    const profileLocation = document.getElementById('profile-location');
    const dropdownProfileName = document.querySelector('.dropdown-profile-name');
    const navProfileAvatar = document.getElementById('nav-profile-avatar');
    const dropdownProfileIcon = document.getElementById('dropdown-profile-icon');
    const profileImage = document.getElementById('profile-image');

    const savedName = localStorage.getItem('userName') || 'John Doe';
    const savedLocation = localStorage.getItem('userLocation') || 'Philippines';
    const savedInitials = localStorage.getItem('userInitials') || 'JD';
    let savedProfileImage = localStorage.getItem(getUserProfileImageKey());
    
    if (profileName) profileName.textContent = savedName;
    if (profileLocation) profileLocation.textContent = savedLocation;
    if (savedProfileImage && profileImage) profileImage.src = savedProfileImage;
    if (dropdownProfileName) dropdownProfileName.textContent = savedName;
    
    function updateProfileIcons(imageSrc, initials) {
        if (!navProfileAvatar) return;
        if (imageSrc) {
            navProfileAvatar.innerHTML = `<img src="${imageSrc}" alt="Profile" class="nav-profile-icon">`;
        } else {
            navProfileAvatar.innerHTML = `<span style="font-size: 18px; font-weight: bold;">${initials}</span>`;
        }
        if (dropdownProfileIcon) dropdownProfileIcon.src = imageSrc || 'img/profile icon.webp';
    }

    updateProfileIcons(savedProfileImage, savedInitials);

    const savedBtn = document.getElementById('saved-btn');
    const followedBtn = document.getElementById('followed-btn');
    const uploadsBtn = document.getElementById('uploads-btn');
    const savedContent = document.getElementById('saved-content');
    const followedContent = document.getElementById('followed-content');
    const uploadsContent = document.getElementById('uploads-content');

    // Initially hide all content sections except saved
    if (savedContent) savedContent.style.display = 'block';
    if (followedContent) followedContent.style.display = 'none';
    if (uploadsContent) uploadsContent.style.display = 'none';

    // Set saved as active
    if (savedBtn) savedBtn.classList.add('active');

    // Function to show content
    function showContent(contentToShow, activeBtn) {
        if (savedContent) savedContent.style.display = 'none';
        if (followedContent) followedContent.style.display = 'none';
        if (uploadsContent) uploadsContent.style.display = 'none';
        if (contentToShow) contentToShow.style.display = 'block';

        if (savedBtn) savedBtn.classList.remove('active');
        if (followedBtn) followedBtn.classList.remove('active');
        if (uploadsBtn) uploadsBtn.classList.remove('active');

        if (activeBtn) activeBtn.classList.add('active');
    }

    // Function to open artwork modal
    function openArtworkModal(imageSrc) {
        const modal = document.getElementById('artwork-modal');
        const img = document.getElementById('artwork-modal-img');
    
        if (modal && img) {
            img.src = imageSrc;
            modal.style.display = 'flex';
            modal.style.opacity = '1';
            modal.style.pointerEvents = 'auto';
            modal.classList.add('show');
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
            modal.style.display = 'none'; // Immediate hide
            modal.style.opacity = '0';
            modal.style.pointerEvents = 'none';
            document.body.classList.remove('no-scroll');
        }
    }
    
    // Event listeners for modal
    const artworkModal = document.getElementById('artwork-modal');
    if (artworkModal) {
        // Use event delegation for clicks inside the modal
        artworkModal.addEventListener('click', function(e) {
            // Check if clicked element is the close button (span.close) or its child
            // or if the background itself was clicked
            if (e.target.classList.contains('close') || e.target === artworkModal) {
                e.preventDefault();
                e.stopPropagation();
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

    // Tab button listeners
    if (savedBtn) {
        savedBtn.addEventListener('click', function() {
            showContent(savedContent, savedBtn);
        });
    }

    if (followedBtn) {
        followedBtn.addEventListener('click', function() {
            showContent(followedContent, followedBtn);
        });
    }

    if (uploadsBtn) {
        uploadsBtn.addEventListener('click', function() {
            showContent(uploadsContent, uploadsBtn);
        });
    }

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
                    if (profileImage) profileImage.src = user.profile_picture;
                    localStorage.setItem(getUserProfileImageKey(), user.profile_picture);
                    updateProfileIcons(user.profile_picture, savedInitials);
                }
            }
        })
        .catch(err => console.error('Error fetching user data:', err));
    }

    // Load saved artworks and followed artists
    loadSavedArtworks();
    loadFollowedArtists();

    // Profile image change functionality
    const profileImageContainer = document.querySelector('.profile-image-container');
    const profileImageInput = document.getElementById('profile-image-input');

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

    // Location editing
    if (profileLocation) {
        profileLocation.addEventListener('blur', function() {
            localStorage.setItem('userLocation', profileLocation.textContent);
        });
    }

    const saveProfileBtn = document.getElementById('save-profile-btn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', function() {
            localStorage.setItem('userLocation', profileLocation.textContent);
            alert('Profile saved!');
        });
    }

    // Upload functionality
    const uploadNewBtn = document.getElementById('upload-new-btn');
    const uploadInput = document.getElementById('upload-input');
    const uploadsGrid = document.getElementById('uploads-grid');

    if (uploadNewBtn && uploadInput && uploadsGrid) {
        uploadNewBtn.addEventListener('click', function() {
            uploadInput.click();
        });

        uploadInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const dataUrl = e.target.result;
                    const card = document.createElement('div');
                    card.className = 'artwork-card';
                    card.innerHTML = `
                        <img src="${dataUrl}" alt="Uploaded Artwork">
                        <h3>Uploaded Artwork</h3>
                        <p>Uploaded by me</p>
                    `;
                    uploadsGrid.appendChild(card);
                    
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
                    newImg.addEventListener('click', function() {
                        openArtworkModal(this.src);
                    });

                    const uploadsKey = getUserUploadsKey();
                    let uploads = JSON.parse(localStorage.getItem(uploadsKey) || '[]');
                    uploads.push(dataUrl);
                    localStorage.setItem(uploadsKey, JSON.stringify(uploads));
                };
                reader.readAsDataURL(file);
            }
        });

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
            img.addEventListener('click', function() {
                openArtworkModal(this.src);
            });

            const removeBtn = card.querySelector('.remove-btn');
            removeBtn.addEventListener('click', function() {
                let currentUploads = JSON.parse(localStorage.getItem(uploadsKey) || '[]');
                currentUploads.splice(index, 1);
                localStorage.setItem(uploadsKey, JSON.stringify(currentUploads));
                location.reload();
            });
        });
    }

    // Function to load saved artworks
    function loadSavedArtworks() {
        const userId = localStorage.getItem('userId');
        if (!savedContent) return;
        const artworksGrid = savedContent.querySelector('.artworks-grid');
        if (!artworksGrid) return;

        artworksGrid.innerHTML = '';

        if (!userId) {
            artworksGrid.innerHTML = '<p>Please log in to view saved artworks.</p>';
            return;
        }

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
                        <div class="artwork-image-container">
                            <img src="${artwork.image_url || 'img/art1.jpg'}" alt="${artwork.title}">
                            <div class="heart-icon saved" data-artwork-id="${artwork.artwork_id}">
                                <i class="fas fa-heart"></i>
                            </div>
                        </div>
                        <h3>${artwork.title}</h3>
                        <p>${artwork.medium || 'Artwork'}</p>
                    `;
                    artworksGrid.appendChild(card);

                    // Add click handler to redirect to artwork details
                    card.addEventListener('click', function(event) {
                        event.preventDefault();
                        event.stopPropagation();
                        const userId = localStorage.getItem('userId');
                        if (userId) {
                            window.location.href = `artwork-details.html?id=${artwork.artwork_id}`;
                        } else {
                            openModal();
                            openTab('signup');
                        }
                    });

                    const saveBtn = card.querySelector('.heart-icon');
                    saveBtn.addEventListener('click', function(e) {
                        e.stopPropagation(); // Prevent card click
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
                                loadSavedArtworks();
                            }
                        })
                        .catch(err => console.error('Unsave error:', err));
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
        if (!followedContent) return;
        const artistsGrid = followedContent.querySelector('.artworks-grid');
        if (!artistsGrid) return;

        artistsGrid.innerHTML = '';

        if (!userId) {
            artistsGrid.innerHTML = '<p>Please log in to view followed artists.</p>';
            return;
        }

        fetch(`/followed-artists/${userId}`)
            .then(response => response.json())
            .then(followedArtists => {
                if (followedArtists.length === 0) {
                    artistsGrid.innerHTML = '<p>No followed artists yet.</p>';
                    return;
                }

                followedArtists.forEach(artist => {
                    const card = document.createElement('div');
                    card.className = 'artist-card';
                    card.innerHTML = `
                        <img src="${artist.photo_url || 'img/profile icon.webp'}" alt="${artist.name}">
                        <h3>${artist.name}</h3>
                        <p>${artist.bio || 'Artist description'}</p>
                        <button class="follow-btn followed" data-artist-id="${artist.artist_id}">Followed</button>
                    `;
                    artistsGrid.appendChild(card);

                    // Add click handler to redirect to artist details
                    card.addEventListener('click', function(event) {
                        event.preventDefault();
                        event.stopPropagation();
                        const userId = localStorage.getItem('userId');
                        if (userId) {
                            window.location.href = `artist-details.html?id=${artist.artist_id}`;
                        } else {
                            openModal();
                            openTab('signup');
                        }
                    });

                    const followBtn = card.querySelector('.follow-btn');
                    followBtn.addEventListener('click', function(e) {
                        e.stopPropagation(); // Prevent card click
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
                                loadFollowedArtists();
                            }
                        })
                        .catch(err => console.error('Unfollow error:', err));
                    });
                });
            })
            .catch(err => {
                console.error('Error loading followed artists:', err);
                artistsGrid.innerHTML = '<p>Error loading followed artists.</p>';
            });
    }
});
