const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('banarts.db');

db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
    if (err) {
        console.error(err);
        db.close();
        return;
    }

    const tables = rows.map(row => row.name).filter(name => name !== 'sqlite_sequence');
    let completed = 0;
    const results = [];

    tables.forEach(table => {
        db.get(`SELECT COUNT(*) as count FROM \`${table}\``, (err, row) => {
            if (err) {
                console.error(`Error counting rows in ${table}:`, err);
            } else {
                results.push({ table, count: row.count });
            }
            completed++;
            if (completed === tables.length) {
                console.log('Table row counts:');
                results.forEach(result => {
                    console.log(`- ${result.table}: ${result.count} rows`);
                });
                const unused = results.filter(r => r.count === 0);
                if (unused.length > 0) {
                    console.log('\nUnused tables (0 rows):');
                    unused.forEach(u => console.log(`- ${u.table}`));
                } else {
                    console.log('\nNo unused tables found.');
                }
                db.close();
            }
        });
    });
});