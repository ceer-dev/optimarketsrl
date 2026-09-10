const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE_URL = 'http://127.0.0.1:8080/index.html';

async function measureScenario(scenarioName, options = {}) {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  if (options.cpuThrottling) {
    const client = await page.target().createCDPSession();
    await client.send('Emulation.setCPUThrottlingRate', { rate: options.cpuThrottling });
  }

  // Pre-register client so it doesn't redirect to form.html
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('registeredClient', JSON.stringify({
      optica: 'OPTICA_MEDICION',
      phone: '77777777',
      nit: '999999'
    }));
    sessionStorage.setItem('novedadesShown', 'true');
  });

  let requests = [];
  let transferredBytes = 0;
  let imageRequests = [];

  page.on('request', (req) => {
    requests.push({ url: req.url(), resourceType: req.resourceType() });
  });

  page.on('response', async (res) => {
    try {
      const headers = res.headers();
      const len = parseInt(headers['content-length'] || 0, 10);
      transferredBytes += len;
      if (res.request().resourceType() === 'image') {
        imageRequests.push({
          url: res.url(),
          status: res.status(),
          size: len
        });
      }
    } catch (e) {}
  });

  const startTime = Date.now();
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
  const tti = Date.now() - startTime;

  // Wait for categories to be clickable
  await page.waitForSelector('.category-btn', { timeout: 10000 });

  return {
    browser,
    page,
    tti,
    requestsCount: requests.length,
    transferredBytes,
    imageRequests
  };
}

async function runAllBenchmarks() {
  console.log('>>> INICIANDO MEDICIONES DE RENDIMIENTO...');

  // 1. Visita Inicial (Caché Vacía)
  console.log('\n--- 1. Visita Inicial (Cold Cache) ---');
  const cold = await measureScenario('Cold Cache');
  console.log(`Solicitudes: ${cold.requestsCount}`);
  console.log(`Bytes transferidos (aprox): ${(cold.transferredBytes / 1024).toFixed(1)} KB`);
  console.log(`Tiempo hasta interactivo (TTI): ${cold.tti} ms`);
  await cold.browser.close();

  // 2. Visita Repetida (Warm Cache)
  console.log('\n--- 2. Visita Repetida (Warm Cache) ---');
  // Reuse same user data directory or browser context
  const browser2 = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  const page2 = await browser2.newPage();
  await page2.evaluateOnNewDocument(() => {
    localStorage.setItem('registeredClient', JSON.stringify({ optica: 'OPTICA_TEST', phone: '777', nit: '111' }));
    sessionStorage.setItem('novedadesShown', 'true');
  });
  await page2.goto(BASE_URL, { waitUntil: 'networkidle2' });
  
  let warmRequests = 0;
  let warmBytes = 0;
  page2.on('dialog', async d => {
    console.log('DIALOG:', d.message());
    await d.dismiss();
  });
  page2.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page2.on('request', () => warmRequests++);
  page2.on('response', (res) => {
    const len = parseInt(res.headers()['content-length'] || 0, 10);
    warmBytes += len;
  });

  const warmStart = Date.now();
  await page2.reload({ waitUntil: 'networkidle2' });
  const warmTti = Date.now() - warmStart;
  console.log(`Solicitudes en recarga: ${warmRequests}`);
  console.log(`Bytes transferidos: ${(warmBytes / 1024).toFixed(1)} KB`);
  console.log(`Tiempo recarga: ${warmTti} ms`);

  // 3. Selección de Medida en Flujo Actual (Lentilla -> Organico Blanco -> +0.50)
  console.log('\n--- 3. Selección de Medida (Carga de Imagen) ---');
  await page2.waitForSelector('button[data-cat="Lentilla"]', { timeout: 5000 });
  await page2.click('button[data-cat="Lentilla"]');
  await page2.waitForSelector('#step2', { visible: true, timeout: 5000 });
  await page2.click('#viewToggleSearch');
  await page2.waitForSelector('#standardSearchSection:not(.hidden)', { visible: true, timeout: 5000 });

  // Type product name
  await page2.type('#productInput', 'Organico Blanco');
  await page2.waitForTimeout ? page2.waitForTimeout(400) : new Promise(r => setTimeout(r, 400));
  
  // Fill measure input
  await page2.evaluate(() => {
    const pInput = document.getElementById('productInput');
    if (pInput) pInput.value = 'Organico Blanco';
    const mInput = document.getElementById('finalMeasure');
    if (mInput) {
      mInput.value = '+0.50';
      mInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  let measureImageRequests = [];
  page2.on('response', (res) => {
    if (res.request().resourceType() === 'image') {
      measureImageRequests.push({
        url: res.url(),
        size: parseInt(res.headers()['content-length'] || 0, 10)
      });
    }
  });

  const measureClickStart = Date.now();
  // Click main search button
  await page2.waitForSelector('#mainSearchBtn', { visible: true, timeout: 5000 });
  await page2.click('#mainSearchBtn');
  await page2.waitForSelector('#step3.active', { visible: true, timeout: 5000 });
  
  // Wait for main envelope image to load
  await page2.waitForFunction(() => {
    const img = document.getElementById('calcMainEnvelopeImage');
    return img && img.complete && img.naturalWidth > 0;
  }, { timeout: 10000 });
  const imageRenderTime = Date.now() - measureClickStart;

  const totalMeasureImageBytes = measureImageRequests.reduce((a, b) => a + b.size, 0);
  console.log(`Imágenes descargadas al cotizar: ${measureImageRequests.length}`);
  console.log(`Peso total imágenes en selección: ${(totalMeasureImageBytes / 1024).toFixed(1)} KB`);
  console.log(`Tiempo hasta renderizar imagen: ${imageRenderTime} ms`);
  measureImageRequests.forEach(img => {
    console.log(`  - ${path.basename(img.url)}: ${(img.size / 1024).toFixed(1)} KB`);
  });

  // 4. Cambio de Medida dentro del mismo material
  console.log('\n--- 4. Cambio de Medida dentro del mismo material ---');
  // Go back to step 2
  await page2.evaluate(() => View.goToStep(2));
  await page2.waitForSelector('#step2.active', { visible: true, timeout: 5000 });

  // Update measure to +0.75
  await page2.evaluate(() => {
    const m = document.getElementById('finalMeasure');
    if (m) {
      m.value = '+0.75';
      m.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  let changeImageRequests = [];
  page2.on('response', (res) => {
    if (res.request().resourceType() === 'image') {
      changeImageRequests.push(res.url());
    }
  });

  const changeStart = Date.now();
  await page2.evaluate(() => Controller.handleFinalSearch());
  await page2.waitForSelector('#step3.active', { visible: true, timeout: 5000 });
  await page2.waitForFunction(() => {
    const img = document.getElementById('calcMainEnvelopeImage');
    return img && img.complete && img.naturalWidth > 0;
  }, { timeout: 10000 });
  const changeRenderTime = Date.now() - changeStart;
  console.log(`Peticiones de imagen al cambiar medida: ${changeImageRequests.length}`);
  console.log(`Tiempo al cambiar medida: ${changeRenderTime} ms`);

  await browser2.close();

  const results = {
    coldTti: cold.tti,
    coldBytes: cold.transferredBytes,
    coldRequests: cold.requestsCount,
    warmTti,
    warmBytes,
    warmRequests,
    imageRequestsCount: measureImageRequests.length,
    imageTotalBytes: totalMeasureImageBytes,
    imageRenderTime,
    changeImageRequestsCount: changeImageRequests.length,
    changeRenderTime
  };

  fs.writeFileSync('scripts/baseline_results.json', JSON.stringify(results, null, 2));
  console.log('\n>>> MEDICIÓN BASE COMPLETADA. Guardada en scripts/baseline_results.json');
}

runAllBenchmarks().catch(console.error);
