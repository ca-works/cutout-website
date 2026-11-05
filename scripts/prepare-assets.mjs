// Builds every demonstration image the site uses from design/sources/.
//
// Each sample is an original photograph plus the alpha matte CutOut's own engine produced for it
// (`cutout-cli remove birefnet-general-fp32.onnx <photo> <out.png> cpu`, default refinement; see
// design/sources/README.md). A cutout on the site is always "original RGB × that matte" — never
// retouched — so the website cannot show a better edge than the app makes.
//
// Outputs (git-ignored, rebuilt by `npm run assets` and in CI):
//   src/assets/generated/samples/<id>.jpg, <id>-cutout.png   (Astro makes AVIF/WebP + srcset)
//   src/assets/generated/hero/photo-<w>.{avif,webp}           the hero print
//   src/assets/generated/hero/subject-<w>.{avif,webp}         the hero cutout
//   src/assets/generated/hero/shadow.webp                     its soft shadow
//   src/assets/generated/hero/hero.json                       size, outline path, alt text
//   src/assets/generated/hero/hero.css                        aspect ratio
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

const SRC = 'design/sources';
const OUT = 'src/assets/generated';
const SAMPLES = ['golden', 'bolt', 'crankset', 'dandelion', 'bolts', 'mug'];
// The hero subject: a simple, well-lit object with a clean silhouette and one real hole (the handle).
const HERO = { id: 'mug', alt: 'A white enamel mug with a black rim', widths: [960, 1400, 1800] };

await mkdir(`${OUT}/samples`, { recursive: true });
await mkdir(`${OUT}/hero`, { recursive: true });

async function loadPair(id, maxSide) {
  const meta = await sharp(`${SRC}/${id}.jpg`).metadata();
  const scale = Math.min(1, maxSide / Math.max(meta.width, meta.height));
  const w = Math.round(meta.width * scale);
  const h = Math.round(meta.height * scale);
  const rgb = await sharp(`${SRC}/${id}.jpg`).rotate().resize(w, h, { kernel: 'lanczos3' }).removeAlpha().raw().toBuffer();
  const matte = await sharp(`${SRC}/${id}-matte.png`).resize(w, h, { kernel: 'lanczos3' }).extractChannel(0).raw().toBuffer();
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0, j = 0; i < w * h; i++, j += 3) {
    rgba[i * 4] = rgb[j];
    rgba[i * 4 + 1] = rgb[j + 1];
    rgba[i * 4 + 2] = rgb[j + 2];
    rgba[i * 4 + 3] = matte[i];
  }
  return { w, h, rgb, rgba, matte };
}

const raw = (buf, w, h, channels) => sharp(buf, { raw: { width: w, height: h, channels } });

// ---------------------------------------------------------------------------- samples
for (const id of SAMPLES) {
  const { w, h, rgb, rgba } = await loadPair(id, 2000);
  await raw(rgb, w, h, 3).jpeg({ quality: 92, mozjpeg: true }).toFile(`${OUT}/samples/${id}.jpg`);
  await raw(rgba, w, h, 4).png({ compressionLevel: 9 }).toFile(`${OUT}/samples/${id}-cutout.png`);
  console.log(`sample ${id}: ${w}×${h}`);
}

// ---------------------------------------------------------------------------- hero
for (const size of HERO.widths) {
  const { w, h, rgb, rgba } = await loadPair(HERO.id, size);
  await raw(rgb, w, h, 3).webp({ quality: 84, effort: 6 }).toFile(`${OUT}/hero/photo-${size}.webp`);
  await raw(rgb, w, h, 3).avif({ quality: 60, effort: 6, chromaSubsampling: '4:4:4' }).toFile(`${OUT}/hero/photo-${size}.avif`);
  await raw(rgba, w, h, 4).webp({ quality: 86, alphaQuality: 100, effort: 6 }).toFile(`${OUT}/hero/subject-${size}.webp`);
  await raw(rgba, w, h, 4).avif({ quality: 64, effort: 6, chromaSubsampling: '4:4:4' }).toFile(`${OUT}/hero/subject-${size}.avif`);
  console.log(`hero ${size}: ${w}×${h}`);
}

// The cutout's soft shadow: the matte, blurred, as black with alpha.
{
  const { w, h, matte } = await loadPair(HERO.id, 1000);
  const { data: blurred, info } = await raw(matte, w, h, 1)
    .blur(Math.max(4, w * 0.018))
    .extractChannel(0)
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 1 || info.width !== w || info.height !== h) throw new Error('unexpected shadow buffer layout');
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) rgba[i * 4 + 3] = Math.round(blurred[i] * 0.72);
  await raw(rgba, w, h, 4).webp({ quality: 70, alphaQuality: 80 }).toFile(`${OUT}/hero/shadow.webp`);
}

// ---------------------------------------------------------------------------- outline
// Marching squares on a lightly blurred matte (fur would make the line jitter), the longest loop,
// border-hugging stretches removed, spurs removed, simplified and smoothed.
{
  const src = await sharp(`${SRC}/${HERO.id}.jpg`).metadata();
  const N = 1024;
  const NH = Math.round((N * src.height) / src.width);
  const field = await sharp(`${SRC}/${HERO.id}-matte.png`).resize(N, NH, { kernel: 'lanczos3' }).blur(4).extractChannel(0).raw().toBuffer();
  const W = N + 2, Hh = NH + 2;
  const v = new Float32Array(W * Hh);
  for (let y = 0; y < NH; y++) for (let x = 0; x < N; x++) v[(y + 1) * W + x + 1] = field[y * N + x] / 255;
  const T = 0.5;
  const segs = [];
  const lerp = (a, b) => (T - a) / (b - a);
  // Edges: 0 top, 1 right, 2 bottom, 3 left.
  const table = {
    1: [[3, 2]], 2: [[2, 1]], 3: [[3, 1]], 4: [[0, 1]], 5: [[3, 0], [2, 1]], 6: [[0, 2]], 7: [[3, 0]],
    8: [[3, 0]], 9: [[0, 2]], 10: [[3, 2], [0, 1]], 11: [[0, 1]], 12: [[3, 1]], 13: [[2, 1]], 14: [[3, 2]],
  };
  for (let y = 0; y < Hh - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const a = v[y * W + x], b = v[y * W + x + 1], c = v[(y + 1) * W + x + 1], d = v[(y + 1) * W + x];
      const idx = (a >= T ? 8 : 0) | (b >= T ? 4 : 0) | (c >= T ? 2 : 0) | (d >= T ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const e = [[x + lerp(a, b), y], [x + 1, y + lerp(b, c)], [x + lerp(d, c), y + 1], [x, y + lerp(a, d)]];
      for (const [p, q] of table[idx]) segs.push([e[p], e[q]]);
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
  const loop = loops[0].map(([x, y]) => [x - 1, y - 1]);
  const onBorder = ([x, y]) => x < 2.5 || y < 2.5 || x > N - 3.5 || y > NH - 3.5;
  let start = loop.findIndex(onBorder);
  const closed = start < 0;
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
  const rdp = (pts, eps) => {
    if (pts.length < 3) return pts;
    const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    let max = 0, at = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const dd = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (dd > max) {
        max = dd;
        at = i;
      }
    }
    if (max <= eps) return [pts[0], pts[pts.length - 1]];
    return rdp(pts.slice(0, at + 1), eps).slice(0, -1).concat(rdp(pts.slice(at), eps));
  };
  // A closed loop starts and ends at the same point, which RDP cannot simplify as one piece:
  // split it at the point farthest from the start and simplify both halves.
  const simplify = (input, isClosed, despur = true) => {
    const rdpRing = (ring) => {
      let far = 0, fd = 0;
      ring.forEach(([x, y], i) => {
        const d = Math.hypot(x - ring[0][0], y - ring[0][1]);
        if (d > fd) (fd = d), (far = i);
      });
      return rdp(ring.slice(0, far + 1), 0.8).slice(0, -1).concat(rdp(ring.slice(far).concat([ring[0]]), 0.8));
    };
    // A closed loop starts and ends at the same point, which RDP cannot simplify in one piece.
    let out = isClosed ? rdpRing(input) : rdp(input, 0.8);
    // Spur removal strips whiskers from an outline; it must not run on small closed holes.
    for (let changed = despur; changed; ) {
      changed = false;
      outer: for (let i = 0; i < out.length - 2; i++) {
        let arc = 0;
        for (let j = i + 1; j < Math.min(out.length, i + 80); j++) {
          arc += Math.hypot(out[j][0] - out[j - 1][0], out[j][1] - out[j - 1][1]);
          const gap = Math.hypot(out[j][0] - out[i][0], out[j][1] - out[i][1]);
          // Only short detours are whiskers; a long one (a mug's handle) is real shape.
          if (j > i + 1 && gap < 24 && arc > 3 * gap + 24 && arc < 160) {
            out.splice(i + 1, j - i - 1);
            changed = true;
            break outer;
          }
        }
      }
    }
    for (let k = 0; k < 2; k++) {
      const sm = [out[0]];
      for (let i = 0; i < out.length - 1; i++) {
        const [x0, y0] = out[i], [x1, y1] = out[i + 1];
        sm.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1], [0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1]);
      }
      sm.push(out[out.length - 1]);
      out = sm;
    }
    return out;
  };
  const pts = simplify(best, closed);
  // Holes (e.g. between a crankset's arms): every other loop that is not tiny, traced too.
  const holes = loops
    .slice(1)
    .filter((l) => l.length > loops[0].length * 0.05)
    .map((l) => simplify(l.map(([x, y]) => [x - 1, y - 1]), true, false));
  // Path in the source photo's pixel space (the SVG's viewBox).
  const k = src.width / N;
  const sub = (list, z) => 'M' + list.map(([x, y]) => `${(x * k).toFixed(1)} ${(y * k).toFixed(1)}`).join('L') + (z ? 'Z' : '');
  const path = [sub(pts, closed), ...holes.map((h) => sub(h, true))].join('');
  const ys = pts.map((p) => p[1] / NH), xs = pts.map((p) => p[0] / N);
  const bbox = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  await writeFile(`${OUT}/hero/hero.json`, JSON.stringify({ width: src.width, height: src.height, alt: HERO.alt, path, bbox }) + '\n');
  await writeFile(
    `${OUT}/hero/hero.css`,
    `/* generated by scripts/prepare-assets.mjs */\n.hero__stage { --ar: ${(src.width / src.height).toFixed(5)}; }\n`,
  );
  console.log(`outline: ${pts.length} points, ${closed ? 'closed' : 'open'}, ${holes.length} holes; bbox y ${bbox.y0.toFixed(2)}–${bbox.y1.toFixed(2)}`);
}
