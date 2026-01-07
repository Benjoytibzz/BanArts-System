const http = require('http');

function testGallery() {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/gallery/2',
    method: 'HEAD'  // Use HEAD to just get headers without body
  };

  const req = http.request(options, (res) => {
    console.log('Status:', res.statusCode);
    console.log('Headers:', res.headers);
    res.on('data', (chunk) => {
      // Should not get data for HEAD
    });
    res.on('end', () => {
      console.log('Response ended');
    });
  });

  req.on('error', (e) => {
    console.error('Request error:', e);
  });

  req.end();
}

testGallery();