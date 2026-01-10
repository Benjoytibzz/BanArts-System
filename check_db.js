const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('banarts.db');
db.all("PRAGMA table_info(Museums)", (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log(JSON.stringify(rows, null, 2));
    }
    db.close();
});
