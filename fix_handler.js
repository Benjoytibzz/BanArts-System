const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server.js');

try {
  let content = fs.readFileSync(filePath, 'utf8');
  
  const oldHandler = `  // 404 handler for unmatched routes (instead of serving static files)
  // This prevents static middleware from catching API requests
  app.use((req, res) => {
    // Only serve static files for GET requests
    if (req.method === 'GET') {
      const filePath = path.join(__dirname, req.path);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.sendFile(filePath);
      } else {
        res.status(404).json({ error: 'Route not found' });
      }
    } else {
      res.status(404).json({ error: 'Route not found' });
    }
  });`;
  
  const newHandler = `  // 404 handler - return JSON for unmatched API routes
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });`;
  
  if (content.includes(oldHandler)) {
    content = content.replace(oldHandler, newHandler);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ File updated successfully');
  } else {
    console.log('⚠️ Handler not found - checking for variations...');
    if (content.includes('// 404 handler for unmatched routes')) {
      console.log('Found handler, attempting simpler replacement...');
      content = content.replace(
        /\/\/ 404 handler for unmatched routes[\s\S]*?app\.use\(\(req, res\) => \{[\s\S]*?\}\);/,
        `  // 404 handler - return JSON for unmatched API routes
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });`
      );
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('✅ File updated with regex replacement');
    }
  }
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
