---
description: Repository Information Overview
alwaysApply: true
---

# BanArts Platform Information

## Summary

BanArts is a comprehensive Node.js Express-based web platform for managing and showcasing art collections. It serves as a centralized system for artists, artworks, galleries, museums, events, and collections with a REST API backend and static HTML/CSS/JavaScript frontend. The application uses SQLite for persistent data storage and supports file uploads via Multer with real-time updates through Socket.io.

## Structure

**Root-level directories and files:**
- **`server.js`** — Central monolithic server file containing all routes, database initialization, and API endpoints
- **`img/`** — Directory for uploaded images (artists photos, artwork images, gallery images, etc.)
- **`.github/`** — GitHub-related configuration
- **`.vscode/`** — VS Code workspace settings
- **Frontend HTML files** — Static pages served from root (`index.html`, `artworks.html`, `artists.html`, `galleries.html`, `museums.html`, `events.html`, `collections.html`, `admin-dashboard.html`, etc.)
- **Frontend JavaScript** — `script.js` (main app logic), `admin.js` (admin interface), `profile.js` (user profiles), `notifications.js` (notification system), `settings.js` (user settings)
- **Styling** — `styles.css` (main stylesheet)
- **Database** — `banarts.db` (SQLite database file, auto-created at startup)
- **Configuration** — `package.json` and `package-lock.json` (npm dependencies)

## Language & Runtime

**Language**: JavaScript (Node.js)  
**Runtime**: Node.js (no specific version specified in package.json)  
**Build System**: None (Express server runs directly)  
**Package Manager**: npm

## Dependencies

**Main Dependencies:**
- **`express@^4.18.2`** — Web framework for REST API
- **`sqlite3@^5.1.7`** — SQLite database driver
- **`multer@^2.0.2`** — Middleware for file uploads (multipart/form-data)
- **`cors@^2.8.5`** — Cross-Origin Resource Sharing middleware
- **`socket.io@^4.7.2`** — Real-time bidirectional communication
- **`mssql@^9.1.1`** — MSSQL driver (included but not actively used in primary flow)

**Development Dependencies:**
- **`nodemon@^3.0.1`** — Auto-restart server on file changes

## Build & Installation

```bash
npm install
npm start          # Production: runs node server.js
npm run dev        # Development: runs nodemon server.js
```

**Server runs on**: `http://localhost:3002` (port configurable via `PORT` env variable)

## Main Files & Resources

**Server Entry Point**: `server.js` (3439 lines)
- Database initialization and migrations
- All REST API endpoints (100+ routes)
- Middleware configuration (CORS, JSON parsing, static file serving)
- Socket.io connection handling

**Frontend Entry**: `index.html` (main landing page)

**Database**: `banarts.db` (SQLite, auto-initialized on first run)

**File Upload Directory**: `img/` (stores uploaded artwork images, artist photos, gallery images)

**Key Frontend Scripts**:
- `script.js` — Core application logic and page interactions
- `admin.js` — Administrative dashboard and management features
- `profile.js` — User profile management
- `notifications.js` — Notification system integration
- `settings.js` — User settings interface

## Database Schema

**Core Tables**:
- **Users** — User accounts with email, password, profile info, role (user/admin), user type (visitor/artist/curator)
- **Artists** — Artist profiles with name, category, contact, location, biography, exhibition history
- **Artworks** — Artwork records with title, description, medium, dimensions, price, artist reference
- **ArtworkCategories** — Artwork category definitions
- **Galleries** — Gallery information with collections, location, contact details
- **Museums** — Museum details with location and contact information
- **MuseumArtifacts** — Artifacts stored in museums
- **Events** — Art events with dates, locations, descriptions
- **Collections** — User-created collections of artworks
- **Notifications** — System notifications for users

## API Endpoints (Partial List)

**Artists**: `GET/POST /artists`, `GET/PUT/DELETE /artists/:id`, `GET /artists/featured`, `GET /artists/other`

**Artworks**: `GET/POST /artworks`, `GET/PUT/DELETE /artworks/:id`, `GET /artworks/featured`, `DELETE /artworks/clear-all`

**Galleries**: `GET/POST /galleries`, `GET/PUT/DELETE /galleries/:id`, `GET /galleries/featured`, `POST /galleries/:id/set-featured`

**Museums**: `GET/POST /museums`, `GET/PUT/DELETE /museums/:id`

**Events**: Full CRUD endpoints for events management

**Collections**: Full CRUD endpoints for collections

**User Management**: `/login`, `/dashboard` (admin), user profile and authentication endpoints

**Notifications**: `GET /notifications`, `PUT /notifications/:id/read`, `PUT /notifications/mark-all-read`

**File Uploads**: Handled via Multer middleware; POST endpoints accept `multipart/form-data` with file fields

## Authentication & Middleware

- **`requireAuth`** — Placeholder authentication middleware (allows all requests)
- **`requireAdmin`** — Placeholder admin authorization middleware
- **CORS** — Enabled for all origins
- **Static Files** — Served from repository root via `express.static()`

## Testing

**Test Files Located**: Root directory
- `test_galleries.js` — Test suite for gallery endpoints
- `test_gallery.js` — Additional gallery tests
- `update_artworks_table.js` — Database migration/update script
- `add_column.js` — Schema update utility
- `cleanup-artworks.js` — Data cleanup script

**No formal test runner configured** — Tests are standalone Node.js scripts

## Key Configuration & Environment

- **Database Path**: `banarts.db` (created in project root)
- **Upload Directory**: `img/` (auto-created if missing)
- **Port**: `3002` (default, overridable via `PORT` env variable)
- **CORS**: Enabled for all origins
- **Socket.io**: Configured for bidirectional communication with CORS enabled

## Error Handling

- Graceful shutdown on uncaught exceptions and unhandled promise rejections
- DB connection error logging
- Server error handling with specific `EADDRINUSE` detection for port conflicts
- Process-level signal handlers for `SIGINT` and `SIGTERM`

## Development Notes

- Single monolithic `server.js` file contains all server logic
- Frontend updates don't require server restart (served as static files)
- Database schema changes use guarded `ALTER TABLE` statements to preserve existing data
- File uploads stored with timestamp-based unique names to prevent collisions
- No explicit authentication layer (frontend-based for now; can be enhanced server-side)
