// Server restart trigger
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config({ override: true });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log('--- ENVIRONMENT CHECK ---');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Cloudinary:', process.env.CLOUDINARY_CLOUD_NAME ? 'Configured' : 'MISSING');
console.log('Google Callback:', process.env.GOOGLE_CALLBACK_URL || 'NOT SET');
console.log('-------------------------');

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Don't exit in development
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in development
});

const app = express();
const PORT = process.env.PORT || 3002;

// Configure Local storage for multer
let storage;
console.log('Using local disk storage');
storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'img';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Use same storage for collections as other uploads
const uploadCollections = multer({ storage: storage });

// Ensure upload directory exists
const imgDir = path.join(__dirname, 'img');
try {
  if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
} catch (e) {
  console.error('Failed to ensure img directory exists:', e);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Database configuration
const dbPath = path.join(__dirname, 'banarts.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase(() => {
      console.log('Database initialization complete');
      initializeAuth();
      startServer();
    });
  }
});

// Image path helper
const getImagePath = (path) => {
    if (!path) return null;
    if (typeof path !== 'string') return path;
    if (path.startsWith('http')) return path;
    // For local paths, ensure they start with / and use forward slashes
    const normalizedPath = path.replace(/\\/g, '/');
    return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
};

const validatePassword = (password) => {
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
};

const processImageFields = (row) => {
    if (!row) return row;
    const fields = [
        'photo_url', 'image_url', 'profile_picture', 'collector_image', 
        'thumbnail_url', 'logo_url', 'artist_photo', 'painting_url', 'image_urls'
    ];
    const newRow = { ...row };
    fields.forEach(field => {
        if (newRow[field]) {
            if (field === 'image_urls' && typeof newRow[field] === 'string') {
                try {
                    const urls = JSON.parse(newRow[field]);
                    if (Array.isArray(urls)) {
                        newRow[field] = JSON.stringify(urls.map(url => getImagePath(url)));
                    }
                } catch (e) {
                    newRow[field] = getImagePath(newRow[field]);
                }
            } else {
                newRow[field] = getImagePath(newRow[field]);
            }
        }
    });
    return newRow;
};

let auth;
function initializeAuth() {
  try {
    auth = require('./auth')(db);
    
    app.use(session({
      secret: process.env.JWT_SECRET || 'session-secret',
      resave: false,
      saveUninitialized: true,
      cookie: { secure: false }
    }));
    
    app.use(auth.passport.initialize());
    app.use(auth.passport.session());

    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id') {
      app.get('/auth/test', (req, res) => {
        res.json({ status: 'OAuth routes are working', google: 'available' });
      });
      
      app.get('/auth/google', (req, res, next) => {
        console.log('🔵 Google login initiated');
        auth.passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
      });
      
      app.get('/auth/google/callback', 
        (req, res, next) => {
          console.log('🔵 Google callback received with query:', req.query);
          auth.passport.authenticate('google', { failureRedirect: '/login?error=auth_failed' })(req, res, next);
        },
        (req, res) => {
          console.log('🔵 Google auth successful, user:', req.user?.email);
          const token = auth.generateToken(req.user);
          res.redirect(`/login-success?token=${token}&user=${encodeURIComponent(JSON.stringify({
            id: req.user.user_id,
            email: req.user.email,
            first_name: req.user.first_name,
            last_name: req.user.last_name,
            profile_picture: getImagePath(req.user.profile_picture),
            role: req.user.role
          }))}`);
        }
      );
      console.log('✅ Google OAuth routes registered');
    } else {
      console.warn('⚠️ Google OAuth routes not registered - add GOOGLE_CLIENT_ID to .env');
    }
  
    if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_ID !== 'your_facebook_app_id') {
      app.get('/auth/facebook', auth.passport.authenticate('facebook', { scope: ['email', 'public_profile'] }));
      app.get('/auth/facebook/callback',
        auth.passport.authenticate('facebook', { failureRedirect: '/login' }),
        (req, res) => {
          const token = auth.generateToken(req.user);
          res.redirect(`/login-success?token=${token}&user=${encodeURIComponent(JSON.stringify({
            id: req.user.user_id,
            email: req.user.email,
            first_name: req.user.first_name,
            last_name: req.user.last_name,
            profile_picture: getImagePath(req.user.profile_picture),
            role: req.user.role
          }))}`);
        }
      );
      console.log('✅ Facebook OAuth routes registered');
    } else {
      console.warn('⚠️ Facebook OAuth routes not registered - add FACEBOOK_APP_ID to .env');
    }
  
    if (process.env.TWITTER_CONSUMER_KEY && process.env.TWITTER_CONSUMER_KEY !== 'your_twitter_key') {
      app.get('/auth/twitter', auth.passport.authenticate('twitter'));
      app.get('/auth/twitter/callback',
        auth.passport.authenticate('twitter', { failureRedirect: '/login' }),
        (req, res) => {
          const token = auth.generateToken(req.user);
          res.redirect(`/login-success?token=${token}&user=${encodeURIComponent(JSON.stringify({
            id: req.user.user_id,
            email: req.user.email,
            first_name: req.user.first_name,
            last_name: req.user.last_name,
            profile_picture: getImagePath(req.user.profile_picture),
            role: req.user.role
          }))}`);
        }
      );
      console.log('✅ Twitter OAuth routes registered');
    }
  } catch (error) {
    console.error('Error initializing authentication:', error);
  }
  
  app.get('/login-success', (req, res) => {
    const token = req.query.token;
    const user = req.query.user ? JSON.parse(decodeURIComponent(req.query.user)) : null;
    
    if (!token || !user) {
      return res.status(400).send('Invalid oauth response');
    }
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Login Successful</title>
      </head>
      <body>
        <script>
          const token = '${token}';
          const user = ${JSON.stringify(user)};
          
          localStorage.setItem('authToken', token);
          localStorage.setItem('user', JSON.stringify(user));
          localStorage.setItem('userId', user.id);
          localStorage.setItem('userEmail', user.email);
          localStorage.setItem('isLoggedIn', 'true');
          
          if (user.role) {
            localStorage.setItem('userRole', user.role);
          }

          if (user.profile_picture) {
            const profileImageKey = 'userProfileImage_' + (user.id || user.email || 'default');
            localStorage.setItem(profileImageKey, user.profile_picture);
          }
          
          const fullName = (user.first_name || '') + ' ' + (user.last_name || '');
          localStorage.setItem('userName', fullName.trim());
          
          const nameParts = fullName.trim().split(' ');
          const initials = (nameParts[0] && nameParts[0][0] ? nameParts[0][0] : 'U') + (nameParts.length > 1 && nameParts[nameParts.length - 1][0] ? nameParts[nameParts.length - 1][0] : '');
          localStorage.setItem('userInitials', initials.toUpperCase());
          
          if (user.role === 'admin') {
            window.location.href = 'admin-dashboard.html';
          } else {
            window.location.href = '/';
          }
        </script>
      </body>
      </html>
    `);
  });
  
  app.get('/privacy', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Privacy Policy</title>
        <style>body { font-family: Arial; max-width: 800px; margin: 40px; line-height: 1.6; }</style>
      </head>
      <body>
        <h1>Privacy Policy</h1>
        <p>BanArts respects your privacy. We collect user data only for authentication and profile management purposes.</p>
        <h2>What We Collect</h2>
        <ul>
          <li>Email address and profile information for account creation</li>
          <li>Profile pictures and artwork uploads</li>
          <li>Location and biographical information (optional)</li>
        </ul>
        <h2>How We Use Your Data</h2>
        <p>Your data is used to provide and improve the BanArts platform services. We do not share your information with third parties without your consent.</p>
        <p>For more information, contact us at info@banarts.com</p>
      </body>
      </html>
    `);
  });

  app.get('/terms', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Terms of Service</title>
        <style>body { font-family: Arial; max-width: 800px; margin: 40px; line-height: 1.6; }</style>
      </head>
      <body>
        <h1>Terms of Service</h1>
        <p>By using BanArts, you agree to comply with these terms.</p>
        <h2>User Responsibilities</h2>
        <ul>
          <li>Use this platform responsibly and respectfully</li>
          <li>Respect intellectual property rights of artists</li>
          <li>Do not upload content that violates copyright or is harmful</li>
          <li>Do not engage in harassment or abusive behavior</li>
        </ul>
        <h2>Content Ownership</h2>
        <p>Artists retain all rights to their artwork. By uploading content, you confirm you own the rights to share it.</p>
        <p>For questions, contact us at info@banarts.com</p>
      </body>
      </html>
    `);
  });
  
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });
}

// Graceful shutdown helper
function gracefulShutdown(exitCode) {
  console.log('Shutting down server...');
  try {
    db.close((err) => {
      if (err) console.error('Error closing DB during shutdown:', err);
      else console.log('DB closed');
      process.exit(exitCode || 0);
    });
    // Fallback in case db.close hangs
    setTimeout(() => process.exit(exitCode || 0), 5000);
  } catch (e) {
    console.error('Error during gracefulShutdown:', e);
    process.exit(exitCode || 1);
  }
}

let io;

function startServer() {
  console.log('Routes defined');
  console.log('PORT:', PORT);
  console.log('About to listen on port ' + PORT);
  
  const server = http.createServer(app);
  io = socketIo(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });
  
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
  
  server.listen(PORT, () => {
    console.log('Server running on port ' + PORT);
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use (EADDRINUSE).`);
      console.error('Find and stop the occupying process, or set a different PORT env var.');
    }
    console.error('Server error:', err);
    gracefulShutdown(1);
  });

  process.on('SIGINT', () => gracefulShutdown(0));
  process.on('SIGTERM', () => gracefulShutdown(0));
}
db.on('error', (err) => {
  console.error('DB error:', err);
  process.exit(1);
});
db.on('close', () => {
  console.log('DB closed');
});

// Initialize database tables
function initializeDatabase(done) {
  const sql = `
    -- Users table
    CREATE TABLE IF NOT EXISTS Users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT,
      first_name TEXT,
      last_name TEXT,
      profile_picture TEXT,
      role TEXT DEFAULT 'user',
      user_type TEXT DEFAULT 'visitor',
      oauth_provider TEXT,
      oauth_id TEXT,
      is_active INTEGER DEFAULT 1,
      security_question TEXT,
      security_answer TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ArtistCategories table
    CREATE TABLE IF NOT EXISTS ArtistCategories (
      artist_category_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Artists table
    CREATE TABLE IF NOT EXISTS Artists (
      artist_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT NOT NULL,
      email TEXT,
      contact TEXT,
      location TEXT,
      about TEXT,
      born_year INTEGER,
      specialties TEXT,
      exhibitions TEXT,
      category TEXT,
      photo_url TEXT,
      social_links TEXT,
      is_featured INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE SET NULL
    );

    -- ArtworkCategories table
    CREATE TABLE IF NOT EXISTS ArtworkCategories (
      category_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Artworks table
    CREATE TABLE IF NOT EXISTS Artworks (
      artwork_id INTEGER PRIMARY KEY AUTOINCREMENT,
      artist_id INTEGER,
      categories TEXT,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      medium TEXT,
      year INTEGER,
      size TEXT,
      rarity TEXT,
      condition TEXT,
      signature TEXT,
      certificate TEXT,
      frame TEXT,
      series TEXT,
      image_url TEXT,
      price DECIMAL(10,2),
      is_available INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (artist_id) REFERENCES Artists(artist_id) ON DELETE SET NULL
    );

    -- Galleries table
    CREATE TABLE IF NOT EXISTS Galleries (
      gallery_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      about TEXT,
      location TEXT,
      type TEXT,
      collections TEXT,
      email TEXT,
      phone TEXT,
      image_url TEXT,
      contact_info TEXT,
      website TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Museums table
    CREATE TABLE IF NOT EXISTS Museums (
      museum_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      about TEXT,
      location TEXT,
      image_url TEXT,
      contact_info TEXT,
      website TEXT,
      is_featured INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- MuseumArtifacts table
    CREATE TABLE IF NOT EXISTS MuseumArtifacts (
      artifact_id INTEGER PRIMARY KEY AUTOINCREMENT,
      museum_id INTEGER,
      name TEXT NOT NULL,
      artist TEXT,
      type TEXT,
      medium TEXT,
      dimensions TEXT,
      weight TEXT,
      year INTEGER,
      details TEXT,
      location TEXT,
      condition TEXT,
      status TEXT DEFAULT 'Active',
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (museum_id) REFERENCES Museums(museum_id) ON DELETE CASCADE
    );

    -- Events table
    CREATE TABLE IF NOT EXISTS Events (
      event_id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      name TEXT NOT NULL,
      org TEXT,
      about TEXT,
      date DATETIME,
      location TEXT,
      image_url TEXT,
      logo_url TEXT,
      contact_info TEXT,
      website TEXT,
      status TEXT DEFAULT 'upcoming',
      is_featured INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Videos table
    CREATE TABLE IF NOT EXISTS Videos (
      video_id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      details TEXT,
      url TEXT,
      thumbnail_url TEXT,
      duration TEXT,
      category TEXT,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Collections table
    CREATE TABLE IF NOT EXISTS Collections (
      collection_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      about TEXT,
      image_url TEXT,
      painting_url TEXT,
      collector_name TEXT,
      collector_image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- GalleryThumbnails table
    CREATE TABLE IF NOT EXISTS GalleryThumbnails (
      thumbnail_id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_url TEXT NOT NULL,
      title TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- BrowseGalleries table
    CREATE TABLE IF NOT EXISTS BrowseGalleries (
      browse_gallery_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- BrowseMuseums table
    CREATE TABLE IF NOT EXISTS BrowseMuseums (
      browse_museum_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- UserSavedArtworks table
    CREATE TABLE IF NOT EXISTS UserSavedArtworks (
      save_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      artwork_id INTEGER NOT NULL,
      saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (artwork_id) REFERENCES Artworks(artwork_id) ON DELETE CASCADE,
      UNIQUE(user_id, artwork_id)
    );

    -- UserFollowedArtists table
    CREATE TABLE IF NOT EXISTS UserFollowedArtists (
      follow_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      artist_id INTEGER NOT NULL,
      followed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (artist_id) REFERENCES Artists(artist_id) ON DELETE CASCADE,
      UNIQUE(user_id, artist_id)
    );


    -- CuratedHighlights table
    CREATE TABLE IF NOT EXISTS CuratedHighlights (
      highlight_id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- FeaturedArtworks table
    CREATE TABLE IF NOT EXISTS FeaturedArtworks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- GalleryFeaturedArtworks table
    CREATE TABLE IF NOT EXISTS GalleryFeaturedArtworks (
      gallery_featured_id INTEGER PRIMARY KEY AUTOINCREMENT,
      gallery_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (gallery_id) REFERENCES Galleries(gallery_id) ON DELETE CASCADE
    );

    -- Notifications table
    CREATE TABLE IF NOT EXISTS Notifications (
      notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      related_item_id INTEGER,
      related_item_type TEXT,
      is_read INTEGER DEFAULT 0,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  db.exec(sql, (err) => {
    if (err) {
      console.error('Error creating tables:', err);
      if (done) done(err);
    } else {
      console.log('Database tables initialized');
      // Add new columns if they don't exist (chain to ensure completion)
      addMissingColumns(() => {
        db.run("ALTER TABLE Events ADD COLUMN artworks TEXT", (alterErr) => {
          if (alterErr && !alterErr.message.includes('duplicate column')) {
            console.error('Error adding artworks column:', alterErr);
          } else {
            console.log('Artworks column added or already exists');
          }
          db.run("ALTER TABLE Events ADD COLUMN exhibitors TEXT", (alterErr2) => {
            if (alterErr2 && !alterErr2.message.includes('duplicate column')) {
              console.error('Error adding exhibitors column:', alterErr2);
            } else {
              console.log('Exhibitors column added or already exists');
            }
            db.run("ALTER TABLE Events ADD COLUMN status TEXT DEFAULT 'upcoming'", (alterErr3) => {
              if (alterErr3 && !alterErr3.message.includes('duplicate column')) {
                console.error('Error adding status column:', alterErr3);
              } else {
                console.log('Status column added or already exists');
              }
              db.run("ALTER TABLE Notifications ADD COLUMN expires_at DATETIME", (alterErr4) => {
                if (alterErr4 && !alterErr4.message.includes('duplicate column')) {
                  console.error('Error adding expires_at column:', alterErr4);
                } else {
                  console.log('expires_at column added or already exists');
                }
                if (done) done();
              });
            });
          });
        });
      });
    }
  });
}

function addMissingColumns(done) {
  // Check Users table OAuth columns first
  db.all("PRAGMA table_info(Users)", (err, rows) => {
    if (err) {
      console.error('Error getting Users schema:', err);
      checkArtworksColumns(done);
      return;
    }

    const columns = rows.map(row => row.name);
    const missingColumns = [];

    if (!columns.includes('oauth_token')) missingColumns.push('oauth_token TEXT');
    if (!columns.includes('oauth_refresh_token')) missingColumns.push('oauth_refresh_token TEXT');
    if (!columns.includes('oauth_token_expiry')) missingColumns.push('oauth_token_expiry DATETIME');
    if (!columns.includes('bio')) missingColumns.push('bio TEXT');
    if (!columns.includes('location')) missingColumns.push('location TEXT');
    if (!columns.includes('security_question')) missingColumns.push('security_question TEXT');
    if (!columns.includes('security_answer')) missingColumns.push('security_answer TEXT');

    if (missingColumns.length > 0) {
      console.log('Adding missing OAuth columns to Users:', missingColumns);
      let added = 0;
      missingColumns.forEach(col => {
        db.run(`ALTER TABLE Users ADD COLUMN ${col}`, (alterErr) => {
          if (alterErr && !alterErr.message.includes('duplicate column')) {
            console.error(`Error adding ${col}:`, alterErr);
          } else {
            console.log(`✅ Added ${col} column to Users`);
          }
          added++;
          if (added === missingColumns.length) {
            checkArtworksColumns(done);
          }
        });
      });
    } else {
      checkArtworksColumns(done);
    }
  });
}

function checkArtworksColumns(done) {
  // Check Artworks table columns
  db.all("PRAGMA table_info(Artworks)", (err, rows) => {
    if (err) {
      console.error('Error getting Artworks schema:', err);
      insertDefaultData(() => { if (done) done(); });
      return;
    }

    const columns = rows.map(row => row.name);
    const missingColumns = [];

    if (!columns.includes('social_media')) missingColumns.push('social_media');
    if (!columns.includes('phone')) missingColumns.push('phone');
    if (!columns.includes('email')) missingColumns.push('email');
    if (!columns.includes('is_featured')) missingColumns.push('is_featured INTEGER DEFAULT 0');

    if (missingColumns.length > 0) {
      console.log('Adding missing columns to Artworks:', missingColumns);
      let added = 0;
      missingColumns.forEach(col => {
        const colDef = col.includes(' ') ? col : `${col} TEXT`;
        db.run(`ALTER TABLE Artworks ADD COLUMN ${colDef}`, (alterErr) => {
          if (alterErr) {
            console.error(`Error adding ${col}:`, alterErr);
          } else {
            console.log(`✅ Added ${col} column`);
          }
          added++;
          if (added === missingColumns.length) {
            addGalleryColumns(done);
          }
        });
      });
    } else {
      addGalleryColumns(done);
    }
  });
}

function addGalleryColumns(done) {
     // Check Galleries table columns
     db.all("PRAGMA table_info(Galleries)", (err, rows) => {
       if (err) {
         console.error('Error getting Galleries schema:', err);
         addMuseumColumns(done);
         return;
       }

       const columns = rows.map(row => row.name);
       const missingColumns = [];

       if (!columns.includes('type')) missingColumns.push('type');
       if (!columns.includes('collections')) missingColumns.push('collections');
       if (!columns.includes('email')) missingColumns.push('email');
       if (!columns.includes('phone')) missingColumns.push('phone');
       if (!columns.includes('is_featured')) missingColumns.push('is_featured INTEGER DEFAULT 0');

       if (missingColumns.length > 0) {
         console.log('Adding missing columns to Galleries:', missingColumns);
         let added = 0;
         missingColumns.forEach(col => {
           const colDef = col.includes(' ') ? col : `${col} TEXT`;
           db.run(`ALTER TABLE Galleries ADD COLUMN ${colDef}`, (alterErr) => {
             if (alterErr) {
               console.error(`Error adding ${col}:`, alterErr);
             } else {
               console.log(`✅ Added ${col} column`);
             }
             added++;
             if (added === missingColumns.length) {
               addMuseumColumns(done);
             }
           });
         });
       } else {
         addMuseumColumns(done);
       }
     });
   }

function addMuseumColumns(done) {
     // Check Museums table columns
     db.all("PRAGMA table_info(Museums)", (err, rows) => {
       if (err) {
         console.error('Error getting Museums schema:', err);
         addGalleryThumbnailsColumns(done);
         return;
       }

       const columns = rows.map(row => row.name);
       const missingColumns = [];

       if (!columns.includes('is_featured')) missingColumns.push('is_featured INTEGER DEFAULT 0');

       if (missingColumns.length > 0) {
         console.log('Adding missing columns to Museums:', missingColumns);
         let added = 0;
         missingColumns.forEach(col => {
           const colDef = col.includes(' ') ? col : `${col} TEXT`;
           db.run(`ALTER TABLE Museums ADD COLUMN ${colDef}`, (alterErr) => {
             if (alterErr) {
               console.error(`Error adding ${col}:`, alterErr);
             } else {
               console.log(`✅ Added ${col} column`);
             }
             added++;
             if (added === missingColumns.length) {
               addGalleryThumbnailsColumns(done);
             }
           });
         });
       } else {
         addGalleryThumbnailsColumns(done);
       }
     });
   }


function addGalleryThumbnailsColumns(done) {
  // Check GalleryFeaturedArtworks table columns
  db.all("PRAGMA table_info(GalleryFeaturedArtworks)", (err, rows) => {
    if (err) {
      console.error('Error getting GalleryFeaturedArtworks schema:', err);
      addGalleryThumbnailsColumnsHelper(done);
      return;
    }

    const columns = rows.map(row => row.name);
    if (!columns.includes('price')) {
      db.run('ALTER TABLE GalleryFeaturedArtworks ADD COLUMN price DECIMAL(10,2)', (alterErr) => {
        if (alterErr && !alterErr.message.includes('duplicate column')) {
          console.error('Error adding price column:', alterErr);
        } else {
          console.log('✅ Added price column to GalleryFeaturedArtworks');
        }
        addGalleryThumbnailsColumnsHelper(done);
      });
    } else {
      addGalleryThumbnailsColumnsHelper(done);
    }
  });
}

function addGalleryThumbnailsColumnsHelper(done) {
  // Check GalleryThumbnails table columns
  db.all("PRAGMA table_info(GalleryThumbnails)", (err, rows) => {
    if (err) {
      console.error('Error getting GalleryThumbnails schema:', err);
      insertDefaultData(done);
      return;
    }

    const columns = rows.map(row => row.name);
    const missingColumns = [];

    if (!columns.includes('title')) missingColumns.push('title TEXT');
    if (!columns.includes('description')) missingColumns.push('description TEXT');

    if (missingColumns.length > 0) {
      console.log('Adding missing columns to GalleryThumbnails:', missingColumns);
      let added = 0;
      missingColumns.forEach(col => {
        db.run(`ALTER TABLE GalleryThumbnails ADD COLUMN ${col}`, (alterErr) => {
          if (alterErr) {
            console.error(`Error adding ${col}:`, alterErr);
          } else {
            console.log(`✅ Added ${col} column to GalleryThumbnails`);
          }
          added++;
          if (added === missingColumns.length) {
            addEventColumns(done);
          }
        });
      });
    } else {
      addEventColumns(done);
    }
  });
}

function addEventColumns(done) {
  db.all("PRAGMA table_info(Events)", (err, rows) => {
    if (err) {
      console.error('Error getting Events schema:', err);
      insertDefaultData(done);
      return;
    }

    const columns = rows.map(row => row.name);
    if (!columns.includes('is_featured')) {
      db.run('ALTER TABLE Events ADD COLUMN is_featured INTEGER DEFAULT 0', (alterErr) => {
        if (alterErr) {
          console.error('Error adding is_featured to Events:', alterErr);
        } else {
          console.log('✅ Added is_featured column to Events');
        }
        insertDefaultData(done);
      });
    } else {
      insertDefaultData(done);
    }
  });
}

function insertDefaultData(done) {
  // Clear all notifications to keep bell empty for new users
  db.run('DELETE FROM Notifications', (deleteErr) => {
    if (deleteErr) {
      console.error('Error clearing notifications:', deleteErr);
    } else {
      console.log('Notifications cleared');
    }

    // Insert default admin user (only if not exists)
    db.get('SELECT * FROM Users WHERE email = ?', ['admin@banarts.com'], (err, row) => {
      if (err) {
        console.error('Error checking admin user:', err);
        if (done) done(err);
      } else if (!row) {
        db.run('INSERT INTO Users (email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)', ['admin@banarts.com', 'bantayanonartists2026***', 'Admin', 'User', 'admin'], (err) => {
          if (err) {
            console.error('Error creating admin user:', err);
          } else {
            console.log('Admin user created');
          }
          console.log('Database initialized - preserving existing data');
          if (done) done();
        });
      } else {
        // Force update admin password to the new one
        db.run('UPDATE Users SET password = ? WHERE email = ?', ['bantayanonartists2026***', 'admin@banarts.com'], (err) => {
          if (err) console.error('Error updating admin password:', err);
        });
        console.log('Database initialized - preserving existing data');
        if (done) done();
      }
    });
  });
}

function createNotification(type, message, relatedItemId, relatedItemType) {
  console.log('Creating notification:', { type, message, relatedItemId, relatedItemType });
  
  db.run(
    'INSERT INTO Notifications (type, message, related_item_id, related_item_type, is_read, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [type, message, relatedItemId || null, relatedItemType, 0],
    function(err) {
      if (err) {
        console.error('Error creating notification:', err);
        return;
      }
      const notificationId = this.lastID;
      console.log('Notification inserted with ID:', notificationId);
      
      db.get('SELECT * FROM Notifications WHERE notification_id = ?', [notificationId], (err, notification) => {
        if (err) {
          console.error('Error fetching notification:', err);
          return;
        }
        
        if (!notification) {
          console.error('Notification not found after insertion');
          return;
        }
        
        console.log('Notification fetched:', notification);
        
        if (io && io.sockets) {
          console.log('Broadcasting notification to all clients');
          io.sockets.emit('new_notification', notification);
          console.log('Notification broadcasted successfully');
        } else {
          console.error('Socket.io not available for broadcasting');
        }
      });
    }
  );
}

function getNotifications(callback) {
  db.run('DELETE FROM Notifications WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP', (deleteErr) => {
    if (deleteErr) {
      console.error('Error cleaning up expired notifications:', deleteErr);
    }
    db.all(`SELECT * FROM Notifications 
            WHERE (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
            ORDER BY is_read ASC, created_at DESC LIMIT 50`, (err, rows) => {
      if (err) {
        console.error('Error fetching notifications:', err);
        callback([]);
        return;
      }
      console.log('Fetched notifications:', rows ? rows.length : 0);
      callback(rows || []);
    });
  });
}


// Authentication middleware
const requireAuth = (req, res, next) => {
  // For now, just check if logged in via localStorage (will be handled on frontend)
  next();
};

// Admin authentication middleware
const requireAdmin = (req, res, next) => {
  // For now, just check if logged in via localStorage (will be handled on frontend)
  // In production, verify JWT token and role
  next();
};

// API Routes

// Test endpoint
app.get('/test', (req, res) => {
  console.log('=== TEST ENDPOINT CALLED ===');
  res.json({ message: 'Server is working!', timestamp: new Date().toISOString() });
});

// Clear notifications (temporary)
app.delete('/clear-notifications', (req, res) => {
  db.run('DELETE FROM Notifications', function(err) {
    if (err) {
      console.error('Error clearing notifications:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json({ message: 'Notifications cleared', deleted: this.changes });
  });
});

// Notifications endpoints
app.get('/notifications', (req, res) => {
  getNotifications((notifications) => {
    res.json(notifications);
  });
});

app.get('/notifications/unread-count', (req, res) => {
  db.get('SELECT COUNT(*) as count FROM Notifications WHERE is_read = 0', (err, row) => {
    if (err) {
      console.error('Error counting unread notifications:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json({ count: row.count });
  });
});

app.put('/notifications/mark-all-read', (req, res) => {
  db.run('UPDATE Notifications SET is_read = 1, expires_at = datetime("now", "+2 hours") WHERE is_read = 0', function(err) {
    if (err) {
      console.error('Error marking all notifications as read:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json({ success: true });
  });
});

app.put('/notifications/:id/read', (req, res) => {
  db.run('UPDATE Notifications SET is_read = 1, expires_at = datetime("now", "+2 hours") WHERE notification_id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Error marking notification as read:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json({ success: true });
  });
});

// Login
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM Users WHERE email = ? AND password = ?', [email, password], (err, user) => {
    if (err) {
      console.error('Login error:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    if (user) {
      const token = auth.generateToken(user);
      const processedUser = processImageFields(user);
      res.json({ 
        success: true, 
        token,
        user: { 
          id: processedUser.user_id, 
          email: processedUser.email, 
          role: processedUser.role, 
          first_name: processedUser.first_name, 
          last_name: processedUser.last_name,
          profile_picture: processedUser.profile_picture
        } 
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid email or password. Please check your credentials.' });
    }
  });
});

app.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ success: false, message: 'Logout error' });
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

app.post('/signup', (req, res) => {
  const { email, password, first_name, last_name, security_question, security_answer } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password required' });
  }

  if (!security_question || !security_answer) {
    return res.status(400).json({ success: false, message: 'Security question and answer are required' });
  }

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    return res.status(400).json({ success: false, message: passwordCheck.message });
  }

  db.run(
    'INSERT INTO Users (email, password, first_name, last_name, user_type, role, security_question, security_answer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [email, password, first_name || '', last_name || '', 'visitor', 'user', security_question, security_answer],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ success: false, message: 'Email already exists' });
        }
        console.error('Signup error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
      db.get('SELECT * FROM Users WHERE user_id = ?', [this.lastID], (selectErr, user) => {
        if (selectErr) return res.status(500).json({ success: false, message: 'Server error' });
        const token = auth.generateToken(user);
        res.status(201).json({
          success: true,
          token,
          user: {
            id: user.user_id,
            email: user.email,
            role: user.role,
            first_name: user.first_name,
            last_name: user.last_name,
            profile_picture: user.profile_picture
          }
        });
      });
    }
  );
});

// Check user auth provider status
app.get('/user-auth-status/:email', (req, res) => {
  const { email } = req.params;
  db.get('SELECT user_id, email, oauth_provider FROM Users WHERE email = ?', [email], (err, user) => {
    if (err) {
      console.error('Error checking auth status:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    if (user) {
      const hasOAuth = user.oauth_provider && user.oauth_provider.trim() !== '';
      res.json({
        success: true,
        hasOAuthProvider: !!hasOAuth,
        oauthProvider: user.oauth_provider || null
      });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  });
});

// Change password
app.post('/change-password', (req, res) => {
  const { email, currentPassword, newPassword } = req.body;

  if (!email || !currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  db.get('SELECT * FROM Users WHERE email = ?', [email], (err, user) => {
    if (err) {
      console.error('Password change error:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.oauth_provider) {
      return res.status(403).json({ 
        success: false, 
        message: `Cannot change password for accounts registered with ${user.oauth_provider}. Please manage your password through ${user.oauth_provider}.` 
      });
    }

    if (user.password !== currentPassword) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
      return res.status(400).json({ success: false, message: passwordCheck.message });
    }

    db.run(
      'UPDATE Users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [newPassword, user.user_id],
      function(err) {
        if (err) {
          console.error('Update password error:', err);
          return res.status(500).json({ success: false, message: 'Server error' });
        }
        res.json({ success: true, message: 'Password changed successfully' });
      }
    );
  });
});

// Forgot password / Reset password
app.post('/auth/forgot-password', (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ success: false, message: 'Email and new password are required' });
  }

  db.get('SELECT * FROM Users WHERE email = ?', [email], (err, user) => {
    if (err) {
      console.error('Forgot password error:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.oauth_provider) {
      return res.status(403).json({ 
        success: false, 
        message: `Cannot change password for accounts registered with ${user.oauth_provider}.` 
      });
    }

    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
      return res.status(400).json({ success: false, message: passwordCheck.message });
    }

    db.run(
      'UPDATE Users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [newPassword, user.user_id],
      function(err) {
        if (err) {
          console.error('Reset password update error:', err);
          return res.status(500).json({ success: false, message: 'Server error' });
        }
        res.json({ success: true, message: 'Password has been reset successfully' });
      }
    );
  });
});

// Dashboard stats
app.get('/dashboard', requireAdmin, (req, res) => {
  const queries = [
    'SELECT COUNT(*) as count FROM Users',
    'SELECT COUNT(*) as count FROM Artists',
    'SELECT COUNT(*) as count FROM Museums',
    'SELECT COUNT(*) as count FROM Galleries',
    'SELECT COUNT(*) as count FROM MuseumArtifacts',
    'SELECT COUNT(*) as count FROM Artworks',
    'SELECT COUNT(*) as count FROM Videos',
    'SELECT COUNT(*) as count FROM Events'
  ];

  const results = {};
  let completed = 0;

  queries.forEach((query, index) => {
    const tableName = ['users', 'artists', 'museums', 'galleries', 'artifacts', 'artworks', 'videos', 'events'][index];
    db.get(query, (err, row) => {
      if (err) {
        console.error('Dashboard error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      results[tableName] = row.count;
      completed++;
      if (completed === queries.length) {
        res.json(results);
      }
    });
  });
});

// Artists CRUD
app.get('/artists', (req, res) => {
  db.all('SELECT * FROM Artists ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Get artists error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json(rows.map(row => processImageFields(row)));
  });
});

// Get featured artists
app.get('/artists/featured', (req, res) => {
  db.all('SELECT * FROM Artists WHERE is_featured = 1 ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Get featured artists error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json(rows.map(row => processImageFields(row)));
  });
});

// Get featured artworks
app.get('/artworks/featured', (req, res) => {
  db.all(`
    SELECT a.*, art.name as artist_name
    FROM Artworks a
    LEFT JOIN Artists art ON a.artist_id = art.artist_id
    WHERE a.is_featured = 1
    ORDER BY a.created_at DESC
  `, (err, rows) => {
    if (err) {
      console.error('Get featured artworks error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json(rows.map(row => processImageFields(row)));
  });
});

// Get other artists (not featured)
app.get('/artists/other', (req, res) => {
  db.all('SELECT * FROM Artists WHERE is_featured = 0 OR is_featured IS NULL ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Get other artists error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json(rows.map(row => processImageFields(row)));
  });
});

app.get('/artists/:id', (req, res) => {
  db.get('SELECT * FROM Artists WHERE artist_id = ?', [req.params.id], (err, row) => {
    if (err) {
      console.error('Get artist error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (row) {
      res.json(processImageFields(row));
    } else {
      res.status(404).json({ message: 'Artist not found' });
    }
  });
});

app.post('/artists', upload.single('photo'), (req, res) => {
  console.log('--- ARTIST CREATION REQUEST ---');
  console.log('File:', req.file);
  console.log('Body:', req.body);

  const { name, email, contact, location, about, born_year, specialties, exhibitions, category, is_featured } = req.body;
  const photo_url = req.file ? req.file.path : null;
  
  console.log('Saved photo_url:', photo_url);

  if (!name || !category) {
    console.log('Missing required fields');
    return res.status(400).json({ message: 'Name and category are required' });
  }

  db.run(
    'INSERT INTO Artists (name, email, contact, location, about, born_year, specialties, exhibitions, category, photo_url, is_featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [name, email, contact, location, about, born_year, specialties, exhibitions, category, photo_url, is_featured == 1 ? 1 : 0],
    function(err) {
      if (err) {
        console.error('Create artist error:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
      }
      console.log('Artist inserted with ID:', this.lastID);
      // Get the inserted record
      db.get('SELECT * FROM Artists WHERE artist_id = ?', [this.lastID], (err, row) => {
        if (err) {
          console.error('Get inserted artist error:', err);
          return res.status(500).json({ message: 'Server error', error: err.message });
        }
        console.log('Artist created successfully:', row);
        // Create notification for new artist
        createNotification('artist', `New artist added: ${row.name}`, row.artist_id, 'artist');
        res.json(processImageFields(row));
      });
    }
  );
});

app.put('/artists/:id', upload.single('photo'), (req, res) => {
   const { name, email, contact, location, about, born_year, specialties, exhibitions, category, is_featured } = req.body;
   const photo_url = req.file ? req.file.path : req.body.photo_url;

   db.run(
     'UPDATE Artists SET name = ?, email = ?, contact = ?, location = ?, about = ?, born_year = ?, specialties = ?, exhibitions = ?, category = ?, photo_url = ?, is_featured = ?, updated_at = CURRENT_TIMESTAMP WHERE artist_id = ?',
     [name, email, contact, location, about, born_year, specialties, exhibitions, category, photo_url, is_featured == 1 ? 1 : 0, req.params.id],
     function(err) {
      if (err) {
        console.error('Update artist error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: 'Artist not found' });
      }
      // Get the updated record
      db.get('SELECT * FROM Artists WHERE artist_id = ?', [req.params.id], (err, row) => {
        if (err) {
          console.error('Get updated artist error:', err);
          return res.status(500).json({ message: 'Server error' });
        }
        
        if (row) {
          createNotification('artist_update', `Artist profile updated: ${row.name}`, row.artist_id, 'artist');
        }
        
        res.json(processImageFields(row));
      });
    }
  );
});

app.delete('/artists/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM Artists WHERE artist_id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Delete artist error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Artist not found' });
    }
    res.json({ message: 'Artist deleted' });
  });
});

// Artworks CRUD
app.get('/artworks', (req, res) => {
  const limit = req.query._limit ? parseInt(req.query._limit) : null;
  const artistId = req.query.artist_id ? parseInt(req.query.artist_id) : null;
  const category = req.query.category || req.query.categories;

  let sql = `
    SELECT a.*, art.name as artist_name
    FROM Artworks a
    LEFT JOIN Artists art ON a.artist_id = art.artist_id
  `;

  const params = [];
  const conditions = [];

  if (artistId) {
    conditions.push('a.artist_id = ?');
    params.push(artistId);
  }

  if (category) {
    conditions.push('a.categories LIKE ?');
    params.push(`%${category}%`);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

   sql += ' ORDER BY a.created_at DESC';

   if (limit) {
     sql += ` LIMIT ${limit}`;
   }

   db.all(sql, params, (err, rows) => {
     if (err) {
       console.error('Get artworks error:', err);
       return res.status(500).json({ message: 'Server error' });
     }
     res.json(rows.map(row => processImageFields(row)));
   });
 });

app.get('/artworks/:id', (req, res) => {
   db.get(`
     SELECT a.*, art.name as artist_name, art.photo_url as artist_photo, art.email as artist_email, art.contact as artist_contact, art.about as artist_about, art.category as artist_category
     FROM Artworks a
     LEFT JOIN Artists art ON a.artist_id = art.artist_id
     WHERE a.artwork_id = ?
   `, [req.params.id], (err, row) => {
    if (err) {
      console.error('Get artwork error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (row) {
      res.json(processImageFields(row));
    } else {
      res.status(404).json({ message: 'Artwork not found' });
    }
  });
});

app.post('/artworks', upload.single('image'), (req, res) => {
  try {
    const { title, description, location, medium, year, size, signature, certificate, social_media, phone, email, artist_id, categories, is_featured, price } = req.body;
    const image_url = req.file ? req.file.path.replace(/\\/g, '/') : null;

    db.run(
      'INSERT INTO Artworks (title, description, location, medium, year, size, signature, certificate, social_media, phone, email, image_url, artist_id, categories, is_featured, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [title, description, location, medium, year, size, signature, certificate, social_media, phone, email, image_url, artist_id, categories, is_featured == 1 ? 1 : 0, price],
      function(err) {
        if (err) {
          console.error('Create artwork error:', err);
          return res.status(500).json({ message: 'Server error: ' + err.message });
        }
        
        const lastID = this.lastID;
        // Get the inserted record with artist name
        db.get(`
          SELECT a.*, art.name as artist_name
          FROM Artworks a
          LEFT JOIN Artists art ON a.artist_id = art.artist_id
          WHERE a.artwork_id = ?
        `, [lastID], (err, row) => {
          if (err) {
            console.error('Get inserted artwork error:', err);
            return res.status(500).json({ message: 'Server error' });
          }
          if (!row) {
            return res.status(500).json({ message: 'Error retrieving created artwork' });
          }
          // Create notification for new artwork
          createNotification('artwork', `New artwork added: ${row.title}`, row.artwork_id, 'artwork');
          res.json(processImageFields(row));
        });
      }
    );
  } catch (error) {
    console.error('Artwork POST crash:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.put('/artworks/:id', upload.single('image'), (req, res) => {
  try {
    const { title, description, location, medium, year, size, signature, certificate, social_media, phone, email, artist_id, categories, is_featured, price } = req.body;
    const image_url = req.file ? req.file.path : req.body.image_url;

    db.run(
      'UPDATE Artworks SET title = ?, description = ?, location = ?, medium = ?, year = ?, size = ?, signature = ?, certificate = ?, social_media = ?, phone = ?, email = ?, image_url = ?, artist_id = ?, categories = ?, is_featured = ?, price = ?, updated_at = CURRENT_TIMESTAMP WHERE artwork_id = ?',
      [title, description, location, medium, year, size, signature, certificate, social_media, phone, email, image_url, artist_id, categories, is_featured == 1 ? 1 : 0, price, req.params.id],
      function(err) {
        if (err) {
          console.error('Update artwork error:', err);
          return res.status(500).json({ message: 'Server error: ' + err.message });
        }
        if (this.changes === 0) {
          return res.status(404).json({ message: 'Artwork not found' });
        }
        // Get the updated record
        db.get(`
          SELECT a.*, art.name as artist_name
          FROM Artworks a
          LEFT JOIN Artists art ON a.artist_id = art.artist_id
          WHERE a.artwork_id = ?
        `, [req.params.id], (err, row) => {
          if (err) {
            console.error('Get updated artwork error:', err);
            return res.status(500).json({ message: 'Server error' });
          }
          if (!row) {
            return res.status(500).json({ message: 'Error retrieving updated artwork' });
          }
          
          createNotification('artwork_update', `Artwork updated: ${row.title}`, row.artwork_id, 'artwork');
          
          res.json(processImageFields(row));
        });
      }
    );
  } catch (error) {
    console.error('Artwork PUT crash:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/artworks/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM Artworks WHERE artwork_id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Delete artwork error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Artwork not found' });
    }
    res.json({ message: 'Artwork deleted' });
  });
});


// Galleries CRUD
app.get('/galleries', (req, res) => {
    const limit = req.query._limit ? parseInt(req.query._limit) : null;
    let sql = 'SELECT * FROM Galleries ORDER BY created_at DESC';
    if (limit) {
      sql += ` LIMIT ${limit}`;
    }

    db.all(sql, (err, rows) => {
      if (err) {
        console.error('Get galleries error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      res.json(rows.map(row => {
        const processedRow = processImageFields(row);
        // Fix corrupted type field
        if (processedRow.type === '[object Object]' || !processedRow.type) {
          processedRow.type = 'Art Gallery';
        }
        return processedRow;
      }));
    });
  });

// Get featured galleries
app.get('/galleries/featured', (req, res) => {
     db.all('SELECT * FROM Galleries WHERE is_featured = 1 ORDER BY created_at DESC', (err, rows) => {
       if (err) {
         console.error('Get featured galleries error:', err);
         return res.status(500).json({ message: 'Server error' });
       }
       res.json(rows.map(row => {
         const processedRow = processImageFields(row);
         // Fix corrupted type field
         if (processedRow.type === '[object Object]' || !processedRow.type) {
           processedRow.type = 'Art Gallery';
         }
         return processedRow;
       }));
     });
   });

app.get('/galleries/:id', (req, res) => {
  db.get('SELECT * FROM Galleries WHERE gallery_id = ?', [req.params.id], (err, row) => {
    if (err) {
      console.error('Get gallery error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (row) {
      res.json(processImageFields(row));
    } else {
      res.status(404).json({ message: 'Gallery not found' });
    }
  });
});

app.post('/galleries', requireAuth, upload.single('image'), (req, res) => {
  const { name, about, location, type, collections, email, phone, is_featured } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Gallery name is required' });
  }
  const image_url = req.file ? req.file.path : null;
  db.run(
    'INSERT INTO Galleries (name, about, location, type, collections, email, phone, image_url, is_featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [name, about, location, type, collections, email, phone, image_url, is_featured == 1 ? 1 : 0],
    function(err) {
      if (err) {
        console.error('Create gallery error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      // Get the inserted record
      db.get('SELECT * FROM Galleries WHERE gallery_id = ?', [this.lastID], (err, row) => {
        if (err) {
          console.error('Get inserted gallery error:', err);
          return res.status(500).json({ message: 'Server error' });
        }
        // Create notification for new gallery
        createNotification('gallery', `New gallery added: ${row.name}`, row.gallery_id, 'gallery');
        res.json(processImageFields(row));
      });
    }
  );
});

app.put('/galleries/:id', requireAuth, upload.single('image'), (req, res) => {
  const { name, about, location, type, collections, email, phone, is_featured } = req.body;
  const image_url = req.file ? req.file.path : req.body.image_url;
  db.run(
    'UPDATE Galleries SET name = ?, about = ?, location = ?, type = ?, collections = ?, email = ?, phone = ?, image_url = ?, is_featured = ?, updated_at = CURRENT_TIMESTAMP WHERE gallery_id = ?',
    [name, about, location, type, collections, email, phone, image_url, is_featured == 1 ? 1 : 0, req.params.id],
    function(err) {
      if (err) {
        console.error('Update gallery error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: 'Gallery not found' });
      }
      // Get the updated record
      db.get('SELECT * FROM Galleries WHERE gallery_id = ?', [req.params.id], (err, row) => {
        if (err) {
          console.error('Get updated gallery error:', err);
          return res.status(500).json({ message: 'Server error' });
        }
        
        if (row) {
          createNotification('gallery_update', `Gallery updated: ${row.name}`, row.gallery_id, 'gallery');
        }
        
        res.json(processImageFields(row));
      });
    }
  );
});

app.delete('/galleries/:id', requireAuth, (req, res) => {
     db.run('DELETE FROM Galleries WHERE gallery_id = ?', [req.params.id], function(err) {
       if (err) {
         console.error('Delete gallery error:', err);
         return res.status(500).json({ message: 'Server error' });
       }
       if (this.changes === 0) {
         return res.status(404).json({ message: 'Gallery not found' });
       }
       res.json({ message: 'Gallery deleted' });
     });
   });
 
 // Gallery Featured Artworks CRUD
 app.get('/gallery-featured-artworks', requireAuth, (req, res) => {
   db.all('SELECT gfa.*, g.name as gallery_name FROM GalleryFeaturedArtworks gfa LEFT JOIN Galleries g ON gfa.gallery_id = g.gallery_id WHERE gfa.title IS NOT NULL AND gfa.title != "" ORDER BY display_order ASC, created_at DESC', (err, rows) => {
     if (err) {
       console.error('Get gallery featured artworks error:', err);
       return res.status(500).json({ message: 'Server error' });
     }
     res.json(rows);
   });
 });
 
 app.get('/gallery-featured-artworks/:id', (req, res) => {
   db.get('SELECT * FROM GalleryFeaturedArtworks WHERE gallery_featured_id = ?', [req.params.id], (err, row) => {
     if (err) {
       console.error('Get gallery featured artwork error:', err);
       return res.status(500).json({ message: 'Server error' });
     }
     if (row) {
       res.json(processImageFields(row));
     } else {
       res.status(404).json({ message: 'Gallery featured artwork not found' });
     }
   });
 });
 
 app.post('/gallery-featured-artworks', requireAuth, upload.single('image'), (req, res) => {
   const { gallery_id, title, description, display_order, price } = req.body;
   const image_url = req.file ? req.file.path : null;
 
   console.log('POST /gallery-featured-artworks - gallery_id:', gallery_id, 'title:', title, 'image_url:', image_url, 'price:', price);
 
   if (!gallery_id) {
     return res.status(400).json({ message: 'Gallery ID is required' });
   }
   
   if (!title || title.trim() === '') {
     return res.status(400).json({ message: 'Title is required and cannot be empty' });
   }
 
   db.run(
     'INSERT INTO GalleryFeaturedArtworks (gallery_id, title, description, image_url, display_order, price) VALUES (?, ?, ?, ?, ?, ?)',
     [gallery_id, title, description, image_url, display_order || 0, price || null],
     function(err) {
       if (err) {
         console.error('Create gallery featured artwork error:', err);
         return res.status(500).json({ message: 'Server error' });
       }
       // Get the inserted record
       db.get('SELECT * FROM GalleryFeaturedArtworks WHERE gallery_featured_id = ?', [this.lastID], (err, row) => {
         if (err) {
           console.error('Get inserted gallery featured artwork error:', err);
           return res.status(500).json({ message: 'Server error' });
         }
         // Create notification for new gallery featured artwork
         createNotification('gallery_update', `Featured artwork updated: ${row.title}`, row.gallery_id, 'gallery');
         res.json(processImageFields(row));
       });
     }
   );
 });
 
 app.put('/gallery-featured-artworks/:id', requireAuth, upload.single('image'), (req, res) => {
   const { gallery_id, title, description, display_order, price } = req.body;
   const image_url = req.file ? req.file.path : req.body.image_url;
 
   db.run(
     'UPDATE GalleryFeaturedArtworks SET gallery_id = ?, title = ?, description = ?, image_url = ?, display_order = ?, price = ?, updated_at = CURRENT_TIMESTAMP WHERE gallery_featured_id = ?',
     [gallery_id, title, description, image_url, display_order || 0, price || null, req.params.id],
     function(err) {
       if (err) {
         console.error('Update gallery featured artwork error:', err);
         return res.status(500).json({ message: 'Server error' });
       }
       if (this.changes === 0) {
         return res.status(404).json({ message: 'Gallery featured artwork not found' });
       }
       // Get the updated record
       db.get('SELECT * FROM GalleryFeaturedArtworks WHERE gallery_featured_id = ?', [req.params.id], (err, row) => {
         if (err) {
           console.error('Get updated gallery featured artwork error:', err);
           return res.status(500).json({ message: 'Server error' });
         }

         if (row) {
           createNotification('gallery_update', `Featured artwork updated: ${row.title}`, row.gallery_id, 'gallery');
         }

         res.json(processImageFields(row));
       });
     }
   );
 });
 
 app.delete('/gallery-featured-artworks/:id', requireAuth, (req, res) => {
   db.run('DELETE FROM GalleryFeaturedArtworks WHERE gallery_featured_id = ?', [req.params.id], function(err) {
     if (err) {
       console.error('Delete gallery featured artwork error:', err);
       return res.status(500).json({ message: 'Server error' });
     }
     if (this.changes === 0) {
       return res.status(404).json({ message: 'Gallery featured artwork not found' });
     }
     res.json({ message: 'Gallery featured artwork deleted' });
   });
 });

 // Featured gallery endpoints
app.post('/galleries/reset-featured', requireAuth, (req, res) => {
   db.run('UPDATE Galleries SET is_featured = 0', function(err) {
     if (err) {
       console.error('Reset featured galleries error:', err);
       return res.status(500).json({ message: 'Server error' });
     }
     res.json({ message: 'Featured galleries reset' });
   });
 });

app.post('/galleries/:id/set-featured', requireAuth, (req, res) => {
   db.run('UPDATE Galleries SET is_featured = 1 WHERE gallery_id = ?', [req.params.id], function(err) {
     if (err) {
       console.error('Set featured gallery error:', err);
       return res.status(500).json({ message: 'Server error' });
     }
     if (this.changes === 0) {
       return res.status(404).json({ message: 'Gallery not found' });
     }
     res.json({ message: 'Gallery set as featured' });
   });
 });

// Museums CRUD
app.get('/museums', (req, res) => {
   const limit = req.query._limit ? parseInt(req.query._limit) : null;
   let sql = 'SELECT * FROM Museums ORDER BY created_at DESC';
   if (limit) {
     sql += ` LIMIT ${limit}`;
   }

   db.all(sql, (err, rows) => {
     if (err) {
       console.error('Get museums error:', err);
       return res.status(500).json({ message: 'Server error' });
     }
     res.json(rows.map(row => processImageFields(row)));
   });
 });

// Get featured museums
app.get('/museums/featured', (req, res) => {
  console.log('Fetching featured museums...');
  db.all('SELECT * FROM Museums WHERE is_featured = 1 ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Get featured museums error:', err);
      // If the column doesn't exist yet, return empty array instead of error
      if (err.message.includes('no such column')) {
        return res.json([]);
      }
      return res.status(500).json({ message: 'Server error' });
    }
    console.log(`Found ${rows ? rows.length : 0} featured museums`);
    res.json(rows.map(row => processImageFields(row)));
  });
});

app.get('/museums/:id', (req, res) => {
  db.get('SELECT * FROM Museums WHERE museum_id = ?', [req.params.id], (err, row) => {
    if (err) {
      console.error('Get museum error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (row) {
      res.json(processImageFields(row));
    } else {
      res.status(404).json({ message: 'Museum not found' });
    }
  });
});

app.post('/museums', requireAuth, upload.single('image'), (req, res) => {
  const { name, about, location, contact_info, website, is_featured } = req.body;
  const image_url = req.file ? req.file.path : null;

  if (!name) {
    return res.status(400).json({ message: 'Museum name is required' });
  }

  db.run(
    'INSERT INTO Museums (name, about, location, contact_info, website, image_url, is_featured) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, about, location, contact_info, website, image_url, is_featured == 1 ? 1 : 0],
    function(err) {
      if (err) {
        console.error('Create museum error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      // Get the inserted record
      db.get('SELECT * FROM Museums WHERE museum_id = ?', [this.lastID], (err, row) => {
        if (err) {
          console.error('Get inserted museum error:', err);
          return res.status(500).json({ message: 'Server error' });
        }
        // Create notification for new museum
        createNotification('museum', `New museum added: ${row.name}`, row.museum_id, 'museum');
        res.json(processImageFields(row));
      });
    }
  );
});

app.put('/museums/:id', requireAuth, upload.single('image'), (req, res) => {
  const { name, about, location, contact_info, website, is_featured } = req.body;
  const image_url = req.file ? req.file.path : req.body.image_url;

  db.run(
    'UPDATE Museums SET name = ?, about = ?, location = ?, contact_info = ?, website = ?, image_url = ?, is_featured = ?, updated_at = CURRENT_TIMESTAMP WHERE museum_id = ?',
    [name, about, location, contact_info, website, image_url, is_featured == 1 ? 1 : 0, req.params.id],
    function(err) {
      if (err) {
        console.error('Update museum error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: 'Museum not found' });
      }
      // Get the updated record
      db.get('SELECT * FROM Museums WHERE museum_id = ?', [req.params.id], (err, row) => {
        if (err) {
          console.error('Get updated museum error:', err);
          return res.status(500).json({ message: 'Server error' });
        }
        
        if (row) {
          createNotification('museum_update', `Museum updated: ${row.name}`, row.museum_id, 'museum');
        }
        
        res.json(processImageFields(row));
      });
    }
  );
});

app.delete('/museums/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM Museums WHERE museum_id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Delete museum error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Museum not found' });
    }
    res.json({ message: 'Museum deleted' });
  });
});

// Search across all entities
app.get('/search', (req, res) => {
  const query = req.query.q;
  
  if (!query || query.trim() === '') {
    return res.status(400).json({ message: 'Search query is required' });
  }

  const searchTerm = `%${query}%`;
  const results = {
    artworks: [],
    artists: [],
    museums: [],
    galleries: []
  };

  let completed = 0;

  db.all(`
    SELECT a.*, art.name as artist_name
    FROM Artworks a
    LEFT JOIN Artists art ON a.artist_id = art.artist_id
    WHERE a.title LIKE ?
    ORDER BY a.created_at DESC
  `, [searchTerm], (err, rows) => {
    if (err) {
      console.error('Search artworks error:', err);
    } else {
      results.artworks = rows || [];
    }
    completed++;
    if (completed === 4) res.json(results);
  });

  db.all(`
    SELECT *
    FROM Artists
    WHERE name LIKE ?
    ORDER BY created_at DESC
  `, [searchTerm], (err, rows) => {
    if (err) {
      console.error('Search artists error:', err);
    } else {
      results.artists = rows || [];
    }
    completed++;
    if (completed === 4) res.json(results);
  });

  db.all(`
    SELECT *
    FROM Museums
    WHERE name LIKE ?
    ORDER BY created_at DESC
  `, [searchTerm], (err, rows) => {
    if (err) {
      console.error('Search museums error:', err);
    } else {
      results.museums = rows || [];
    }
    completed++;
    if (completed === 4) res.json(results);
  });

  db.all(`
    SELECT *
    FROM Galleries
    WHERE name LIKE ?
    ORDER BY created_at DESC
  `, [searchTerm], (err, rows) => {
    if (err) {
      console.error('Search galleries error:', err);
    } else {
      results.galleries = rows || [];
    }
    completed++;
    if (completed === 4) res.json(results);
  });
});

// Events CRUD
app.get('/events', (req, res) => {
  db.all('SELECT * FROM Events ORDER BY date DESC', (err, rows) => {
    if (err) {
      console.error('Get events error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    // Parse JSON fields
    rows.forEach(row => {
      if (row.artworks) {
        try {
          row.artworks = JSON.parse(row.artworks);
        } catch (e) {
          row.artworks = [];
        }
      }
      if (row.exhibitors) {
        try {
          row.exhibitors = JSON.parse(row.exhibitors);
        } catch (e) {
          row.exhibitors = [];
        }
      }
    });
    res.json(rows.map(row => processImageFields(row)));
  });
});

// Get featured events
app.get('/events/featured', (req, res) => {
  db.all('SELECT * FROM Events WHERE is_featured = 1 ORDER BY date DESC', (err, rows) => {
    if (err) {
      console.error('Get featured events error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    // Parse JSON fields
    rows.forEach(row => {
      if (row.artworks) {
        try {
          row.artworks = JSON.parse(row.artworks);
        } catch (e) {
          row.artworks = [];
        }
      }
      if (row.exhibitors) {
        try {
          row.exhibitors = JSON.parse(row.exhibitors);
        } catch (e) {
          row.exhibitors = [];
        }
      }
    });
    res.json(rows.map(row => processImageFields(row)));
  });
});

app.get('/events/:id', (req, res) => {
  db.get('SELECT * FROM Events WHERE event_id = ?', [req.params.id], (err, row) => {
    if (err) {
      console.error('Get event error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (row) {
      // Parse JSON fields
      if (row.artworks) {
        try {
          row.artworks = JSON.parse(row.artworks);
        } catch (e) {
          row.artworks = [];
        }
      }
      if (row.exhibitors) {
        try {
          row.exhibitors = JSON.parse(row.exhibitors);
        } catch (e) {
          row.exhibitors = [];
        }
      }
      res.json(processImageFields(row));
    } else {
      res.status(404).json({ message: 'Event not found' });
    }
  });
});

app.post('/events', requireAuth, upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'artwork_files', maxCount: 50 }
]), (req, res) => {
    try {
        const { type, name, org, about, date, location, logo_url, status, is_featured } = req.body;

        // Extract array fields that might have [] in their names
        const artwork_names = req.body.artwork_names || req.body['artwork_names[]'] || [];
        const artwork_artists = req.body.artwork_artists || req.body['artwork_artists[]'] || [];
        const exhibitors = req.body.exhibitors || req.body['exhibitors[]'] || [];

    // Event image
    let image_url = null;
    if (req.files && req.files['image'] && req.files['image'][0]) {
        image_url = req.files['image'][0].path;
    }

    // Process artworks
    const eventArtworks = [];
    if (req.files && req.files['artwork_files']) {
        const files = req.files['artwork_files'];
        const names = Array.isArray(artwork_names) ? artwork_names : [artwork_names];
        const artists = Array.isArray(artwork_artists) ? artwork_artists : [artwork_artists];

        files.forEach((file, index) => {
            eventArtworks.push({
                title: names[index] || `Artwork ${index + 1}`,
                artist_name: artists[index] || 'Unknown Artist',
                image_url: file.path
            });
        });
    }

    if (!name) {
      return res.status(400).json({ message: 'Event name is required' });
    }

    if (eventArtworks.length < 10) {
        return res.status(400).json({ message: 'A minimum of 10 artworks is required' });
    }

    // Format date for SQLite
    let formattedDate = date;
    if (date && typeof date === 'string' && date.includes('T')) {
        formattedDate = date.replace('T', ' ') + ':00';
    }

    const eventStatus = status || 'upcoming';
    const exhibitorsList = Array.isArray(exhibitors) ? exhibitors : (exhibitors ? [exhibitors] : []);

    db.run(
      'INSERT INTO Events (type, name, org, about, date, location, image_url, logo_url, artworks, exhibitors, status, is_featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [type || 'event', name, org, about, formattedDate, location, image_url, logo_url, JSON.stringify(eventArtworks), JSON.stringify(exhibitorsList), eventStatus, is_featured == 1 ? 1 : 0],
      function(err) {
       if (err) {
         console.error('Create event error:', err);
         return res.status(500).json({ message: 'Server error: ' + err.message });
       }
       // Get the inserted record
       db.get('SELECT * FROM Events WHERE event_id = ?', [this.lastID], (err, row) => {
         if (err) {
           console.error('Get inserted event error:', err);
           return res.status(500).json({ message: 'Server error' });
         }

         if (!row) {
             return res.status(404).json({ message: 'Event not found after insertion' });
         }

         // Parse JSON fields
         if (row.artworks) {
           try {
             row.artworks = JSON.parse(row.artworks);
           } catch (e) {
             row.artworks = [];
           }
         }
         if (row.exhibitors) {
           try {
             row.exhibitors = JSON.parse(row.exhibitors);
           } catch (e) {
             row.exhibitors = [];
           }
         }
         // Create notification for new event
         createNotification('event', `New event added: ${row.name}`, row.event_id, 'event');
         res.json(processImageFields(row));
       });
     }
   );
    } catch (error) {
        console.error('Unexpected error in POST /events:', error);
        res.status(500).json({ message: 'Internal server error: ' + error.message });
    }
 });

app.put('/events/:id', requireAuth, upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'artwork_files', maxCount: 50 }
]), (req, res) => {
    try {
        const { type, name, org, about, date, location, logo_url, status, is_featured } = req.body;
        const id = req.params.id;

        // Extract array fields that might have [] in their names
        const artwork_source = req.body.artwork_source || req.body['artwork_source[]'] || [];
        const artwork_names = req.body.artwork_names || req.body['artwork_names[]'] || [];
        const artwork_artists = req.body.artwork_artists || req.body['artwork_artists[]'] || [];
        const existing_artwork_urls = req.body.existing_artwork_urls || req.body['existing_artwork_urls[]'] || [];
        const exhibitors = req.body.exhibitors || req.body['exhibitors[]'] || [];

    // Event image
    let image_url = req.body.image_url;
    if (req.files && req.files['image'] && req.files['image'][0]) {
        image_url = req.files['image'][0].path;
    }

    // Process artworks
    let eventArtworks = [];
    if (artwork_source) {
        const sources = Array.isArray(artwork_source) ? artwork_source : [artwork_source];
        const names = Array.isArray(artwork_names) ? artwork_names : [artwork_names];
        const artists = Array.isArray(artwork_artists) ? artwork_artists : [artwork_artists];
        const existingUrls = Array.isArray(existing_artwork_urls) ? existing_artwork_urls : [existing_artwork_urls].filter(Boolean);
        const files = (req.files && req.files['artwork_files']) ? req.files['artwork_files'] : [];

        let fileIndex = 0;
        let existingIndex = 0;

        sources.forEach((source, i) => {
            if (source === 'new' && files[fileIndex]) {
                eventArtworks.push({
                    title: names[i] || `Artwork ${i + 1}`,
                    artist_name: artists[i] || 'Unknown Artist',
                    image_url: files[fileIndex++].path
                });
            } else if (source === 'existing' && existingUrls[existingIndex]) {
                eventArtworks.push({
                    title: names[i] || `Artwork ${i + 1}`,
                    artist_name: artists[i] || 'Unknown Artist',
                    image_url: existingUrls[existingIndex++]
                });
            }
        });
    } else if (req.body.artworks) {
        // Fallback for older data or different submission method
        try {
            eventArtworks = typeof req.body.artworks === 'string' ? JSON.parse(req.body.artworks) : req.body.artworks;
        } catch (e) {
            eventArtworks = [];
        }
    }

    if (!name) {
      return res.status(400).json({ message: 'Event name is required' });
    }

    // Format date for SQLite
    let formattedDate = date;
    if (date && typeof date === 'string' && date.includes('T')) {
        formattedDate = date.replace('T', ' ') + ':00';
    }

    const eventStatus = status || 'upcoming';
    const exhibitorsList = Array.isArray(exhibitors) ? exhibitors : (exhibitors ? [exhibitors] : []);

    const updateEventRecord = (finalArtworks) => {
        db.run(
          'UPDATE Events SET type = ?, name = ?, org = ?, about = ?, date = ?, location = ?, image_url = ?, logo_url = ?, artworks = ?, exhibitors = ?, status = ?, is_featured = ?, updated_at = CURRENT_TIMESTAMP WHERE event_id = ?',
          [type || 'event', name, org, about, formattedDate, location, image_url, logo_url, JSON.stringify(finalArtworks), JSON.stringify(exhibitorsList), eventStatus, is_featured == 1 ? 1 : 0, id],
          function(err) {
           if (err) {
             console.error('Update event error:', err);
             return res.status(500).json({ message: 'Server error: ' + err.message });
           }
           if (this.changes === 0) {
             return res.status(404).json({ message: 'Event not found' });
           }
           // Get the updated record
           db.get('SELECT * FROM Events WHERE event_id = ?', [id], (err, row) => {
             if (err) {
               console.error('Get updated event error:', err);
               return res.status(500).json({ message: 'Server error' });
             }
             
             if (!row) {
                return res.status(404).json({ message: 'Event not found after update' });
             }

             // Parse JSON fields
             if (row.artworks) {
               try {
                 row.artworks = JSON.parse(row.artworks);
               } catch (e) {
                 row.artworks = [];
               }
             }
             if (row.exhibitors) {
               try {
                 row.exhibitors = JSON.parse(row.exhibitors);
               } catch (e) {
                 row.exhibitors = [];
               }
             }
             
             createNotification('event_update', `Event updated: ${row.name}`, row.event_id, 'event');
             res.json(processImageFields(row));
           });
         }
       );
    };

    if (eventArtworks.length === 0 && (!artwork_source || artwork_source.length === 0) && !req.body.artworks) {
        db.get('SELECT artworks FROM Events WHERE event_id = ?', [id], (err, row) => {
            let existingArtworks = [];
            if (row && row.artworks) {
                try {
                    existingArtworks = JSON.parse(row.artworks);
                } catch(e) {}
            }
            updateEventRecord(existingArtworks);
        });
    } else {
        updateEventRecord(eventArtworks);
    }
} catch (error) {
    console.error('Unexpected error in PUT /events/:id:', error);
    res.status(500).json({ message: 'Internal server error: ' + error.message });
}
});

app.delete('/events/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM Events WHERE event_id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Delete event error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json({ message: 'Event deleted' });
  });
});

app.post('/events/:id/set-featured', requireAuth, (req, res) => {
  db.run('UPDATE Events SET is_featured = 1 WHERE event_id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Set featured event error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json({ message: 'Event set as featured' });
  });
});

app.post('/events/:id/unset-featured', requireAuth, (req, res) => {
  db.run('UPDATE Events SET is_featured = 0 WHERE event_id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Unset featured event error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json({ message: 'Event removed from featured' });
  });
});

// Videos CRUD
app.get('/videos', (req, res) => {
  db.all('SELECT * FROM Videos ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Get videos error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json(rows.map(row => processImageFields(row)));
  });
});

app.get('/videos/:id', (req, res) => {
  db.get('SELECT * FROM Videos WHERE video_id = ?', [req.params.id], (err, row) => {
    if (err) {
      console.error('Get video error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (row) {
      res.json(processImageFields(row));
    } else {
      res.status(404).json({ message: 'Video not found' });
    }
  });
});

app.post('/videos', requireAuth, (req, res) => {
  const { title, details, url } = req.body;
  db.run(
    'INSERT INTO Videos (title, details, url) VALUES (?, ?, ?)',
    [title, details, url],
    function(err) {
      if (err) {
        console.error('Create video error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      // Get the inserted record
      db.get('SELECT * FROM Videos WHERE video_id = ?', [this.lastID], (err, row) => {
        if (err) {
          console.error('Get inserted video error:', err);
          return res.status(500).json({ message: 'Server error' });
        }
        // Create notification for new video
        createNotification('video', `New video added: ${row.title}`, row.video_id, 'video');
        res.json(processImageFields(row));
      });
    }
  );
});

app.put('/videos/:id', requireAuth, (req, res) => {
  const { title, details, url } = req.body;
  db.run(
    'UPDATE Videos SET title = ?, details = ?, url = ?, updated_at = CURRENT_TIMESTAMP WHERE video_id = ?',
    [title, details, url, req.params.id],
    function(err) {
      if (err) {
        console.error('Update video error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: 'Video not found' });
      }
      // Get the updated record
      db.get('SELECT * FROM Videos WHERE video_id = ?', [req.params.id], (err, row) => {
        if (err) {
          console.error('Get updated video error:', err);
          return res.status(500).json({ message: 'Server error' });
        }
        
        if (row) {
          createNotification('video_update', `Video updated: ${row.title}`, row.video_id, 'video');
        }
        
        res.json(processImageFields(row));
      });
    }
  );
});

app.delete('/videos/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM Videos WHERE video_id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Delete video error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Video not found' });
    }
    res.json({ message: 'Video deleted' });
  });
});

// Collections CRUD
app.get('/collections', (req, res) => {
  db.all('SELECT * FROM Collections ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Get collections error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json(rows.map(row => processImageFields(row)));
  });
});

app.get('/collections/:id', (req, res) => {
  db.get('SELECT * FROM Collections WHERE collection_id = ?', [req.params.id], (err, row) => {
    if (err) {
      console.error('Get collection error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (row) {
      res.json(processImageFields(row));
    } else {
      res.status(404).json({ message: 'Collection not found' });
    }
  });
});

app.post('/collections', requireAuth, uploadCollections.single('collector_image'), (req, res) => {
   const { name, about, collector_name } = req.body;
   const name_final = name || (collector_name ? collector_name + "'s Collection" : 'New Collection');
   const image_url = req.file ? req.file.path : null;
   const painting_url = null;
   const collector_image = req.file ? req.file.path : null;

   db.run(
      'INSERT INTO Collections (name, about, image_url, painting_url, collector_name, collector_image) VALUES (?, ?, ?, ?, ?, ?)',
      [name_final, about, image_url, painting_url, collector_name, collector_image],
      function(err) {
         if (err) {
            console.error('Create collection error:', err);
            return res.status(500).json({ message: 'Server error' });
         }
         // Get the inserted record
         db.get('SELECT * FROM Collections WHERE collection_id = ?', [this.lastID], (err, row) => {
            if (err) {
               console.error('Get inserted collection error:', err);
               return res.status(500).json({ message: 'Server error' });
            }
            // Create notification for new collection
            createNotification('collection', `New collection added: ${row.name}`, row.collection_id, 'collection');
            res.json(processImageFields(row));
         });
      }
   );
});

app.put('/collections/:id', requireAuth, uploadCollections.single('collector_image'), (req, res) => {
   const { name, about, collector_name } = req.body;
   const name_final = name || (collector_name ? collector_name + "'s Collection" : 'New Collection');
   const image_url = req.file ? req.file.path : req.body.image_url;
   const painting_url = req.body.painting_url || null;
   const collector_image = req.file ? req.file.path : req.body.collector_image;

   db.run(
      'UPDATE Collections SET name = ?, about = ?, image_url = ?, painting_url = ?, collector_name = ?, collector_image = ?, updated_at = CURRENT_TIMESTAMP WHERE collection_id = ?',
      [name_final, about, image_url, painting_url, collector_name, collector_image, req.params.id],
      function(err) {
         if (err) {
            console.error('Update collection error:', err);
            return res.status(500).json({ message: 'Server error' });
         }
         if (this.changes === 0) {
            return res.status(404).json({ message: 'Collection not found' });
         }
         // Get the updated record
         db.get('SELECT * FROM Collections WHERE collection_id = ?', [req.params.id], (err, row) => {
            if (err) {
               console.error('Get updated collection error:', err);
               return res.status(500).json({ message: 'Server error' });
            }
            
            if (row) {
              createNotification('collection_update', `Collection updated: ${row.name}`, row.collection_id, 'collection');
            }
            
            res.json(processImageFields(row));
         });
      }
   );
});

app.delete('/collections/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM Collections WHERE collection_id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Delete collection error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Collection not found' });
    }
    res.json({ message: 'Collection deleted' });
  });

});

// Artwork Categories
app.get('/artworkcategories', (req, res) => {
  db.all('SELECT * FROM ArtworkCategories ORDER BY name', (err, rows) => {
    if (err) {
      console.error('Get artwork categories error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json(rows);
  });
});

// Artist Categories
app.get('/artist-categories', (req, res) => {
  db.all('SELECT * FROM ArtistCategories ORDER BY name', (err, rows) => {
    if (err) {
      console.error('Get artist categories error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json(rows);
  });
});

app.get('/artist-categories/:id', (req, res) => {
  db.get('SELECT * FROM ArtistCategories WHERE artist_category_id = ?', [req.params.id], (err, row) => {
    if (err) {
      console.error('Get artist category error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (row) {
      res.json(processImageFields(row));
    } else {
      res.status(404).json({ message: 'Artist category not found' });
    }
  });
});

app.post('/artist-categories', requireAuth, (req, res) => {
  const { name, description } = req.body;
  db.run('INSERT INTO ArtistCategories (name, description) VALUES (?, ?)', [name, description], function(err) {
    if (err) {
      console.error('Create artist category error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    // Get the inserted record
    db.get('SELECT * FROM ArtistCategories WHERE artist_category_id = ?', [this.lastID], (err, row) => {
      if (err) {
        console.error('Get inserted artist category error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      res.json(processImageFields(row));
    });
  });
});

app.put('/artist-categories/:id', requireAuth, (req, res) => {
  const { name, description } = req.body;
  db.run('UPDATE ArtistCategories SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE artist_category_id = ?', [name, description, req.params.id], function(err) {
    if (err) {
      console.error('Update artist category error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Artist category not found' });
    }
    // Get the updated record
    db.get('SELECT * FROM ArtistCategories WHERE artist_category_id = ?', [req.params.id], (err, row) => {
      if (err) {
        console.error('Get updated artist category error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      res.json(processImageFields(row));
    });
  });
});

app.delete('/artist-categories/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM ArtistCategories WHERE artist_category_id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Delete artist category error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Artist category not found' });
    }
    res.json({ message: 'Artist category deleted' });
  });
});

// Artifacts CRUD
app.get('/artifacts', (req, res) => {
  db.all('SELECT * FROM MuseumArtifacts ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Get artifacts error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json(rows.map(row => processImageFields(row)));
  });
});

app.get('/artifacts/:id', (req, res) => {
  db.get('SELECT * FROM MuseumArtifacts WHERE artifact_id = ?', [req.params.id], (err, row) => {
    if (err) {
      console.error('Get artifact error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (row) {
      res.json(processImageFields(row));
    } else {
      res.status(404).json({ message: 'Artifact not found' });
    }
  });
});

app.post('/artifacts', requireAuth, upload.single('image'), (req, res) => {
  const { museum_id, name, artist, type, medium, dimensions, weight, year, details, location, condition, status } = req.body;
  const image_url = req.file ? req.file.path : null;

  if (!name || !museum_id) {
    return res.status(400).json({ message: 'Name and museum are required' });
  }

  db.run(
    'INSERT INTO MuseumArtifacts (museum_id, name, artist, type, medium, dimensions, weight, year, details, location, condition, status, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [museum_id, name, artist, type, medium, dimensions, weight, year, details, location, condition, status, image_url],
    function(err) {
      if (err) {
        console.error('Create artifact error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      // Get the inserted record
      db.get('SELECT * FROM MuseumArtifacts WHERE artifact_id = ?', [this.lastID], (err, row) => {
        if (err) {
          console.error('Get inserted artifact error:', err);
          return res.status(500).json({ message: 'Server error' });
        }
        // Create notification for new artifact
        createNotification('museum_update', `Featured artifact updated: ${row.name}`, row.museum_id, 'museum');
        res.json(processImageFields(row));
      });
    }
  );
});

app.put('/artifacts/:id', requireAuth, upload.single('image'), (req, res) => {
  const { museum_id, name, artist, type, medium, dimensions, weight, year, details, location, condition, status } = req.body;
  const image_url = req.file ? req.file.path : req.body.image_url;

  if (!name || !museum_id) {
    return res.status(400).json({ message: 'Name and museum are required' });
  }

  db.run(
    'UPDATE MuseumArtifacts SET museum_id = ?, name = ?, artist = ?, type = ?, medium = ?, dimensions = ?, weight = ?, year = ?, details = ?, location = ?, condition = ?, status = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE artifact_id = ?',
    [museum_id, name, artist, type, medium, dimensions, weight, year, details, location, condition, status, image_url, req.params.id],
    function(err) {
      if (err) {
        console.error('Update artifact error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: 'Artifact not found' });
      }
      // Get the updated record
      db.get('SELECT * FROM MuseumArtifacts WHERE artifact_id = ?', [req.params.id], (err, row) => {
        if (err) {
          console.error('Get updated artifact error:', err);
          return res.status(500).json({ message: 'Server error' });
        }
        
        if (row) {
          createNotification('museum_update', `Featured artifact updated: ${row.name}`, row.museum_id, 'museum');
        }
        
        res.json(processImageFields(row));
      });
    }
  );
});

app.delete('/artifacts/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM MuseumArtifacts WHERE artifact_id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Delete artifact error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Artifact not found' });
    }
    res.json({ message: 'Artifact deleted' });
  });
});

// Gallery Thumbnails CRUD
app.get('/thumbnails', (req, res) => {
  db.all('SELECT * FROM GalleryThumbnails ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Get thumbnails error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json(rows.map(row => processImageFields(row)));
  });
});

app.post('/thumbnails', requireAuth, upload.array('images', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: 'No images uploaded' });
  }

  // Parse items data from JSON
  let itemsData = [];
  try {
    itemsData = JSON.parse(req.body.items || '[]');
  } catch (e) {
    console.error('Error parsing items data:', e);
    return res.status(400).json({ message: 'Invalid items data' });
  }

  if (itemsData.length !== req.files.length) {
    return res.status(400).json({ message: 'Number of items does not match number of images' });
  }

  const imageUrls = req.files.map(file => file.path);

  const insertPromises = imageUrls.map((image_url, index) => {
    const title = itemsData[index]?.title || '';
    const description = itemsData[index]?.description || '';

    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO GalleryThumbnails (image_url, title, description) VALUES (?, ?, ?)',
        [image_url, title, description],
        function(err) {
          if (err) {
            console.error('Create thumbnail error:', err);
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  });

  Promise.all(insertPromises)
    .then(lastIDs => {
      // Get all inserted records
      const placeholders = lastIDs.map(() => '?').join(',');
      db.all(`SELECT * FROM GalleryThumbnails WHERE thumbnail_id IN (${placeholders})`, lastIDs, (err, rows) => {
        if (err) {
          console.error('Get inserted thumbnails error:', err);
          return res.status(500).json({ message: 'Server error' });
        }
        res.json(rows);
      });
    })
    .catch(err => {
      console.error('Thumbnail insertion error:', err);
      res.status(500).json({ message: 'Server error' });
    });
});

app.get('/thumbnails/:id', (req, res) => {
  db.get('SELECT * FROM GalleryThumbnails WHERE thumbnail_id = ?', [parseInt(req.params.id)], (err, row) => {
    if (err) {
      console.error('Get thumbnail error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (row) {
      res.json(processImageFields(row));
    } else {
      res.status(404).json({ message: 'Thumbnail not found' });
    }
  });
});

app.put('/thumbnails/:id', upload.single('image'), (req, res) => {
  console.log('PUT /thumbnails/:id called with id:', req.params.id);
  console.log('Body:', req.body);
  console.log('File:', req.file);

  const { title, description } = req.body;

  // Validate required fields
  if (!title || !description) {
    console.log('Validation failed: title or description missing');
    return res.status(400).json({ message: 'Title and description are required' });
  }

  // Build the update query dynamically based on whether an image was uploaded
  let updateFields = 'title = ?, description = ?';
  let params = [title, description];

  if (req.file) {
    const imageUrl = req.file.path;
    updateFields = 'title = ?, description = ?, image_url = ?';
    params = [title, description, imageUrl];
    console.log('New image uploaded:', imageUrl);
  } else {
    console.log('No new image uploaded, keeping existing image');
  }

  console.log('Update query:', `UPDATE GalleryThumbnails SET ${updateFields} WHERE thumbnail_id = ?`);
  console.log('Params:', params);

  db.run(
    `UPDATE GalleryThumbnails SET ${updateFields} WHERE thumbnail_id = ?`,
    [...params, parseInt(req.params.id)],
    function(err) {
      if (err) {
        console.error('Update thumbnail error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      if (this.changes === 0) {
        console.error('No thumbnail found with id:', req.params.id);
        return res.status(404).json({ message: 'Thumbnail not found' });
      }
      console.log('Thumbnail updated successfully, changes:', this.changes);
      // Get the updated record
      db.get('SELECT * FROM GalleryThumbnails WHERE thumbnail_id = ?', [parseInt(req.params.id)], (err, row) => {
        if (err) {
          console.error('Get updated thumbnail error:', err);
          return res.status(500).json({ message: 'Server error' });
        }
        console.log('Updated thumbnail:', row);
        res.json(processImageFields(row));
      });
    }
  );
});

app.delete('/thumbnails/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM GalleryThumbnails WHERE thumbnail_id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Delete thumbnail error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Thumbnail not found' });
    }
    res.json({ message: 'Thumbnail deleted' });
  });
});

// Browse Galleries CRUD
app.get('/browse-galleries', (req, res) => {
  db.all('SELECT * FROM BrowseGalleries ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Get browse galleries error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json(rows);
  });
});

app.post('/browse-galleries', requireAuth, (req, res) => {
  const { name, location, image_url } = req.body;
  db.run(
    'INSERT INTO BrowseGalleries (name, location, image_url) VALUES (?, ?, ?)',
    [name, location, image_url],
    function(err) {
      if (err) {
        console.error('Create browse gallery error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      // Get the inserted record
      db.get('SELECT * FROM BrowseGalleries WHERE browse_gallery_id = ?', [this.lastID], (err, row) => {
        if (err) {
          console.error('Get inserted browse gallery error:', err);
          return res.status(500).json({ message: 'Server error' });
        }
        res.json(processImageFields(row));
      });
    }
  );
});

app.delete('/browse-galleries/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM BrowseGalleries WHERE browse_gallery_id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Delete browse gallery error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Browse gallery not found' });
    }
    res.json({ message: 'Browse gallery deleted' });
  });
});

// Browse Museums CRUD
app.get('/browse-museums', (req, res) => {
  db.all('SELECT * FROM BrowseMuseums ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Get browse museums error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json(rows);
  });
});

app.post('/browse-museums', requireAuth, (req, res) => {
  const { name, location, image_url } = req.body;
  db.run(
    'INSERT INTO BrowseMuseums (name, location, image_url) VALUES (?, ?, ?)',
    [name, location, image_url],
    function(err) {
      if (err) {
        console.error('Create browse museum error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      // Get the inserted record
      db.get('SELECT * FROM BrowseMuseums WHERE browse_museum_id = ?', [this.lastID], (err, row) => {
        if (err) {
          console.error('Get inserted browse museum error:', err);
          return res.status(500).json({ message: 'Server error' });
        }
        res.json(processImageFields(row));
      });
    }
  );
});

app.delete('/browse-museums/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM BrowseMuseums WHERE browse_museum_id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Delete browse museum error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Browse museum not found' });
    }
    res.json({ message: 'Browse museum deleted' });
  });
});

// Curated Highlights CRUD
app.get('/curated-highlights', (req, res) => {
  db.all('SELECT * FROM CuratedHighlights ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Get curated highlights error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json(rows);
  });
});

app.post('/curated-highlights', requireAuth, (req, res) => {
  const { title, description, image_url } = req.body;
  db.run('INSERT INTO CuratedHighlights (title, description, image_url) VALUES (?, ?, ?)', [title, description, image_url], function(err) {
    if (err) {
      console.error('Create curated highlight error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    db.get('SELECT * FROM CuratedHighlights WHERE highlight_id = ?', [this.lastID], (err, row) => {
      if (err) {
        console.error('Get inserted curated highlight error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      res.json(processImageFields(row));
    });
  });
});

app.put('/curated-highlights/:id', requireAuth, (req, res) => {
  const { title, description, image_url } = req.body;
  db.run('UPDATE CuratedHighlights SET title = ?, description = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE highlight_id = ?', [title, description, image_url, req.params.id], function(err) {
    if (err) {
      console.error('Update curated highlight error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Curated highlight not found' });
    }
    db.get('SELECT * FROM CuratedHighlights WHERE highlight_id = ?', [req.params.id], (err, row) => {
      if (err) {
        console.error('Get updated curated highlight error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      res.json(processImageFields(row));
    });
  });
});

app.delete('/curated-highlights/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM CuratedHighlights WHERE highlight_id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Delete curated highlight error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Curated highlight not found' });
    }
    res.json({ message: 'Curated highlight deleted' });
  });
});

// Featured Artworks CRUD
app.get('/featured-artworks', (req, res) => {
  db.all('SELECT * FROM FeaturedArtworks ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Get featured artworks error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json(rows.map(row => processImageFields(row)));
  });
});

app.post('/featured-artworks', requireAuth, upload.single('image'), (req, res) => {
  const { name } = req.body;
  const image_url = req.file ? req.file.path : null;

  db.run(
    'INSERT INTO FeaturedArtworks (name, image_url) VALUES (?, ?)',
    [name, image_url],
    function(err) {
      if (err) {
        console.error('Create featured artwork error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      // Get the inserted record
      db.get('SELECT * FROM FeaturedArtworks WHERE id = ?', [this.lastID], (err, row) => {
        if (err) {
          console.error('Get inserted featured artwork error:', err);
          return res.status(500).json({ message: 'Server error' });
        }
        res.json(processImageFields(row));
      });
    }
  );
});

app.delete('/featured-artworks/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM FeaturedArtworks WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Delete featured artwork error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Featured artwork not found' });
    }
    res.json({ message: 'Featured artwork deleted' });
  });
});

// Upload profile picture
app.post('/upload-profile-picture', upload.single('profile_picture'), (req, res) => {
  console.log('--- PROFILE PICTURE UPLOAD ---');
  console.log('File:', req.file);
  console.log('Body:', req.body);
  
  const userId = req.body.user_id;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'User ID required' });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const profilePicturePath = req.file.path;

  db.run(
    'UPDATE Users SET profile_picture = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
    [profilePicturePath, userId],
    function(err) {
      if (err) {
        console.error('Update profile picture error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
      res.json({ success: true, profile_picture: profilePicturePath });
    }
  );
});

// Register new user (no auth required)
app.post('/register', (req, res) => {
  const { email, password, first_name, last_name, security_question, security_answer } = req.body;
  db.run(
    'INSERT INTO Users (email, password, first_name, last_name, role, security_question, security_answer) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [email, password, first_name || '', last_name || '', 'user', security_question || null, security_answer || null],
    function(err) {
      if (err) {
        console.error('Register error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
      // Get the inserted record
      db.get('SELECT user_id, email, first_name, last_name, role, is_active, created_at FROM Users WHERE user_id = ?', [this.lastID], (err, row) => {
        if (err) {
          console.error('Get registered user error:', err);
          return res.status(500).json({ success: false, message: 'Server error' });
        }
        res.json(processImageFields(row));
      });
    }
  );
});

// Users CRUD
app.get('/users', requireAuth, (req, res) => {
  db.all('SELECT user_id, email, role, is_active, created_at, profile_picture FROM Users ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Get users error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json(rows.map(row => processImageFields(row)));
  });
});

app.get('/users/:id', requireAuth, (req, res) => {
  db.get('SELECT user_id, email, first_name, last_name, bio, location, role, is_active, created_at, profile_picture FROM Users WHERE user_id = ?', [req.params.id], (err, row) => {
    if (err) {
      console.error('Get user error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (row) {
      res.json(processImageFields(row));
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  });
});

app.post('/users', requireAuth, (req, res) => {
  const { email, password, role } = req.body;
  db.run(
    'INSERT INTO Users (email, password, role) VALUES (?, ?, ?)',
    [email, password, role],
    function(err) {
      if (err) {
        console.error('Create user error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      // Get the inserted record
      db.get('SELECT user_id, email, role, is_active, created_at FROM Users WHERE user_id = ?', [this.lastID], (err, row) => {
        if (err) {
          console.error('Get inserted user error:', err);
          return res.status(500).json({ message: 'Server error' });
        }
        res.json(processImageFields(row));
      });
    }
  );
});

app.put('/users/:id', requireAuth, (req, res) => {
  const fields = [];
  const params = [];
  const allowedFields = ['email', 'role', 'is_active', 'first_name', 'last_name', 'bio', 'location'];
  
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      fields.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  });

  if (fields.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  const sql = `UPDATE Users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`;
  params.push(req.params.id);

  db.run(sql, params, function(err) {
    if (err) {
      console.error('Update user error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    // Get the updated record
    db.get('SELECT user_id, email, first_name, last_name, bio, location, role, is_active, created_at, profile_picture FROM Users WHERE user_id = ?', [req.params.id], (err, row) => {
      if (err) {
        console.error('Get updated user error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      res.json(processImageFields(row));
    });
  });
});

app.delete('/users/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM Users WHERE user_id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Delete user error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted' });
  });
});

app.post('/test-endpoint', (req, res) => {
  console.log('Test endpoint called');
  res.setHeader('Content-Type', 'application/json');
  res.json({ success: true, message: 'Test successful' });
});

app.post('/change-password', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  
  const { email, currentPassword, newPassword } = req.body;
  
  console.log('Change password request for email:', email);
  
  if (!email || !currentPassword || !newPassword) {
    console.warn('Missing required fields:', { email: !!email, currentPassword: !!currentPassword, newPassword: !!newPassword });
    return res.status(400).json({ success: false, message: 'Email, current password, and new password are required' });
  }

  if (newPassword.length < 4) {
    return res.status(400).json({ success: false, message: 'New password must be at least 4 characters long' });
  }

  db.get('SELECT * FROM Users WHERE email = ?', [email], (err, user) => {
    if (err) {
      console.error('Database query error:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (!user) {
      console.warn('User not found for email:', email);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log('User found, comparing passwords');
    if (user.password !== currentPassword) {
      console.warn('Password mismatch for user:', email);
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    console.log('Password match, updating password for user:', email);
    db.run(
      'UPDATE Users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?',
      [newPassword, email],
      function(err) {
        if (err) {
          console.error('Update password error:', err);
          return res.status(500).json({ success: false, message: 'Failed to update password' });
        }
        console.log('Password updated successfully for user:', email);
        res.json({ success: true, message: 'Password changed successfully' });
      }
    );
  });
});

// Follow/Unfollow Artists API
app.post('/follow-artist', requireAuth, (req, res) => {
  const { artist_id } = req.body;
  const user_id = req.headers['user-id']; // Get from header

  if (!user_id) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  // Check if already following
  db.get('SELECT * FROM UserFollowedArtists WHERE user_id = ? AND artist_id = ?', [user_id, artist_id], (err, row) => {
    if (err) {
      console.error('Check follow error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (row) {
      // Already following, unfollow
      db.run('DELETE FROM UserFollowedArtists WHERE user_id = ? AND artist_id = ?', [user_id, artist_id], function(err) {
        if (err) {
          console.error('Unfollow error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ followed: false, message: 'Unfollowed successfully' });
      });
    } else {
      // Not following, follow
      db.run('INSERT INTO UserFollowedArtists (user_id, artist_id) VALUES (?, ?)', [user_id, artist_id], function(err) {
        if (err) {
          console.error('Follow error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ followed: true, message: 'Followed successfully' });
      });
    }
  });
});

// Get followed artists for a user
app.get('/followed-artists/:user_id', (req, res) => {
  const user_id = req.params.user_id;

  db.all(`
    SELECT a.* FROM Artists a
    INNER JOIN UserFollowedArtists ufa ON a.artist_id = ufa.artist_id
    WHERE ufa.user_id = ?
    ORDER BY ufa.followed_at DESC
  `, [user_id], (err, rows) => {
    if (err) {
      console.error('Get followed artists error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Save/Unsave Artworks API
app.post('/save-artwork', requireAuth, (req, res) => {
  const artwork_id = parseInt(req.body.artwork_id);
  const user_id = parseInt(req.headers['user-id']);

  if (isNaN(user_id) || isNaN(artwork_id)) {
    return res.status(401).json({ error: 'User not authenticated or invalid artwork' });
  }

  // Try to insert, if already exists, delete
  db.run('INSERT OR IGNORE INTO UserSavedArtworks (user_id, artwork_id) VALUES (?, ?)', [user_id, artwork_id], function(err) {
    if (err) {
      console.error('Save error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (this.changes === 0) {
      // Already saved, unsave
      db.run('DELETE FROM UserSavedArtworks WHERE user_id = ? AND artwork_id = ?', [user_id, artwork_id], function(err) {
        if (err) {
          console.error('Unsave error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ saved: false, message: 'Unsaved successfully' });
      });
    } else {
      // Saved
      res.json({ saved: true, message: 'Saved successfully' });
    }
  });
});

// Get saved artworks for a user
app.get('/saved-artworks/:user_id', (req, res) => {
  const user_id = req.params.user_id;

  db.all(`
    SELECT a.* FROM Artworks a
    INNER JOIN UserSavedArtworks usa ON a.artwork_id = usa.artwork_id
    WHERE usa.user_id = ?
    ORDER BY usa.saved_at DESC
  `, [user_id], (err, rows) => {
    if (err) {
      console.error('Get saved artworks error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Dynamic artist profile route
/*
app.get('/artist/:id', (req, res) => {
  const artistId = req.params.id;

  // Get artist data
  db.get('SELECT * FROM Artists WHERE artist_id = ?', [artistId], (err, artist) => {
    if (err) {
      console.error('Get artist error:', err);
      return res.status(500).send('Server error');
    }
    if (!artist) {
      return res.status(404).send('Artist not found');
    }

    // Get artist's artworks
    db.all('SELECT * FROM Artworks WHERE artist_id = ?', [artistId], (err, artworks) => {
      if (err) {
        console.error('Get artworks error:', err);
        artworks = [];
      }

      // Generate HTML for the profile page
      const specialtiesList = artist.specialties ? artist.specialties.split(',').map(s => `<p>${s.trim()}</p>`).join('') : '';
      const exhibitionsList = artist.exhibitions ? artist.exhibitions.split(',').map(e => `<p>${e.trim()}</p>`).join('') : '';

      const artworksHTML = artworks.map(artwork => `
        <div class="artwork-card">
          <img src="${artwork.image_url || '/img/art1.jpg'}" alt="${artwork.title}">
          <h3>${artwork.title}</h3>
        </div>
      `).join('');

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${artist.name} - BanArts</title>
    <link rel="stylesheet" href="/styles.css">
    <style>
        @media (max-width: 768px) {
            .artist-bio {
                text-align: justify;
            }
            .artist-details h3 {
                text-align: justify;
            }
            .artist-details p {
                text-align: justify;
            }
        }
    </style>
</head>
<body>
    <header>
        <nav role="navigation" aria-label="Main navigation">
            <div class="logo">
                <img src="/img/bantayanon artists logo.jpg" alt="BanArts Logo" class="logo-img">
                BanArts
            </div>
            <div class="nav-menu">
                <div class="search-bar">
                    <label for="search-input" class="sr-only">Search artworks, artists, galleries...</label>
                    <input type="text" id="search-input" placeholder="Search artworks, artists..." aria-describedby="search-help">
                    <button type="submit" aria-label="Submit search">Search</button>
                    <div id="search-help" class="sr-only">Type to search for artworks, artists, or galleries</div>
                </div>
                <ul>
                    <li><a href="/index.html">Home</a></li>
                    <li><a href="/artists.html">Artists</a></li>
                    <li><a href="/artworks.html">Artworks</a></li>
                    <li><a href="/galleries.html">Galleries</a></li>
                    <li><a href="/museums.html">Museums</a></li>
                    <li><a href="/events.html">Events</a></li>
                    <li><a href="/videos.html">Videos</a></li>
                    <li><a href="/collections.html">Collections</a></li>
                </ul>
                <div class="auth-buttons">
                    <button type="button" class="login-link">Login</button>
                    <button type="button" class="signup-btn">Signup</button>
                </div>
            </div>
            <button class="mobile-menu-toggle" aria-label="Toggle navigation menu">
                &#9776;
            </button>
        </nav>
    </header>

    <main>
        <section class="artist-profile">
            <div class="artist-header">
                <img src="${artist.photo_url || '/img/profile icon.webp'}" alt="${artist.name}" class="artist-photo">
                <div class="artist-info">
                    <div class="artist-header-title">
                        <h1>${artist.name}</h1>
                        <button class="follow-btn" data-artist-id="${artist.artist_id}">Follow</button>
                    </div>
                    <p class="artist-specialty">${artist.category || 'Artist'}</p>
                    <p class="artist-location">Based in ${artist.location || 'Bantayan Island'}</p>
                    ${artist.born_year ? `<p class="artist-born">Born: ${artist.born_year}</p>` : ''}
                    <p class="artist-bio">${artist.about || 'Artist from Bantayan Island.'}</p>
                    <div class="artist-details">
                        ${specialtiesList ? `
<h3>Specialties:</h3>
${specialtiesList}
` : ''}
                        ${exhibitionsList ? `
<h3>Exhibitions</h3>
${exhibitionsList}
` : ''}
                        <h3>Contact</h3>
                        ${artist.email ? `<p><strong>Email:</strong> ${artist.email}</p>` : ''}<br>
                        ${artist.contact ? `<p><strong>Phone:</strong> ${artist.contact}</p>` : ''}
                        <a href="/artists.html" class="back-btn">Back to Artists</a>
                    </div>
                </div>
            </div>
        </section>

        <section class="artist-artworks">
            <h2>Artworks by ${artist.name}</h2>
            <div class="artworks-grid">
                ${artworksHTML || '<p>No artworks available yet.</p>'}
            </div>
        </section>

    </main>

    <script src="/script.js"></script>
</body>
</html>
      `;

      res.send(html);
  });

});
*/

// Dynamic artwork details route
app.get('/artwork/:id', (req, res) => {
  const artworkId = req.params.id;
  console.log('Artwork route called for id:', artworkId);

  // Get artwork data
  db.get(`
    SELECT a.*, art.name as artist_name, art.email as artist_email, art.contact as artist_contact, art.photo_url as artist_photo
    FROM Artworks a
    LEFT JOIN Artists art ON a.artist_id = art.artist_id
    WHERE a.artwork_id = ?
  `, [artworkId], (err, artwork) => {
    if (err) {
      console.error('Get artwork error:', err);
      return res.status(500).send('Server error');
    }
    if (!artwork) {
      return res.status(404).send('Artwork not found');
    }

    // Get related artworks (same artist, limit 4)
    db.all(`
      SELECT a.*, art.name as artist_name
      FROM Artworks a
      LEFT JOIN Artists art ON a.artist_id = art.artist_id
      WHERE a.artist_id = ? AND a.artwork_id != ?
      LIMIT 4
    `, [artwork.artist_id, artworkId], (err, relatedArtworks) => {
      if (err) {
        console.error('Get related artworks error:', err);
        relatedArtworks = [];
      }

      // Generate related artworks HTML
      const relatedHTML = relatedArtworks.map(art => `
        <div class="artwork-card">
          <img src="${art.image_url || '/img/art1.jpg'}" alt="${art.title}">
          <h3>${art.title}</h3>
          <p>By ${art.artist_name || 'Unknown Artist'}</p>
        </div>
      `).join('');

      // Generate HTML
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${artwork.title} - BanArts</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link rel="stylesheet" href="/styles.css">
    <style>
        @media (max-width: 768px) {
            .artwork-description {
                text-align: justify;
            }
            .artwork-details-info ul li {
                text-align: justify;
            }
            .artwork-details-info h3 {
                text-align: justify;
            }
            .artwork-details-info p {
                text-align: justify;
                width: 100%;
            }
        }
    </style>
</head>
<body>
    <header>
        <nav role="navigation" aria-label="Main navigation">
            <div class="logo">
                <img src="/img/bantayanon artists logo.jpg" alt="BanArts Logo" class="logo-img">
                BanArts
            </div>
            <div class="nav-menu">
                <div class="search-bar">
                    <label for="search-input" class="sr-only">Search artworks, artists...</label>
                    <input type="text" id="search-input" placeholder="Search artworks, artists...">
                    <button type="submit">Search</button>
                </div>
                <ul>
                    <li><a href="/index.html">Home</a></li>
                    <li><a href="/artists.html">Artists</a></li>
                    <li><a href="/artworks.html">Artworks</a></li>
                    <li><a href="/galleries.html">Galleries</a></li>
                    <li><a href="/museums.html">Museums</a></li>
                    <li><a href="/events.html">Events</a></li>
                    <li><a href="/videos.html">Videos</a></li>
                    <li><a href="/collections.html">Collections</a></li>
                </ul>
                <div class="auth-buttons">
                    <button type="button" class="login-link">Login</button>
                    <button type="button" class="signup-btn">Signup</button>
                </div>
            </div>
            <div class="mobile-header-icons">
                <div class="notification-container"></div>
                <div class="profile-dropdown-container mobile-icon">
                    <a href="/profile.html" class="profile-icon" id="profile-icon-link">
                        <div class="nav-profile-avatar" id="nav-profile-avatar"></div>
                    </a>
                    <div class="profile-dropdown">
                        <div class="profile-dropdown-header">
                            <img src="/img/profile icon.webp" alt="Profile" class="dropdown-profile-icon" id="dropdown-profile-icon">
                            <div class="dropdown-profile-name">John Doe</div>
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
                <button class="mobile-menu-toggle" aria-label="Toggle navigation menu">
                    &#9776;
                </button>
            </div>
        </nav>
    </header>

    <main style="margin-top: 90px; padding: 30px;">
        <section class="artwork-details">
            <div class="artwork-header">
                <img src="${artwork.image_url || '/img/art1.jpg'}" alt="${artwork.title}" class="artwork-photo" style="max-width: 400px; height: auto;">
                <div class="artwork-info">
                    <h1>${artwork.title}</h1>
                    <p class="artwork-category">${artwork.categories || 'Artwork'}</p>
                    <p class="artwork-artist">By <a href="/artist/${artwork.artist_id}">${artwork.artist_name || 'Unknown Artist'}</a></p>
                    <p class="artwork-description">${artwork.description || 'No description available.'}</p>
                    <div class="artwork-details-info">
                        <h3>Artwork Information</h3>
                        <ul>
                            <li><strong>Title:</strong> ${artwork.title}</li>
                            <li><strong>Artist:</strong> ${artwork.artist_name || 'Unknown'}</li>
                            <li><strong>Category:</strong> ${artwork.categories || 'N/A'}</li>
                            <li><strong>Medium:</strong> ${artwork.medium || 'N/A'}</li>
                            <li><strong>Dimensions:</strong> ${artwork.size || 'N/A'}</li>
                            <li><strong>Year:</strong> ${artwork.year || 'N/A'}</li>
                            <li><strong>Price:</strong> ${artwork.price || 'N/A'}</li>
                            ${artwork.certificate ? `<li><strong>Certificate of Authenticity:</strong> ${artwork.certificate}</li>` : ''}
                            ${artwork.signature ? `<li><strong>Signature:</strong> ${artwork.signature}</li>` : ''}
                        </ul><br>
                        <h3>Contact the Artist</h3>
                        <div style="display: flex; align-items: center; margin-bottom: 15px;">
                            <img src="${artwork.artist_photo || '/img/profile icon.webp'}" alt="${artwork.artist_name}" style="width: 60px; height: 60px; border-radius: 50%; margin-right: 15px; object-fit: cover; border: 2px solid #007bff;">
                            <div>
                                <h4 style="margin: 0; color: #333;">${artwork.artist_name}</h4>
                                <p style="margin: 5px 0; color: #666; font-size: 0.9rem;">${artwork.artist_category || 'Artist'}</p>
                            </div>
                        </div>
                        ${artwork.artist_email ? `<p><strong>Email:</strong> ${artwork.artist_email}</p>` : ''}
                        ${artwork.artist_contact ? `<p><strong>Phone:</strong> ${artwork.artist_contact}</p>` : ''}
                        <p><strong>Artist Profile:</strong> <a href="/artist/${artwork.artist_id}">View Full Profile</a></p>
                        <a href="/artworks.html" class="back-btn">Back to Artworks</a>
                    </div>
                </div>
            </div>
        </section>

        <section class="related-artworks" style="margin-top: 40px;">
            <h2>Related Artworks</h2>
            <div class="artworks-grid">
                ${relatedHTML || '<p>No related artworks available.</p>'}
            </div>
        </section>
    </main>

   <footer>
        <div class="footer-content">
            <div class="footer-section">
                <h3>About BanArts</h3>
                <p>BanArts is the official platform of the Bantayanon Artists Group, dedicated to showcasing the rich artistic heritage and contemporary creativity of Bantayan Island, Philippines. We connect local artists with art enthusiasts worldwide.</p>
            </div>
            <div class="footer-section">
                <h3>Contact Us</h3>
                <p><strong>Email:</strong> bantayanonartists@gmail.com<br><strong>Phone:</strong> 09481766048<br><strong>Address:</strong> Bantayan Island, Cebu, Philippines</p>
            </div>
            <div class="footer-section">
                <h3>Follow Us</h3>
                <div class="social-icons">
                    <a href="#" class="social-icon-link" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a>
                    <a href="#" class="social-icon-link" aria-label="Gmail"><i class="fas fa-envelope"></i></a>
                    <a href="#" class="social-icon-link" aria-label="Twitter"><i class="fab fa-twitter"></i></a>
                </div>
            </div>
        </div>
        <div class="footer-bottom">
            <p>&copy; 2026 BanArts. All rights reserved.</p>
        </div>
    </footer>

    <!-- Login/Signup Modal -->
    <div id="auth-modal" class="modal">
        <div class="modal-content">
            <span class="close">&times;</span>
            <div class="modal-tabs">
                <button class="tab-btn active" onclick="openTab('login')">Login</button>
                <button class="tab-btn" onclick="openTab('signup')">Signup</button>
            </div>
            <div id="login-tab" class="tab-content active">
                <img src="/img/bantayanon artists logo.jpg" alt="BanArts Logo" class="modal-logo">
                <h2>Login</h2>
                <form>
                    <input type="email" placeholder="Email" required>
                    <input type="password" placeholder="Password" required>
                    <button type="submit">Login</button>
                </form>
                <div class="divider">or</div>
                <div class="social-login">
                    <a href="/auth/facebook" class="social-link facebook"><img src="/img/facebook-logo.avif" alt="Facebook"></a>
                    <a href="/auth/google" class="social-link google"><img src="/img/google-icon-logo-png-transparent.png" alt="Google"></a>
                    <a href="/auth/apple" class="social-link apple"><img src="/img/Apple-Logo.jpg" alt="Apple"></a>
                </div>
                <p class="legal-text">By clicking Sign Up or Continue with Email, Apple, Google, or Facebook, you agree to BanArts <a href="terms.html" style="color: blue; text-decoration: underline;">Terms and Conditions</a> and Privacy Policy. This site is protected by reCAPTCHA and the Google Privacy Policy and Terms of Service apply.</p>
            </div>
            <div id="signup-tab" class="tab-content">
                <img src="/img/bantayanon artists logo.jpg" alt="BanArts Logo" class="modal-logo">
                <h2>Signup</h2>
                <form>
                    <input type="text" placeholder="Full Name" required>
                    <input type="email" placeholder="Email" required>
                    <input type="password" placeholder="Password" required>
                    <input type="password" placeholder="Confirm Password" required>
                    <button type="submit">Signup</button>
                </form>
                <div class="divider">or</div>
                <div class="social-login">
                    <a href="/auth/facebook" class="social-link facebook"><img src="/img/facebook-logo.avif" alt="Facebook"></a>
                    <a href="/auth/google" class="social-link google"><img src="/img/google-icon-logo-png-transparent.png" alt="Google"></a>
                    <a href="/auth/apple" class="social-link apple"><img src="/img/Apple-Logo.jpg" alt="Apple"></a>
                </div>
                <p class="legal-text">By clicking Sign Up or Continue with Email, Apple, Google, or Facebook, you agree to BanArts Terms and Conditions and Privacy Policy. This site is protected by reCAPTCHA and the Google Privacy Policy and Terms of Service apply.</p>
            </div>
        </div>
    </div>

    <script src="/script.js"></script>
</body>
</html>
      `;

      res.send(html);
    });
  });
});


// Dynamic museum details route
  app.get('/museum/:id', (req, res) => {
    const museumId = req.params.id;

    // Get museum data
    db.get('SELECT * FROM Museums WHERE museum_id = ?', [museumId], (err, museum) => {
      if (err) {
        console.error('Get museum error:', err);
        return res.status(500).send('Server error');
      }
      if (!museum) {
        return res.status(404).send('Museum not found');
      }

      // Get museum's artifacts
      db.all('SELECT * FROM MuseumArtifacts WHERE museum_id = ?', [museumId], (err, artifacts) => {
        if (err) {
          console.error('Get artifacts error:', err);
          artifacts = [];
        }

        // Generate artifacts HTML
        const artifactsHTML = artifacts.map(artifact => `
          <div class="artwork-card" data-artifact-id="${artifact.artifact_id}">
            <img src="${artifact.image_url || '/img/art1.jpg'}" alt="${artifact.name}" class="artifact-image" onclick="openArtifactModal(${artifact.artifact_id})" style="cursor: pointer;">
            <h3>${artifact.name}</h3>
          </div>
        `).join('');

        // Generate HTML
        const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${museum.name} - BanArts</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
      <link rel="stylesheet" href="/styles.css">
      <style>
        .museum-main-image {
            width: 100%;
            height: auto;
            max-height: 600px;
            display: block;
            margin: 0;
            border-radius: 0;
            object-fit: cover;
        }
        .museum-image-container {
            width: 100%;
            margin: 0;
            padding: 0;
            margin-bottom: 40px;
        }
        .artist-info {
            max-width: 800px;
            margin: 0 auto;
            text-align: center;
        }
        @media (max-width: 768px) {
          .museum-contact-info {
            text-align: justify !important;
          }
          .artist-details p {
            text-align: justify;
            width: 100%;
          }
          .artist-details h3 {
            text-align: justify;
          }
        }
      </style>
  </head>
  <body>
      <header>
          <nav role="navigation" aria-label="Main navigation">
              <div class="logo">
                  <img src="/img/bantayanon artists logo.jpg" alt="BanArts Logo" class="logo-img">
                  BanArts
              </div>
              <div class="nav-menu">
                  <div class="search-bar">
                      <label for="search-input" class="sr-only">Search artworks, artists...</label>
                      <input type="text" id="search-input" placeholder="Search artworks, artists...">
                      <button type="submit">Search</button>
                  </div>
                  <ul>
                      <li><a href="/index.html">Home</a></li>
                      <li><a href="/artists.html">Artists</a></li>
                      <li><a href="/artworks.html">Artworks</a></li>
                      <li><a href="/galleries.html">Galleries</a></li>
                      <li><a href="/museums.html">Museums</a></li>
                      <li><a href="/events.html">Events</a></li>
                      <li><a href="/videos.html">Videos</a></li>
                      <li><a href="/collections.html">Collections</a></li>
                  </ul>
                  <div class="auth-buttons">
                      <button type="button" class="login-link">Login</button>
                      <button type="button" class="signup-btn">Signup</button>
                  </div>
              </div>
              <div class="mobile-header-icons">
                  <div class="notification-container"></div>
                  <div class="profile-dropdown-container mobile-icon">
                      <a href="/profile.html" class="profile-icon" id="profile-icon-link">
                          <div class="nav-profile-avatar" id="nav-profile-avatar"></div>
                      </a>
                      <div class="profile-dropdown">
                          <div class="profile-dropdown-header">
                              <img src="/img/profile icon.webp" alt="Profile" class="dropdown-profile-icon" id="dropdown-profile-icon">
                              <div class="dropdown-profile-name">John Doe</div>
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
                  <button class="mobile-menu-toggle" aria-label="Toggle navigation menu">
                      &#9776;
                  </button>
              </div>
          </nav>
      </header>

      <main style="margin-top: 0; padding: 0;">
          <div class="museum-image-container">
              <img src="${museum.image_url || '/img/museum.jpg'}" alt="${museum.name}" class="museum-main-image">
          </div>
          <section class="museum-profile" style="margin-top: 0; padding-top: 0;">
              <div class="artist-info">
                  <div class="artist-header-title">
                      <h1>${museum.name}</h1>
                  </div>
                      <p class="artist-specialty">Museum</p>
                      <p class="artist-location">Located in ${museum.location || 'Bantayan Island'}</p>
                      <p class="artist-bio">${museum.about || 'Museum description not available.'}</p>
                      <div class="artist-details">
                          <h3>Contact</h3>
                          <p class="museum-contact-info"><strong>Phone:</strong> ${museum.contact_info || ''}</p>
                          <p class="museum-contact-info"><strong>Website:</strong> <a href="${museum.website || '#'}" target="_blank">${museum.website || ''}</a></p>
                          <a href="/museums.html" class="back-btn">Back to Museums</a>
                      </div>
                  </div>
              </div>
          </section>

          <section class="museum-antiques">
              <h2>Featured Artifacts</h2>
              <div class="artworks-grid">
                  ${artifactsHTML || '<p>No artifacts available yet.</p>'}
              </div>
          </section>

      <!-- Artifact Detail Modal -->
      <div id="artifact-modal" class="modal" aria-labelledby="artifact-modal-name" aria-modal="true" aria-hidden="true">
          <div class="modal-content" style="max-width: 900px; width: 95%; max-height: 90vh; overflow-y: auto; margin: 75px auto;">
              <span class="close" onclick="closeArtifactModal()">&times;</span>
              <div id="artifact-modal-body" style="padding: 30px;">
                  <div class="artifact-modal-grid" style="display: flex; flex-wrap: wrap; gap: 30px;">
                      <div style="flex: 1; min-width: 300px;">
                          <img id="artifact-modal-image" src="" alt="" style="width: 100%; border-radius: 8px; object-fit: contain; max-height: 500px; background-color: #f8f9fa;">
                      </div>
                      <div style="flex: 1.2; min-width: 300px;">
                          <h2 id="artifact-modal-name" style="margin: 0 0 20px 0; color: #333; font-size: 2rem;"></h2>
                          <div class="artifact-meta" style="margin-top: 20px;">
                              <p style="margin: 10px 0; font-size: 1.1rem;"><strong>Artist:</strong> <span id="artifact-modal-artist">N/A</span></p>
                              <p style="margin: 10px 0; font-size: 1.1rem;"><strong>Type:</strong> <span id="artifact-modal-type">N/A</span></p>
                              <p style="margin: 10px 0; font-size: 1.1rem;"><strong>Medium:</strong> <span id="artifact-modal-medium">N/A</span></p>
                              <p style="margin: 10px 0; font-size: 1.1rem;"><strong>Year:</strong> <span id="artifact-modal-year">N/A</span></p>
                              <p style="margin: 10px 0; font-size: 1.1rem;"><strong>Dimensions:</strong> <span id="artifact-modal-dimensions">N/A</span></p>
                              <p style="margin: 10px 0; font-size: 1.1rem;"><strong>Weight:</strong> <span id="artifact-modal-weight">N/A</span></p>
                              <p style="margin: 10px 0; font-size: 1.1rem;"><strong>Location in Museum:</strong> <span id="artifact-modal-location">N/A</span></p>
                              <p style="margin: 10px 0; font-size: 1.1rem;"><strong>Condition:</strong> <span id="artifact-modal-condition">N/A</span></p>
                              <p style="margin: 10px 0; font-size: 1.1rem;"><strong>Status:</strong> <span id="artifact-modal-status">N/A</span></p>
                          </div>
                          <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #eee;">
                              <h3 style="margin: 0 0 12px 0; color: #333;">Description</h3>
                              <p id="artifact-modal-details" style="margin: 0; line-height: 1.7; color: #555; word-wrap: break-word; overflow-wrap: break-word;"></p>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      </main>

      <footer>
          <div class="footer-content">
              <div class="footer-section">
                  <h3>About BanArts</h3>
                  <p>BanArts is the official platform of the Bantayanon Artists Group, dedicated to showcasing the rich artistic heritage and contemporary creativity of Bantayan Island, Philippines. We connect local artists with art enthusiasts worldwide.</p>
              </div>
              <div class="footer-section">
                  <h3>Contact Us</h3>
                  <p><strong>Email:</strong> bantayanonartists@gmail.com<br><strong>Phone:</strong> 09481766048<br><strong>Address:</strong> Bantayan Island, Cebu, Philippines</p>
              </div>
              <div class="footer-section">
                  <h3>Follow Us</h3>
                  <div class="social-icons">
                      <a href="#" class="social-icon-link" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a>
                      <a href="#" class="social-icon-link" aria-label="Gmail"><i class="fas fa-envelope"></i></a>
                      <a href="#" class="social-icon-link" aria-label="Twitter"><i class="fab fa-twitter"></i></a>
                  </div>
              </div>
          </div>
          <div class="footer-bottom">
              <p>&copy; 2026 BanArts. All rights reserved.</p>
          </div>
      </footer>

      <script src="/script.js"></script>
  </body>
  </html>
        `;

        res.send(html);
      });
    });

  });

  // Dynamic gallery details route
  app.get('/gallery/:id', (req, res) => {
    const galleryId = req.params.id;

    // Get gallery data
    db.get('SELECT * FROM Galleries WHERE gallery_id = ?', [galleryId], (err, gallery) => {
      if (err) {
        console.error('Get gallery error:', err);
        return res.status(500).send('Server error');
      }
      if (!gallery) {
        return res.status(404).send('Gallery not found');
      }

      // Process image fields for the gallery
      const processedGallery = processImageFields(gallery);

      // Handle type field if it's "[object Object]" (corrupted data)
      if (processedGallery.type === '[object Object]') {
        processedGallery.type = 'Art Gallery';
      }

      // Get gallery's featured artworks (filter out NULL or empty titles)
      db.all(`
        SELECT * FROM GalleryFeaturedArtworks
        WHERE gallery_id = ? AND title IS NOT NULL AND title != ''
        ORDER BY display_order ASC
      `, [galleryId], (err, featuredArtworks) => {
        if (err) {
          console.error('Get featured artworks error:', err);
          featuredArtworks = [];
        }
        console.log('GET /gallery/:id - galleryId:', galleryId, 'Found featured artworks:', featuredArtworks.length, featuredArtworks);

        // Generate featured artworks HTML
        const artworksHTML = featuredArtworks.map(artwork => `
          <div class="artwork-card">
            <img src="${artwork.image_url || '/img/art1.jpg'}" alt="${artwork.title}" class="artwork-image" onclick="openArtworkModal(${artwork.gallery_featured_id})" style="cursor: pointer;">
            <h3>${artwork.title}</h3>
          </div>
        `).join('');

        // Generate HTML
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${processedGallery.name} - BanArts</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link rel="stylesheet" href="/styles.css">
    <style>
        .gallery-main-image {
            width: 100%;
            max-width: 100%;
            height: auto;
            display: block;
            margin-top: 0;
            border-radius: 0;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        header {
            background-color: #007bff !important;
        }
        .gallery-image-container {
            text-align: center;
            margin-bottom: 40px;
        }
        .artist-info {
            max-width: 800px;
            margin: 0 auto;
            text-align: center;
        }
        @media (max-width: 768px) {
            .artist-info {
                padding-left: 15px;
                padding-right: 15px;
            }
            .artist-details p {
                text-align: justify;
                width: 100%;
            }
            .artist-details h3 {
                text-align: justify;
            }
        }
    </style>
</head>
<body>
    <header>
        <nav role="navigation" aria-label="Main navigation">
            <div class="logo">
                <img src="/img/bantayanon artists logo.jpg" alt="BanArts Logo" class="logo-img">
                BanArts
            </div>
            <div class="nav-menu">
                <div class="search-bar">
                    <label for="search-input" class="sr-only">Search artworks, artists, galleries...</label>
                    <input type="text" id="search-input" placeholder="Search artworks, artists..." aria-describedby="search-help">
                    <button type="submit" aria-label="Submit search">Search</button>
                    <div id="search-help" class="sr-only">Type to search for artworks, artists, or galleries</div>
                </div>
                <ul>
                    <li><a href="/index.html">Home</a></li>
                    <li><a href="/artists.html">Artists</a></li>
                    <li><a href="/artworks.html">Artworks</a></li>
                    <li><a href="/galleries.html">Galleries</a></li>
                    <li><a href="/museums.html">Museums</a></li>
                    <li><a href="/events.html">Events</a></li>
                    <li><a href="/videos.html">Videos</a></li>
                    <li><a href="/collections.html">Collections</a></li>
                </ul>
                <div class="auth-buttons">
                    <button type="button" class="login-link">Login</button>
                    <button type="button" class="signup-btn">Signup</button>
                </div>
            </div>
            <div class="mobile-header-icons">
                <div class="notification-container"></div>
                <div class="profile-dropdown-container mobile-icon">
                    <a href="/profile.html" class="profile-icon" id="profile-icon-link">
                        <div class="nav-profile-avatar" id="nav-profile-avatar"></div>
                    </a>
                    <div class="profile-dropdown">
                        <div class="profile-dropdown-header">
                            <img src="/img/profile icon.webp" alt="Profile" class="dropdown-profile-icon" id="dropdown-profile-icon">
                            <div class="dropdown-profile-name">John Doe</div>
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
                <button class="mobile-menu-toggle" aria-label="Toggle navigation menu">
                    &#9776;
                </button>
            </div>
        </nav>
    </header>

    <main style="margin-top: -250px; padding: 0;">
        <section class="gallery-profile">
            <div class="gallery-image-container">
                <img src="${processedGallery.image_url || '/img/gallery.jpg'}" alt="${processedGallery.name}" class="gallery-main-image">
            </div>
            <div class="artist-info">
                <div class="artist-header-title">
                     <h1 style="text-align: center;">${processedGallery.name}</h1>
                 </div>
                <p class="artist-specialty">${processedGallery.type || 'Art Gallery'}</p>
                <p class="artist-location">Located in ${processedGallery.location || 'Bantayan Island'}</p>
                <p class="artist-bio">${processedGallery.about || 'Gallery description not available.'}</p>
                <div class="artist-details">
                    ${processedGallery.collections ? `<h3>Collections</h3><p>"${processedGallery.collections}"</p>` : ''}
                    <h3>Contact</h3>
                    ${processedGallery.email ? `<p><strong>Email:</strong> ${processedGallery.email}</p>` : ''}
                    ${processedGallery.phone ? `<p><strong>Phone:</strong> ${processedGallery.phone}</p>` : ''}
                    ${processedGallery.contact_info ? `<p><strong>Address:</strong> ${processedGallery.contact_info}</p>` : ''}
                    ${processedGallery.website ? `<p><strong>Website:</strong> <a href="${processedGallery.website}" target="_blank">${processedGallery.website}</a></p>` : ''}
                    <a href="/galleries.html" class="back-btn">Back to Galleries</a>
                </div>
            </div>
        </section>

        <section class="gallery-artworks">
            <h2>Featured Artworks</h2>
            <div class="artworks-grid">
                ${artworksHTML || '<p>No featured artworks available yet.</p>'}
            </div>
        </section>

    </main>

  <footer>
        <div class="footer-content">
            <div class="footer-section">
                <h3>About BanArts</h3>
                <p>BanArts is the official platform of the Bantayanon Artists Group, dedicated to showcasing the rich artistic heritage and contemporary creativity of Bantayan Island, Philippines. We connect local artists with art enthusiasts worldwide.</p>
            </div>
            <div class="footer-section">
                <h3>Contact Us</h3>
                <p><strong>Email:</strong> bantayanonartists@gmail.com<br><strong>Phone:</strong> 09481766048<br><strong>Address:</strong> Bantayan Island, Cebu, Philippines</p>
            </div>
            <div class="footer-section">
                <h3>Follow Us</h3>
                <div class="social-icons">
                    <a href="#" class="social-icon-link" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a>
                    <a href="#" class="social-icon-link" aria-label="Gmail"><i class="fas fa-envelope"></i></a>
                    <a href="#" class="social-icon-link" aria-label="Twitter"><i class="fab fa-twitter"></i></a>
                </div>
            </div>
        </div>
        <div class="footer-bottom">
            <p>&copy; 2026 BanArts. All rights reserved.</p>
        </div>
    </footer>

    <!-- Artwork Modal -->
    <div id="artwork-modal" class="modal">
        <div class="modal-content artwork-modal-content">
            <span class="close" onclick="closeArtworkModal()">&times;</span>
            <div class="artwork-modal-body">
                <div class="artwork-modal-image">
                    <img id="artwork-modal-img" src="" alt="Artwork">
                </div>
                <div class="artwork-modal-details">
                    <h2 id="artwork-modal-title"></h2>
                    <p id="artwork-modal-description" class="artwork-description"></p>
                    <p><strong>Price:</strong> <span id="artwork-modal-price"></span></p>
                </div>
            </div>
        </div>
    </div>

    <!-- Login/Signup Modal -->
    <div id="auth-modal" class="modal">
        <div class="modal-content">
            <span class="close">&times;</span>
            <div class="modal-tabs">
                <button class="tab-btn active" onclick="openTab('login')">Login</button>
                <button class="tab-btn" onclick="openTab('signup')">Signup</button>
            </div>
            <div id="login-tab" class="tab-content active">
                <img src="/img/bantayanon artists logo.jpg" alt="BanArts Logo" class="modal-logo">
                <h2>Login</h2>
                <form>
                    <input type="email" placeholder="Email" required>
                    <input type="password" placeholder="Password" required>
                    <button type="submit">Login</button>
                </form>
                <div class="divider">or</div>
                <div class="social-login">
                    <a href="/auth/facebook" class="social-link facebook"><img src="/img/facebook-logo.avif" alt="Facebook"></a>
                    <a href="/auth/google" class="social-link google"><img src="/img/google-icon-logo-png-transparent.png" alt="Google"></a>
                    <a href="/auth/apple" class="social-link apple"><img src="/img/Apple-Logo.jpg" alt="Apple"></a>
                </div>
                <p class="legal-text">By clicking Sign Up or Continue with Email, Apple, Google, or Facebook, you agree to BanArts Terms and Conditions and Privacy Policy. This site is protected by reCAPTCHA and the Google Privacy Policy and Terms of Service apply.</p>
            </div>
            <div id="signup-tab" class="tab-content">
                <img src="/img/bantayanon artists logo.jpg" alt="BanArts Logo" class="modal-logo">
                <h2>Signup</h2>
                <form>
                    <input type="text" placeholder="Full Name" required>
                    <input type="email" placeholder="Email" required>
                    <input type="password" placeholder="Password" required>
                    <input type="password" placeholder="Confirm Password" required>
                    <button type="submit">Signup</button>
                </form>
                <div class="divider">or</div>
                <div class="social-login">
                    <a href="/auth/facebook" class="social-link facebook"><img src="/img/facebook-logo.avif" alt="Facebook"></a>
                    <a href="/auth/google" class="social-link google"><img src="/img/google-icon-logo-png-transparent.png" alt="Google"></a>
                    <a href="/auth/apple" class="social-link apple"><img src="/img/Apple-Logo.jpg" alt="Apple"></a>
                </div>
                <p class="legal-text">By clicking Sign Up or Continue with Email, Apple, Google, or Facebook, you agree to BanArts Terms and Conditions and Privacy Policy. This site is protected by reCAPTCHA and the Google Privacy Policy and Terms of Service apply.</p>
            </div>
        </div>
    </div>

    <script src="/script.js"></script>
    <script src="/socket.io/socket.io.js"></script>
    <script>
        // Modal functionality for dynamic gallery profile pages
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
                    document.body.classList.add('no-scroll');
                }, 10);
            }
        }

        function closeModal() {
            const modal = document.getElementById('auth-modal');
            if (modal) {
                modal.classList.remove('show');
                document.body.classList.remove('no-scroll');
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);
            }
        }

        function openTab(tabName) {
            const tabs = document.querySelectorAll('.tab-content');
            const buttons = document.querySelectorAll('.tab-btn');
            tabs.forEach(tab => tab.classList.remove('active'));
            buttons.forEach(btn => btn.classList.remove('active'));
            document.getElementById(tabName + '-tab').classList.add('active');
            // Find the corresponding tab button and add active
            const activeBtn = document.querySelector('.tab-btn[onclick*="' + tabName + '"]');
            if (activeBtn) activeBtn.classList.add('active');
        }

        // Event listeners for modal
        document.addEventListener('DOMContentLoaded', function() {
            const loginBtn = document.querySelector('.login-link');
            const signupBtn = document.querySelector('.signup-btn');
            const closeBtn = document.querySelector('.close');

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

            // Close modal when clicking outside
            window.addEventListener('click', function(e) {
                const modal = document.getElementById('auth-modal');
                if (e.target === modal) {
                    closeModal();
                }
            });
        });

        function openArtworkModal(artworkId) {
            console.log('Opening artwork modal for ID:', artworkId);
            fetch('/gallery-featured-artworks/' + artworkId)
                .then(response => {
                    if (!response.ok) throw new Error('Failed to fetch artwork');
                    return response.json();
                })
                .then(artwork => {
                    console.log('Loaded artwork:', artwork);
                    document.getElementById('artwork-modal-img').src = artwork.image_url || '/img/art1.jpg';
                    document.getElementById('artwork-modal-title').textContent = artwork.title;
                    document.getElementById('artwork-modal-description').textContent = artwork.description || 'No description available.';
                    document.getElementById('artwork-modal-price').textContent = artwork.price || 'N/A';
                    
                    const modal = document.getElementById('artwork-modal');
                    if (modal) {
                        modal.style.display = 'flex';
                        modal.style.zIndex = '10000'; // Ensure it's above everything
                        
                        // Position modal at current scroll position
                        const modalContent = modal.querySelector('.modal-content');
                        if (modalContent) {
                            modalContent.style.top = (window.scrollY + 20) + 'px';
                        }

                        setTimeout(() => {
                            modal.classList.add('show');
                            document.body.classList.add('no-scroll');
                        }, 10);
                    }
                })
                .catch(error => {
                    console.error('Error loading artwork:', error);
                    alert('Error loading artwork details. Please try again.');
                });
        }

        function closeArtworkModal() {
            const modal = document.getElementById('artwork-modal');
            if (modal) {
                modal.classList.remove('show');
                document.body.classList.remove('no-scroll');
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);
            }
        }

        window.addEventListener('click', function(e) {
            const artworkModal = document.getElementById('artwork-modal');
            if (e.target === artworkModal) {
                closeArtworkModal();
            }
        });
    </script>
</body>
</html>
        `;

        res.send(html);
      });
    });

  });

  // Dynamic artist details route
  app.get('/artist/:id', (req, res) => {
    res.redirect(`/artist-details.html?id=${req.params.id}`);
  });

  app.get('/gallery/:id', (req, res) => {
    res.redirect(`/gallery-details.html?id=${req.params.id}`);
  });

  app.get('/museum/:id', (req, res) => {
    res.redirect(`/museum_details.html?id=${req.params.id}`);
  });

  app.get('/event/:id', (req, res) => {
    res.redirect(`/event-details.html?id=${req.params.id}`);
  });

  // Facebook Compliance Routes
  app.get('/privacy-policy', (req, res) => {
    res.send('<h1>Privacy Policy</h1><p>We respect your privacy. Your data is only used for authentication and to improve your experience on BanArts.</p>');
  });

  app.get('/deletion', (req, res) => {
    res.send('<h1>Data Deletion Instructions</h1><p>To request data deletion, please contact us at tibalanbenjo123@gmail.com with your account email address. Your data will be removed within 30 days.</p>');
  });

  // Server startup is handled after DB initialization by `startServer()`.
