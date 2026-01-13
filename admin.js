// Admin Dashboard JavaScript

// Global variables

// Global function definitions for form submission callbacks
function loadMuseums() {
    fetch('/museums')
        .then(response => response.json())
        .then(museums => {
            allAdminMuseums = museums;
            displayAdminMuseums(museums);
        })
        .catch(error => {
            console.error('Error loading museums:', error);
            document.querySelector('#museums-table tbody').innerHTML = '<tr><td colspan="6">Error loading museums</td></tr>';
        });
}

// Global data storage
let allAdminCollections = [];
let allAdminUsers = [];
let allAdminArtists = [];
let allAdminArtworks = [];
let allAdminGalleries = [];
let allAdminGalleryFeatured = [];
let allAdminMuseums = [];
let allAdminEvents = [];
let allAdminVideos = [];
let allAdminArtifacts = [];

function loadCollections() {
    fetch('/collections')
        .then(response => response.json())
        .then(collections => {
            allAdminCollections = collections;
            displayAdminCollections(collections);
            updateCollectionStats(collections);
        })
        .catch(error => {
            console.error('Error loading collections:', error);
            document.querySelector('#collections-table tbody').innerHTML = '<tr><td colspan="7">Error loading collections</td></tr>';
        });
}

// Galleries management
function loadGalleries() {
    fetch('/galleries')
        .then(response => response.json())
        .then(galleries => {
            allAdminGalleries = galleries;
            displayAdminGalleries(galleries);
        })
        .catch(error => {
            console.error('Error loading galleries:', error);
            document.querySelector('#galleries-table tbody').innerHTML = '<tr><td colspan="7">Error loading galleries</td></tr>';
        });
}

// Artists management
function loadArtists() {
    fetch('/artists')
        .then(response => response.json())
        .then(artists => {
            allAdminArtists = artists;
            displayAdminArtists(artists);
        })
        .catch(error => {
            console.error('Error loading artists:', error);
            document.querySelector('#artists-table tbody').innerHTML = '<tr><td colspan="7">Error loading artists</td></tr>';
        });
}

// Load featured galleries for dashboard
function loadDashboardGalleries() {
    fetch('/galleries/featured?_limit=4')
        .then(response => response.json())
        .then(galleries => {
            const container = document.getElementById('recent-galleries');
            container.innerHTML = galleries.slice(0, 4).map(gallery => `
                <div class="dashboard-card">
                    <img src="${gallery.image_url || '/img/gallery 2.jpg'}" alt="${gallery.name}">
                    <div class="dashboard-card-content">
                        <h3>${gallery.name}</h3>
                        <p>${gallery.location || 'Location not specified'}</p>
                    </div>
                </div>
            `).join('');
        })
        .catch(error => {
            console.error('Error loading dashboard galleries:', error);
            document.getElementById('recent-galleries').innerHTML = '<div class="loading">Error loading galleries</div>';
        });
}

// Load featured artists for dashboard
function loadDashboardArtists() {
    fetch('/artists/featured')
        .then(response => response.json())
        .then(artists => {
            const container = document.getElementById('featured-artists');
            container.innerHTML = artists.slice(0, 4).map(artist => `
                <div class="dashboard-card">
                    <img src="${artist.photo_url || '/img/profile icon.webp'}" alt="${artist.name}">
                    <div class="dashboard-card-content">
                        <h3>${artist.name}</h3>
                        <p>${artist.category || 'Artist'}</p>
                    </div>
                </div>
            `).join('');
        })
        .catch(error => {
            console.error('Error loading dashboard artists:', error);
            document.getElementById('featured-artists').innerHTML = '<div class="loading">Error loading artists</div>';
        });
}

// Load featured artworks for dashboard
function loadDashboardArtworks() {
    fetch('/artworks/featured?_limit=4')
        .then(response => response.json())
        .then(artworks => {
            const container = document.getElementById('recent-artworks');
            container.innerHTML = artworks.slice(0, 4).map(artwork => `
                <div class="dashboard-card">
                    <img src="${artwork.image_url || '/img/art1.jpg'}" alt="${artwork.title}" onclick="viewArtworkDetails(${artwork.artwork_id})" style="cursor: pointer;">
                    <div class="dashboard-card-content">
                        <h3 onclick="viewArtworkDetails(${artwork.artwork_id})" style="cursor: pointer;">${artwork.title}</h3>
                        <p>By ${artwork.artist_name || 'Unknown Artist'}</p>
                    </div>
                </div>
            `).join('');
        })
        .catch(error => {
            console.error('Error loading dashboard artworks:', error);
            document.getElementById('recent-artworks').innerHTML = '<div class="loading">Error loading artworks</div>';
        });
}

// Artworks management
function loadArtworks() {
    fetch('/artworks')
        .then(response => response.json())
        .then(artworks => {
            allAdminArtworks = artworks;
            displayAdminArtworks(artworks);
        })
        .catch(error => {
            console.error('Error loading artworks:', error);
            document.querySelector('#artworks-table tbody').innerHTML = '<tr><td colspan="8">Error loading artworks</td></tr>';
        });
}

function displayAdminCollections(collections) {
    const tbody = document.querySelector('#collections-table tbody');

    if (collections.length > 0) {
        tbody.innerHTML = collections.map(collection => {
            const isRecent = isRecentCollection(collection.created_at);
            return `
                <tr>
                    <td>${collection.collection_id}</td>
                    <td>
                        <img src="${collection.image_url || '/img/art1.jpg'}" alt="${collection.name}" class="collection-thumbnail">
                    </td>
                    <td>
                        <div class="collection-info">
                            <div>
                                <div class="collection-name-cell">${collection.name}</div>
                                ${isRecent ? '<span class="recent-indicator">NEW</span>' : ''}
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="collector-badge">${collection.collector_name || 'Anonymous'}</span>
                    </td>
                    <td>
                        <div class="collection-description-preview" title="${collection.about || ''}">
                            ${collection.about || 'No description'}
                        </div>
                    </td>
                    <td>${formatDate(collection.created_at)}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-secondary btn-sm" onclick="editCollection(${collection.collection_id})">Edit</button>
                            <button class="btn btn-danger btn-sm" onclick="deleteCollection(${collection.collection_id})">Delete</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="7" class="no-results">No collections found</td></tr>';
    }
}

function updateCollectionStats(collections) {
    const totalCollections = collections.length;
    const activeCollections = collections.length; // Assuming all are active for now
    const recentCollections = collections.filter(c => isRecentCollection(c.created_at)).length;

    document.getElementById('admin-total-collections').textContent = totalCollections;
    document.getElementById('admin-active-collections').textContent = activeCollections;
    document.getElementById('admin-recent-collections').textContent = recentCollections;
}

function isRecentCollection(dateString) {
    if (!dateString) return false;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30; // Consider recent if added within last 30 days
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

// Collection search functionality
function setupCollectionSearch() {
    const searchInput = document.getElementById('admin-collection-search');
    if (searchInput) {
        searchInput.addEventListener('input', filterAdminCollections);
    }
}

function filterAdminCollections() {
    const searchInput = document.getElementById('admin-collection-search');
    if (!searchInput) return;

    const searchTerm = searchInput.value.toLowerCase().trim();

    if (!searchTerm) {
        displayAdminCollections(allAdminCollections);
        return;
    }

    const filteredCollections = allAdminCollections.filter(collection => {
        const name = (collection.name || '').toLowerCase();
        const collectorName = (collection.collector_name || '').toLowerCase();
        const about = (collection.about || '').toLowerCase();

        return name.includes(searchTerm) ||
               collectorName.includes(searchTerm) ||
               about.includes(searchTerm);
    });

    displayAdminCollections(filteredCollections);
}

function clearCollectionSearch() {
    const searchInput = document.getElementById('admin-collection-search');
    if (searchInput) {
        searchInput.value = '';
        filterAdminCollections();
    }
}

// User search functionality
function setupUserSearch() {
    const searchInput = document.getElementById('admin-user-search');
    if (searchInput) {
        searchInput.addEventListener('input', filterAdminUsers);
    }
}

function filterAdminUsers() {
    const searchInput = document.getElementById('admin-user-search');
    if (!searchInput) return;

    const searchTerm = searchInput.value.toLowerCase().trim();

    if (!searchTerm) {
        displayAdminUsers(allAdminUsers);
        return;
    }

    const filteredUsers = allAdminUsers.filter(user => {
        const email = (user.email || '').toLowerCase();
        const role = (user.role || '').toLowerCase();

        return email.includes(searchTerm) || role.includes(searchTerm);
    });

    displayAdminUsers(filteredUsers);
}

function clearUserSearch() {
    const searchInput = document.getElementById('admin-user-search');
    if (searchInput) {
        searchInput.value = '';
        filterAdminUsers();
    }
}

function displayAdminUsers(users) {
    const tbody = document.querySelector('#users-table tbody');
    if (!tbody) return;

    if (users.length > 0) {
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.user_id}</td>
                <td>${user.email}</td>
                <td>${user.role}</td>
                <td>${user.is_active ? 'Active' : 'Inactive'}</td>
                <td>${user.created_at ? new Date(user.created_at).toLocaleDateString() : ''}</td>
                <td>
                    <button class="btn btn-secondary" onclick="editUser(${user.user_id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteUser(${user.user_id})">Delete</button>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="6" class="no-results">No users found</td></tr>';
    }
}

// Artists Search Logic
function setupArtistSearch() {
    const searchInput = document.getElementById('admin-artist-search');
    if (searchInput) {
        searchInput.addEventListener('input', filterAdminArtists);
    }
}

function filterAdminArtists() {
    const searchInput = document.getElementById('admin-artist-search');
    if (!searchInput) return;

    const searchTerm = searchInput.value.toLowerCase().trim();

    if (!searchTerm) {
        displayAdminArtists(allAdminArtists);
        return;
    }

    const filteredArtists = allAdminArtists.filter(artist => {
        const name = (artist.name || '').toLowerCase();
        const email = (artist.email || '').toLowerCase();
        const category = (artist.category || '').toLowerCase();
        const location = (artist.location || '').toLowerCase();

        return name.includes(searchTerm) || 
               email.includes(searchTerm) || 
               category.includes(searchTerm) || 
               location.includes(searchTerm);
    });

    displayAdminArtists(filteredArtists);
}

function clearArtistSearch() {
    const searchInput = document.getElementById('admin-artist-search');
    if (searchInput) {
        searchInput.value = '';
        filterAdminArtists();
    }
}

function displayAdminArtists(artists) {
    const tbody = document.querySelector('#artists-table tbody');
    if (!tbody) return;

    if (artists.length > 0) {
        tbody.innerHTML = artists.map(artist => `
            <tr>
                <td>${artist.artist_id}</td>
                <td>${artist.name}</td>
                <td>${artist.email || ''}</td>
                <td>${artist.location || ''}</td>
                <td>${artist.category || ''}</td>
                <td>${artist.is_featured ? 'Yes' : 'No'}</td>
                <td>
                    <button class="btn btn-secondary" onclick="editArtist(${artist.artist_id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteArtist(${artist.artist_id})">Delete</button>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="7" class="no-results">No artists found</td></tr>';
    }
}

// Artworks Search Logic
function setupArtworkSearch() {
    const searchInput = document.getElementById('admin-artwork-search');
    if (searchInput) {
        searchInput.addEventListener('input', filterAdminArtworks);
    }
}

function filterAdminArtworks() {
    const searchInput = document.getElementById('admin-artwork-search');
    if (!searchInput) return;

    const searchTerm = searchInput.value.toLowerCase().trim();

    if (!searchTerm) {
        displayAdminArtworks(allAdminArtworks);
        return;
    }

    const filteredArtworks = allAdminArtworks.filter(artwork => {
        const title = (artwork.title || '').toLowerCase();
        const artist = (artwork.artist_name || '').toLowerCase();
        const category = (artwork.categories || '').toLowerCase();

        return title.includes(searchTerm) || 
               artist.includes(searchTerm) || 
               category.includes(searchTerm);
    });

    displayAdminArtworks(filteredArtworks);
}

function clearArtworkSearch() {
    const searchInput = document.getElementById('admin-artwork-search');
    if (searchInput) {
        searchInput.value = '';
        filterAdminArtworks();
    }
}

function displayAdminArtworks(artworks) {
    const tbody = document.querySelector('#artworks-table tbody');
    if (!tbody) return;

    if (artworks.length > 0) {
        tbody.innerHTML = artworks.map(artwork => `
            <tr>
                <td>${artwork.artwork_id}</td>
                <td>${artwork.title}</td>
                <td>${artwork.artist_name || ''}</td>
                <td>${artwork.categories || ''}</td>
                <td>${artwork.year || ''}</td>
                <td>${artwork.is_available ? 'Yes' : 'No'}</td>
                <td>${artwork.is_featured ? 'Yes' : 'No'}</td>
                <td>
                    <button class="btn btn-secondary" onclick="editArtwork(${artwork.artwork_id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteArtwork(${artwork.artwork_id})">Delete</button>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="8" class="no-results">No artworks found</td></tr>';
    }
}

// Galleries Search Logic
function setupGallerySearch() {
    const searchInput = document.getElementById('admin-gallery-search');
    if (searchInput) {
        searchInput.addEventListener('input', filterAdminGalleries);
    }
}

function filterAdminGalleries() {
    const searchInput = document.getElementById('admin-gallery-search');
    if (!searchInput) return;

    const searchTerm = searchInput.value.toLowerCase().trim();

    if (!searchTerm) {
        displayAdminGalleries(allAdminGalleries);
        return;
    }

    const filteredGalleries = allAdminGalleries.filter(gallery => {
        const name = (gallery.name || '').toLowerCase();
        const location = (gallery.location || '').toLowerCase();
        const type = (gallery.type || '').toLowerCase();
        const email = (gallery.email || '').toLowerCase();

        return name.includes(searchTerm) || 
               location.includes(searchTerm) || 
               type.includes(searchTerm) || 
               email.includes(searchTerm);
    });

    displayAdminGalleries(filteredGalleries);
}

function clearGallerySearch() {
    const searchInput = document.getElementById('admin-gallery-search');
    if (searchInput) {
        searchInput.value = '';
        filterAdminGalleries();
    }
}

function displayAdminGalleries(galleries) {
    const tbody = document.querySelector('#galleries-table tbody');
    if (!tbody) return;

    if (galleries.length > 0) {
        tbody.innerHTML = galleries.map(gallery => `
            <tr>
                <td>${gallery.gallery_id}</td>
                <td>${gallery.name}</td>
                <td>${gallery.location || ''}</td>
                <td>${gallery.type || ''}</td>
                <td>${gallery.email || ''}</td>
                <td>${gallery.is_featured ? 'Yes' : 'No'}</td>
                <td>
                    <button class="btn btn-secondary" onclick="editGallery(${gallery.gallery_id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteGallery(${gallery.gallery_id})">Delete</button>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="7" class="no-results">No galleries found</td></tr>';
    }
}

// Gallery Featured Search Logic
function setupGalleryFeaturedSearch() {
    const searchInput = document.getElementById('admin-gallery-featured-search');
    if (searchInput) {
        searchInput.addEventListener('input', filterAdminGalleryFeatured);
    }
}

function filterAdminGalleryFeatured() {
    const searchInput = document.getElementById('admin-gallery-featured-search');
    if (!searchInput) return;

    const searchTerm = searchInput.value.toLowerCase().trim();

    if (!searchTerm) {
        displayAdminGalleryFeatured(allAdminGalleryFeatured);
        return;
    }

    const filtered = allAdminGalleryFeatured.filter(item => {
        const galleryName = (item.gallery_name || '').toLowerCase();
        const title = (item.title || '').toLowerCase();
        const description = (item.description || '').toLowerCase();

        return galleryName.includes(searchTerm) || 
               title.includes(searchTerm) || 
               description.includes(searchTerm);
    });

    displayAdminGalleryFeatured(filtered);
}

function clearGalleryFeaturedSearch() {
    const searchInput = document.getElementById('admin-gallery-featured-search');
    if (searchInput) {
        searchInput.value = '';
        filterAdminGalleryFeatured();
    }
}

function displayAdminGalleryFeatured(artworks) {
    const tbody = document.querySelector('#gallery-featured-table tbody');
    if (!tbody) return;

    if (artworks.length > 0) {
        tbody.innerHTML = artworks.map(artwork => `
            <tr>
                <td>${artwork.gallery_featured_id}</td>
                <td>${artwork.gallery_id}</td>
                <td>${artwork.gallery_name || 'Unknown Gallery'}</td>
                <td>${artwork.title}</td>
                <td>${artwork.description || ''}</td>
                <td>${artwork.display_order || 0}</td>
                <td>
                    <button class="btn btn-secondary" onclick="editGalleryFeaturedArtwork(${artwork.gallery_featured_id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteGalleryFeaturedArtwork(${artwork.gallery_featured_id})">Delete</button>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="7" class="no-results">No featured artworks found</td></tr>';
    }
}

// Museums Search Logic
function setupMuseumSearch() {
    const searchInput = document.getElementById('admin-museum-search');
    if (searchInput) {
        searchInput.addEventListener('input', filterAdminMuseums);
    }
}

function filterAdminMuseums() {
    const searchInput = document.getElementById('admin-museum-search');
    if (!searchInput) return;

    const searchTerm = searchInput.value.toLowerCase().trim();

    if (!searchTerm) {
        displayAdminMuseums(allAdminMuseums);
        return;
    }

    const filtered = allAdminMuseums.filter(museum => {
        const name = (museum.name || '').toLowerCase();
        const location = (museum.location || '').toLowerCase();
        const email = (museum.email || '').toLowerCase();

        return name.includes(searchTerm) || 
               location.includes(searchTerm) || 
               email.includes(searchTerm);
    });

    displayAdminMuseums(filtered);
}

function clearMuseumSearch() {
    const searchInput = document.getElementById('admin-museum-search');
    if (searchInput) {
        searchInput.value = '';
        filterAdminMuseums();
    }
}

function displayAdminMuseums(museums) {
    const tbody = document.querySelector('#museums-table tbody');
    if (!tbody) return;

    if (museums.length > 0) {
        tbody.innerHTML = museums.map(museum => `
            <tr>
                <td>${museum.museum_id}</td>
                <td>${museum.name}</td>
                <td>${museum.location || ''}</td>
                <td>${museum.contact_info || ''}</td>
                <td>${museum.is_featured ? 'Yes' : 'No'}</td>
                <td>${museum.website ? `<a href="${museum.website}" target="_blank">Link</a>` : ''}</td>
                <td>
                    <button class="btn btn-secondary" onclick="editMuseum(${museum.museum_id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteMuseum(${museum.museum_id})">Delete</button>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="7" class="no-results">No museums found</td></tr>';
    }
}

// Events Search Logic
function setupEventSearch() {
    const searchInput = document.getElementById('admin-event-search');
    if (searchInput) {
        searchInput.addEventListener('input', filterAdminEvents);
    }
}

function filterAdminEvents() {
    const searchInput = document.getElementById('admin-event-search');
    if (!searchInput) return;

    const searchTerm = searchInput.value.toLowerCase().trim();

    if (!searchTerm) {
        displayAdminEvents(allAdminEvents);
        return;
    }

    const filtered = allAdminEvents.filter(event => {
        const name = (event.name || '').toLowerCase();
        const location = (event.location || '').toLowerCase();
        const status = (event.status || '').toLowerCase();

        return name.includes(searchTerm) || 
               location.includes(searchTerm) || 
               status.includes(searchTerm);
    });

    displayAdminEvents(filtered);
}

function clearEventSearch() {
    const searchInput = document.getElementById('admin-event-search');
    if (searchInput) {
        searchInput.value = '';
        filterAdminEvents();
    }
}

function displayAdminEvents(events) {
    const tbody = document.querySelector('#events-table tbody');
    if (!tbody) return;

    if (events.length > 0) {
        tbody.innerHTML = events.map(event => `
            <tr>
                <td>${event.event_id}</td>
                <td>${event.name}</td>
                <td>${event.date ? new Date(event.date).toLocaleDateString() : ''}</td>
                <td>${event.location || ''}</td>
                <td>${event.status || ''}</td>
                <td>
                    <button class="btn btn-secondary" onclick="editEvent(${event.event_id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteEvent(${event.event_id})">Delete</button>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="6" class="no-results">No events found</td></tr>';
    }
}

// Videos Search Logic
function setupVideoSearch() {
    const searchInput = document.getElementById('admin-video-search');
    if (searchInput) {
        searchInput.addEventListener('input', filterAdminVideos);
    }
}

function filterAdminVideos() {
    const searchInput = document.getElementById('admin-video-search');
    if (!searchInput) return;

    const searchTerm = searchInput.value.toLowerCase().trim();

    if (!searchTerm) {
        displayAdminVideos(allAdminVideos);
        return;
    }

    const filtered = allAdminVideos.filter(video => {
        const title = (video.title || '').toLowerCase();
        const details = (video.details || '').toLowerCase();

        return title.includes(searchTerm) || 
               details.includes(searchTerm);
    });

    displayAdminVideos(filtered);
}

function clearVideoSearch() {
    const searchInput = document.getElementById('admin-video-search');
    if (searchInput) {
        searchInput.value = '';
        filterAdminVideos();
    }
}

function displayAdminVideos(videos) {
    const tbody = document.querySelector('#videos-table tbody');
    if (!tbody) return;

    if (videos.length > 0) {
        tbody.innerHTML = videos.map(video => `
            <tr>
                <td>${video.video_id}</td>
                <td>${video.title}</td>
                <td>${video.details || ''}</td>
                <td>
                    <button class="btn btn-secondary" onclick="editVideo(${video.video_id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteVideo(${video.video_id})">Delete</button>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="4" class="no-results">No videos found</td></tr>';
    }
}

// Artifacts Search Logic
function setupArtifactSearch() {
    const searchInput = document.getElementById('admin-artifact-search');
    if (searchInput) {
        searchInput.addEventListener('input', filterAdminArtifacts);
    }
}

function filterAdminArtifacts() {
    const searchInput = document.getElementById('admin-artifact-search');
    if (!searchInput) return;

    const searchTerm = searchInput.value.toLowerCase().trim();

    if (!searchTerm) {
        displayAdminArtifacts(allAdminArtifacts);
        return;
    }

    const filtered = allAdminArtifacts.filter(artifact => {
        const name = (artifact.name || '').toLowerCase();
        const artist = (artifact.artist || '').toLowerCase();
        const type = (artifact.type || '').toLowerCase();
        const museumId = (artifact.museum_id || '').toString();

        return name.includes(searchTerm) || 
               artist.includes(searchTerm) || 
               type.includes(searchTerm) ||
               museumId.includes(searchTerm);
    });

    displayAdminArtifacts(filtered);
}

function clearArtifactSearch() {
    const searchInput = document.getElementById('admin-artifact-search');
    if (searchInput) {
        searchInput.value = '';
        filterAdminArtifacts();
    }
}

function displayAdminArtifacts(artifacts) {
    const tbody = document.querySelector('#artifacts-table tbody');
    if (!tbody) return;

    if (artifacts.length > 0) {
        tbody.innerHTML = artifacts.map(artifact => `
            <tr>
                <td>${artifact.artifact_id}</td>
                <td>${artifact.name}</td>
                <td>${artifact.museum_id || ''}</td>
                <td>${artifact.artist || ''}</td>
                <td>${artifact.type || ''}</td>
                <td>${artifact.year || ''}</td>
                <td>${artifact.status || 'Active'}</td>
                <td>
                    <button class="btn btn-secondary" onclick="editArtifact(${artifact.artifact_id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteArtifact(${artifact.artifact_id})">Delete</button>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="8" class="no-results">No artifacts found</td></tr>';
    }
}

function loadDashboardMuseums() {
    fetch('/museums/featured?_limit=4')
        .then(response => response.json())
        .then(museums => {
            const container = document.getElementById('recent-museums');
            container.innerHTML = museums.slice(0, 4).map(museum => `
                <div class="dashboard-card">
                    <img src="${museum.image_url || '/img/museum.jpg'}" alt="${museum.name}">
                    <div class="dashboard-card-content">
                        <h3>${museum.name}</h3>
                        <p>${museum.location || 'Location not specified'}</p>
                    </div>
                </div>
            `).join('');
        })
        .catch(error => {
            console.error('Error loading dashboard museums:', error);
            document.getElementById('recent-museums').innerHTML = '<div class="loading">Error loading museums</div>';
        });
}

// Events management
function loadEvents() {
    fetch('/events')
        .then(response => response.json())
        .then(events => {
            // Sort events: upcoming first, then current, then past, then by date DESC within same status
            const statusOrder = { 'upcoming': 1, 'current': 2, 'past': 3 };
            events.sort((a, b) => {
                const aOrder = statusOrder[a.status] || 4;
                const bOrder = statusOrder[b.status] || 4;
                if (aOrder !== bOrder) return aOrder - bOrder;
                return new Date(b.date) - new Date(a.date);
            });

            allAdminEvents = events;
            displayAdminEvents(events);
        })
        .catch(error => {
            console.error('Error loading events:', error);
            document.querySelector('#events-table tbody').innerHTML = '<tr><td colspan="6">Error loading events</td></tr>';
        });
}

document.addEventListener('DOMContentLoaded', function() {
// Check if user is admin
const userRole = localStorage.getItem('userRole');
if (userRole === 'admin') {
    // Initialize dashboard
    loadDashboardStats();
    setupNavigation();
    loadArtists(); // Load default section

    // Setup search functionality
    setupCollectionSearch();
    setupUserSearch();
    setupArtistSearch();
    setupArtworkSearch();
    setupGallerySearch();
    setupGalleryFeaturedSearch();
    setupMuseumSearch();
    setupEventSearch();
    setupVideoSearch();
    setupArtifactSearch();
} else {
    alert('Access denied. Admin privileges required.');
    window.location.href = '/';
}

    // Setup navigation
    function setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link[data-section]');
        navLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const section = this.getAttribute('data-section');

                // Update active nav
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                this.classList.add('active');

                // Show section
                document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
                document.getElementById(section).classList.add('active');

                // Load data for section
                switch(section) {
                    case 'dashboard':
                        loadDashboardStats();
                        break;
                    case 'artists':
                        loadArtists();
                        break;
                    case 'artworks':
                        loadArtworks();
                        break;
                    case 'galleries':
                        loadGalleries();
                        break;
                    case 'gallery-featured':
                        loadGalleryFeaturedArtworks();
                        break;
                    case 'museums':
                        loadMuseums();
                        break;
                    case 'events':
                        loadEvents();
                        break;
                    case 'videos':
                        loadVideos();
                        break;
                    case 'artifacts-collections':
                        loadArtifacts();
                        break;
                    case 'collections':
                        loadCollections();
                        break;
                    case 'users':
                        loadUsers();
                        break;
                }
            });
        });
    }


    // Load dashboard statistics and featured content
    function loadDashboardStats() {
        fetch('/dashboard')
            .then(response => response.json())
            .then(data => {
                document.getElementById('users-count').textContent = data.users || 0;
                document.getElementById('artists-count').textContent = data.artists || 0;
                document.getElementById('artworks-count').textContent = data.artworks || 0;
                document.getElementById('galleries-count').textContent = data.galleries || 0;
                document.getElementById('museums-count').textContent = data.museums || 0;
                document.getElementById('events-count').textContent = data.events || 0;
                document.getElementById('videos-count').textContent = data.videos || 0;

                // Load collections count separately
                fetch('/collections')
                    .then(response => response.json())
                    .then(collections => {
                        // Add collections stat card to dashboard
                        const statsGrid = document.querySelector('.stats-grid');
                        if (statsGrid && !document.getElementById('collections-count')) {
                            const collectionsCard = document.createElement('div');
                            collectionsCard.className = 'stat-card';
                            collectionsCard.innerHTML = `
                                <div class="stat-number" id="collections-count">${collections.length}</div>
                                <div class="stat-label">Total Collections</div>
                            `;
                            statsGrid.appendChild(collectionsCard);
                        } else if (document.getElementById('collections-count')) {
                            document.getElementById('collections-count').textContent = collections.length;
                        }
                    })
                    .catch(error => console.error('Error loading collections count:', error));
            })
            .catch(error => console.error('Error loading dashboard stats:', error));

        // Load featured content
        loadDashboardArtworks();
        loadDashboardArtists();
        loadDashboardGalleries();
        loadDashboardMuseums();
    }










    // Videos management
    function loadVideos() {
        fetch('/videos')
            .then(response => response.json())
            .then(videos => {
                allAdminVideos = videos;
                displayAdminVideos(videos);
            })
            .catch(error => {
                console.error('Error loading videos:', error);
                document.querySelector('#videos-table tbody').innerHTML = '<tr><td colspan="4">Error loading videos</td></tr>';
            });
    }


    // Artifacts management for admin
    function loadArtifacts() {
        fetch('/artifacts')
            .then(response => response.json())
            .then(artifacts => {
                allAdminArtifacts = artifacts;
                displayAdminArtifacts(artifacts);
            })
            .catch(error => {
                console.error('Error loading artifacts:', error);
                document.querySelector('#artifacts-table tbody').innerHTML = '<tr><td colspan="8">Error loading artifacts</td></tr>';
            });
    }

    // Collections management for artifacts-collections section
    function loadCollectionsForAdmin() {
        fetch('/collections')
            .then(response => response.json())
            .then(collections => {
                const tbody = document.querySelector('#collections-management-table tbody');
                tbody.innerHTML = collections.map(collection => `
                    <tr>
                        <td>${collection.collection_id}</td>
                        <td>${collection.name}</td>
                        <td>${collection.collector_name || ''}</td>
                        <td>${collection.about || ''}</td>
                        <td>
                            <button class="btn btn-secondary" onclick="editCollection(${collection.collection_id})">Edit</button>
                            <button class="btn btn-danger" onclick="deleteCollection(${collection.collection_id})">Delete</button>
                        </td>
                    </tr>
                `).join('');
            })
            .catch(error => {
                console.error('Error loading collections for admin:', error);
                document.querySelector('#collections-management-table tbody').innerHTML = '<tr><td colspan="5">Error loading collections</td></tr>';
            });
    }

    // Users management
    function loadUsers() {
        fetch('/users')
            .then(response => response.json())
            .then(users => {
                allAdminUsers = users;
                displayAdminUsers(users);
            })
            .catch(error => {
                console.error('Error loading users:', error);
                document.querySelector('#users-table tbody').innerHTML = '<tr><td colspan="6">Error loading users</td></tr>';
            });
    }

    // Form submission handlers
    document.getElementById('artifact-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const id = this.getAttribute('data-id');

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/artifacts/${id}` : '/artifacts';

        fetch(url, {
            method: method,
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            closeArtifactModal();
            loadArtifacts();
            loadDashboardStats();
        })
        .catch(error => {
            console.error('Error saving artifact:', error);
            alert('Error saving artifact: ' + error.message);
        });
    });

    document.getElementById('collection-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const id = this.getAttribute('data-id');

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/collections/${id}` : '/collections';

        fetch(url, {
            method: method,
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            closeCollectionModal();
            loadCollectionsForAdmin();
            loadCollections();
            loadDashboardStats();
        })
        .catch(error => {
            console.error('Error saving collection:', error);
            alert('Error saving collection. Please try again.');
        });
    });
});

// Modal functions
function openModal(type, id = null) {
    const modal = document.getElementById('admin-modal');
    const form = document.getElementById('admin-form');
    const title = document.getElementById('modal-title');

    if (!modal || !form || !title) {
        console.error('Modal elements not found');
        return;
    }

    const formHtml = getFormFields(type, id);
    form.innerHTML = formHtml;

    // Set appropriate title
    title.textContent = id ? `Edit ${type}` : `Add New ${type}`;

    if (id) {
        form.setAttribute('data-id', id);
    } else {
        form.removeAttribute('data-id');
    }

    if (type === 'collection') {
        form.enctype = 'multipart/form-data';
    }

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';

    // Load artists for artwork form, galleries for gallery-featured form, artworks and artists for events, and then load item data if editing
    if (type === 'artwork') {
        loadArtistsForDropdown().then(() => {
            if (id) {
                loadItemData(type, id);
            }
        });
    } else if (type === 'gallery-featured') {
        loadGalleriesForDropdown().then(() => {
            if (id) {
                loadItemData(type, id);
            }
        });
    } else if (type === 'event') {
        loadArtistsForEventDropdown().then(() => {
            if (id) {
                loadItemData(type, id);
            }
        });
    } else if (id) {
        loadItemData(type, id);
    }
}

function closeModal() {
    const modal = document.getElementById('admin-modal');
    if (modal) modal.classList.remove('show');
    document.body.style.overflow = '';
    const form = document.getElementById('admin-form');
    form.reset();
    // Remove any preview images
    form.querySelectorAll('.preview-image').forEach(preview => preview.remove());
    form.removeAttribute('data-id');
}

function getFormFields(type, id) {

    const forms = {
        artist: `
            <div class="form-group">
                <label>Name:</label>
                <input type="text" name="name" required>
            </div>
            <div class="form-group">
                <label>Email:</label>
                <input type="email" name="email">
            </div>
            <div class="form-group">
                <label>Contact:</label>
                <input type="text" name="contact">
            </div>
            <div class="form-group">
                <label>Location:</label>
                <input type="text" name="location">
            </div>
            <div class="form-group">
                <label>About:</label>
                <textarea name="about"></textarea>
            </div>
            <div class="form-group">
                <label>Born Year:</label>
                <input type="number" name="born_year">
            </div>
            <div class="form-group">
                <label>Specialties:</label>
                <input type="text" name="specialties">
            </div>
            <div class="form-group">
                <label>Exhibitions:</label>
                <input type="text" name="exhibitions">
            </div>
            <div class="form-group">
                <label>Category:</label>
                <select name="category">
                    <option value="Painting">Painting</option>
                    <option value="Photography">Photography</option>
                    <option value="Digital Art">Digital Art</option>
                    <option value="Drawing">Drawing</option>
                    <option value="Mural">Mural</option>
                    <option value="Sculpture">Sculpture</option>
                </select>
            </div>
            <div class="form-group">
                <label>Photo:</label>
                <input type="file" name="photo" accept="image/*">
                <small>Leave empty to keep current photo</small>
            </div>
            <div class="form-group">
                <label>Featured:</label>
                <input type="checkbox" name="is_featured">
            </div>
            <button type="submit" class="btn btn-primary">Save</button>
        `,
        artwork: `
            <div class="form-group">
                <label>Title:</label>
                <input type="text" name="title" required>
            </div>
            <div class="form-group">
                <label>Description:</label>
                <textarea name="description"></textarea>
            </div>
            <div class="form-group">
                <label>Artist:</label>
                <select name="artist_id">
                    <option value="">Select Artist</option>
                    <!-- Artists will be loaded dynamically -->
                </select>
            </div>
            <div class="form-group">
                <label>Categories:</label>
                <select name="categories">
                    <option value="Painting">Painting</option>
                    <option value="Photography">Photography</option>
                    <option value="Digital Art">Digital Art</option>
                    <option value="Drawing">Drawing</option>
                    <option value="Mural">Mural</option>
                    <option value="Sculpture">Sculpture</option>
                </select>
            </div>
            <div class="form-group">
                <label>Medium:</label>
                <input type="text" name="medium">
            </div>
            <div class="form-group">
                <label>Year:</label>
                <input type="number" name="year">
            </div>
            <div class="form-group">
                <label>Size:</label>
                <input type="text" name="size">
            </div>
            <div class="form-group">
                <label>Price:</label>
                <input type="text" name="price" placeholder="e.g., 5000, Contact for price, Negotiable, POA">
            </div>
            <div class="form-group">
                <label>Image:</label>
                <input type="file" name="image" accept="image/*">
            </div>
            <div class="form-group">
                <label>Featured:</label>
                <input type="checkbox" name="is_featured">
            </div>
            <button type="submit" class="btn btn-primary">Save</button>
        `,
        gallery: `
            <div class="form-group">
                <label>Name:</label>
                <input type="text" name="name" required>
            </div>
            <div class="form-group">
                <label>About:</label>
                <textarea name="about"></textarea>
            </div>
            <div class="form-group">
                <label>Location:</label>
                <input type="text" name="location">
            </div>
            <div class="form-group">
                <label>Type:</label>
                <input type="text" name="type">
            </div>
            <div class="form-group">
                <label>Collections:</label>
                <input type="text" name="collections">
            </div>
            <div class="form-group">
                <label>Email:</label>
                <input type="email" name="email">
            </div>
            <div class="form-group">
                <label>Phone:</label>
                <input type="text" name="phone">
            </div>
            <div class="form-group">
                <label>Image:</label>
                <input type="file" name="image" accept="image/*">
                <small>Leave empty to keep current image</small>
            </div>
            <div class="form-group">
                <label>Featured:</label>
                <input type="checkbox" name="is_featured">
            </div>
            <button type="submit" class="btn btn-primary">Save</button>
        `,
        museum: `
            <div class="form-group">
                <label>Name:</label>
                <input type="text" name="name" required>
            </div>
            <div class="form-group">
                <label>About:</label>
                <textarea name="about"></textarea>
            </div>
            <div class="form-group">
                <label>Location:</label>
                <input type="text" name="location">
            </div>
            <div class="form-group">
                <label>Contact Number:</label>
                <input type="text" name="contact_info">
            </div>
            <div class="form-group">
                <label>Email:</label>
                <input type="email" name="website">
            </div>
            <div class="form-group">
                <label>Image:</label>
                <input type="file" name="image" accept="image/*">
                <small>Leave empty to keep current image</small>
            </div>
            <div class="form-group">
                <label>Featured:</label>
                <input type="checkbox" name="is_featured">
            </div>
            <button type="submit" class="btn btn-primary">Save</button>
        `,
        event: `
            <div class="form-group">
                <label>Name:</label>
                <input type="text" name="name" required>
            </div>
            <div class="form-group">
                <label>Date:</label>
                <input type="datetime-local" name="date" required>
            </div>
            <div class="form-group">
                <label>Location:</label>
                <input type="text" name="location" required>
            </div>
            <div class="form-group">
                <label>Overview:</label>
                <textarea name="about"></textarea>
            </div>
            <div class="form-group">
                <label>Organization:</label>
                <input type="text" name="org">
            </div>
            <div class="form-group">
                <label>Status:</label>
                <select name="status">
                    <option value="current">Current</option>
                    <option value="upcoming" selected>Upcoming</option>
                    <option value="past">Past</option>
                </select>
            </div>
            <div class="form-group">
                <label>Image:</label>
                <input type="file" name="image" accept="image/*">
            </div>
            <div class="form-group">
                <label>Upload Artworks (Minimum 10):</label>
                <div id="event-artworks-upload-container">
                    ${Array.from({length: 10}).map((_, i) => `
                        <div class="artwork-upload-row" style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center;">
                            <span style="min-width: 25px;">${i+1}.</span>
                            <input type="hidden" name="artwork_source[]" value="new">
                            <input type="file" name="artwork_files" accept="image/*" required style="flex: 1;">
                            <input type="text" name="artwork_names" placeholder="Artwork Name" required style="flex: 1;">
                            <input type="text" name="artwork_artists" placeholder="Artist Name" required style="flex: 1;">
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="btn btn-secondary btn-sm" onclick="addArtworkUploadRow()" style="margin-top: 10px;">+ Add More Artworks</button>
            </div>
            <div class="form-group">
                <label>Exhibitors:</label>
                <select name="exhibitors[]" multiple>
                    <!-- Artists will be loaded dynamically -->
                </select>
            </div>
            <button type="submit" class="btn btn-primary">Save</button>
        `,
        video: `
            <div class="form-group">
                <label>Title:</label>
                <input type="text" name="title" required>
            </div>
            <div class="form-group">
                <label>Details:</label>
                <textarea name="details"></textarea>
            </div>
            <div class="form-group">
                <label>URL:</label>
                <input type="url" name="url">
            </div>
            <button type="submit" class="btn btn-primary">Save</button>
        `,
        collection: `
            <div class="form-group">
                <label>Collector Name:</label>
                <input type="text" name="collector_name" required>
            </div>
            <div class="form-group">
                <label>About:</label>
                <textarea name="about"></textarea>
            </div>
            <div class="form-group">
                <label>Collector Image:</label>
                <input type="file" name="collector_image" accept="image/*" style="width: auto !important;">
            </div>
            <button type="submit" class="btn btn-primary">Save</button>
        `,
        user: `
            <div class="form-group">
                <label>Email:</label>
                <input type="email" name="email" required>
            </div>
            <div class="form-group">
                <label>Password:</label>
                <input type="password" name="password">
            </div>
            <div class="form-group">
                <label>First Name:</label>
                <input type="text" name="first_name">
            </div>
            <div class="form-group">
                <label>Last Name:</label>
                <input type="text" name="last_name">
            </div>
            <div class="form-group">
                <label>Role:</label>
                <select name="role">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                </select>
            </div>
            <div class="form-group">
                <label>Active:</label>
                <input type="checkbox" name="is_active" checked>
            </div>
            <button type="submit" class="btn btn-primary">Save</button>
        `,
        'gallery-featured': `
            <div class="form-group">
                <label>Gallery:</label>
                <select name="gallery_id" required>
                    <option value="">Select Gallery</option>
                    <!-- Galleries will be loaded dynamically -->
                </select>
            </div>
            <div class="form-group">
                <label>Title:</label>
                <input type="text" name="title" required>
            </div>
            <div class="form-group">
                <label>Description:</label>
                <textarea name="description"></textarea>
            </div>
            <div class="form-group">
                <label>Image:</label>
                <input type="file" name="image" accept="image/*">
                <small>Leave empty to keep current image</small>
            </div>
            <div class="form-group">
                <label>Display Order:</label>
                <input type="number" name="display_order" value="0" min="0">
            </div>
            <button type="submit" class="btn btn-primary">Save</button>
        `
    };

    return forms[type] || '<p>Form not available</p>';
}

function addArtworkUploadRow() {
    const container = document.getElementById('event-artworks-upload-container');
    if (!container) return;
    
    const rowCount = container.querySelectorAll('.artwork-upload-row').length;
    const newRow = document.createElement('div');
    newRow.className = 'artwork-upload-row';
    newRow.style.display = 'flex';
    newRow.style.gap = '10px';
    newRow.style.marginBottom = '8px';
    newRow.style.alignItems = 'center';
    
    newRow.innerHTML = `
        <span style="min-width: 25px;">${rowCount + 1}.</span>
        <input type="hidden" name="artwork_source[]" value="new">
        <input type="file" name="artwork_files" accept="image/*" style="flex: 1;">
        <input type="text" name="artwork_names" placeholder="Artwork Name" style="flex: 1;">
        <input type="text" name="artwork_artists" placeholder="Artist Name" style="flex: 1;">
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove(); updateArtworkRowNumbers();" style="padding: 2px 8px;">×</button>
    `;
    
    container.appendChild(newRow);
}

function updateArtworkRowNumbers() {
    const container = document.getElementById('event-artworks-upload-container');
    if (!container) return;
    
    container.querySelectorAll('.artwork-upload-row').forEach((row, index) => {
        const span = row.querySelector('span');
        if (span) span.textContent = `${index + 1}.`;
    });
}

function loadArtistsForDropdown() {
    return fetch('/artists')
        .then(response => response.json())
        .then(artists => {
            const select = document.querySelector('#admin-form select[name="artist_id"]');
            if (select) {
                // Clear existing options except the first one
                select.innerHTML = '<option value="">Select Artist</option>';
                artists.forEach(artist => {
                    const option = document.createElement('option');
                    option.value = artist.artist_id;
                    option.textContent = artist.name;
                    select.appendChild(option);
                });
            } else {
                console.error('Artist select not found');
            }
        })
        .catch(error => console.error('Error loading artists for dropdown:', error));
}

function loadGalleriesForDropdown() {
    return fetch('/galleries')
        .then(response => response.json())
        .then(galleries => {
            const select = document.querySelector('#admin-form select[name="gallery_id"]');
            if (select) {
                // Clear existing options except the first one
                select.innerHTML = '<option value="">Select Gallery</option>';
                galleries.forEach(gallery => {
                    const option = document.createElement('option');
                    option.value = gallery.gallery_id;
                    option.textContent = gallery.name;
                    select.appendChild(option);
                });
            } else {
                console.error('Gallery select not found');
            }
        })
        .catch(error => console.error('Error loading galleries for dropdown:', error));
}

function loadArtworksForEventDropdown() {
    return fetch('/artworks')
        .then(response => response.json())
        .then(artworks => {
            const select = document.querySelector('#admin-form select[name="artworks[]"]');
            if (select) {
                select.innerHTML = '';
                artworks.forEach(artwork => {
                    const option = document.createElement('option');
                    option.value = artwork.artwork_id;
                    option.textContent = artwork.title;
                    select.appendChild(option);
                });
            } else {
                console.error('Artworks select not found');
            }
        })
        .catch(error => console.error('Error loading artworks for event dropdown:', error));
}

function loadArtistsForEventDropdown() {
    return fetch('/artists')
        .then(response => response.json())
        .then(artists => {
            const select = document.querySelector('#admin-form select[name="exhibitors[]"]');
            if (select) {
                select.innerHTML = '';
                artists.forEach(artist => {
                    const option = document.createElement('option');
                    option.value = artist.artist_id;
                    option.textContent = artist.name;
                    select.appendChild(option);
                });
            } else {
                console.error('Artists select not found');
            }
        })
        .catch(error => console.error('Error loading artists for event dropdown:', error));
}

function loadGalleryFeaturedArtworks() {
    fetch('/gallery-featured-artworks')
        .then(response => response.json())
        .then(artworks => {
            allAdminGalleryFeatured = artworks;
            displayAdminGalleryFeatured(artworks);
        })
        .catch(error => {
            console.error('Error loading gallery featured artworks:', error);
            document.querySelector('#gallery-featured-table tbody').innerHTML = '<tr><td colspan="7">Error loading gallery featured artworks</td></tr>';
        });
}

function loadItemData(type, id) {
    let url;
    if (type === 'gallery-featured') {
        url = `/gallery-featured-artworks/${id}`;
    } else {
        url = `/${type}s/${id}`;
    }

    fetch(url)
        .then(response => response.json())
        .then(data => {
            const form = document.getElementById('admin-form');
            Object.keys(data).forEach(key => {
                const input = form.querySelector(`[name="${key}"]`);
                if (input) {
                    if (input.type === 'checkbox') {
                        input.checked = data[key] == 1;
                    } else if (input.type === 'file') {
                        // For file inputs, show current image as preview
                        if (data[key]) {
                            const previewDiv = document.createElement('div');
                            previewDiv.className = 'preview-image';
                            previewDiv.innerHTML = `
                                <small>Current image:</small><br>
                                <img src="${data[key]}" style="max-width: 100px; max-height: 100px; margin: 5px 0;">
                            `;
                            input.parentNode.insertBefore(previewDiv, input.nextSibling);
                        }
                    } else {
                        input.value = data[key] || '';
                    }
                }
            });

            if (type === 'event') {
                // Handle uploaded artworks
                if (data.artworks && Array.isArray(data.artworks)) {
                    const container = document.getElementById('event-artworks-upload-container');
                    if (container) {
                        container.innerHTML = '';
                        data.artworks.forEach((artwork, i) => {
                            const row = document.createElement('div');
                            row.className = 'artwork-upload-row';
                            row.style.display = 'flex';
                            row.style.gap = '10px';
                            row.style.marginBottom = '8px';
                            row.style.alignItems = 'center';
                            row.innerHTML = `
                                                        <span style="min-width: 25px;">${i + 1}.</span>
                                                        <div style="flex: 1;">
                                                            <input type="hidden" name="artwork_source[]" value="existing">
                                                            <input type="file" name="artwork_files" accept="image/*" onchange="this.previousElementSibling.value='new'">
                                                            <div class="current-artwork-preview" style="margin-top: 5px;">
                                                                <img src="${artwork.image_url}" style="max-height: 40px; border-radius: 4px;">
                                                                <input type="hidden" name="existing_artwork_urls[]" value="${artwork.image_url}">
                                                            </div>
                                                        </div>
                                                        <input type="text" name="artwork_names" value="${artwork.title || ''}" placeholder="Artwork Name" required style="flex: 1;">
                                                        <input type="text" name="artwork_artists" value="${artwork.artist_name || ''}" placeholder="Artist Name" required style="flex: 1;">
                                                        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove(); updateArtworkRowNumbers();" style="padding: 2px 8px;">×</button>
                                                    `;
                            container.appendChild(row);
                        });
                    }
                }
                if (data.exhibitors && Array.isArray(data.exhibitors)) {
                    const exhibitorsSelect = form.querySelector('select[name="exhibitors[]"]');
                    if (exhibitorsSelect) {
                        Array.from(exhibitorsSelect.options).forEach(option => {
                            option.selected = data.exhibitors.includes(parseInt(option.value));
                        });
                    }
                }
                // Handle status select
                if (data.status) {
                    const statusSelect = form.querySelector('select[name="status"]');
                    if (statusSelect) {
                        statusSelect.value = data.status;
                    }
                }
            }
            if (type === 'collection') {
                // Handle collector image preview
                if (data.collector_image) {
                    document.getElementById('collection-collector-preview').innerHTML = '<img src="' + data.collector_image + '" style="max-width: 100px; max-height: 100px;">';
                }
            }
        })
        .catch(error => console.error(`Error loading ${type}:`, error));
}

// CRUD operations
function editArtist(id) { openModal('artist', id); }
function editArtwork(id) { openModal('artwork', id); }
function editGallery(id) { openModal('gallery', id); }
function editMuseum(id) { openModal('museum', id); }
function editEvent(id) { openModal('event', id); }
function editVideo(id) { openModal('video', id); }
function editCollection(id) {
    // Show modal first
    document.getElementById('collection-modal-title').textContent = 'Edit Collection';
    document.getElementById('collection-submit-text').textContent = 'Update Collection';
    const modal = document.getElementById('collection-modal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    // Reset form
    const form = document.getElementById('collection-form');
    form.reset();
    document.getElementById('collection-collector-preview').innerHTML = '';

    // Load data
    fetch(`/collections/${id}`)
        .then(response => response.json())
        .then(collection => {
            // Populate form fields
            const nameInput = form.querySelector('[name="name"]');
            if (nameInput) nameInput.value = collection.name || '';

            const collectorNameInput = form.querySelector('[name="collector_name"]');
            if (collectorNameInput) collectorNameInput.value = collection.collector_name || '';

            const aboutInput = form.querySelector('[name="about"]');
            if (aboutInput) aboutInput.value = collection.about || '';

            // Handle image preview
            if (collection.image_url) {
                document.getElementById('collection-collector-preview').innerHTML = '<img src="' + collection.image_url + '" style="max-width: 200px; max-height: 150px; border-radius: 8px; border: 1px solid #ddd;">';
            }

            form.setAttribute('data-id', id);
        })
        .catch(error => {
            console.error('Error loading collection:', error);
            alert('Error loading collection data. Please try again.');
            closeCollectionModal();
        });
}
function editUser(id) { openModal('user', id); }
function editGalleryFeaturedArtwork(id) { openModal('gallery-featured', id); }

function viewArtworkDetails(id) {
    window.open(`artwork-details.html?id=${id}`, '_blank');
}

function deleteArtist(id) {
    if (confirm('Are you sure you want to delete this artist?')) {
        // Optimistically remove from dashboard UI if exists
        const card = document.querySelector(`[onclick*="deleteArtist(${id})"]`)?.closest('.dashboard-card');
        if (card) {
            card.style.opacity = '0.5';
            card.style.pointerEvents = 'none';
        }

        fetch(`/artists/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => response.json())
            .then(data => {
                if (data.message === 'Artist deleted') {
                    // Always refresh the current view
                    const activeSection = document.querySelector('.nav-link.active').getAttribute('data-section');
                    if (activeSection === 'artists') {
                        loadArtists();
                    }
                    loadDashboardArtists(); // Refresh dashboard
                } else {
                    throw new Error(data.message || 'Delete failed');
                }
            })
            .catch(error => {
                console.error('Error deleting artist:', error);
                // Revert optimistic update on error
                if (card) {
                    card.style.opacity = '1';
                    card.style.pointerEvents = 'auto';
                }
                alert('Error deleting artist. Please try again.');
            });
    }
}

function deleteArtwork(id) {
    if (confirm('Are you sure you want to delete this artwork?')) {
        // Optimistically remove from dashboard UI if exists
        const card = document.querySelector(`[onclick*="deleteArtwork(${id})"]`)?.closest('.dashboard-card');
        if (card) {
            card.style.opacity = '0.5';
            card.style.pointerEvents = 'none';
        }

        fetch(`/artworks/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => response.json())
            .then(data => {
                if (data.message === 'Artwork deleted') {
                    // Always refresh the current view
                    const activeSection = document.querySelector('.nav-link.active').getAttribute('data-section');
                    if (activeSection === 'artworks') {
                        loadArtworks();
                    }
                    loadDashboardArtworks(); // Refresh dashboard
                } else {
                    throw new Error(data.message || 'Delete failed');
                }
            })
            .catch(error => {
                console.error('Error deleting artwork:', error);
                // Revert optimistic update on error
                if (card) {
                    card.style.opacity = '1';
                    card.style.pointerEvents = 'auto';
                }
                alert('Error deleting artwork. Please try again.');
            });
    }
}

function deleteGallery(id) {
    if (confirm('Are you sure you want to delete this gallery?')) {
        // Optimistically remove from dashboard UI if exists
        const card = document.querySelector(`[onclick*="deleteGallery(${id})"]`)?.closest('.dashboard-card');
        if (card) {
            card.style.opacity = '0.5';
            card.style.pointerEvents = 'none';
        }

        fetch(`/galleries/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => response.json())
            .then(data => {
                if (data.message === 'Gallery deleted') {
                    // Always refresh the current view
                    const activeSection = document.querySelector('.nav-link.active').getAttribute('data-section');
                    if (activeSection === 'galleries') {
                        loadGalleries();
                    }
                    loadDashboardGalleries(); // Refresh dashboard
                } else {
                    throw new Error(data.message || 'Delete failed');
                }
            })
            .catch(error => {
                console.error('Error deleting gallery:', error);
                // Revert optimistic update on error
                if (card) {
                    card.style.opacity = '1';
                    card.style.pointerEvents = 'auto';
                }
                alert('Error deleting gallery. Please try again.');
            });
    }
}

function deleteMuseum(id) {
    if (confirm('Are you sure you want to delete this museum?')) {
        // Optimistically remove from dashboard UI if exists
        const card = document.querySelector(`[onclick*="deleteMuseum(${id})"]`)?.closest('.dashboard-card');
        if (card) {
            card.style.opacity = '0.5';
            card.style.pointerEvents = 'none';
        }

        fetch(`/museums/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => response.json())
            .then(data => {
                if (data.message === 'Museum deleted') {
                    // Always refresh the current view
                    const activeSection = document.querySelector('.nav-link.active').getAttribute('data-section');
                    if (activeSection === 'museums') {
                        loadMuseums();
                    }
                    loadDashboardMuseums(); // Refresh dashboard
                } else {
                    throw new Error(data.message || 'Delete failed');
                }
            })
            .catch(error => {
                console.error('Error deleting museum:', error);
                // Revert optimistic update on error
                if (card) {
                    card.style.opacity = '1';
                    card.style.pointerEvents = 'auto';
                }
                alert('Error deleting museum. Please try again.');
            });
    }
}

function deleteEvent(id) {
    if (confirm('Are you sure you want to delete this event?')) {
        fetch(`/events/${id}`, { method: 'DELETE' })
            .then(() => loadEvents())
            .catch(error => console.error('Error deleting event:', error));
    }
}

function deleteVideo(id) {
    if (confirm('Are you sure you want to delete this video?')) {
        fetch(`/videos/${id}`, { method: 'DELETE' })
            .then(() => loadVideos())
            .catch(error => console.error('Error deleting video:', error));
    }
}

function deleteCollection(id) {
    if (confirm('Are you sure you want to delete this collection?')) {
        fetch(`/collections/${id}`, { method: 'DELETE' })
            .then(() => loadCollections())
            .catch(error => console.error('Error deleting collection:', error));
    }
}

function deleteUser(id) {
    if (confirm('Are you sure you want to delete this user?')) {
        fetch(`/users/${id}`, { method: 'DELETE' })
            .then(() => loadUsers())
            .catch(error => console.error('Error deleting user:', error));
    }
}

function deleteGalleryFeaturedArtwork(id) {
    if (confirm('Are you sure you want to delete this gallery featured artwork?')) {
        fetch(`/gallery-featured-artworks/${id}`, { method: 'DELETE' })
            .then(() => loadGalleryFeaturedArtworks())
            .catch(error => console.error('Error deleting gallery featured artwork:', error));
    }
}


// Form submission
document.getElementById('admin-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    const section = document.querySelector('.nav-link.active').getAttribute('data-section');
    let type;
    if (section === 'gallery-featured') {
        type = 'gallery-featured';
    } else {
        type = section.slice(0, -1); // Remove 's' for other sections
    }
    const id = this.getAttribute('data-id');
    
    // Validate required fields for gallery-featured
    if (type === 'gallery-featured') {
        const title = formData.get('title');
        const gallery_id = formData.get('gallery_id');
        
        if (!gallery_id || gallery_id === '') {
            alert('Please select a gallery');
            return;
        }
        if (!title || title.trim() === '') {
            alert('Please enter a title for the artwork');
            return;
        }
    }

    // Validate minimum 10 artworks for new events
    if (type === 'event' && !id) {
        const artworkFiles = formData.getAll('artwork_files');
        const validFiles = artworkFiles.filter(file => file instanceof File && file.size > 0);
        if (validFiles.length < 10) {
            alert('A minimum of 10 artworks is required for a new event.');
            return;
        }
    }

    // Convert checkbox values
    this.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        formData.set(checkbox.name, checkbox.checked ? 1 : 0);
    });

    // Check if form has file inputs
    const hasFiles = Array.from(formData.values()).some(value => value instanceof File && value.size > 0);

    // Ensure status is included (only for forms that have status field)
    const form = document.getElementById('admin-form');
    const statusSelect = form ? form.querySelector('select[name="status"]') : null;
    const statusValue = statusSelect ? statusSelect.value : 'upcoming';
    if (hasFiles && statusSelect) {
        formData.set('status', statusValue);
    }

    const method = id ? 'PUT' : 'POST';
    let url;
    if (type === 'gallery-featured') {
        url = id ? `/gallery-featured-artworks/${id}` : `/gallery-featured-artworks`;
    } else {
        url = id ? `/${type}s/${id}` : `/${type}s`;
    }

    const headers = {};
    let body;

    if (hasFiles) {
        // Send as FormData for file uploads
        body = formData;
    } else {
        // Convert to JSON for regular data
        const data = {};
        for (let [key, value] of formData.entries()) {
            if (data[key]) {
                if (Array.isArray(data[key])) {
                    data[key].push(value);
                } else {
                    data[key] = [data[key], value];
                }
            } else {
                data[key] = value;
            }
        }
        headers['Content-Type'] = 'application/json';
        if (statusSelect) {
            data.status = statusValue;
        }
        body = JSON.stringify(data);
    }

    fetch(url, {
        method: method,
        headers: headers,
        body: body
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        closeModal();
        // Reload current section and dashboard
        const activeSection = document.querySelector('.nav-link.active').getAttribute('data-section');
        switch(activeSection) {
            case 'dashboard':
                loadDashboardStats();
                break;
            case 'artists':
                loadArtists();
                loadDashboardArtists();
                break;
            case 'artworks':
                loadArtworks();
                loadDashboardArtworks();
                break;
            case 'galleries':
                loadGalleries();
                loadDashboardGalleries();
                break;
            case 'gallery-featured':
                loadGalleryFeaturedArtworks();
                break;
            case 'museums':
                loadMuseums();
                loadDashboardMuseums();
                break;
            case 'events': loadEvents(); break;
            case 'videos': loadVideos(); break;
            case 'collections': loadCollections(); break;
            case 'users': loadUsers(); break;
        }
    })
    .catch(error => {
        console.error('Error saving:', error);
        alert('Error saving data: ' + error.message);
    });
});

// Artifact modal functions
function openArtifactModal() {
    const modal = document.getElementById('artifact-modal');
    const form = document.getElementById('artifact-form');

    // Load museums for dropdown
    loadMuseumsForDropdown().then(() => {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    });
}

function closeArtifactModal() {
    const modal = document.getElementById('artifact-modal');
    if (modal) modal.classList.remove('show');
    document.body.style.overflow = '';
    const form = document.getElementById('artifact-form');
    if (form) form.reset();
}

// Collection modal functions
function openCollectionModal() {
    document.getElementById('collection-modal-title').textContent = 'Add New Collection';
    document.getElementById('collection-submit-text').textContent = 'Add Collection';
    const modal = document.getElementById('collection-modal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

function closeCollectionModal() {
    const modal = document.getElementById('collection-modal');
    if (modal) modal.classList.remove('show');
    document.body.style.overflow = '';
    const form = document.getElementById('collection-form');
    if (form) form.reset();
    // Clear preview
    const preview = document.getElementById('collection-collector-preview');
    if (preview) preview.innerHTML = '';
}

// Preview collection image
function previewCollectionImage(input) {
    const preview = document.getElementById('collection-collector-preview');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" style="max-width: 200px; max-height: 150px; border-radius: 8px; border: 1px solid #ddd;">`;
        };
        reader.readAsDataURL(input.files[0]);
    } else {
        preview.innerHTML = '';
    }
}

// Load museums for artifact dropdown
function loadMuseumsForDropdown() {
    return fetch('/museums')
        .then(response => response.json())
        .then(museums => {
            const select = document.querySelector('#artifact-form select[name="museum_id"]');
            if (select) {
                select.innerHTML = '<option value="">Select Museum</option>';
                museums.forEach(museum => {
                    const option = document.createElement('option');
                    option.value = museum.museum_id;
                    option.textContent = museum.name;
                    select.appendChild(option);
                });
            }
        })
        .catch(error => console.error('Error loading museums for dropdown:', error));
}

// CRUD operations for artifacts
function editArtifact(id) {
    fetch(`/artifacts/${id}`)
        .then(response => response.json())
        .then(artifact => {
            loadMuseumsForDropdown().then(() => {
                const form = document.getElementById('artifact-form');
                Object.keys(artifact).forEach(key => {
                    const input = form.querySelector(`[name="${key}"]`);
                    if (input) {
                        if (input.type === 'file') {
                            // Handle file preview if needed
                        } else {
                            input.value = artifact[key] || '';
                        }
                    }
                });
                form.setAttribute('data-id', id);
                const modal = document.getElementById('artifact-modal');
                if (modal) {
                    modal.classList.add('show');
                    document.body.style.overflow = 'hidden';
                }
            });
        })
        .catch(error => console.error('Error loading artifact:', error));
}

function deleteArtifact(id) {
    if (confirm('Are you sure you want to delete this artifact?')) {
        fetch(`/artifacts/${id}`, { method: 'DELETE' })
            .then(() => {
                loadArtifacts();
                loadDashboardStats(); // Update stats
            })
            .catch(error => console.error('Error deleting artifact:', error));
    }
}

// Close modal when clicking outside
window.addEventListener('click', function(e) {
    const adminModal = document.getElementById('admin-modal');
    const artifactModal = document.getElementById('artifact-modal');
    const collectionModal = document.getElementById('collection-modal');

    if (e.target === adminModal) {
        closeModal();
    }
    if (e.target === artifactModal) {
        closeArtifactModal();
    }
    if (e.target === collectionModal) {
        closeCollectionModal();
    }
});