const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputDir = path.join(__dirname, 'splash-assets');
const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.svg'));

async function convert() {
  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(inputDir, file.replace('.svg', '.png'));
    const svg = fs.readFileSync(inputPath);
    
    // Extract dimensions from filename or SVG
    const match = file.match(/(\d+)x(\d+)/);
    const width = match ? parseInt(match[1]) : 1366;
    const height = match ? parseInt(match[2]) : 1366;
    
    await sharp(Buffer.from(svg))
      .resize(width, height)
      .png()
      .toFile(outputPath);
    
    console.log(`Converted: ${file} -> ${file.replace('.svg', '.png')}`);
  }
}

convert().then(() => console.log('\n✓ All splash PNGs created'));
