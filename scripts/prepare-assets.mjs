// Builds every demonstration image the site uses from design/sources/.
//
// Each sample is an original photograph plus the alpha matte that CutOut's own engine produced
// for it (`cutout-cli remove birefnet-general-fp32.onnx <photo> <out.png> cpu`, default refinement,
// see design/sources/README.md). The cutout shown on the site is always "original RGB × that
// matte" — nothing is retouched, so the website never shows a better edge than the app makes.
//
// Outputs (committed, regenerate with `npm run assets`):
//   src/assets/generated/samples/<id>.jpg           original, long side ≤ 2000 px, metadata stripped
//   src/assets/generated/samples/<id>-cutout.png    original × matte, same size (Astro makes AVIF/WebP)
//   src/assets/generated/hero/photo-<w>.webp        hero sheet texture and poster (square)
//   src/assets/generated/hero/subject-<w>.webp      hero subject texture (RGBA)
//   src/assets/generated/hero/contour.json          the subject outline the cut line follows
//   public/og.png and the favicons are made by scripts/make-icons.mjs and scripts/make-og.mjs.
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

const SRC = 'design/sources';
const SAMPLES = ['cat', 'mug', 'dandelion'];

await mkdir('src/assets/generated/samples', { recursive: true });
await mkdir('src/assets/generated/hero', { recursive: true });

async function loadPair(id, maxSide) {
  const meta = await sharp(`${SRC}/${id}.jpg`).metadata();
  const scale = Math.min(1, maxSide / Math.max(meta.width, meta.height));
  const w = Math.round(meta.width * scale);
  const h = Math.round(meta.height * scale);
  const rgb = await sharp(`${SRC}/${id}.jpg`)
    .rotate()
    .resize(w, h, { kernel: 'lanczos3' })
    .removeAlpha()
    .raw()
    .toBuffer();
  const matte = await sharp(`${SRC}/${id}-matte.png`)
    .resize(w, h, { kernel: 'lanczos3' })
    .extractChannel(0)
    .raw()
    .toBuffer();
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0, j = 0; i < w * h; i++, j += 3) {
    rgba[i * 4] = rgb[j];
    rgba[i * 4 + 1] = rgb[j + 1];
    rgba[i * 4 + 2] = rgb[j + 2];
    rgba[i * 4 + 3] = matte[i];
  }
  return { w, h, rgb, rgba, matte };
}

// ---------------------------------------------------------------------------- samples
for (const id of SAMPLES) {
  const { w, h, rgb, rgba } = await loadPair(id, 2000);
  await sharp(rgb, { raw: { width: w, height: h, channels: 3 } })
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(`src/assets/generated/samples/${id}.jpg`);
  await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(`src/assets/generated/samples/${id}-cutout.png`);
  if (id === 'cat') {
    // The engine's mask itself, for the "nothing is erased" explanation.
    const { matte } = await loadPair(id, 1200);
    const side = Math.round(Math.sqrt(matte.length));
    await sharp(matte, { raw: { width: side, height: side, channels: 1 } })
      .png({ compressionLevel: 9 })
      .toFile('src/assets/generated/samples/cat-matte.png');
  }
  console.log(`sample ${id}: ${w}×${h}`);
}

// ---------------------------------------------------------------------------- hero
for (const size of [1536, 1024]) {
  const { w, h, rgb, rgba } = await loadPair('cat', size);
  await sharp(rgb, { raw: { width: w, height: h, channels: 3 } })
    .webp({ quality: 82, effort: 6 })
    .toFile(`src/assets/generated/hero/photo-${size}.webp`);
  await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .webp({ quality: 84, alphaQuality: 100, effort: 6, exact: false })
    .toFile(`src/assets/generated/hero/subject-${size}.webp`);
  // AVIF for browsers that support it (smaller; same pixels within codec tolerance).
  await sharp(rgb, { raw: { width: w, height: h, channels: 3 } })
    .avif({ quality: 58, effort: 6, chromaSubsampling: '4:4:4' })
    .toFile(`src/assets/generated/hero/photo-${size}.avif`);
  await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .avif({ quality: 62, effort: 6, chromaSubsampling: '4:4:4' })
    .toFile(`src/assets/generated/hero/subject-${size}.avif`);
  console.log(`hero ${size}: ${w}×${h}`);
}

// ---------------------------------------------------------------------------- contour
// Marching squares on a lightly blurred matte (so fur does not make the line jitter), then the
// longest closed loop, minus the parts that run along the photo's own border (the cat's body is
// cropped by the frame there: nothing is cut along it), simplified and resampled evenly.
{
  const N = 1024;
  const field = await sharp(`${SRC}/cat-matte.png`)
    .resize(N, N, { kernel: 'lanczos3' })
    .blur(4.5)
    .extractChannel(0)
    .raw()
    .toBuffer();
  const W = N + 2;
  const v = new Float32Array(W * W); // padded with 0 so every loop closes
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) v[(y + 1) * W + x + 1] = field[y * N + x] / 255;
  const T = 0.5;
  const segs = [];
  const lerp = (a, b) => (T - a) / (b - a);
  for (let y = 0; y < W - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const a = v[y * W + x], b = v[y * W + x + 1], c = v[(y + 1) * W + x + 1], d = v[(y + 1) * W + x];
      const idx = (a >= T ? 8 : 0) | (b >= T ? 4 : 0) | (c >= T ? 2 : 0) | (d >= T ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const top = [x + lerp(a, b), y], right = [x + 1, y + lerp(b, c)];
      const bottom = [x + lerp(d, c), y + 1], left = [x, y + lerp(a, d)];
      const table = {
        1: [[left, bottom]], 2: [[bottom, right]], 3: [[left, right]], 4: [[top, right]],
        5: [[left, top], [bottom, right]], 6: [[top, bottom]], 7: [[left, top]], 8: [[left, top]],
        9: [[top, bottom]], 10: [[left, bottom], [top, right]], 11: [[top, right]], 12: [[left, right]],
        13: [[bottom, right]], 14: [[left, bottom]],
      };
      for (const s of table[idx]) segs.push(s);
    }
  }
  const key = (p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
  const adj = new Map();
  segs.forEach((s, i) => {
    for (const p of s) {
      const k = key(p);
      if (!adj.has(k)) adj.set(k, []);
      adj.get(k).push(i);
    }
  });
  const used = new Uint8Array(segs.length);
  const loops = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const loop = [segs[i][0], segs[i][1]];
    for (;;) {
      const end = loop[loop.length - 1];
      const next = (adj.get(key(end)) || []).find((j) => !used[j]);
      if (next === undefined) break;
      used[next] = 1;
      const s = segs[next];
      loop.push(key(s[0]) === key(end) ? s[1] : s[0]);
    }
    loops.push(loop);
  }
  loops.sort((p, q) => q.length - p.length);
  // Back to image space (remove the padding offset), then drop border-hugging points.
  const loop = loops[0].map(([x, y]) => [x - 1, y - 1]);
  const onBorder = ([x, y]) => x < 2.5 || y < 2.5 || x > N - 3.5 || y > N - 3.5;
  // Rotate so the loop starts on the border; then collect the longest interior run.
  let start = loop.findIndex(onBorder);
  if (start < 0) start = 0;
  const ring = loop.slice(start).concat(loop.slice(0, start));
  let best = [], cur = [];
  for (const p of ring) {
    if (onBorder(p)) {
      if (cur.length > best.length) best = cur;
      cur = [];
    } else cur.push(p);
  }
  if (cur.length > best.length) best = cur;
  // Ramer–Douglas–Peucker.
  const rdp = (pts, eps) => {
    if (pts.length < 3) return pts;
    const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    let max = 0, at = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > max) { max = d; at = i; }
    }
    if (max <= eps) return [pts[0], pts[pts.length - 1]];
    return rdp(pts.slice(0, at + 1), eps).slice(0, -1).concat(rdp(pts.slice(at), eps));
  };
  let pts = rdp(best, 0.7);
  // Remove spurs: short excursions that leave the outline and come straight back (whiskers).
  for (let changed = true; changed; ) {
    changed = false;
    outer: for (let i = 0; i < pts.length - 2; i++) {
      let arc = 0;
      for (let j = i + 1; j < Math.min(pts.length, i + 80); j++) {
        arc += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]);
        const gap = Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]);
        if (j > i + 1 && gap < 24 && arc > 3 * gap + 24) {
          pts.splice(i + 1, j - i - 1);
          changed = true;
          break outer;
        }
      }
    }
  }
  // Chaikin smoothing (2 passes) keeps the line calm without leaving the edge.
  for (let k = 0; k < 2; k++) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      out.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1], [0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1]);
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  // Even resampling every 3 px so dashes have a constant rhythm.
  const step = 3;
  const even = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    let [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    let seg = Math.hypot(x1 - x0, y1 - y0);
    while (carry + seg >= step) {
      const t = (step - carry) / seg;
      x0 += (x1 - x0) * t;
      y0 += (y1 - y0) * t;
      even.push([x0, y0]);
      seg = Math.hypot(x1 - x0, y1 - y0);
      carry = 0;
    }
    carry += seg;
  }
  const round = (n) => Math.round((n / N) * 1e4) / 1e4;
  const points = even.flatMap(([x, y]) => [round(x), round(y)]);
  await writeFile(
    'src/assets/generated/hero/contour.json',
    JSON.stringify({ source: 'cat-matte.png', size: N, step: step / N, points }) + '\n',
  );
  console.log(`contour: ${loops.length} loops, ${best.length} interior points → ${even.length} resampled`);
}
