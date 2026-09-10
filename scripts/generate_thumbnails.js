const fs = require('fs');
const path = require('path');
const sharp = require('D:/Work/Optimarket/Optiweb/Optiweb/node_modules/sharp');

const BASE_DIR = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(BASE_DIR, 'images');
const THUMBS_DIR = path.join(IMAGES_DIR, 'thumbs');
const OPT_DIR = path.join(IMAGES_DIR, 'optimizadas');

const SUBDIRS = ['lentilla', 'materiallisto', 'productos'];

async function processDirectory(sub) {
  const srcDir = path.join(IMAGES_DIR, sub);
  const dstThumbDir = path.join(THUMBS_DIR, sub);
  const dstOptDir = path.join(OPT_DIR, sub);

  if (!fs.existsSync(dstThumbDir)) fs.mkdirSync(dstThumbDir, { recursive: true });
  if (!fs.existsSync(dstOptDir)) fs.mkdirSync(dstOptDir, { recursive: true });

  const files = fs.readdirSync(srcDir);
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!['.png', '.jpg', '.jpeg'].includes(ext)) continue;

    const baseName = path.basename(file, ext);
    const srcFile = path.join(srcDir, file);

    const thumbWebp = path.join(dstThumbDir, `${baseName}.webp`);
    const thumbJpg = path.join(dstThumbDir, `${baseName}.jpg`);
    const optWebp = path.join(dstOptDir, `${baseName}.webp`);
    const optJpg = path.join(dstOptDir, `${baseName}.jpg`);

    try {
      // 1. Thumbnail WebP (140x140, ~2-4 KB)
      if (!fs.existsSync(thumbWebp)) {
        await sharp(srcFile)
          .resize(140, 140, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 75 })
          .toFile(thumbWebp);
      }
      // 2. Thumbnail JPG fallback (140x140, ~3-5 KB)
      if (!fs.existsSync(thumbJpg)) {
        await sharp(srcFile)
          .resize(140, 140, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 75 })
          .toFile(thumbJpg);
      }
      // 3. Optimized Card/Detail WebP (500x500, ~15-25 KB)
      if (!fs.existsSync(optWebp)) {
        await sharp(srcFile)
          .resize(500, 500, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(optWebp);
      }
      // 4. Optimized Card/Detail JPG fallback (500x500, ~20-35 KB)
      if (!fs.existsSync(optJpg)) {
        await sharp(srcFile)
          .resize(500, 500, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 75 })
          .toFile(optJpg);
      }
    } catch (e) {
      console.error(`Error procesando ${file}:`, e.message);
    }
  }
}

async function main() {
  console.log('Generando miniaturas optimizadas...');
  for (const sub of SUBDIRS) {
    console.log(`Procesando ${sub}...`);
    await processDirectory(sub);
  }
  console.log('¡Miniaturas generadas con éxito!');
}

main().catch(console.error);
