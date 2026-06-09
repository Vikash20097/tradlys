const sharp = require('sharp');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="32" fill="#00b0ff"/>
  <text x="96" y="118" font-family="Arial" font-size="76" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">T</text>
</svg>`;

(async () => {
  try {
    await sharp(Buffer.from(svg)).png().toFile('../frontend/assets/logo-192.png');
    console.log('logo-192.png created');
    await sharp(Buffer.from(svg)).resize(512, 512).png().toFile('../frontend/assets/logo-512.png');
    console.log('logo-512.png created');
    await sharp(Buffer.from(svg)).resize(32, 32).png().toFile('../frontend/assets/favicon.png');
    console.log('favicon.png created');
  } catch (e) {
    console.error(e);
  }
})();
