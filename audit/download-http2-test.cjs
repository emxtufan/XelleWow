const http2 = require('node:http2');
const fs = require('node:fs');
const client = http2.connect('https://websitefactory.cartier.com');
client.on('error', error => { console.error(error.message); process.exitCode = 1; });
const request = client.request({
  ':path': '/akamai-storage/videos/ww26/assets/app.css',
  ':method': 'GET',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
  'accept': 'text/css,*/*;q=0.1',
  'referer': 'https://www.cartier.com/',
  'sec-fetch-dest': 'style',
  'sec-fetch-mode': 'no-cors',
  'sec-fetch-site': 'same-site',
});
const chunks = [];
request.on('response', headers => console.log('Status:', headers[':status']));
request.on('data', chunk => chunks.push(chunk));
request.on('end', () => {
  const data = Buffer.concat(chunks);
  fs.writeFileSync('F:/Cartier/audit/download-http2-test.css', data);
  console.log('Bytes:', data.length);
  client.close();
});
request.on('error', error => { console.error(error.message); client.close(); process.exitCode = 1; });
request.end();
setTimeout(() => client.destroy(), 20000).unref();
