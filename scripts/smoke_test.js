const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

function createStaticServer(port) {
  const rootDir = path.resolve(__dirname, '..');
  const server = http.createServer((req, res) => {
    let reqPath = decodeURI(req.url.split('?')[0]);
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
    
    const filePath = path.join(rootDir, reqPath);
    if (!filePath.startsWith(rootDir)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.statusCode = 404;
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

async function runTest() {
  const PORT = 3000;
  console.log(`Starting local server on port ${PORT}...`);
  const server = await createStaticServer(PORT);
  console.log('Local static server running.');

  const puppeteer = require('puppeteer');
  console.log('Launching headless browser...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    
    // Simulate registered client and disable novedades modal
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('registeredClient', JSON.stringify({
        optica: 'OPTICA_CI_TEST',
        phone: '71234567',
        nit: '123456'
      }));
      sessionStorage.setItem('novedadesShown', 'true');
    });

    console.log('Navigating to http://127.0.0.1:3000/index.html ...');
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Wait for categories
    await page.waitForSelector('.category-btn', { timeout: 10000 });
    const buttons = await page.$$('.category-btn');
    console.log(`[OK] Found ${buttons.length} category buttons.`);

    if (buttons.length < 4) {
      throw new Error(`Expected at least 4 category buttons, got ${buttons.length}`);
    }

    // Verify Lentilla button is present and click it
    await page.waitForSelector('button[data-cat="Lentilla"]', { timeout: 5000 });
    await page.click('button[data-cat="Lentilla"]');
    console.log('[OK] Lentilla category clicked successfully.');

    // Wait for subcategories
    await page.waitForSelector('#subcategorySection', { visible: true, timeout: 10000 });
    console.log('[OK] Subcategories visible.');

    console.log('[OK] All Smoke Tests Passed Successfully!');
  } finally {
    await browser.close();
    server.close();
  }
}

runTest().catch((err) => {
  console.error('Smoke Test Failed:', err);
  process.exit(1);
});
