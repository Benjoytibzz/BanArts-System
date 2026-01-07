#!/usr/bin/env node
const http = require('http');

// Try to connect to the server
const options = {
  hostname: 'localhost',
  port: 3002,
  path: '/test',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Server is running!');
    console.log('Status:', res.statusCode);
    console.log('Response:', data.substring(0, 100));
    process.exit(0);
  });
});

req.on('error', (error) => {
  console.error('Server is not running:', error.message);
  process.exit(1);
});

req.end();

// Timeout after 5 seconds
setTimeout(() => {
  console.error('Server connection timeout');
  process.exit(1);
}, 5000);
