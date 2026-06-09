const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'tradlys.png');
const assetsDir = path.join(__dirname, '..', 'frontend', 'assets');

fs.mkdirSync(assetsDir, { recursive: true });

(async () => {
  await sharp(src)
    .resize(192, 192, { fit: 'contain', background: { r: 5, g: 7, b: 15, alpha: 1 } })
    .png()
    .toFile(path.join(assetsDir, 'logo-192.png'));

  await sharp(src)
    .resize(512, 512, { fit: 'contain', background: { r: 5, g: 7, b: 15, alpha: 1 } })
    .png()
    .toFile(path.join(assetsDir, 'logo-512.png'));

  await sharp(src)
    .resize(32, 32, { fit: 'contain', background: { r: 5, g: 7, b: 15, alpha: 1 } })
    .png()
    .toFile(path.join(assetsDir, 'favicon.png'));

  console.log('Assets generated from tradlys.png');
})();
