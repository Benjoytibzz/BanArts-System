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
db.all("PRAGMA table_info(Artists)", (err, rows) => {
  if (err) {
    console.error('Error getting schema:', err);
    return;
  }

  console.log('Current Artists table columns:');
  rows.forEach(row => {
    console.log(`- ${row.name}: ${row.type}`);
  });

  // Check if specialties column exists
  const hasSpecialties = rows.some(row => row.name === 'specialties');
  const hasExhibitions = rows.some(row => row.name === 'exhibitions');
  const hasIsFeatured = rows.some(row => row.name === 'is_featured');

  if (!hasSpecialties) {
    console.log('Adding specialties column...');
    db.run("ALTER TABLE Artists ADD COLUMN specialties TEXT", (err) => {
      if (err) {
        console.error('Error adding specialties column:', err);
      } else {
        console.log('✅ Added specialties column');
      }
    });
  } else {
    console.log('✅ Specialties column already exists');
  }

  if (!hasExhibitions) {
    console.log('Adding exhibitions column...');
    db.run("ALTER TABLE Artists ADD COLUMN exhibitions TEXT", (err) => {
      if (err) {
        console.error('Error adding exhibitions column:', err);
      } else {
        console.log('✅ Added exhibitions column');
      }
    });
  } else {
    console.log('✅ Exhibitions column already exists');
  }

  if (!hasIsFeatured) {
    console.log('Adding is_featured column...');
    db.run("ALTER TABLE Artists ADD COLUMN is_featured INTEGER DEFAULT 0", (err) => {
      if (err) {
        console.error('Error adding is_featured column:', err);
      } else {
        console.log('✅ Added is_featured column');
      }
    });
  } else {
    console.log('✅ is_featured column already exists');
  }

  // Check if Specialties table exists
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='Specialties'", (err, row) => {
    if (err) {
      console.error('Error checking Specialties table:', err);
    } else if (!row) {
      console.log('Creating Specialties table...');
      db.run(`CREATE TABLE Specialties (
        specialty_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          console.error('Error creating Specialties table:', err);
        } else {
          console.log('✅ Created Specialties table');
        }
      });
    } else {
      console.log('✅ Specialties table already exists');
    }

    // Check if ArtistSpecialties table exists
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='ArtistSpecialties'", (err, row) => {
      if (err) {
        console.error('Error checking ArtistSpecialties table:', err);
      } else if (!row) {
        console.log('Creating ArtistSpecialties table...');
        db.run(`CREATE TABLE ArtistSpecialties (
          artist_specialty_id INTEGER PRIMARY KEY AUTOINCREMENT,
          artist_id INTEGER NOT NULL,
          specialty_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (artist_id) REFERENCES Artists(artist_id) ON DELETE CASCADE,
          FOREIGN KEY (specialty_id) REFERENCES Specialties(specialty_id) ON DELETE CASCADE,
          UNIQUE(artist_id, specialty_id)
        )`, (err) => {
          if (err) {
            console.error('Error creating ArtistSpecialties table:', err);
          } else {
            console.log('✅ Created ArtistSpecialties table');
          }
        });
      } else {
        console.log('✅ ArtistSpecialties table already exists');
      }

      // Close database after operations
      setTimeout(() => {
        db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
          } else {
            console.log('Database operations completed');
          }
        });
      }, 1000);
    });
  });
});