const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://localhost:8080/index.html';

async function validateCatalogFlow() {
  console.log('>>> INICIANDO VALIDACIÓN DEL CATÁLOGO VISUAL Y PROFORMA...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // 1. Desktop Test (1280x800)
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('registeredClient', JSON.stringify({ optica: 'OPTICA_TEST', phone: '777', nit: '111' }));
    sessionStorage.setItem('novedadesShown', 'true');
  });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('1. Navegando a la aplicación...');
  await page.goto(URL, { waitUntil: 'networkidle2' });

  // Wait for State init
  await page.waitForFunction(() => window.State && window.State.isReady, { timeout: 10000 });
  console.log('✔ Estado de datos inicializado.');

  // Click on "ORGÁNICOS"
  console.log('2. Seleccionando categoría ORGÁNICOS (Lentilla)...');
  await page.click('button[data-cat="Lentilla"]');
  await page.waitForSelector('#step2.active', { visible: true, timeout: 5000 });
  await page.waitForSelector('#catalogVisualSection', { visible: true, timeout: 5000 });
  console.log('✔ Catálogo visual abierto en Paso 2.');

  // Verify cards rendered
  const cardsCount = await page.$$eval('.catalog-card', el => el.length);
  console.log(`✔ Tarjetas de materiales renderizadas: ${cardsCount}`);
  if (cardsCount !== 7) {
    throw new Error(`Se esperaban 7 materiales en Lentilla, pero se encontraron ${cardsCount}`);
  }

  // Verify prices on cards
  const firstCardTitle = await page.$eval('.catalog-card:first-child .catalog-card-title', el => el.textContent.trim());
  const firstCardPrice = await page.$eval('.catalog-card:first-child .catalog-card-price', el => el.textContent.trim());
  console.log(`✔ Primera tarjeta: "${firstCardTitle}" - Precio: "${firstCardPrice}"`);

  // Take screenshot of Desktop Catalog
  await page.screenshot({ path: 'scripts/desktop_catalog.png' });
  console.log('✔ Captura guardada en scripts/desktop_catalog.png');

  // Test opening OD/OI modal
  console.log('3. Abriendo modal de medidas para Organico Blanco...');
  await page.click('.catalog-card:first-child .catalog-card-btn');
  await page.waitForSelector('#catalogSelectionModal:not(.hidden)', { visible: true, timeout: 5000 });
  console.log('✔ Modal de prescripción OD/OI abierto.');

  // Enter OD and OI
  await page.type('#csmInputOD', '+1.50');
  await page.type('#csmInputOI', '+2.00');

  const subtotalText = await page.$eval('#csmSubtotalText', el => el.textContent.trim());
  console.log(`✔ Subtotal calculado en modal (OD + OI): ${subtotalText}`);

  // Add to proforma
  console.log('4. Agregando al carrito/proforma...');
  await page.click('.csm-btn-submit');
  await page.waitForSelector('#catalogSelectionModal.hidden', { timeout: 5000 });
  console.log('✔ Modal cerrado.');

  // Check proforma sidebar
  const proformaItemsCount = await page.$$eval('.proforma-sidebar-item', el => el.length);
  const proformaTotal = await page.$eval('#catalogProformaTotal', el => el.textContent.trim());
  console.log(`✔ Items en barra de proforma: ${proformaItemsCount} (OD + OI separados)`);
  console.log(`✔ Total proforma: ${proformaTotal}`);

  if (proformaItemsCount !== 2) {
    throw new Error(`Se esperaban 2 items (OD y OI) en la proforma, pero hay ${proformaItemsCount}`);
  }

  // Test View Toggle to Classic Search
  console.log('5. Probando alternancia a "Búsqueda Rápida"...');
  await page.click('#viewToggleSearch');
  await page.waitForSelector('#standardSearchSection:not(.hidden)', { visible: true, timeout: 3000 });
  const isCatalogHidden = await page.$eval('#catalogVisualSection', el => el.classList.contains('hidden'));
  console.log(`✔ Búsqueda clásica visible, catálogo oculto: ${isCatalogHidden}`);

  // Toggle back to Catalog
  await page.click('#viewToggleCatalog');
  await page.waitForSelector('#catalogVisualSection:not(.hidden)', { visible: true, timeout: 3000 });
  console.log('✔ Retorno exitoso al catálogo visual.');

  // 2. Mobile Viewport Test (390x844 - iPhone / Mobile moderno)
  console.log('6. Probando vista móvil (390x844)...');
  await page.setViewport({ width: 390, height: 844 });
  await page.waitForTimeout ? page.waitForTimeout(500) : new Promise(r => setTimeout(r, 500));

  // Check mobile pills are visible
  const mobilePillsCount = await page.$$eval('.catalog-mobile-pill', el => el.length);
  console.log(`✔ Píldoras de categoría móvil visibles: ${mobilePillsCount}`);

  // Check mobile bottom bar
  const mobileBarCount = await page.$eval('#catalogMobileBarCount', el => el.textContent.trim());
  const mobileBarTotal = await page.$eval('#catalogMobileBarTotal', el => el.textContent.trim());
  console.log(`✔ Barra móvil inferior proforma: ${mobileBarCount} items - ${mobileBarTotal}`);

  await page.screenshot({ path: 'scripts/mobile_catalog.png' });
  console.log('✔ Captura móvil guardada en scripts/mobile_catalog.png');

  await browser.close();
  console.log('\n>>> ¡TODAS LAS PRUEBAS DEL CATÁLOGO PASARON CON ÉXITO! <<<');
}

validateCatalogFlow().catch(err => {
  console.error('ERROR EN VALIDACIÓN:', err);
  process.exit(1);
});
