// Numerical core of the interactive demonstrations on the Science page.
//
// Each function is a line-for-line port of the CutOut 0.1 engine routine named in its comment, so
// that what a visitor sees in the browser is what the app computes. The functions are pure and are
// tested numerically in tests/unit/science.test.mjs (Node runs this file directly: plain
// TypeScript, no enums or other syntax that needs compiling).

// ------------------------------------------------------------------ compositing

/** Exact rounding of a·b/255 for 0 ≤ a, b ≤ 255 (engine: image::mul255). */
export function mul255(a: number, b: number): number {
  const t = a * b + 128;
  return (t + (t >> 8)) >> 8;
}

/** C = αF + (1 − α)B for one channel, α in 0..1, colours in 0..255 (straight alpha). */
export const over = (f: number, b: number, a: number) => a * f + (1 - a) * b;

/** Straight → premultiplied for an 8-bit pixel (engine: image::premultiply). */
export function premultiply(r: number, g: number, b: number, a: number): [number, number, number, number] {
  if (a === 255) return [r, g, b, a];
  return [mul255(r, a), mul255(g, a), mul255(b, a), a];
}

/** Premultiplied → straight for an 8-bit pixel (engine: image::unpremultiply). */
export function unpremultiply(r: number, g: number, b: number, a: number): [number, number, number, number] {
  if (a === 255) return [r, g, b, a];
  if (a === 0) return [0, 0, 0, 0];
  const u = (v: number) => Math.min(255, Math.floor((v * 255 + (a >> 1)) / a));
  return [u(r), u(g), u(b), a];
}

/**
 * Porter–Duff source-over of an 8-bit straight source pixel with layer opacity onto a
 * premultiplied destination, exactly as the engine's integer path does (composite.rs).
 * Returns the new premultiplied destination.
 */
export function sourceOver(src: [number, number, number, number], mask: number, opacity: number, dst: [number, number, number, number]) {
  let a = mul255(src[3], mask);
  a = mul255(a, Math.round(opacity * 255));
  if (a === 0) return dst.slice() as typeof dst;
  const s = [mul255(src[0], a), mul255(src[1], a), mul255(src[2], a)];
  if (a === 255) return [s[0], s[1], s[2], 255] as typeof dst;
  const ia = 255 - a;
  return [s[0] + mul255(dst[0], ia), s[1] + mul255(dst[1], ia), s[2] + mul255(dst[2], ia), a + mul255(dst[3], ia)] as typeof dst;
}

// ------------------------------------------------------------------ colour (engine: color.rs)

const SRGB = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export interface Lab {
  l: number;
  a: number;
  b: number;
}

const labF = (t: number) => {
  const d = 6 / 29;
  return t > d * d * d ? Math.cbrt(t) : t / (3 * d * d) + 4 / 29;
};

/** sRGB (D65) → CIELAB. */
export function rgbToLab(r: number, g: number, b: number): Lab {
  const R = SRGB[r], G = SRGB[g], B = SRGB[b];
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  const y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B;
  const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
  const fx = labF(x), fy = labF(y), fz = labF(z);
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

const rad = (d: number) => (d * Math.PI) / 180;

/** CIEDE2000 ΔE₀₀ (Sharma, Wu & Dalal 2005), as in the engine. */
export function deltaE2000(p: Lab, q: Lab): number {
  const c1 = Math.hypot(p.a, p.b), c2 = Math.hypot(q.a, q.b);
  const cbar7 = ((c1 + c2) / 2) ** 7;
  const g = 0.5 * (1 - Math.sqrt(cbar7 / (cbar7 + 25 ** 7)));
  const a1p = (1 + g) * p.a, a2p = (1 + g) * q.a;
  const c1p = Math.hypot(a1p, p.b), c2p = Math.hypot(a2p, q.b);
  const hp = (b: number, a: number) => {
    if (a === 0 && b === 0) return 0;
    const h = (Math.atan2(b, a) * 180) / Math.PI;
    return h < 0 ? h + 360 : h;
  };
  const h1p = hp(p.b, a1p), h2p = hp(q.b, a2p);
  const dlp = q.l - p.l, dcp = c2p - c1p;
  let dhp = 0;
  if (c1p * c2p !== 0) {
    const d = h2p - h1p;
    dhp = Math.abs(d) <= 180 ? d : d > 180 ? d - 360 : d + 360;
  }
  const dH = 2 * Math.sqrt(c1p * c2p) * Math.sin(rad(dhp) / 2);
  const lbarp = (p.l + q.l) / 2, cbarp = (c1p + c2p) / 2;
  let hbarp: number;
  if (c1p * c2p === 0) hbarp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbarp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hbarp = (h1p + h2p + 360) / 2;
  else hbarp = (h1p + h2p - 360) / 2;
  const t = 1 - 0.17 * Math.cos(rad(hbarp - 30)) + 0.24 * Math.cos(rad(2 * hbarp)) + 0.32 * Math.cos(rad(3 * hbarp + 6)) - 0.2 * Math.cos(rad(4 * hbarp - 63));
  const dtheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const cbarp7 = cbarp ** 7;
  const rc = 2 * Math.sqrt(cbarp7 / (cbarp7 + 25 ** 7));
  const lb50 = (lbarp - 50) ** 2;
  const sl = 1 + (0.015 * lb50) / Math.sqrt(20 + lb50);
  const sc = 1 + 0.045 * cbarp;
  const sh = 1 + 0.015 * cbarp * t;
  const rt = -Math.sin(rad(2 * dtheta)) * rc;
  const v = (dlp / sl) ** 2 + (dcp / sc) ** 2 + (dH / sh) ** 2 + rt * (dcp / sc) * (dH / sh);
  return Math.sqrt(Math.max(0, v));
}

/** Magic Wand coverage for one ΔE: full inside the tolerance, a linear ramp over `soft` (selection.rs). */
export function wandCoverage(d: number, tol: number, soft: number): number {
  const s = Math.max(0.01, soft);
  if (d <= tol) return 255;
  if (d < tol + s) return Math.round(255 * (1 - (d - tol) / s));
  return 0;
}

/**
 * Perceptual distance map from the seed pixel (ΔE₀₀ × 4, rounded, as the engine stores it). The
 * engine computes this once per click and caches it, so changing the tolerance is cheap.
 */
export function wandDistance(rgba: Uint8ClampedArray, w: number, h: number, sx: number, sy: number): Uint16Array {
  const n = w * h;
  const si = sy * w + sx;
  const key = rgbToLab(rgba[si * 4], rgba[si * 4 + 1], rgba[si * 4 + 2]);
  const dist = new Uint16Array(n);
  for (let i = 0; i < n; i++) dist[i] = Math.min(65535, Math.round(deltaE2000(key, rgbToLab(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2])) * 4));
  return dist;
}

/**
 * Magic Wand coverage from a distance map: a global threshold, or a 4-connected flood fill from the
 * seed in which ramp (edge) pixels are included but do not spread (selection.rs threshold_region).
 */
export function wandThreshold(dist: Uint16Array, w: number, h: number, sx: number, sy: number, tol: number, soft: number, contiguous: boolean): Uint8Array {
  const n = w * h;
  const si = sy * w + sx;
  const t4 = tol * 4, s4 = Math.max(0.01, soft) * 4;
  const cov = (d: number) => (d <= t4 ? 255 : d < t4 + s4 ? Math.round(255 * (1 - (d - t4) / s4)) : 0);
  const out = new Uint8Array(n);
  if (!contiguous) {
    for (let i = 0; i < n; i++) out[i] = cov(dist[i]);
    return out;
  }
  const seen = new Uint8Array(n);
  const q = new Int32Array(n);
  let head = 0, tail = 0;
  seen[si] = 1;
  q[tail++] = si;
  while (head < tail) {
    const i = q[head++];
    const c = cov(dist[i]);
    out[i] = c;
    if (c < 255 && i !== si) continue;
    const x = i % w, y = (i / w) | 0;
    const push = (j: number) => {
      if (!seen[j]) {
        seen[j] = 1;
        if (dist[j] <= t4 + s4) q[tail++] = j;
      }
    };
    if (x > 0) push(i - 1);
    if (x + 1 < w) push(i + 1);
    if (y > 0) push(i - w);
    if (y + 1 < h) push(i + w);
  }
  return out;
}

export function wandSelect(rgba: Uint8ClampedArray, w: number, h: number, sx: number, sy: number, tol: number, soft: number, contiguous: boolean): Uint8Array {
  return wandThreshold(wandDistance(rgba, w, h, sx, sy), w, h, sx, sy, tol, soft, contiguous);
}

// ------------------------------------------------------------------ brushes (engine: brush.rs)

/** Footprint of one brush dab at distance d from its centre: radius r, hardness 0..1. */
export function dabFalloff(d: number, r: number, hardness: number): number {
  const hard = Math.min(1, Math.max(0, hardness));
  const inner = r * hard;
  if (d <= inner) return 1;
  if (d >= r + 0.5) return 0;
  if (hard >= 0.999) return Math.min(1, Math.max(0, r + 0.5 - d));
  const t = Math.min(1, Math.max(0, (d - inner) / (r + 0.5 - inner)));
  return 1 - t * t * (3 - 2 * t);
}

/** Eraser: m' = m − m·c.  Restore: m' = m + (255 − m)·c.  (8-bit, exact rounding.) */
export const erase = (m: number, c: number) => m - mul255(m, c);
export const restore = (m: number, c: number) => m + mul255(255 - m, c);

// ------------------------------------------------------------------ transforms (engine: geometry.rs)

/** 2×3 affine [a b c d e f]: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Affine = [number, number, number, number, number, number];

const mul = (p: Affine, o: Affine): Affine => [
  p[0] * o[0] + p[2] * o[1],
  p[1] * o[0] + p[3] * o[1],
  p[0] * o[2] + p[2] * o[3],
  p[1] * o[2] + p[3] * o[3],
  p[0] * o[4] + p[2] * o[5] + p[4],
  p[1] * o[4] + p[3] * o[5] + p[5],
];

/** Layer → canvas matrix: M = T(x, y) · R(θ) · S(sx, sy) · T(−w/2, −h/2). */
export function layerMatrix(x: number, y: number, sx: number, sy: number, theta: number, w: number, h: number): Affine {
  const c = Math.cos(theta), s = Math.sin(theta);
  const center: Affine = [1, 0, 0, 1, -w / 2, -h / 2];
  const scale: Affine = [sx, 0, 0, sy, 0, 0];
  const rot: Affine = [c, s, -s, c, 0, 0];
  const tr: Affine = [1, 0, 0, 1, x, y];
  return mul(tr, mul(rot, mul(scale, center)));
}

export function invert(m: Affine): Affine | null {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-12) return null;
  const id = 1 / det;
  return [m[3] * id, -m[1] * id, -m[2] * id, m[0] * id, (m[2] * m[5] - m[3] * m[4]) * id, (m[1] * m[4] - m[0] * m[5]) * id];
}

export const apply = (m: Affine, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

// ------------------------------------------------------------------ refine edges, in one dimension

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const toU8 = (v: number) => Math.min(255, Math.max(0, Math.round(v)));

/** Box blur radius r, edge-clamped (filters.rs box_1d). */
export function box1d(src: number[], r: number): number[] {
  if (r === 0) return src.slice();
  const n = src.length;
  const get = (i: number) => src[Math.min(n - 1, Math.max(0, i))];
  let acc = 0;
  for (let k = -r; k <= r; k++) acc += get(k);
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    out[i] = acc / (2 * r + 1);
    acc += get(i + r + 1) - get(i - r);
  }
  return out;
}

/** Box radius the engine uses so that three box passes approximate a Gaussian of σ. */
export const gaussBoxRadius = (sigma: number) => Math.max(1, Math.round(Math.sqrt((12 * sigma * sigma) / 3 + 1) / 2));

export function gauss1d(src: number[], sigma: number): number[] {
  if (sigma < 0.3) return src.slice();
  const r = gaussBoxRadius(sigma);
  return box1d(box1d(box1d(src, r), r), r);
}

/** Grey-scale dilation (r > 0) or erosion (r < 0) with a window of 2|r|+1 (filters.rs morph_u8). */
export function morph1d(src: number[], r: number): number[] {
  if (r === 0) return src.slice();
  const k = Math.abs(r);
  return src.map((_, i) => {
    let v = src[i];
    for (let j = Math.max(0, i - k); j <= Math.min(src.length - 1, i + k); j++) v = r > 0 ? Math.max(v, src[j]) : Math.min(v, src[j]);
    return v;
  });
}

export interface RefineParams {
  smooth: number;
  shift: number;
  contrast: number;
  feather: number;
}

/**
 * Refine Edges ▸ Smooth, Shift Edge, Contrast and Feather, in the engine's order
 * (engine.rs refine_layer), applied to an 8-bit profile. The edge-aware Radius step is two-
 * dimensional and is not part of this one-dimensional illustration.
 */
export function refineProfile(alpha: number[], p: RefineParams): number[] {
  let a = alpha.slice();
  if (p.smooth > 0) a = gauss1d(a, p.smooth).map((x) => toU8((toU8(x) - 128) * 2 + 128));
  if (Math.abs(p.shift) >= 0.5) a = morph1d(a, Math.round(p.shift));
  if (p.contrast > 0) {
    const k = 1 + p.contrast * 8;
    a = a.map((x) => toU8(clamp01((x / 255 - 0.5) * k + 0.5) * 255));
  }
  if (p.feather > 0) a = gauss1d(a, p.feather).map(toU8);
  return a;
}

// ------------------------------------------------------------------ floating point

/** Bit pattern of the IEEE 754 binary32 nearest to v. */
export function f32Bits(v: number): number {
  const dv = new DataView(new ArrayBuffer(4));
  dv.setFloat32(0, v);
  return dv.getUint32(0);
}

export function f32FromBits(bits: number): number {
  const dv = new DataView(new ArrayBuffer(4));
  dv.setUint32(0, bits >>> 0);
  return dv.getFloat32(0);
}

/** IEEE 754 binary16 bit pattern nearest to v (round to nearest, ties to even). */
export function f16Bits(v: number): number {
  if (Number.isNaN(v)) return 0x7e00;
  const sign = v < 0 || Object.is(v, -0) ? 0x8000 : 0;
  const a = Math.abs(v);
  if (a === Infinity) return sign | 0x7c00;
  if (a === 0) return sign;
  // Work with exact multiples of the smallest subnormal, 2^-24.
  let e = Math.floor(Math.log2(a));
  if (2 ** e > a) e--;
  if (2 ** (e + 1) <= a) e++;
  if (e < -14) {
    const m = roundEven(a / 2 ** -24);
    return sign | m; // m may round up to 0x400, which is the smallest normal: still correct
  }
  let m = roundEven((a / 2 ** e - 1) * 1024);
  if (m === 1024) {
    m = 0;
    e++;
  }
  if (e > 15) return sign | 0x7c00;
  return sign | ((e + 15) << 10) | m;
}

function roundEven(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

export function f16FromBits(bits: number): number {
  const s = bits & 0x8000 ? -1 : 1;
  const e = (bits >> 10) & 0x1f;
  const m = bits & 0x3ff;
  if (e === 0) return s * m * 2 ** -24;
  if (e === 31) return m ? NaN : s * Infinity;
  return s * (1 + m / 1024) * 2 ** (e - 15);
}

/** Distance from v to the next representable value of the same format (one unit in the last place). */
export function ulp16(v: number): number {
  const b = f16Bits(Math.abs(v));
  if ((b & 0x7c00) === 0x7c00) return NaN;
  return f16FromBits(b + 1) - f16FromBits(b);
}

export function ulp32(v: number): number {
  const b = f32Bits(Math.abs(v));
  return f32FromBits(b + 1) - f32FromBits(b);
}
