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
    
    // Cliente ya registrado (el panel redirige a form.html si no lo está)
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('registeredClient', JSON.stringify({
        optica: 'OPTICA_CI_TEST',
        phone: '71234567',
        nit: '123456'
      }));
    });

    const erroresPagina = [];
    page.on('console', (msg) => console.log('[PAGE]', msg.text()));
    page.on('pageerror', (err) => { erroresPagina.push(err); console.error('[PAGE ERROR]', err); });

    console.log(`Navigating to http://127.0.0.1:${PORT}/index.html ...`);
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // 1) Categorías del catálogo (catalogo/indice.json)
    await page.waitForSelector('.tarjeta-categoria', { timeout: 10000 });
    const categorias = await page.$$('.tarjeta-categoria');
    console.log(`[OK] Found ${categorias.length} categories.`);
    if (categorias.length < 4) throw new Error(`Expected at least 4 categories, got ${categorias.length}`);

    // 2) Lentilla → subcategorías
    await page.click('a.tarjeta-categoria[href="#/c/lentilla"]');
    await page.waitForSelector('#grillaSub .tarjeta-sub', { timeout: 10000 });
    console.log('[OK] Lentilla subcategories visible.');

    // 3) Ventana de medida: «+2,50-0,50» (con coma) debe encontrarse y permitir agregar
    await page.click('#grillaSub .tarjeta-sub');
    await page.waitForSelector('#fMedida', { visible: true, timeout: 10000 });
    await page.type('#fMedida', '+2,50-0,50');
    await page.waitForFunction(() => !document.getElementById('btnAgregar').disabled, { timeout: 5000 });
    console.log('[OK] Measure window resolves "+2,50-0,50" and allows adding.');

    // 4) Búsqueda global con el diccionario (config/diccionario-busqueda.json): «cr39» → Organico Blanco
    await page.goto(`http://127.0.0.1:${PORT}/index.html#/buscar/cr39`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForFunction(() => /Organico Blanco/.test((document.getElementById('resultadosGlobal') || {}).innerText || ''), { timeout: 10000 });
    console.log('[OK] Search dictionary resolves "cr39".');

    if (erroresPagina.length) throw new Error(`Page errors: ${erroresPagina.length}`);
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
