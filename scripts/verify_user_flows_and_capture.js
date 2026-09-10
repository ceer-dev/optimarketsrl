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

const { spawn } = require('child_process');

async function verifyAll() {
  const PORT = 3005;
  const artifactsDir = 'C:/Users/Carlos Eduardo/.gemini/antigravity-ide/brain/c07ec8ba-1638-417f-ae21-16f38a403221';
  const rootDir = path.resolve(__dirname, '..');
  
  console.log(`Starting independent server on port ${PORT}...`);
  const serverProcess = spawn('python', ['-m', 'http.server', `${PORT}`, '--bind', '127.0.0.1'], {
    cwd: rootDir,
    stdio: 'ignore'
  });
  await new Promise(r => setTimeout(r, 1500));
  console.log('Server started.');

  const puppeteer = require('puppeteer');
  const launchOptions = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  };
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (fs.existsSync(chromePath)) {
    launchOptions.executablePath = chromePath;
  }
  const browser = await puppeteer.launch(launchOptions);

  try {
    // ==========================================
    // 1. CAPTURE FORM.HTML - DESKTOP (1280x800)
    // ==========================================
    console.log('\n--- TEST 1: form.html Desktop ---');
    const pageDesk = await browser.newPage();
    pageDesk.on('dialog', async (d) => {
      console.log('DIALOG:', d.message());
      await d.dismiss();
    });
    pageDesk.on('console', (msg) => console.log('[PAGE DESK]', msg.text()));
    pageDesk.on('pageerror', (err) => console.error('[PAGE DESK ERROR]', err));

    await pageDesk.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
    await pageDesk.goto(`http://127.0.0.1:${PORT}/form.html`, { waitUntil: 'load' });
    
    // Check form elements
    await pageDesk.waitForSelector('#opticaName');
    await pageDesk.waitForSelector('#phoneNumber');
    await pageDesk.waitForSelector('#nit');
    await pageDesk.waitForSelector('#btnSubmitRegistration');
    console.log('[OK] form.html desktop elements verified.');

    const formDeskScreenshot = path.join(artifactsDir, 'capture_form_desktop.png');
    await pageDesk.screenshot({ path: formDeskScreenshot, fullPage: false });
    console.log('[OK] Desktop form screenshot saved to:', formDeskScreenshot);

    // ==========================================
    // 2. CAPTURE FORM.HTML - MOBILE (390x844)
    // ==========================================
    console.log('\n--- TEST 2: form.html Mobile ---');
    const pageMob = await browser.newPage();
    pageMob.on('dialog', async (d) => await d.dismiss());
    await pageMob.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
    await pageMob.goto(`http://127.0.0.1:${PORT}/form.html`, { waitUntil: 'load' });
    await pageMob.waitForSelector('#btnSubmitRegistration');
    
    const formMobScreenshot = path.join(artifactsDir, 'capture_form_mobile.png');
    await pageMob.screenshot({ path: formMobScreenshot, fullPage: false });
    console.log('[OK] Mobile form screenshot saved to:', formMobScreenshot);

    // ==========================================
    // 3. TEST CLIENT REGISTRATION & REDIRECT
    // ==========================================
    console.log('\n--- TEST 3: New Client Registration ---');
    await pageDesk.evaluate(() => {
      document.getElementById('opticaName').value = 'ÓPTICA SANTA CRUZ';
      document.getElementById('phoneNumber').value = '71234567';
      document.getElementById('nit').value = '123456789';
      document.getElementById('registrationForm').requestSubmit();
    });
    await pageDesk.waitForFunction(() => window.location.href.includes('index.html'), { timeout: 15000 });
    console.log('[OK] Redirect to index.html after registration succeeded!');
    
    const clientData = await pageDesk.evaluate(() => localStorage.getItem('registeredClient'));
    console.log('[OK] localStorage clientData:', clientData);
    if (!clientData || !clientData.includes('SANTA CRUZ')) {
      throw new Error('Registration failed to persist client in localStorage');
    }
    // ==========================================
    // 4. TEST RETURNING CLIENT AUTO-REDIRECT
    // ==========================================
    console.log('\n--- TEST 4: Returning Client Auto-Redirect ---');
    // Now navigate back to form.html with registeredClient set in localStorage
    await pageDesk.goto(`http://127.0.0.1:${PORT}/form.html`, { waitUntil: 'domcontentloaded' });
    // Wait until URL becomes index.html
    await pageDesk.waitForFunction(() => window.location.href.includes('index.html'), { timeout: 15000 });
    console.log('[OK] Navigating to form.html resulted in URL:', pageDesk.url());
    console.log('[OK] Auto-redirect verified!');

    // Wait for index.html header and State readiness
    await pageDesk.waitForSelector('.site-header', { timeout: 15000 });
    await pageDesk.waitForFunction(() => window.State && window.State.isReady === true, { timeout: 15000 });
    const welcomeText = await pageDesk.evaluate(() => {
      const msg = document.getElementById('welcomeMessage');
      return msg ? msg.innerText : '';
    });
    console.log('[OK] welcomeMessage text:', welcomeText);

    // Dismiss novedades modal if present
    await pageDesk.evaluate(() => {
      const modal = document.getElementById('novedadesModal');
      if (modal) modal.classList.add('hidden');
      sessionStorage.setItem('novedadesShown', 'true');
    });

    // Capture Header Desktop (clip top 90px)
    const headerDeskScreenshot = path.join(artifactsDir, 'capture_header_desktop.png');
    await pageDesk.screenshot({ path: headerDeskScreenshot, clip: { x: 0, y: 0, width: 1280, height: 90 } });
    console.log('[OK] Header Desktop screenshot saved to:', headerDeskScreenshot);

    const indexDeskScreenshot = path.join(artifactsDir, 'capture_index_desktop.png');
    await pageDesk.screenshot({ path: indexDeskScreenshot, fullPage: false });
    console.log('[OK] Index Desktop screenshot saved to:', indexDeskScreenshot);

    // ==========================================
    // 5. INDEX.HTML - MOBILE HEADER & FLOW
    // ==========================================
    console.log('\n--- TEST 5: index.html Mobile Header ---');
    await pageMob.evaluateOnNewDocument(() => {
      localStorage.setItem('registeredClient', JSON.stringify({
        optica: 'ÓPTICA SANTA CRUZ',
        phone: '71234567',
        nit: '123456789'
      }));
      sessionStorage.setItem('novedadesShown', 'true');
    });
    await pageMob.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
    await pageMob.waitForSelector('.site-header', { timeout: 15000 });
    await pageMob.waitForFunction(() => window.State && window.State.isReady === true, { timeout: 15000 });
    
    // Dismiss modal on mobile
    await pageMob.evaluate(() => {
      const modal = document.getElementById('novedadesModal');
      if (modal) modal.classList.add('hidden');
      sessionStorage.setItem('novedadesShown', 'true');
    });

    const headerMobScreenshot = path.join(artifactsDir, 'capture_header_mobile.png');
    await pageMob.screenshot({ path: headerMobScreenshot, clip: { x: 0, y: 0, width: 390, height: 140 } });
    console.log('[OK] Header Mobile screenshot saved to:', headerMobScreenshot);

    const indexMobScreenshot = path.join(artifactsDir, 'capture_index_mobile.png');
    await pageMob.screenshot({ path: indexMobScreenshot, fullPage: false });
    console.log('[OK] Index Mobile screenshot saved to:', indexMobScreenshot);

    // ==========================================
    // 6. E2E: LENTILLA -> ORGÁNICO BLANCO -> CART
    // ==========================================
    console.log('\n--- TEST 6: Flow to Lentilla -> Organico Blanco -> Price Check -> Cart ---');
    await pageDesk.evaluate(() => {
      const btn = document.querySelector('button[data-cat="Lentilla"]');
      if (btn) btn.click();
      else throw new Error('button[data-cat="Lentilla"] not found');
    });
    console.log('[OK] Clicked Lentilla');

    await pageDesk.waitForFunction(() => {
      const s2 = document.getElementById('step2');
      return s2 && s2.classList.contains('active');
    });
    console.log('[OK] Step 2 is active!');

    // Trigger search for Organico Blanco
    await pageDesk.evaluate(() => {
      Controller.handleSearchInput('Organico Blanco');
    });

    // Select Organico Blanco from results
    await pageDesk.waitForFunction(() => {
      const items = document.querySelectorAll('#productResults .result-item');
      return items.length > 0;
    });
    
    await pageDesk.evaluate(() => {
      const firstItem = document.querySelector('#productResults .result-item');
      if (firstItem) firstItem.click();
    });
    console.log('[OK] Selected Organico Blanco item');

    // Wait for secondary inputs, enter measure +0.00 and search
    await pageDesk.waitForSelector('#finalMeasure', { timeout: 10000 });
    await pageDesk.evaluate(() => {
      document.getElementById('finalMeasure').value = '+0.00';
      Controller.handleFinalSearch();
    });
    console.log('[OK] Entered measure +0.00 and submitted search');

    // Wait for step 3 calculation view
    await pageDesk.waitForFunction(() => {
      const s3 = document.getElementById('step3');
      return s3 && s3.classList.contains('active');
    }, { timeout: 10000 });
    console.log('[OK] Step 3 calculation view opened');

    // Wait for price calculation
    await pageDesk.waitForFunction(() => {
      const el = document.getElementById('liveTotal');
      return el && el.innerText && el.innerText.includes('Bs');
    }, { timeout: 10000 });

    const step3Price = await pageDesk.evaluate(() => document.getElementById('liveTotal').innerText);
    console.log('[OK] Subtotal in Step 3:', step3Price);
    if (!step3Price.includes('8.5')) {
      throw new Error(`Expected Step 3 price to contain 8.5 Bs., got: ${step3Price}`);
    }

    // Add to cart and finish order
    await pageDesk.evaluate(() => Controller.handleAddToCart('finish'));
    console.log('[OK] Clicked Agregar y Finalizar Pedido');

    // Wait for step 4
    await pageDesk.waitForFunction(() => {
      const s4 = document.getElementById('step4');
      return s4 && s4.classList.contains('active');
    }, { timeout: 10000 });
    console.log('[OK] Step 4 Cart / Proforma is visible!');

    const cartPrice = await pageDesk.evaluate(() => {
      const totalEl = document.getElementById('step4Total');
      return totalEl ? totalEl.innerText : '';
    });
    console.log('[OK] Total price in Step 4 Proforma:', cartPrice);

    const proformaScreenshot = path.join(artifactsDir, 'capture_proforma_desktop.png');
    await pageDesk.screenshot({ path: proformaScreenshot, fullPage: false });
    console.log('[OK] Proforma screenshot saved to:', proformaScreenshot);

    console.log('\n=========================================');
    console.log('ALL TESTS AND SCREENSHOTS COMPLETED 100%!');
    console.log('=========================================');

    await pageDesk.close();
    await pageMob.close();
  } finally {
    await browser.close();
    serverProcess.kill();
  }
}

verifyAll().catch(e => {
  console.error('VERIFICATION FAILED:', e);
  process.exit(1);
});
