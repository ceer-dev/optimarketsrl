const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 8080;
const ROOT_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

function getLocalIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ name, address: iface.address });
      }
    }
  }
  return ips;
}

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const filePath = path.join(ROOT_DIR, reqPath);
  if (!filePath.startsWith(ROOT_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.end('Not Found: ' + reqPath);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const etag = `"${stats.size.toString(16)}-${stats.mtimeMs.toString(16)}"`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('ETag', etag);
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (ext === '.json' && reqPath.includes('precios')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else if (['.png', '.jpg', '.jpeg', '.webp', '.svg', '.woff2'].includes(ext)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }

    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch && ifNoneMatch === etag) {
      res.statusCode = 304;
      res.end();
      return;
    }

    if (req.method === 'HEAD') {
      res.statusCode = 200;
      res.end();
      return;
    }

    res.statusCode = 200;
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIps();
  console.log(`=======================================================`);
  console.log(`  OPTIMARKET SRL - SERVIDOR DE VISTA PREVIA LOCAL`);
  console.log(`=======================================================`);
  console.log(`  > Local (PC):      http://localhost:${PORT}`);
  ips.forEach(i => {
    console.log(`  > Red (${i.name}): http://${i.address}:${PORT}`);
  });
  console.log(`=======================================================`);
});
