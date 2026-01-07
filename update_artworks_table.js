const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'banarts.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection failed:', err);
    return;
  }
  console.log('Connected to database');
});

// Check current schema
db.all("PRAGMA table_info(Artworks)", (err, rows) => {
  if (err) {
    console.error('Error getting schema:', err);
    return;
  }

  console.log('Current Artworks table columns:');
  rows.forEach(row => {
    console.log(`- ${row.name}: ${row.type}`);
  });

  // Check if new columns exist
  const hasSocialMedia = rows.some(row => row.name === 'social_media');
  const hasPhone = rows.some(row => row.name === 'phone');
  const hasEmail = rows.some(row => row.name === 'email');

  // Check if old columns exist
  const hasRarity = rows.some(row => row.name === 'rarity');
  const hasCondition = rows.some(row => row.name === 'condition');
  const hasFrame = rows.some(row => row.name === 'frame');
  const hasSeries = rows.some(row => row.name === 'series');

  if (hasSocialMedia && hasPhone && hasEmail && !hasRarity && !hasCondition && !hasFrame && !hasSeries) {
    console.log('✅ Artworks table is already updated');
    db.close();
    return;
  }

  console.log('Updating Artworks table...');

  // Create new table with updated schema
  const createNewTable = `
    CREATE TABLE Artworks_new (
      artwork_id INTEGER PRIMARY KEY AUTOINCREMENT,
      artist_id INTEGER,
      category_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      medium TEXT,
      year INTEGER,
      size TEXT,
      signature TEXT,
      certificate TEXT,
      social_media TEXT,
      phone TEXT,
      email TEXT,
      image_url TEXT,
      price DECIMAL(10,2),
      is_available INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (artist_id) REFERENCES Artists(artist_id) ON DELETE SET NULL,
      FOREIGN KEY (category_id) REFERENCES ArtworkCategories(category_id) ON DELETE SET NULL
    );
  `;

  db.run(createNewTable, (err) => {
    if (err) {
      console.error('Error creating new table:', err);
      db.close();
      return;
    }

    console.log('✅ Created new Artworks table');

    // Copy data from old table to new table
    const copyData = `
      INSERT INTO Artworks_new (
        artwork_id, artist_id, category_id, title, description, location, medium, year, size,
        signature, certificate, image_url, price, is_available, status, tags, created_at, updated_at
      )
      SELECT
        artwork_id, artist_id, category_id, title, description, location, medium, year, size,
        signature, certificate, image_url, price, is_available, status, tags, created_at, updated_at
      FROM Artworks;
    `;

    db.run(copyData, (err) => {
      if (err) {
        console.error('Error copying data:', err);
        db.close();
        return;
      }

      console.log('✅ Copied data to new table');

      // Drop old table
      db.run('DROP TABLE Artworks', (err) => {
        if (err) {
          console.error('Error dropping old table:', err);
          db.close();
          return;
        }

        console.log('✅ Dropped old table');

        // Rename new table to old name
        db.run('ALTER TABLE Artworks_new RENAME TO Artworks', (err) => {
          if (err) {
            console.error('Error renaming table:', err);
            db.close();
            return;
          }

          console.log('✅ Renamed table to Artworks');
          console.log('✅ Artworks table update completed successfully!');

          // Close database
          db.close((err) => {
            if (err) {
              console.error('Error closing database:', err);
            } else {
              console.log('Database operations completed');
            }
          });
        });
      });
    });
  });
});