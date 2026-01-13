const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('banarts.db');

console.log('Dropping unused tables...');

// Drop Booths table
db.run('DROP TABLE IF EXISTS Booths', (err) => {
    if (err) {
        console.error('Error dropping Booths table:', err);
    } else {
        console.log('✅ Dropped Booths table');
    }
});

// Drop UserUploadedArtworks table
db.run('DROP TABLE IF EXISTS UserUploadedArtworks', (err) => {
    if (err) {
        console.error('Error dropping UserUploadedArtworks table:', err);
    } else {
        console.log('✅ Dropped UserUploadedArtworks table');
    }

    // Close the database after operations
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed.');
        }
    });
});