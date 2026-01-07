const http = require('http');

function testGalleries() {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/galleries',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    console.log('Galleries response status:', res.statusCode);
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      try {
        const galleries = JSON.parse(data);
        console.log('Galleries in database:', galleries.length);
        galleries.forEach(g => {
          console.log(`- ${g.gallery_id}: ${g.name} (featured: ${g.is_featured})`);
        });
      } catch (e) {
        console.error('Error parsing response:', e);
        console.log('Raw response:', data);
      }
    });
  });

  req.on('error', (e) => {
    console.error('Request error:', e);
  });

  req.end();
}

function testFeaturedGallery() {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/galleries/featured',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    console.log('Featured gallery response status:', res.statusCode);
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      try {
        const gallery = JSON.parse(data);
        console.log('Featured gallery:', gallery);
      } catch (e) {
        console.error('Error parsing response:', e);
        console.log('Raw response:', data);
      }
    });
  });

  req.on('error', (e) => {
    console.error('Request error:', e);
  });

  req.end();
}

console.log('Testing galleries...');
testGalleries();

setTimeout(() => {
  console.log('\nTesting featured gallery...');
  testFeaturedGallery();
}, 1000);