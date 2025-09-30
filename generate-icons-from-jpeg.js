const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Crear directorio icons si no existe
const iconsDir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Limpiar iconos existentes
const existingIcons = ['icon-192x192.png', 'icon-512x512.png', 'apple-touch-icon.png', 'favicon-32x32.png'];
existingIcons.forEach(icon => {
  const iconPath = path.join(iconsDir, icon);
  if (fs.existsSync(iconPath)) {
    fs.unlinkSync(iconPath);
    console.log(`Eliminado: ${icon}`);
  }
});

// Función para crear máscara con bordes redondeados
function createRoundedMask(size) {
  const radius = Math.floor(size * 0.15); // 15% del tamaño para bordes sutiles
  return Buffer.from(
    `<svg width="${size}" height="${size}">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/>
    </svg>`
  );
}

// Generar iconos desde icon.jpeg
const inputPath = path.join(__dirname, 'public', 'icon.jpeg');

const sizes = [
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 }
];

Promise.all(
  sizes.map(({ name, size }) => {
    const outputPath = path.join(iconsDir, name);
    const mask = createRoundedMask(size);
    
    return sharp(inputPath)
      .resize(size, size, {
        fit: 'contain',  // Cambiado de 'cover' a 'contain'
        position: 'center',
        background: { r: 255, g: 255, b: 255, alpha: 0 } // Fondo transparente
      })
      .composite([
        {
          input: mask,
          blend: 'dest-in'
        }
      ])
      .png({ quality: 90 })
      .toFile(outputPath)
      .then(() => {
        console.log(`✅ Generado: ${name} (${size}x${size}) con bordes redondeados`);
      })
      .catch(err => {
        console.error(`❌ Error generando ${name}:`, err.message);
      });
  })
).then(() => {
  console.log('\n🎉 ¡Todos los iconos generados exitosamente con bordes redondeados!');
}).catch(err => {
  console.error('❌ Error en el proceso:', err);
});