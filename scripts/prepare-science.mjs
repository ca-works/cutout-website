// Builds the images and data used by "The Science Behind CutOut" (src/pages/science.astro).
//
// Every matte is CutOut's own engine output (design/sources/science/README.md). Nothing here
// edits a matte: images are resized, cropped, recoloured for display (a greyscale matte, a
// violet "what refinement changed" overlay) or combined with their photo as "RGB × matte".
//
// Outputs (git-ignored, rebuilt by `npm run assets` and in CI): src/assets/generated/science/
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

const SRC = 'design/sources';
const SCI = `${SRC}/science`;
const OUT = 'src/assets/generated/science';
await mkdir(OUT, { recursive: true });

const raw = (buf, w, h, channels) => sharp(buf, { raw: { width: w, height: h, channels } });
const grey = async (path, w, h) => {
  let s = sharp(path).extractChannel(0);
  if (w) s = sharp(await s.toBuffer()).resize(w, h, { fit: 'fill', kernel: 'lanczos3' }).extractChannel(0);
  const { data, info } = await s.raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 1) throw new Error(`${path}: expected one channel`);
  return { data, w: info.width, h: info.height };
};
const rgbOf = async (path, w, h) => {
  let s = sharp(path).rotate().removeAlpha();
  if (w) s = s.resize(w, h, { fit: 'fill', kernel: 'lanczos3' });
  const { data, info } = await s.raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
};
const withAlpha = (rgb, a, n) => {
  const out = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    out[i * 4] = rgb[i * 3];
    out[i * 4 + 1] = rgb[i * 3 + 1];
    out[i * 4 + 2] = rgb[i * 3 + 2];
    out[i * 4 + 3] = a[i];
  }
  return out;
};
const data = {};

// ---------------------------------------------------------------------------- 1. the opening
// The golden retriever: photo → network input → raw prediction → refined matte → cutout.
{
  const meta = await sharp(`${SRC}/golden.jpg`).metadata();
  data.open = { w: meta.width, h: meta.height, widths: [800, 1400] };
  for (const W of data.open.widths) {
    const H = Math.round((W * meta.height) / meta.width);
    const { data: rgb } = await rgbOf(`${SRC}/golden.jpg`, W, H);
    const refined = await grey(`${SRC}/golden-matte.png`, W, H);
    const rawM = await grey(`${SCI}/golden-raw-matte.png`, W, H);
    await raw(rgb, W, H, 3).webp({ quality: 84, effort: 6 }).toFile(`${OUT}/open-photo-${W}.webp`);
    await raw(rawM.data, W, H, 1).webp({ quality: 90, effort: 6 }).toFile(`${OUT}/open-raw-${W}.webp`);
    await raw(refined.data, W, H, 1).webp({ quality: 90, effort: 6 }).toFile(`${OUT}/open-matte-${W}.webp`);
    await raw(withAlpha(rgb, refined.data, W * H), W, H, 4).webp({ quality: 86, alphaQuality: 100, effort: 6 }).toFile(`${OUT}/open-cutout-${W}.webp`);
  }
  // What refinement changed, measured at full resolution, then shown as violet at display size.
  const full = await grey(`${SRC}/golden-matte.png`);
  const fullRaw = await grey(`${SCI}/golden-raw-matte.png`);
  const n = full.w * full.h;
  let changed = 0, exact = 0;
  const band = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const d = Math.abs(full.data[i] - fullRaw.data[i]);
    if (d) changed++;
    if (full.data[i] === 0 || full.data[i] === 255) exact++;
    band[i * 4] = 0xa8;
    band[i * 4 + 1] = 0x9d;
    band[i * 4 + 2] = 0xff;
    band[i * 4 + 3] = d ? Math.min(255, 70 + d * 4) : 0;
  }
  data.open.changedPct = +((100 * changed) / n).toFixed(2);
  data.open.exactPct = +((100 * exact) / n).toFixed(2);
  for (const W of data.open.widths) {
    const H = Math.round((W * full.h) / full.w);
    await raw(band, full.w, full.h, 4).resize(W, H, { kernel: 'lanczos3' }).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(`${OUT}/open-band-${W}.webp`);
  }
  // The network's view: resampled to 1024 × 1024 without keeping the aspect ratio (as CutOut
  // does, with a triangle filter; sharp's "linear" kernel is the same tent function).
  const { data: input } = await sharp(`${SRC}/golden.jpg`).rotate().removeAlpha().resize(1024, 1024, { fit: 'fill', kernel: 'linear' }).raw().toBuffer({ resolveWithObject: true });
  await raw(input, 1024, 1024, 3).webp({ quality: 86, effort: 6 }).toFile(`${OUT}/open-input.webp`);
  for (const [c, name] of [[0, 'r'], [1, 'g'], [2, 'b']]) {
    const plane = Buffer.alloc(1024 * 1024);
    for (let i = 0; i < plane.length; i++) plane[i] = input[i * 3 + c];
    await raw(plane, 1024, 1024, 1).resize(320, 320, { kernel: 'lanczos3' }).webp({ quality: 85 }).toFile(`${OUT}/plane-${name}.webp`);
  }
}

// ---------------------------------------------------------------------------- 2. pixels
// An exact, lossless crop of the photo (eye and nose), so every value the visitor reads is a
// real pixel of the decoded JPEG.
{
  const crop = { left: 640, top: 470, width: 256, height: 192 };
  await sharp(`${SRC}/golden.jpg`).rotate().extract(crop).removeAlpha().png({ compressionLevel: 9 }).toFile(`${OUT}/pixels.png`);
  data.pixels = crop;
}

// ---------------------------------------------------------------------------- 3. alpha lab, brush
{
  const W = 720;
  const meta = await sharp(`${SRC}/golden.jpg`).metadata();
  const H = Math.round((W * meta.height) / meta.width);
  const { data: rgb } = await rgbOf(`${SRC}/golden.jpg`, W, H);
  const m = await grey(`${SRC}/golden-matte.png`, W, H);
  await raw(rgb, W, H, 3).webp({ quality: 90, effort: 6 }).toFile(`${OUT}/lab-rgb.webp`);
  await raw(m.data, W, H, 1).png({ compressionLevel: 9 }).toFile(`${OUT}/lab-matte.png`);
  // Default probe: the soft pixel nearest to 50 % on the top of the head.
  let best = null;
  for (let y = 40; y < H * 0.45; y++)
    for (let x = Math.round(W * 0.2); x < W * 0.45; x++) {
      const a = m.data[y * W + x];
      const score = Math.abs(a - 128);
      if (!best || score < best.score) best = { x, y, score };
    }
  data.lab = { w: W, h: H, probe: { x: best.x, y: best.y } };
  // A real 1-D slice of the matte across the top of the head (refine-edges demonstration).
  const full = await grey(`${SRC}/golden-matte.png`);
  const fullRaw = await grey(`${SCI}/golden-raw-matte.png`);
  const col = 820;
  const y0 = 160, y1 = 340;
  const slice = (g) => Array.from({ length: y1 - y0 }, (_, i) => g.data[(y0 + i) * g.w + col]);
  data.profile = { col, y0, y1, refined: slice(full), raw: slice(fullRaw) };
}

// ---------------------------------------------------------------------------- 4. edge lab
// For each sample a 360 × 360 window, cut from the full-resolution photo and mattes (mattes
// lossless). Without a fixed `at`, the window with the most soft (0 < α < 1) pixels is chosen by
// measurement. Fixed windows: the top of the puppy's head and ear (the measured choice was a paw),
// the disc's rim with the background around it, and the glass's rim.
const samples = [
  { id: 'fur', photo: `${SRC}/golden.jpg`, matte: `${SRC}/golden-matte.png`, rawMatte: `${SCI}/golden-raw-matte.png`, at: [520, 190] },
  { id: 'seeds', photo: `${SRC}/dandelion.jpg`, matte: `${SRC}/dandelion-matte.png`, rawMatte: `${SCI}/dandelion-raw-matte.png` },
  { id: 'strands', photo: `${SCI}/strands.png`, matte: `${SCI}/strands-matte.png`, rawMatte: `${SCI}/strands-raw-matte.png`, gt: `${SCI}/strands-gt.png` },
  { id: 'glass', photo: `${SCI}/glass.jpg`, matte: `${SCI}/glass-matte.png`, rawMatte: `${SCI}/glass-raw-matte.png`, at: [180, 40] },
  { id: 'disc', photo: `${SCI}/disc.png`, matte: `${SCI}/disc-matte.png`, gt: `${SCI}/disc-gt.png`, at: [160, 420] },
];
data.edges = {};
const S = 360;
for (const s of samples) {
  const m = await grey(s.matte);
  // GT scenes: choose by the ground truth's soft pixels (what the model should reproduce).
  const pick = s.gt ? await grey(s.gt) : m;
  let best = s.at ? { score: 0, x: s.at[0], y: s.at[1] } : { score: -1, x: 0, y: 0 };
  for (let y = 0; !s.at && y + S <= pick.h; y += 20)
    for (let x = 0; x + S <= pick.w; x += 20) {
      let score = 0;
      for (let yy = y; yy < y + S; yy += 4)
        for (let xx = x; xx < x + S; xx += 4) {
          const a = pick.data[yy * pick.w + xx];
          if (a > 8 && a < 247) score++;
        }
      if (score > best.score) best = { score, x, y };
    }
  const rect = { left: best.x, top: best.y, width: S, height: S };
  await sharp(s.photo).rotate().extract(rect).removeAlpha().webp({ quality: 92, effort: 6 }).toFile(`${OUT}/edge-${s.id}-rgb.webp`);
  const out = { rect, size: [m.w, m.h], files: ['rgb', 'matte'] };
  for (const [key, path] of [['matte', s.matte], ['raw', s.rawMatte], ['gt', s.gt]]) {
    if (!path) continue;
    await sharp(path).extractChannel(0).extract(rect).toColourspace('b-w').png({ compressionLevel: 9 }).toFile(`${OUT}/edge-${s.id}-${key}.png`);
    if (key !== 'matte') out.files.push(key);
  }
  data.edges[s.id] = out;
}

// ---------------------------------------------------------------------------- 5. magic wand
{
  await sharp(`${SRC}/mug.jpg`).rotate().resize(420, 420, { kernel: 'lanczos3' }).removeAlpha().webp({ quality: 92, effort: 6 }).toFile(`${OUT}/wand-mug.webp`);
  data.wand = { w: 420, h: 420 };
}

await writeFile(`${OUT}/science.json`, JSON.stringify(data, null, 1));
console.log(`science: refine changed ${data.open.changedPct} % of pixels; ${data.open.exactPct} % exactly 0 or 255`);
for (const [id, e] of Object.entries(data.edges)) console.log(`science edge ${id}: crop ${JSON.stringify(e.rect)}`);
