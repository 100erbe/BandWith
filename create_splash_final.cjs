const fs = require('fs');
const path = require('path');

// Create splash screen SVG with the correct equalizer logo pattern
const createSplashSVG = (width, height, logoSize) => {
  const cx = width / 2;
  const cy = height / 2;
  
  // Logo dimensions relative to logoSize
  const scale = logoSize / 100;
  const barWidth = 18 * scale;
  const barRadius = 5 * scale;
  const gap = 6 * scale;
  const padding = 12 * scale;
  const iconSize = logoSize;
  const iconRadius = iconSize * 0.22;
  
  // Logo position (centered)
  const logoX = cx - iconSize / 2;
  const logoY = cy - iconSize / 2;
  
  // Column positions relative to logo
  const col1 = logoX + padding;
  const col2 = logoX + padding + barWidth + gap;
  const col3 = logoX + padding + (barWidth + gap) * 2;
  
  // Bar definitions with positions
  const bars = [
    // Column 1: 3 separate bars
    { x: col1, y: logoY + padding, h: barWidth },
    { x: col1, y: logoY + padding + barWidth + gap, h: barWidth },
    { x: col1, y: logoY + iconSize - padding - barWidth, h: barWidth },
    // Column 2: 1 tall bar + 1 small bar
    { x: col2, y: logoY + padding, h: barWidth * 2 + gap },
    { x: col2, y: logoY + iconSize - padding - barWidth, h: barWidth },
    // Column 3: 3 separate bars
    { x: col3, y: logoY + padding, h: barWidth },
    { x: col3, y: logoY + padding + barWidth + gap, h: barWidth },
    { x: col3, y: logoY + iconSize - padding - barWidth, h: barWidth },
  ];

  const barsPath = bars.map(bar => 
    `<rect x="${bar.x}" y="${bar.y}" width="${barWidth}" height="${bar.h}" rx="${barRadius}" fill="#000000"/>`
  ).join('\n    ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="#E6E5E1"/>
  
  <!-- Subtle gradient overlay -->
  <defs>
    <radialGradient id="glow" cx="50%" cy="40%" r="60%">
      <stop offset="0%" style="stop-color:#D4FB46;stop-opacity:0.15"/>
      <stop offset="100%" style="stop-color:#D4FB46;stop-opacity:0"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#glow)"/>
  
  <!-- Logo Background (rounded square) -->
  <rect 
    x="${logoX}" 
    y="${logoY}" 
    width="${iconSize}" 
    height="${iconSize}" 
    rx="${iconRadius}" 
    fill="url(#logoGradient)"
  />
  
  <!-- Logo Gradient -->
  <defs>
    <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#D4FB46"/>
      <stop offset="100%" style="stop-color:#C8F040"/>
    </linearGradient>
  </defs>
  
  <!-- Equalizer Bars -->
  <g>
    ${barsPath}
  </g>
</svg>`;
};

// Create splash screens for different resolutions
const splashes = [
  { name: 'splash-2732x2732', width: 2732, height: 2732, logoSize: 280 }, // iPad Pro 12.9"
  { name: 'splash-2048x2732', width: 2048, height: 2732, logoSize: 260 }, // iPad Pro 12.9" Portrait
  { name: 'splash-1668x2388', width: 1668, height: 2388, logoSize: 240 }, // iPad Pro 11" Portrait
  { name: 'splash-1536x2048', width: 1536, height: 2048, logoSize: 220 }, // iPad Portrait
  { name: 'splash-1284x2778', width: 1284, height: 2778, logoSize: 200 }, // iPhone 12/13 Pro Max
  { name: 'splash-1170x2532', width: 1170, height: 2532, logoSize: 180 }, // iPhone 12/13 Pro
  { name: 'splash-1125x2436', width: 1125, height: 2436, logoSize: 180 }, // iPhone X/11 Pro
  { name: 'splash-1242x2688', width: 1242, height: 2688, logoSize: 200 }, // iPhone 11 Pro Max
  { name: 'splash-828x1792', width: 828, height: 1792, logoSize: 160 },   // iPhone 11/XR
  { name: 'splash-750x1334', width: 750, height: 1334, logoSize: 140 },   // iPhone 8
  { name: 'Splash', width: 1366, height: 1366, logoSize: 200 },            // Universal square
];

// Create output directory
const outputDir = path.join(__dirname, 'splash-assets');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate SVG files
splashes.forEach(splash => {
  const svg = createSplashSVG(splash.width, splash.height, splash.logoSize);
  const outputPath = path.join(outputDir, `${splash.name}.svg`);
  fs.writeFileSync(outputPath, svg);
  console.log(`Created: ${splash.name}.svg (${splash.width}x${splash.height})`);
});

console.log('\n✓ Splash SVG files created in:', outputDir);
console.log('\nNow convert to PNG using: sips -s format png <file.svg> --out <file.png>');
console.log('Or copy the universal Splash.svg to the iOS assets folder');
