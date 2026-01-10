const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('banarts.db');
db.run("ALTER TABLE Museums ADD COLUMN is_featured INTEGER DEFAULT 0", (err) => {
    if (err) {
        if (err.message.includes('duplicate column')) {
            console.log('Column already exists');
        } else {
            console.error(err);
        }
    } else {
        console.log('✅ Added is_featured column to Museums');
    }
    db.close();
});
