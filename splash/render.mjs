// Renders the splash. Usage:
//   node render.mjs            → masters in out/, web versions in ../public/splash/
//   node render.mjs --stills   → review stills + contact sheet in out/stills/
//   node render.mjs --stills 0,45,90   (custom frames)
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'out');
const pub = path.join(here, '..', 'public', 'splash');
const args = process.argv.slice(2);
const stills = args.includes('--stills');
const only = args.find((a) => a.startsWith('--only='))?.slice(7);

const serveUrl = await bundle({ entryPoint: path.join(here, 'src', 'index.ts') });
const ids = only ? [only] : ['Splash', 'SplashCover'];
const kb = (f) => `${Math.round(statSync(f).size / 1024)} KB`;
const ffmpeg = (...a) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a]);

if (stills) {
  const custom = args.find((a) => /^[\d,]+$/.test(a));
  const frames = custom ? custom.split(',').map(Number) : [0, 8, 20, 40, 62, 84, 92, 104, 116, 128, 145, 170];
  for (const id of ids) {
    const comp = await selectComposition({ serveUrl, id });
    const dir = path.join(out, 'stills', id);
    mkdirSync(dir, { recursive: true });
    for (const frame of frames) {
      const output = path.join(dir, `f${String(frame).padStart(3, '0')}.png`);
      await renderStill({ composition: comp, serveUrl, frame, output, scale: 0.35 });
    }
    const sheet = path.join(out, 'stills', `${id}-sheet.png`);
    ffmpeg('-pattern_type', 'glob', '-i', path.join(dir, 'f*.png'), '-vf', `tile=${Math.min(6, frames.length)}x${Math.ceil(frames.length / 6)}:padding=8:color=0x333333`, sheet);
    console.log('sheet', sheet);
  }
  process.exit(0);
}

mkdirSync(out, { recursive: true });
mkdirSync(pub, { recursive: true });
for (const id of ids) {
  const comp = await selectComposition({ serveUrl, id });
  const base = id === 'Splash' ? 'bandwith-splash' : 'bandwith-splash-cover';
  const master = path.join(out, `${base}-master.mp4`);
  console.log(`rendering ${id} ${comp.width}×${comp.height} @${comp.fps}fps, ${comp.durationInFrames} frames`);
  await renderMedia({
    composition: comp,
    serveUrl,
    codec: 'h264',
    crf: 14,
    pixelFormat: 'yuv420p',
    outputLocation: master,
    onProgress: ({ progress }) => process.stdout.write(`\r  ${Math.round(progress * 100)}%`),
  });
  console.log(`\n  master ${kb(master)}`);

  // Web versions for the in-app overlay: H.264 (iOS/WKWebView) + VP9 WebM (Android/Chrome).
  const mp4 = path.join(pub, `${base}.mp4`);
  ffmpeg('-i', master, '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'veryslow', '-crf', '24', '-tune', 'animation',
    // Level 5.2 is the ceiling iPhone hardware decoders guarantee; x264 picks 6.0 on its own here.
    '-level:v', '5.2',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4);
  const webm = path.join(out, `${base}.webm`); // deliverable only, not shipped in the app
  ffmpeg('-i', master, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '38', '-row-mt', '1', '-deadline', 'good', '-an', webm);
  // Poster = frame 0 (the pictogram, matching the native launch screen) and the lockup hold.
  const lock = path.join(out, `${base}-lockup.png`);
  await renderStill({ composition: comp, serveUrl, frame: 150, output: lock });
  const first = path.join(out, `${base}-f0.png`);
  await renderStill({ composition: comp, serveUrl, frame: 0, output: first });
  // Reduced-motion fallback shown by the in-app overlay: the lockup frame, as WebP.
  const still = path.join(pub, `${base}-lockup.webp`);
  // sharp comes from the app's devDependencies (ffmpeg here has no libwebp).
  const sharp = createRequire(path.join(here, '..', 'package.json'))('sharp');
  await sharp(lock).webp({ quality: 82, effort: 6 }).toFile(still);
  console.log(`  ${path.basename(mp4)} ${kb(mp4)} · ${path.basename(webm)} ${kb(webm)} · ${path.basename(still)} ${kb(still)}`);
}
