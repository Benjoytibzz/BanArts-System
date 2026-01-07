# Copilot / AI agent instructions for this repo

Overview
- Single-process Node.js Express backend with static frontend files in the repository root.
- Database: local SQLite DB file `banarts.db` (created/initialized by `server.js`).
- All server logic lives in `server.js` (routes, DB initialization, migrations, file upload handling).

Run & development
- Install deps: `npm install`.
- Start production: `npm start` (runs `node server.js`).
- Start dev: `npm run dev` (runs `nodemon server.js`).

High-level architecture & why
- Monolithic single-file server: `server.js` contains table schemas, simple migration helpers, and all REST endpoints. This repo has not been split into controllers/services — make minimal, surgical edits here.
- Static front-end: HTML/JS files are served via `express.static(__dirname)` — the app serves the repository root. Changing front-end files updates what the server serves without extra build steps.
- File uploads are stored under `/img` via `multer.diskStorage`.

Database & migration patterns
- `server.js` opens `banarts.db` (SQLite). Table creation and schema evolution are done at startup in `initializeDatabase()` and helper functions like `addMissingColumns()`.
- New columns are added with `ALTER TABLE ... ADD COLUMN` guarded by PRAGMA checks; the code aims to preserve existing data.
- When adding or changing schema, update `initializeDatabase()` patterns or add a new guarded ALTER step — avoid dropping tables or clearing data.

API patterns & conventions (concrete examples)
- REST endpoints are grouped by resource: `/artists`, `/artworks`, `/galleries`, `/museums`, `/events`, etc.
- CRUD style: GET collection, GET by id (`/:id`), POST to create, PUT to update, DELETE to remove. Example: `POST /artists` accepts `multipart/form-data` with file field `photo` and form fields (`name`, `category`, ...).
- Joins: server often returns joined results (e.g., Artworks return artist name via `LEFT JOIN Artists art ON a.artist_id = art.artist_id`).
- Pagination/limits: query param `_limit` is used in several endpoints (e.g., `GET /galleries?_limit=5`).

Data shapes and project-specific conventions
- Booleans are stored as integers (0/1) — e.g., `is_featured`.
- Timestamps use `created_at` / `updated_at` with `CURRENT_TIMESTAMP` default.
- Several fields are free-form TEXT that contain comma-separated lists (e.g., `tags`, `collections`, `categories`).
- Authentication middleware (`requireAuth`, `requireAdmin`) are placeholders that `next()` — authentication is primarily handled on the frontend; do not assume JWTs exist unless you add them.

File uploads & static files
- Uploads saved to `/img` folder using `multer` (see `storage` config in `server.js`).
- Uploaded file URLs are returned as `/img/<filename>`; front-end references these paths directly.

Editing guidelines for AI agents
- Prefer small, local changes in `server.js`. If adding a route, follow the existing style: validate required fields, run the DB query, and return JSON with proper status codes.
- When changing schema, add guarded `PRAGMA table_info(...)` checks and `ALTER TABLE` statements similar to `addMissingColumns()` to preserve existing DB contents.
- If you add new npm dependencies, update `package.json` and mention any manual `npm install` steps in the commit message.

Debugging and common pitfalls
- Server exits on unhandled exceptions/rejections (there are process handlers that call `process.exit(1)`). Reproduce failures locally with `npm run dev` to get stack traces.
- DB file `banarts.db` is created in repo root; if you need a fresh database, stop the server and remove `banarts.db` (data will be lost). Prefer guarded migrations when possible.
- Static files are served from repo root — watch for path collisions when adding files.

Quick examples
- Start server (PowerShell):
```powershell
npm install
npm run dev
```
- Create an artist with an image (curl example):
```bash
curl -X POST http://localhost:3002/artists -F "name=My Artist" -F "category=Painter" -F "photo=@/path/to/photo.jpg"
```
- Query featured artworks:
```bash
curl http://localhost:3002/artworks/featured
```

Files to inspect for context
- `server.js` — central file; read it fully before large changes.
- `package.json` — scripts and deps (`express`, `sqlite3`, `multer`, `cors`).
- HTML files in repo root — frontend behavior and expected API shapes (e.g., `artworks.html`, `artists.html`, `profile.js`, `script.js`).

When in doubt, ask the repo owner
- Confirm whether auth should be implemented server-side (JWT/session) before adding protected endpoints.
- Confirm any schema changes that require data migration strategy.

If anything here looks wrong or you want more detail (examples of specific endpoints, typical frontend requests, or DB sample rows), tell me which part to expand.
