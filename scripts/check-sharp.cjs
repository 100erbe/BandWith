try {
  const sharp = require('sharp');
  console.log('Sharp version:', sharp.version);
} catch (e) {
  console.log('Sharp not installed:', e.message);
}
