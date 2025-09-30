const sharp = require('sharp');
const fs = require('fs');

// Crear carpeta icons si no existe
if (!fs.existsSync('public/icons')) {
  fs.mkdirSync('public/icons');
}

// Generar iconos
sharp('public/gato-icon.svg')
  .resize(192, 192)
  .png()
  .toFile('public/icons/icon-192x192.png');

sharp('public/gato-icon.svg')
  .resize(512, 512)
  .png()
  .toFile('public/icons/icon-512x512.png');

sharp('public/gato-icon.svg')
  .resize(180, 180)
  .png()
  .toFile('public/icons/apple-touch-icon.png');

console.log('Iconos generados exitosamente!');