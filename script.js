// Simple script for BanArts website

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


function setActiveNavLink() {
    const currentPath = window.location.pathname;
    const currentPage = currentPath.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('nav ul li a');
    
    const pageMapping = {
        'artist-details.html': 'artists.html',
        'artwork-details.html': 'artworks.html',
        'museum_details.html': 'museums.html',
        'gallery-details.html': 'galleries.html',
        'browse-galleries.html': 'galleries.html',
        'browse-museums.html': 'museums.html',
        'event-details.html': 'events.html'
    };
    
    let targetPage = pageMapping[currentPage] || currentPage;
    
    if (/^\d+$/.test(currentPage)) {
        if (currentPath.includes('gallery')) {
            targetPage = 'galleries.html';
        } else if (currentPath.includes('artist')) {
            targetPage = 'artists.html';
        } else if (currentPath.includes('artwork')) {
            targetPage = 'artworks.html';
        } else if (currentPath.includes('museum')) {
            targetPage = 'museums.html';
        } else if (currentPath.includes('event')) {
            targetPage = 'events.html';
        }
    }
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        const linkPage = href.split('/').pop();
        
        if (linkPage === targetPage || (currentPage === '' && linkPage === 'index.html')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    updateNavbar();
    setActiveNavLink();
    initializeMobileMenu();
});

function initializeMobileMenu() {
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navMenu = document.querySelector('.nav-menu');

    if (mobileMenuToggle && navMenu) {
        mobileMenuToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            navMenu.classList.toggle('show');
            const isOpen = navMenu.classList.contains('show');
            this.setAttribute('aria-expanded', isOpen);
            this.innerHTML = isOpen ? '&#10006;' : '&#9776;';
        });

        // Close mobile menu when clicking outside
        document.addEventListener('click', function(e) {
            if (navMenu.classList.contains('show') && !navMenu.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
                navMenu.classList.remove('show');
                mobileMenuToggle.setAttribute('aria-expanded', 'false');
                mobileMenuToggle.innerHTML = '&#9776;';
            }
        });

        // Close mobile menu when clicking on a link
        navMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', function() {
                navMenu.classList.remove('show');
                mobileMenuToggle.setAttribute('aria-expanded', 'false');
                mobileMenuToggle.innerHTML = '&#9776;';
            });
        });
    }
}

// Smooth scrolling for navigation links
document.querySelectorAll('nav a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});

// Category button active state and filtering
document.querySelectorAll('.category-link').forEach(link => {
    link.addEventListener('click', function() {
        // Remove active class from all category links
        document.querySelectorAll('.category-link').forEach(l => l.classList.remove('active'));
        // Add active class to clicked link
        this.classList.add('active');

        // Get the category from href (e.g., #painting -> painting)
        const category = this.getAttribute('href').substring(1);

        // Update the section title
        const h2 = document.querySelector('.other-artworks h2');
        if (h2) {
            if (category === 'all') {
                h2.textContent = 'All Artworks';
            } else {
                h2.textContent = category.charAt(0).toUpperCase() + category.slice(1) + ' Artworks';
            }
        }

        // Check if we're on artworks page and use the filter function
        if (typeof filterArtworks === 'function') {
            filterArtworks(category);
        } else {
            // Fallback for other pages
            const artworks = document.querySelectorAll('.artwork-card');
            artworks.forEach(card => {
                if (category === 'all') {
                    card.style.display = 'block';
                } else {
                    const cardCategories = card.getAttribute('data-categories') || card.getAttribute('data-category') || '';
                    const categoriesArray = cardCategories.split(' ');
                    if (categoriesArray.includes(category)) {
                        card.style.display = 'block';
                    } else {
                        card.style.display = 'none';
                    }
                }
            });
        }
    });
});

// Follow button toggle with database persistence
document.querySelectorAll('.follow-btn').forEach(btn => {
    // Get artist ID from data attribute or URL
    let artistId = btn.getAttribute('data-artist-id');
    if (!artistId) {
        // Try to extract from URL or other means
        const url = window.location.pathname;
        const artistMatch = url.match(/artist-(\d+)\.html/);
        if (artistMatch) {
            artistId = artistMatch[1];
        }
    }

    // Initialize followed state on page load
    const userId = localStorage.getItem('userId');
    const userEmail = localStorage.getItem('userEmail');

    if (userId && artistId) {
        // Check if user follows this artist
        fetch(`/followed-artists/${userId}`)
            .then(response => response.json())
            .then(followedArtists => {
                const isFollowed = followedArtists.some(artist => artist.artist_id == artistId);
                updateFollowButton(btn, isFollowed);
            })
            .catch(err => {
                console.error('Error checking follow status:', err);
                updateFollowButton(btn, false);
            });
    } else {
        updateFollowButton(btn, false);
    }

    btn.addEventListener('click', function() {
        if (!userEmail) {
            openModal();
            openTab('signup');
            return;
        }

        if (!artistId) {
            alert('Artist ID not found. Please try again.');
            return;
        }

        // Call follow/unfollow API
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
            updateFollowButton(btn, data.followed);
            // Optional: Show success message
            console.log(data.message);
        })
        .catch(err => {
            console.error('Follow error:', err);
            alert('Error updating follow status. Please try again.');
        });
    });

    // Hover effects for followed state
    btn.addEventListener('mouseenter', function() {
        if (this.classList.contains('followed')) {
            this.textContent = 'Unfollow';
        }
    });

    btn.addEventListener('mouseleave', function() {
        if (this.classList.contains('followed')) {
            this.textContent = 'Followed';
        }
    });
});

function updateFollowButton(btn, isFollowed) {
    if (isFollowed) {
        btn.textContent = 'Followed';
        btn.classList.add('followed');
    } else {
        btn.textContent = 'Follow';
        btn.classList.remove('followed');
    }
}

// Save button toggle with database persistence
document.querySelectorAll('.save-btn').forEach(btn => {
    // Get artwork ID from data attribute
    let artworkId = btn.getAttribute('data-artwork-id');
    if (!artworkId) {
        // Try to extract from other attributes or generate one
        const card = btn.closest('.artwork-card');
        if (card) {
            artworkId = card.getAttribute('data-id') || Math.random().toString(36).substr(2, 9);
        }
    }

    // Initialize saved state on page load
    const userId = localStorage.getItem('userId');
    const userEmail = localStorage.getItem('userEmail');

    if (userId && artworkId) {
        // Check if user saved this artwork
        fetch(`/saved-artworks/${userId}`)
            .then(response => response.json())
            .then(savedArtworks => {
                const isSaved = savedArtworks.some(artwork => artwork.artwork_id == artworkId);
                updateSaveButton(btn, isSaved);
            })
            .catch(err => {
                console.error('Error checking save status:', err);
                updateSaveButton(btn, false);
            });
    } else {
        updateSaveButton(btn, false);
    }

    btn.addEventListener('click', function() {
        if (!userEmail) {
            openModal();
            openTab('signup');
            return;
        }

        if (!artworkId) {
            alert('Artwork ID not found. Please try again.');
            return;
        }

        // Toggle the class immediately
        const wasSaved = this.classList.contains('saved');
        if (wasSaved) {
            this.classList.remove('saved');
        } else {
            this.classList.add('saved');
        }

        // Call save/unsave API
        fetch('/save-artwork', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'user-id': userId
            },
            body: JSON.stringify({ artwork_id: artworkId })
        })
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('Server error');
            }
        })
        .then(data => {
            updateSaveButton(this, data.saved);
            // Optional: Show success message
            console.log(data.message);
        })
        .catch(err => {
            console.error('Save error:', err);
            alert('Error updating save status. Please try again.');
            // Revert the toggle
            if (wasSaved) {
                this.classList.add('saved');
            } else {
                this.classList.remove('saved');
            }
        });
    });
});

function updateSaveButton(btn, isSaved) {
    if (isSaved) {
        btn.classList.add('saved');
    } else {
        btn.classList.remove('saved');
    }
}

// Artwork image zoom with cursor follow
document.querySelectorAll('.artwork-card img').forEach(img => {
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
});

// Modal functionality
function openModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '10000';

        // Position modal at current scroll position
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.top = (window.scrollY + 20) + 'px';
        }

        setTimeout(() => {
            modal.classList.add('show');
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('no-scroll');
        }, 10);

        // Focus management
        const firstFocusableElement = modal.querySelector('.close') || modal.querySelector('.tab-btn');
        if (firstFocusableElement) {
            firstFocusableElement.focus();
        }
    }
}

function closeModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('no-scroll');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

function openForgotPasswordModal() {
    closeModal();
    const modal = document.getElementById('forgot-password-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '10000';

        // Position modal at current scroll position
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.top = (window.scrollY + 20) + 'px';
        }

        setTimeout(() => {
            modal.classList.add('show');
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('no-scroll');
        }, 10);
        
        // Ensure the tab content is visible
        const forgotTab = document.getElementById('forgot-password-tab');
        if (forgotTab) {
            forgotTab.classList.add('active');
            forgotTab.setAttribute('aria-hidden', 'false');
        }
    }
}

function closeForgotPasswordModal() {
    const modal = document.getElementById('forgot-password-modal');
    if (modal) {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('no-scroll');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

function openTab(tabName) {
    const tabs = document.querySelectorAll('.tab-content');
    const buttons = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.classList.remove('active');
        tab.setAttribute('aria-hidden', 'true');
    });
    buttons.forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
    });
    const targetTab = document.getElementById(tabName + '-tab');
    if (targetTab) {
        targetTab.classList.add('active');
        targetTab.setAttribute('aria-hidden', 'false');
    }

    // Find the corresponding tab button and add active
    const activeBtn = document.querySelector(`.tab-btn[onclick*="${tabName}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.setAttribute('aria-selected', 'true');
    }

    // Update modal title for screen readers
    const modalTitle = document.getElementById('modal-title');
    if (modalTitle) {
        modalTitle.textContent = tabName.charAt(0).toUpperCase() + tabName.slice(1);
    }
}

function togglePasswordVisibility(button) {
    const passwordField = button.closest('.password-field');
    const passwordInput = passwordField.querySelector('.password-input');
    const icon = button.querySelector('i');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
        button.setAttribute('aria-label', 'Hide password');
    } else {
        passwordInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
        button.setAttribute('aria-label', 'Show password');
    }
}

// Event listeners for modal
const loginBtn = document.querySelector('.login-link');
const signupBtn = document.querySelector('.signup-btn');
const closeBtn = document.querySelector('.close');
const forgotPasswordLink = document.getElementById('forgot-password-link');
const backToLoginLink = document.getElementById('back-to-login-link');
const closeForgotPasswordBtn = document.querySelector('.close-forgot-password');
const forgotPasswordForm = document.getElementById('forgot-password-form');

if (loginBtn) loginBtn.addEventListener('click', function(e) {
    e.preventDefault();
    openModal();
    openTab('login');
});

if (signupBtn) signupBtn.addEventListener('click', function(e) {
    e.preventDefault();
    openModal();
    openTab('signup');
});

if (closeBtn) closeBtn.addEventListener('click', closeModal);

if (forgotPasswordLink) forgotPasswordLink.addEventListener('click', function(e) {
    e.preventDefault();
    openForgotPasswordModal();
});

if (backToLoginLink) backToLoginLink.addEventListener('click', function(e) {
    e.preventDefault();
    closeForgotPasswordModal();
    openModal();
    openTab('login');
});

if (closeForgotPasswordBtn) closeForgotPasswordBtn.addEventListener('click', closeForgotPasswordModal);

if (forgotPasswordForm) forgotPasswordForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('reset-email').value;
    const newPassword = document.getElementById('reset-new-password').value;
    const confirmPassword = document.getElementById('reset-confirm-password').value;
    const errorDiv = document.getElementById('forgot-password-error');
    const successDiv = document.getElementById('forgot-password-success');

    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    if (newPassword !== confirmPassword) {
        errorDiv.textContent = 'Passwords do not match.';
        errorDiv.style.display = 'block';
        return;
    }

    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
        errorDiv.textContent = passwordCheck.message;
        errorDiv.style.display = 'block';
        return;
    }

    try {
        const response = await fetch('/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, newPassword })
        });

        const data = await response.json();
        if (response.ok) {
            successDiv.textContent = data.message || 'Password changed successfully!';
            successDiv.style.display = 'block';
            forgotPasswordForm.reset();
            setTimeout(() => {
                closeForgotPasswordModal();
                openModal();
                openTab('login');
            }, 2000);
        } else {
            errorDiv.textContent = data.error || data.message || 'Something went wrong. Please try again.';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'Network error. Please try again.';
        errorDiv.style.display = 'block';
    }
});

// Close modal when clicking outside
window.addEventListener('click', function(e) {
    const authModal = document.getElementById('auth-modal');
    const forgotPasswordModal = document.getElementById('forgot-password-modal');
    
    if (e.target === authModal) {
        closeModal();
    }
    if (e.target === forgotPasswordModal) {
        closeForgotPasswordModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const authModal = document.getElementById('auth-modal');
        const forgotPasswordModal = document.getElementById('forgot-password-modal');
        
        if (authModal && authModal.classList.contains('show')) {
            closeModal();
        }
        if (forgotPasswordModal && forgotPasswordModal.classList.contains('show')) {
            closeForgotPasswordModal();
        }
    }
});

// Search functionality
function getSearchData() {
    const artists = [
        { name: "Benjo Tibalan", url: "benjo-tibalan.html", type: "artist", img: "img/benjjj.jpg" },
        { name: "George V. Aniban", url: "george-aniban.html", type: "artist", img: "img/george profile.jpg" },
        { name: "London B. Villaruel", url: "london-villaruel.html", type: "artist", img: "img/london.jpg" },
        { name: "Jessica Sario", url: "jessica-sario.html", type: "artist", img: "img/jessicaSario.jpg" },
        { name: "Maria Santos", url: "#", type: "artist", img: "img/art1.jpg" },
        { name: "Carlos Reyes", url: "#", type: "artist", img: "img/art2.jpg" },
        { name: "Ana Cruz", url: "#", type: "artist", img: "img/art3.jpg" },
        { name: "Roberto Lim", url: "#", type: "artist", img: "img/roch.jpg" },
        { name: "Elena Torres", url: "#", type: "artist", img: "img/art1.jpg" },
        { name: "Manuel Garcia", url: "#", type: "artist", img: "img/art2.jpg" },
        { name: "Sofia Mendoza", url: "#", type: "artist", img: "img/art3.jpg" },
        { name: "Pedro Alvarez", url: "#", type: "artist", img: "img/roch.jpg" },
    ];
    const artworks = [
        { name: "Acrylic Masterpiece", url: "acrylic-masterpiece.html", type: "artwork", img: "img/acrylic 1.jpg" },
        { name: "Colorful Expressions", url: "colorful-expressions.html", type: "artwork", img: "img/acrylic 2.jpg" },
        { name: "Abstract Landscape", url: "#", type: "artwork", img: "img/acrylic 8.jpg" },
        { name: "Emotional Depths", url: "#", type: "artwork", img: "img/acrylic 11.jpg" },
        { name: "Community Spirit", url: "#", type: "artwork", img: "img/mural1.jpg" },
        { name: "Island Heritage", url: "#", type: "artwork", img: "img/mural2.jpg" },
        { name: "Youth Dreams", url: "#", type: "artwork", img: "img/mural3.jpg" },
        { name: "Cultural Unity", url: "#", type: "artwork", img: "img/mural4.jpg" },
        { name: "Cultural Fusion", url: "#", type: "artwork", img: "img/graphics 1.jpg" },
        { name: "Heritage Digital", url: "#", type: "artwork", img: "img/digital_1.jpg" },
        { name: "Modern Motifs", url: "#", type: "artwork", img: "img/digtal art.jpg" },
        { name: "Island Visions", url: "#", type: "artwork", img: "img/hyper1.jpg" },
        { name: "Cultural Threads", url: "#", type: "artwork", img: "img/drawing1.jpg" },
        { name: "Island Stories", url: "#", type: "artwork", img: "img/photo1.jpg" },
        { name: "Heritage Mosaic", url: "#", type: "artwork", img: "img/drawing2.jpg" },
        { name: "Community Voices", url: "#", type: "artwork", img: "img/photo2.jpg" },
        { name: "Santo Niño de Cebu", url: "santo-niño-de-cebu.html", type: "artwork", img: "img/santo nino.jpg" },
    ];
    return [...artists, ...artworks];
}

const searchData = getSearchData();

// Set initial active tab style
const activeTab = document.querySelector('.event-tab-btn.active');
if (activeTab) {
    activeTab.style.color = 'blue';
    activeTab.style.textDecoration = 'underline';
}

document.addEventListener('DOMContentLoaded', function() {
    const searchBars = document.querySelectorAll('.search-bar');
    searchBars.forEach(searchBar => {
        const input = searchBar.querySelector('input');
        const button = searchBar.querySelector('button');
        let dropdown = searchBar.querySelector('.search-dropdown');

        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.className = 'search-dropdown';
            searchBar.appendChild(dropdown);
        }

        let selectedIndex = -1;
        let currentMatches = [];
        let searchTimeout = null;

        function getDetailsUrl(item) {
            if (item.type === 'artwork') return `/artwork-details.html?id=${item.artwork_id}`;
            if (item.type === 'artist') return `/artist-details.html?id=${item.artist_id}`;
            if (item.type === 'museum') return `/museum/${item.museum_id}`;
            if (item.type === 'gallery') return `/gallery/${item.gallery_id}`;
            return '#';
        }

        function getImageUrl(item) {
            if (item.type === 'artwork') return item.image_url || 'img/art-placeholder.jpg';
            if (item.type === 'artist') return item.photo_url || 'img/artist-placeholder.jpg';
            if (item.type === 'museum') return item.image_url || 'img/museum-placeholder.jpg';
            if (item.type === 'gallery') return item.image_url || 'img/gallery-placeholder.jpg';
            return 'img/placeholder.jpg';
        }

        function getDisplayName(item) {
            if (item.type === 'artwork') return item.title;
            if (item.type === 'artist') return item.name;
            if (item.type === 'museum') return item.name;
            if (item.type === 'gallery') return item.name;
            return 'Unknown';
        }

        async function updateDropdown(query) {
            dropdown.innerHTML = '';
            selectedIndex = -1;

            if (query.length < 1) {
                dropdown.style.display = 'none';
                return;
            }

            dropdown.innerHTML = '<div class="search-loading"><div class="loading-spinner"></div>Searching...</div>';
            dropdown.style.display = 'block';

            try {
                const response = await fetch(`/search?q=${encodeURIComponent(query)}`);
                if (!response.ok) throw new Error('Search failed');

                const results = await response.json();
                currentMatches = [];

                if (results.artworks && results.artworks.length > 0) {
                    results.artworks.slice(0, 3).forEach(art => {
                        currentMatches.push({
                            ...art,
                            type: 'artwork',
                            displayName: art.title,
                            image: art.image_url || 'img/art-placeholder.jpg',
                            url: `/artwork-details.html?id=${art.artwork_id}`
                        });
                    });
                }

                if (results.artists && results.artists.length > 0) {
                    results.artists.slice(0, 3).forEach(artist => {
                        currentMatches.push({
                            ...artist,
                            type: 'artist',
                            displayName: artist.name,
                            image: artist.photo_url || 'img/artist-placeholder.jpg',
                            url: `/artist-details.html?id=${artist.artist_id}`
                        });
                    });
                }

                if (results.museums && results.museums.length > 0) {
                    results.museums.slice(0, 2).forEach(museum => {
                        currentMatches.push({
                            ...museum,
                            type: 'museum',
                            displayName: museum.name,
                            image: museum.image_url || 'img/museum-placeholder.jpg',
                            url: `/museum/${museum.museum_id}`
                        });
                    });
                }

                if (results.galleries && results.galleries.length > 0) {
                    results.galleries.slice(0, 2).forEach(gallery => {
                        currentMatches.push({
                            ...gallery,
                            type: 'gallery',
                            displayName: gallery.name,
                            image: gallery.image_url || 'img/gallery-placeholder.jpg',
                            url: `/gallery/${gallery.gallery_id}`
                        });
                    });
                }

                dropdown.innerHTML = '';

                if (currentMatches.length > 0) {
                    currentMatches.forEach((item, index) => {
                        const itemDiv = document.createElement('div');
                        itemDiv.className = 'search-dropdown-item';
                        itemDiv.setAttribute('data-index', index);

                        const img = document.createElement('img');
                        img.src = item.image;
                        img.alt = item.displayName;

                        const infoDiv = document.createElement('div');
                        infoDiv.className = 'search-item-info';

                        const titleDiv = document.createElement('div');
                        titleDiv.className = 'search-item-title';
                        titleDiv.textContent = item.displayName;

                        const typeDiv = document.createElement('div');
                        typeDiv.className = 'search-item-type';
                        typeDiv.textContent = item.type.charAt(0).toUpperCase() + item.type.slice(1);

                        infoDiv.appendChild(titleDiv);
                        infoDiv.appendChild(typeDiv);

                        itemDiv.appendChild(img);
                        itemDiv.appendChild(infoDiv);

                        itemDiv.addEventListener('click', function() {
                            selectItem(item);
                        });

                        itemDiv.addEventListener('mouseenter', function() {
                            setSelectedIndex(index);
                        });

                        dropdown.appendChild(itemDiv);
                    });
                    dropdown.style.display = 'block';
                } else {
                    dropdown.innerHTML = '<div class="search-no-results">No results found</div>';
                    dropdown.style.display = 'block';
                }
            } catch (error) {
                console.error('Search error:', error);
                dropdown.innerHTML = '<div class="search-no-results">Search error. Please try again.</div>';
                dropdown.style.display = 'block';
            }
        }

        function selectItem(item) {
            const userId = localStorage.getItem('userId');
            if (!userId) {
                openModal();
                openTab('signup');
                hideDropdown();
                input.value = '';
                return;
            }
            window.location.href = item.url;
            hideDropdown();
            input.value = '';
        }

        function setSelectedIndex(index) {
            const items = dropdown.querySelectorAll('.search-dropdown-item');
            items.forEach(item => item.classList.remove('highlighted'));

            if (index >= 0 && index < items.length) {
                items[index].classList.add('highlighted');
                selectedIndex = index;
            } else {
                selectedIndex = -1;
            }
        }

        function hideDropdown() {
            dropdown.style.display = 'none';
            selectedIndex = -1;
        }

        function showNotification(message, type = 'info') {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.textContent = message;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'warning' ? '#ffc107' : '#007bff'};
                color: white;
                padding: 10px 20px;
                border-radius: 4px;
                z-index: 10000;
                animation: slideInRight 0.3s ease;
            `;
            document.body.appendChild(notification);
            setTimeout(() => {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }

        input.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            const query = this.value.trim();
            if (query.length >= 1) {
                searchTimeout = setTimeout(() => updateDropdown(query), 300);
            } else {
                dropdown.style.display = 'none';
            }
        });

        input.addEventListener('focus', function() {
            if (this.value.trim().length >= 1) {
                updateDropdown(this.value.trim());
            }
        });

        input.addEventListener('blur', function() {
            setTimeout(() => hideDropdown(), 150);
        });

        input.addEventListener('keydown', function(e) {
            const items = dropdown.querySelectorAll('.search-dropdown-item');

            switch(e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    if (selectedIndex < items.length - 1) {
                        setSelectedIndex(selectedIndex + 1);
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (selectedIndex > 0) {
                        setSelectedIndex(selectedIndex - 1);
                    }
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (selectedIndex >= 0 && currentMatches[selectedIndex]) {
                        selectItem(currentMatches[selectedIndex]);
                    } else if (input.value.trim()) {
                        button.click();
                    }
                    break;
                case 'Escape':
                    hideDropdown();
                    input.blur();
                    break;
            }
        });

        button.addEventListener('click', async function(e) {
            e.preventDefault();
            const query = input.value.trim();
            if (query) {
                try {
                    const response = await fetch(`/search?q=${encodeURIComponent(query)}`);
                    if (response.ok) {
                        const results = await response.json();
                        if (results.artworks?.length > 0) {
                            window.location.href = `/artwork-details.html?id=${results.artworks[0].artwork_id}`;
                        } else if (results.artists?.length > 0) {
                            window.location.href = `/artist-details.html?id=${results.artists[0].artist_id}`;
                        } else if (results.museums?.length > 0) {
                            window.location.href = `/museum/${results.museums[0].museum_id}`;
                        } else if (results.galleries?.length > 0) {
                            window.location.href = `/gallery/${results.galleries[0].gallery_id}`;
                        } else {
                            showNotification('No results found for: ' + query, 'warning');
                        }
                    }
                } catch (error) {
                    console.error('Search error:', error);
                    showNotification('Search error. Please try again.', 'warning');
                }
            }
            hideDropdown();
        });
    });
});

// Event section tabs
function showSection(section) {
    const sections = ['overview', 'artworks', 'exhibitors'];
    sections.forEach(s => {
        const el = document.getElementById(s + '-content');
        if (el) el.style.display = s === section ? 'block' : 'none';
    });
    // Update button active state
    document.querySelectorAll('.event-tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.color = 'inherit';
        btn.style.textDecoration = 'none';
    });
    event.target.classList.add('active');
    event.target.style.color = 'blue';
    event.target.style.textDecoration = 'underline';
}

document.addEventListener('DOMContentLoaded', function() {
    // Other DOMContentLoaded initialization if needed
});

// Function to update navbar based on login status
function updateNavbar() {
    const authButtons = document.querySelector('.auth-buttons');
    if (!authButtons) return;

    const isLoggedIn = localStorage.getItem('userEmail');

    if (isLoggedIn) {
        // Replace login/signup buttons with profile UI
        const userName = localStorage.getItem('userName') || 'User';
        const userInitials = localStorage.getItem('userInitials') || userName.charAt(0).toUpperCase();
        const userProfileImage = localStorage.getItem(getUserProfileImageKey());

        // Fetch latest user data to keep profile picture in sync
        const userId = localStorage.getItem('userId');
        const authToken = localStorage.getItem('authToken');
        if (userId && authToken) {
            fetch(`/users/${userId}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            })
            .then(res => res.json())
            .then(user => {
                if (user && user.profile_picture && user.profile_picture !== userProfileImage) {
                    localStorage.setItem(getUserProfileImageKey(), user.profile_picture);
                    // Update icons without full refresh if possible
                    const navAvatar = document.getElementById('nav-profile-avatar');
                    const mobileNavAvatar = document.getElementById('mobile-nav-profile-avatar');
                    const dropdownIcon = document.getElementById('dropdown-profile-icon');
                    const mobileDropdownIcon = document.getElementById('mobile-dropdown-profile-icon');
                    
                    const imgHtml = `<img src="${user.profile_picture}" alt="Profile" class="nav-profile-icon">`;
                    if (navAvatar) navAvatar.innerHTML = imgHtml;
                    if (mobileNavAvatar) mobileNavAvatar.innerHTML = imgHtml;
                    if (dropdownIcon) dropdownIcon.src = user.profile_picture;
                    if (mobileDropdownIcon) mobileDropdownIcon.src = user.profile_picture;
                }
            })
            .catch(err => console.error('Error syncing profile picture:', err));
        }

        // Determine profile icon HTML
        let profileIconHtml;
        if (userProfileImage) {
            profileIconHtml = `<img src="${userProfileImage}" alt="Profile" class="nav-profile-icon">`;
        } else {
            profileIconHtml = `<span style="font-size: 18px; font-weight: bold;">${userInitials}</span>`;
        }

        const isAdmin = localStorage.getItem('userRole') === 'admin';
        const adminLink = isAdmin ? '<a href="/admin-dashboard.html" class="admin-button">Admin</a>' : '';

        authButtons.innerHTML = `
            ${adminLink}
            <div class="notification-container">
                <button class="notification-bell" id="notification-bell" aria-label="View notifications">
                    <i class="fas fa-bell"></i>
                    <span class="notification-badge" id="notification-badge" style="display: none;">0</span>
                </button>
                <div class="notification-dropdown" id="notification-dropdown">
                    <div class="notification-header">
                        <h3>Notifications</h3>
                        <button class="close-notifications" id="close-notifications" aria-label="Close notifications">×</button>
                    </div>
                    <div class="notification-content">
                        <ul class="notification-list" id="notification-list">
                            <li class="notification-item"><span class="notification-empty">No notifications</span></li>
                        </ul>
                    </div>
                    <div class="notification-footer" id="notification-footer" style="display: none;">
                        <button class="mark-all-read" id="mark-all-read">Mark all as read</button>
                    </div>
                </div>
            </div>
            <div class="profile-dropdown-container">
                <a href="/profile.html" class="profile-icon" id="profile-icon-link"><div class="nav-profile-avatar" id="nav-profile-avatar">${profileIconHtml}</div></a>
                <div class="profile-dropdown">
                    <div class="profile-dropdown-header">
                        <img src="${userProfileImage || 'img/profile icon.webp'}" alt="Profile" class="dropdown-profile-icon" id="dropdown-profile-icon">
                        <div class="dropdown-profile-name">${userName}</div>
                        <a href="/profile.html" class="view-profile-btn">View Profile</a>
                    </div>
                    <div class="profile-dropdown-item">My Collection</div>
                    <a href="/profile.html#uploads" class="profile-dropdown-item">Artworks</a>
                    <div class="dropdown-divider"></div>
                    <div class="profile-dropdown-item">Favorites</div>
                    <a href="/profile.html#saved" class="profile-dropdown-item">Saves</a>
                    <a href="/profile.html#followed" class="profile-dropdown-item">Follows</a>
                    <div class="dropdown-divider"></div>
                    <div class="profile-dropdown-item settings-header">Settings</div>
                    <a href="/settings.html" class="profile-dropdown-item edit-profile-btn">Edit Profile</a>
                    <a href="#" class="profile-dropdown-item logout-item" id="logout-btn">Logout</a>
                </div>
            </div>
        `;

        // Also update mobile header icons if they exist
        const mobileHeaderIcons = document.querySelector('.mobile-header-icons');
        if (mobileHeaderIcons) {
            const mobileNotificationContainer = mobileHeaderIcons.querySelector('.notification-container');
            const mobileProfileContainer = mobileHeaderIcons.querySelector('.profile-dropdown-container');
            
            if (mobileNotificationContainer) {
                mobileNotificationContainer.innerHTML = `
                    <button class="notification-bell" id="mobile-notification-bell" aria-label="View notifications">
                        <i class="fas fa-bell"></i>
                        <span class="notification-badge" id="mobile-notification-badge" style="display: none;">0</span>
                    </button>
                    <div class="notification-dropdown" id="mobile-notification-dropdown">
                        <div class="notification-header">
                            <h3>Notifications</h3>
                            <button class="close-notifications" id="mobile-close-notifications" aria-label="Close notifications">×</button>
                        </div>
                        <div class="notification-content">
                            <ul class="notification-list" id="mobile-notification-list">
                                <li class="notification-item"><span class="notification-empty">No notifications</span></li>
                            </ul>
                        </div>
                        <div class="notification-footer" id="mobile-notification-footer" style="display: none;">
                            <button class="mark-all-read" id="mobile-mark-all-read">Mark all as read</button>
                        </div>
                    </div>
                `;
            }
            
            if (mobileProfileContainer) {
                mobileProfileContainer.innerHTML = `
                    <a href="/profile.html" class="profile-icon" id="mobile-profile-icon-link">
                        <div class="nav-profile-avatar" id="mobile-nav-profile-avatar">${profileIconHtml}</div>
                    </a>
                    <div class="profile-dropdown">
                        <div class="profile-dropdown-header">
                            <img src="${userProfileImage || 'img/profile icon.webp'}" alt="Profile" class="dropdown-profile-icon" id="mobile-dropdown-profile-icon">
                            <div class="dropdown-profile-name">${userName}</div>
                            <a href="/profile.html" class="view-profile-btn">View Profile</a>
                        </div>
                        <div class="profile-dropdown-item">My Collection</div>
                        <a href="/profile.html#uploads" class="profile-dropdown-item">Artworks</a>
                        <div class="dropdown-divider"></div>
                        <div class="profile-dropdown-item">Favorites</div>
                        <a href="/profile.html#saved" class="profile-dropdown-item">Saves</a>
                        <a href="/profile.html#followed" class="profile-dropdown-item">Follows</a>
                        <div class="dropdown-divider"></div>
                        <div class="profile-dropdown-item settings-header">Settings</div>
                        <a href="/settings.html" class="profile-dropdown-item edit-profile-btn">Edit Profile</a>
                        <a href="#" class="profile-dropdown-item mobile-logout-item" id="mobile-logout-btn">Logout</a>
                    </div>
                `;
            }
        }

        authButtons.style.display = 'flex';

        // Add event listeners for the new elements
        const profileIconLink = document.getElementById('profile-icon-link');
        const logoutBtn = document.getElementById('logout-btn');
        const savesLink = document.querySelector('a[href="#saved"]');
        const followsLink = document.querySelector('a[href="#followed"]');

        // Mobile elements
        const mobileProfileIconLink = document.getElementById('mobile-profile-icon-link');
        const mobileLogoutBtn = document.getElementById('mobile-logout-btn');

        if (profileIconLink) {
            profileIconLink.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const dropdown = this.nextElementSibling;
                if (dropdown) {
                    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
                }
            });
        }

        if (mobileProfileIconLink) {
            mobileProfileIconLink.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const dropdown = this.nextElementSibling;
                if (dropdown) {
                    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
                }
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                // Clear all authentication and user data
                localStorage.removeItem('userEmail');
                localStorage.removeItem('userPassword');
                localStorage.removeItem('userInitials');
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('userRole');
                localStorage.removeItem('userId');
                localStorage.removeItem('userName');
                localStorage.removeItem('userProfileImage');
                window.location.href = '/';
            });
        }

        if (mobileLogoutBtn) {
            mobileLogoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                // Clear all authentication and user data
                localStorage.removeItem('userEmail');
                localStorage.removeItem('userPassword');
                localStorage.removeItem('userInitials');
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('userRole');
                localStorage.removeItem('userId');
                localStorage.removeItem('userName');
                localStorage.removeItem('userProfileImage');
                window.location.href = '/';
            });
        }

        // Global handler for logout items in static HTML pages
        document.querySelectorAll('.logout-item').forEach(logoutItem => {
            logoutItem.addEventListener('click', function(e) {
                e.preventDefault();
                // Clear all authentication and user data
                localStorage.removeItem('userEmail');
                localStorage.removeItem('userPassword');
                localStorage.removeItem('userInitials');
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('userRole');
                localStorage.removeItem('userId');
                localStorage.removeItem('userName');
                localStorage.removeItem('userProfileImage');
                window.location.href = '/';
            });
        });

        // Notification bell event listeners
        const notificationBell = document.getElementById('notification-bell');
        const notificationDropdown = document.getElementById('notification-dropdown');
        const closeNotificationsBtn = document.getElementById('close-notifications');
        const markAllReadBtn = document.getElementById('mark-all-read');
        
        const mobileNotificationBell = document.getElementById('mobile-notification-bell');
        const mobileNotificationDropdown = document.getElementById('mobile-notification-dropdown');
        const mobileCloseNotificationsBtn = document.getElementById('mobile-close-notifications');
        const mobileMarkAllReadBtn = document.getElementById('mobile-mark-all-read');

        if (notificationBell) {
            notificationBell.addEventListener('click', function(e) {
                e.stopPropagation();
                if (notificationDropdown) {
                    notificationDropdown.style.display = notificationDropdown.style.display === 'block' ? 'none' : 'block';
                }
            });
        }

        if (closeNotificationsBtn) {
            closeNotificationsBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (notificationDropdown) {
                    notificationDropdown.style.display = 'none';
                }
            });
        }

        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', function() {
                markAllNotificationsAsRead();
            });
        }

        if (mobileNotificationBell) {
            mobileNotificationBell.addEventListener('click', function(e) {
                e.stopPropagation();
                if (mobileNotificationDropdown) {
                    mobileNotificationDropdown.style.display = mobileNotificationDropdown.style.display === 'block' ? 'none' : 'block';
                }
            });
        }

        if (mobileCloseNotificationsBtn) {
            mobileCloseNotificationsBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (mobileNotificationDropdown) {
                    mobileNotificationDropdown.style.display = 'none';
                }
            });
        }

        if (mobileMarkAllReadBtn) {
            mobileMarkAllReadBtn.addEventListener('click', function() {
                markAllNotificationsAsRead();
            });
        }

        if (savesLink) {
            savesLink.addEventListener('click', function(e) {
                e.preventDefault();
                window.location.href = '/profile.html#saved';
            });
        }

        if (followsLink) {
            followsLink.addEventListener('click', function(e) {
                e.preventDefault();
                window.location.href = '/profile.html#followed';
            });
        }

        // Close dropdowns when clicking outside
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.profile-dropdown-container') && !e.target.closest('.notification-container')) {
                const dropdowns = document.querySelectorAll('.profile-dropdown');
                dropdowns.forEach(dropdown => dropdown.style.display = 'none');
                const notifDropdowns = document.querySelectorAll('.notification-dropdown');
                notifDropdowns.forEach(dropdown => dropdown.style.display = 'none');
            }
        });

        // Load notifications for logged-in users
        if (isLoggedIn) {
            loadNotifications();
            // Poll for new notifications every 5 seconds
            setInterval(loadNotifications, 5000);
            // Update notification times every 60 seconds
            setInterval(updateNotificationTimes, 60000);
            
            // Listen for socket notifications
            if (typeof io !== 'undefined') {
                const socket = io();
                socket.on('new_notification', function(notification) {
                    console.log('New notification received:', notification);
                    loadNotifications();
                });
            }
        }
    } else {
        // User is not logged in - show login/signup buttons
        authButtons.innerHTML = `
            <button type="button" class="login-link">Login</button>
            <button type="button" class="signup-btn">Signup</button>
        `;
        authButtons.style.display = 'flex';

        // Hide profile dropdown but keep hamburger menu visible
        const mobileHeaderIcons = document.querySelector('.mobile-header-icons');
        if (mobileHeaderIcons) {
            mobileHeaderIcons.style.display = '';
            const profileContainer = mobileHeaderIcons.querySelector('.profile-dropdown-container');
            const notificationContainer = mobileHeaderIcons.querySelector('.notification-container');
            if (profileContainer) profileContainer.style.display = 'none';
            if (notificationContainer) notificationContainer.style.display = 'none';
        }

        // Add event listeners for login/signup
        const loginLink = authButtons.querySelector('.login-link');
        const signupBtn = authButtons.querySelector('.signup-btn');

        if (loginLink) {
            loginLink.addEventListener('click', function(e) {
                e.preventDefault();
                openModal();
                openTab('login');
            });
        }

        if (signupBtn) {
            signupBtn.addEventListener('click', function(e) {
                e.preventDefault();
                openModal();
                openTab('signup');
            });
        }
    }
}

function loadNotifications() {
    fetch('/notifications')
        .then(res => res.json())
        .then(data => {
            const notifications = data || [];
            const unreadCount = notifications.filter(n => !n.is_read).length;
            updateNotificationUI(notifications, unreadCount);
        })
        .catch(err => console.error('Error loading notifications:', err));
}

function updateNotificationUI(notifications, unreadCount) {
    const badge = document.getElementById('notification-badge');
    const mobileBadge = document.getElementById('mobile-notification-badge');
    const list = document.getElementById('notification-list');
    const mobileList = document.getElementById('mobile-notification-list');
    const footer = document.getElementById('notification-footer');
    const mobileFooter = document.getElementById('mobile-notification-footer');

    if (unreadCount > 0) {
        if (badge) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.style.display = 'block';
        }
        if (mobileBadge) {
            mobileBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            mobileBadge.style.display = 'block';
        }
    } else {
        if (badge) badge.style.display = 'none';
        if (mobileBadge) mobileBadge.style.display = 'none';
    }

    if (notifications.length === 0) {
        const emptyHtml = '<li class="notification-item"><span class="notification-empty">No notifications</span></li>';
        if (list) list.innerHTML = emptyHtml;
        if (mobileList) mobileList.innerHTML = emptyHtml;
        if (footer) footer.style.display = 'none';
        if (mobileFooter) mobileFooter.style.display = 'none';
    } else {
        const html = notifications.map(notif => `
            <li class="notification-item ${notif.is_read ? '' : 'unread'}" data-id="${notif.notification_id}" data-type="${notif.related_item_type || ''}" data-item-id="${notif.related_item_id || ''}" data-created="${notif.created_at}">
                <div class="notification-item-content">
                    <div class="notification-item-message">${escapeHtml(notif.message)}</div>
                    <div class="notification-item-time">${formatTime(notif.created_at)}</div>
                </div>
            </li>
        `).join('');
        
        if (list) {
            list.innerHTML = html;
            list.querySelectorAll('.notification-item').forEach(item => {
                item.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    const type = this.getAttribute('data-type');
                    const itemId = this.getAttribute('data-item-id');
                    markNotificationAsRead(id);
                    navigateToNotificationItem(type, itemId);
                });
            });
        }
        
        if (mobileList) {
            mobileList.innerHTML = html;
            mobileList.querySelectorAll('.notification-item').forEach(item => {
                item.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    const type = this.getAttribute('data-type');
                    markNotificationAsRead(id);
                    navigateToNotificationItem(type);
                });
            });
        }
        
        if (footer && unreadCount > 0) footer.style.display = 'block';
        if (mobileFooter && unreadCount > 0) mobileFooter.style.display = 'block';
        
        updateNotificationTimes();
    }
}

function markNotificationAsRead(notificationId) {
    fetch(`/notifications/${notificationId}/read`, { method: 'PUT' })
        .catch(err => console.error('Error marking notification as read:', err));
}

function markAllNotificationsAsRead() {
    fetch('/notifications/mark-all-read', { method: 'PUT' })
        .then(() => loadNotifications())
        .catch(err => console.error('Error marking all notifications as read:', err));
}

function navigateToNotificationItem(type, itemId) {
    const pageMap = {
        'Artist': 'artist-details.html',
        'Artwork': 'artwork-details.html',
        'Museum': 'museums.html',
        'Gallery': 'galleries.html',
        'Event': 'event-details.html'
    };

    const page = pageMap[type];
    if (page && itemId) {
        window.location.href = `${page}?id=${itemId}`;
    } else if (page) {
        window.location.href = page;
    }
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function formatTime(dateString) {
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

function updateNotificationTimes() {
    const timeElements = document.querySelectorAll('.notification-item-time');
    timeElements.forEach(el => {
        const createdAt = el.closest('.notification-item').getAttribute('data-created');
        if (createdAt) {
            el.textContent = formatTime(createdAt);
        }
    });
}

// Newsletter subscription
document.addEventListener('DOMContentLoaded', function() {
    const newsletterForm = document.querySelector('.newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const emailInput = this.querySelector('input[type="email"]');
            const email = emailInput.value.trim();

            if (!email) {
                showNotification('Please enter a valid email address.', 'error');
                return;
            }

            // Here you would typically send the email to your backend
            // For now, we'll just show a success message
            showNotification('Thank you for subscribing! You will receive updates about new artworks and events.', 'success');
            emailInput.value = '';
        });
    }
});

// Notification system
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification-toast');
    existingNotifications.forEach(notification => notification.remove());

    // Create new notification
    const notification = document.createElement('div');
    notification.className = `notification-toast ${type}`;
    notification.innerHTML = `
        <i class="fas ${getNotificationIcon(type)}"></i>
        <span>${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);

    // Auto-hide after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        default: return 'fa-info-circle';
    }
}

// Add notification styles dynamically
const notificationStyles = `
    .notification-toast {
        position: fixed;
        top: 100px;
        right: 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        padding: 1rem 1.5rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        z-index: 10000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 400px;
        border-left: 4px solid #007bff;
    }

    .notification-toast.show {
        transform: translateX(0);
    }

    .notification-toast.success { border-left-color: #28a745; }
    .notification-toast.error { border-left-color: #dc3545; }
    .notification-toast.warning { border-left-color: #ffc107; }
    .notification-toast.info { border-left-color: #007bff; }

    .notification-toast i {
        font-size: 1.2rem;
        flex-shrink: 0;
    }

    .notification-toast.success i { color: #28a745; }
    .notification-toast.error i { color: #dc3545; }
    .notification-toast.warning i { color: #d39e00; }
    .notification-toast.info i { color: #007bff; }

    .notification-close {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #666;
        padding: 0;
        margin-left: auto;
    }

    .notification-close:hover {
        color: #333;
    }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);

function openArtifactModal(artifactId) {
    console.log('Opening artifact modal for ID:', artifactId);
    const modal = document.getElementById('artifact-modal');
    if (!modal) {
        console.error('Artifact modal not found');
        return;
    }

    fetch(`/artifacts/${artifactId}`)
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch artifact');
            return response.json();
        })
        .then(artifact => {
            console.log('Loaded artifact:', artifact);
            // Ensure image URL starts with / for absolute path
            let imageUrl = artifact.image_url || '/img/art1.jpg';
            if (imageUrl && !imageUrl.startsWith('/') && !imageUrl.startsWith('http')) {
                imageUrl = '/' + imageUrl;
            }
            document.getElementById('artifact-modal-image').src = imageUrl;
            document.getElementById('artifact-modal-image').alt = artifact.name;
            document.getElementById('artifact-modal-name').textContent = artifact.name;
            document.getElementById('artifact-modal-artist').textContent = artifact.artist || 'N/A';
            document.getElementById('artifact-modal-type').textContent = artifact.type || 'N/A';
            document.getElementById('artifact-modal-medium').textContent = artifact.medium || 'N/A';
            document.getElementById('artifact-modal-year').textContent = artifact.year || 'N/A';
            document.getElementById('artifact-modal-dimensions').textContent = artifact.dimensions || 'N/A';
            document.getElementById('artifact-modal-weight').textContent = artifact.weight || 'N/A';
            document.getElementById('artifact-modal-location').textContent = artifact.location || 'N/A';
            document.getElementById('artifact-modal-condition').textContent = artifact.condition || 'N/A';
            document.getElementById('artifact-modal-status').textContent = artifact.status || 'N/A';
            document.getElementById('artifact-modal-details').textContent = artifact.details || 'No description available.';

            modal.style.display = 'flex';
            modal.style.zIndex = '10000';

            // Position modal at current scroll position
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.style.top = (window.scrollY + 20) + 'px';
            }

            setTimeout(() => modal.classList.add('show'), 10);
            document.body.classList.add('no-scroll');
            modal.setAttribute('aria-hidden', 'false');
            console.log('Modal displayed');
        })
        .catch(error => {
            console.error('Error loading artifact:', error);
            alert('Error loading artifact details. Please try again.');
        });
}

function closeArtifactModal() {
    const modal = document.getElementById('artifact-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.classList.remove('no-scroll');
        }, 300);
        modal.setAttribute('aria-hidden', 'true');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const artifactModal = document.getElementById('artifact-modal');
    if (artifactModal) {
        artifactModal.addEventListener('click', function(event) {
            if (event.target === this) {
                closeArtifactModal();
            }
        });
    }

    document.addEventListener('keydown', function(event) {
        const modal = document.getElementById('artifact-modal');
        if (event.key === 'Escape' && modal && modal.classList.contains('show')) {
            closeArtifactModal();
        }
    });

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const errorDiv = document.getElementById('login-error');

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                if (data.success) {
                    localStorage.setItem('authToken', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    localStorage.setItem('userId', data.user.id);
                    localStorage.setItem('userEmail', data.user.email);
                    localStorage.setItem('isLoggedIn', 'true');
                    localStorage.setItem('userRole', data.user.role || 'user');
                    
                    const fullName = `${data.user.first_name || ''} ${data.user.last_name || ''}`.trim();
                    localStorage.setItem('userName', fullName || 'User');
                    
                    const nameParts = (fullName || 'User').split(' ');
                    const initials = (nameParts[0][0] + (nameParts.length > 1 ? nameParts[nameParts.length - 1][0] : '')).toUpperCase();
                    localStorage.setItem('userInitials', initials);

                    closeModal();
                    
                    if (data.user.role === 'admin') {
                        window.location.href = '/admin-dashboard.html';
                    } else {
                        location.reload();
                    }
                } else {
                    errorDiv.textContent = data.message || 'Login failed';
                    errorDiv.style.display = 'block';
                }
            } catch (error) {
                errorDiv.textContent = 'Login error: ' + error.message;
                errorDiv.style.display = 'block';
            }
        });
    }

    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const confirmPassword = document.getElementById('signup-confirm-password').value;
            const errorDiv = document.getElementById('signup-error');

            if (password !== confirmPassword) {
                errorDiv.textContent = 'Passwords do not match';
                errorDiv.style.display = 'block';
                return;
            }

            const passwordCheck = validatePassword(password);
            if (!passwordCheck.valid) {
                errorDiv.textContent = passwordCheck.message;
                errorDiv.style.display = 'block';
                return;
            }

            const [first_name, last_name] = name.split(' ').length > 1 ? name.split(' ') : [name, ''];

            try {
                const response = await fetch('/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, first_name, last_name })
                });
                
                const data = await response.json();
                if (data.success) {
                    localStorage.setItem('authToken', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    localStorage.setItem('userId', data.user.id);
                    localStorage.setItem('userEmail', data.user.email);
                    localStorage.setItem('isLoggedIn', 'true');
                    localStorage.setItem('userRole', data.user.role || 'user');
                    
                    const fullName = `${data.user.first_name || ''} ${data.user.last_name || ''}`.trim();
                    localStorage.setItem('userName', fullName || 'User');
                    
                    const nameParts = (fullName || 'User').split(' ');
                    const initials = (nameParts[0][0] + (nameParts.length > 1 ? nameParts[nameParts.length - 1][0] : '')).toUpperCase();
                    localStorage.setItem('userInitials', initials);

                    closeModal();
                    
                    if (data.user.role === 'admin') {
                        window.location.href = '/admin-dashboard.html';
                    } else {
                        location.reload();
                    }
                } else {
                    errorDiv.textContent = data.message || 'Signup failed';
                    errorDiv.style.display = 'block';
                }
            } catch (error) {
                errorDiv.textContent = 'Signup error: ' + error.message;
                errorDiv.style.display = 'block';
            }
        });
    }

    const authToken = localStorage.getItem('authToken');
});

