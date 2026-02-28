const sharp = require('sharp');

const iconPath = '/Users/gboccia/Desktop/BandOps Mobile App/dist/icons/icon-512x512.png';
const outputDir = '/Users/gboccia/Desktop/BandWith - Reharsal-semiOK-V9';

async function createSplash(size, outputPath) {
  const iconSize = Math.round(size * 0.18);
  
  // Light gray background matching the app (#E6E5E1)
  const background = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 230, g: 229, b: 225, alpha: 1 } // #E6E5E1
    }
  });

  const resizedIcon = await sharp(iconPath)
    .resize(iconSize, iconSize)
    .toBuffer();

  const left = Math.round((size - iconSize) / 2);
  const top = Math.round((size - iconSize) / 2);

  await background
    .composite([{
      input: resizedIcon,
      left: left,
      top: top
    }])
    .png()
    .toFile(outputPath);

  console.log(`Created: ${outputPath}`);
}

async function main() {
  try {
    // iOS splash screens
    await createSplash(2732, `${outputDir}/ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png`);
    await createSplash(2732, `${outputDir}/ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png`);
    await createSplash(2732, `${outputDir}/ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png`);
    
    // Android splash screens
    await createSplash(2732, `${outputDir}/android/app/src/main/res/drawable/splash.png`);
    await createSplash(1920, `${outputDir}/android/app/src/main/res/drawable-land-hdpi/splash.png`);
    await createSplash(1920, `${outputDir}/android/app/src/main/res/drawable-land-mdpi/splash.png`);
    await createSplash(1920, `${outputDir}/android/app/src/main/res/drawable-land-xhdpi/splash.png`);
    await createSplash(2560, `${outputDir}/android/app/src/main/res/drawable-land-xxhdpi/splash.png`);
    await createSplash(2560, `${outputDir}/android/app/src/main/res/drawable-land-xxxhdpi/splash.png`);
    await createSplash(1280, `${outputDir}/android/app/src/main/res/drawable-port-hdpi/splash.png`);
    await createSplash(960, `${outputDir}/android/app/src/main/res/drawable-port-mdpi/splash.png`);
    await createSplash(1920, `${outputDir}/android/app/src/main/res/drawable-port-xhdpi/splash.png`);
    await createSplash(2560, `${outputDir}/android/app/src/main/res/drawable-port-xxhdpi/splash.png`);
    await createSplash(2560, `${outputDir}/android/app/src/main/res/drawable-port-xxxhdpi/splash.png`);
    
    console.log('\n✅ Light splash screens created!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
