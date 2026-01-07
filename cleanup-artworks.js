const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('Starting cleanup of null/empty title artworks...');

db.run('DELETE FROM GalleryFeaturedArtworks WHERE title IS NULL OR title = ""', function(err) {
  if (err) {
    console.error('Cleanup error:', err);
    process.exit(1);
  }
  console.log(`✓ Cleanup complete: Deleted ${this.changes} artworks with NULL or empty titles`);
  
  db.all('SELECT gallery_featured_id, gallery_id, title FROM GalleryFeaturedArtworks', (err, rows) => {
    if (err) {
      console.error('Error reading remaining artworks:', err);
    } else {
      console.log(`\nRemaining artworks (${rows.length}):`);
      rows.forEach(row => {
        console.log(`  - Gallery ${row.gallery_id}: "${row.title}"`);
      });
    }
    db.close();
  });
});
