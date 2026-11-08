// Numerical tests for the Science page's demonstrations (src/scripts/science/sci-lib.ts).
// Each test checks the browser port against either an exhaustive identity, a published reference
// value, or a result taken from CutOut's own engine tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../../src/scripts/science/sci-lib.ts';

const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b} (±${eps})`);

test('mul255 is exactly round(a·b / 255) for every pair of bytes', () => {
  for (let a = 0; a < 256; a++)
    for (let b = 0; b < 256; b++) assert.equal(L.mul255(a, b), Math.round((a * b) / 255), `${a}·${b}`);
});

test('compositing equation: endpoints and midpoint', () => {
  assert.equal(L.over(200, 40, 1), 200);
  assert.equal(L.over(200, 40, 0), 40);
  assert.equal(L.over(200, 40, 0.5), 120);
});

test('premultiply → unpremultiply loses at most 255/(2α) per channel', () => {
  for (let a = 1; a < 256; a++)
    for (let c = 0; c < 256; c += 3) {
      const p = L.premultiply(c, c, c, a);
      const s = L.unpremultiply(p[0], p[1], p[2], a);
      assert.ok(Math.abs(s[0] - c) <= Math.ceil(255 / (2 * a)) + 0.5, `c=${c} a=${a} → ${s[0]}`);
    }
  assert.deepEqual(L.unpremultiply(9, 9, 9, 0), [0, 0, 0, 0]);
});

test('source-over matches the engine test (red at 50 % over blue → 128, 0, 127)', () => {
  let dst = [0, 0, 0, 0];
  dst = L.sourceOver([0, 0, 255, 255], 255, 1, dst);
  dst = L.sourceOver([255, 0, 0, 255], 255, 0.5, dst);
  assert.deepEqual(L.unpremultiply(...dst), [128, 0, 127, 255]);
});

test('a mask of 0 hides a pixel; the mask multiplies alpha', () => {
  assert.deepEqual(L.sourceOver([10, 20, 30, 255], 0, 1, [0, 0, 0, 0]), [0, 0, 0, 0]);
  assert.equal(L.sourceOver([10, 20, 30, 255], 128, 1, [0, 0, 0, 0])[3], 128);
});

test('CIEDE2000 reproduces Sharma, Wu & Dalal (2005) test pairs', () => {
  const pairs = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425], // pair 1
    [[50, 0, 0], [50, -1, 2], 2.3669], // pair 7
    [[50, 2.5, 0], [73, 25, -18], 27.1492], // pair 17
    [[50, 2.5, 0], [61, -5, 29], 22.8977], // pair 18
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644], // pair 25
  ];
  for (const [p, q, d] of pairs) close(L.deltaE2000({ l: p[0], a: p[1], b: p[2] }, { l: q[0], a: q[1], b: q[2] }), d, 1e-4);
});

test('sRGB → CIELAB: white and black', () => {
  const w = L.rgbToLab(255, 255, 255);
  close(w.l, 100, 1e-3);
  close(w.a, 0, 1e-2);
  close(w.b, 0, 1e-2);
  close(L.rgbToLab(0, 0, 0).l, 0, 1e-9);
});

test('Magic Wand: contiguous fill stops at a different colour; ramp pixels are partial', () => {
  // 5×1: white, white, light grey (ΔE₀₀ ≈ 3.05 from white), red, white
  const px = [[255, 255, 255], [255, 255, 255], [240, 240, 240], [255, 0, 0], [255, 255, 255]];
  const rgba = new Uint8ClampedArray(px.flatMap((p) => [...p, 255]));
  const sel = L.wandSelect(rgba, 5, 1, 0, 0, 1, 4, true);
  assert.equal(sel[0], 255);
  assert.equal(sel[1], 255);
  assert.ok(sel[2] > 0 && sel[2] < 255, `ramp ${sel[2]}`);
  assert.equal(sel[3], 0);
  assert.equal(sel[4], 0, 'not reachable without crossing red');
  const global = L.wandSelect(rgba, 5, 1, 0, 0, 1, 4, false);
  assert.equal(global[4], 255);
});

test('brush falloff: solid core, smoothstep shoulder, anti-aliased hard rim', () => {
  assert.equal(L.dabFalloff(0, 10, 0.5), 1);
  assert.equal(L.dabFalloff(5, 10, 0.5), 1);
  assert.equal(L.dabFalloff(10.5, 10, 0.5), 0);
  close(L.dabFalloff(7.75, 10, 0.5), 0.5, 1e-12, 'midpoint of the shoulder');
  let prev = 1;
  for (let d = 0; d <= 11; d += 0.1) {
    const f = L.dabFalloff(d, 10, 0.3);
    assert.ok(f <= prev + 1e-12);
    prev = f;
  }
  assert.equal(L.dabFalloff(10, 10, 1), 1);
  assert.equal(L.dabFalloff(10.25, 10, 1), 0.25, '1 px anti-aliased rim outside r');
});

test('eraser and restore are exact inverses at full strength', () => {
  for (let m = 0; m < 256; m++) {
    assert.equal(L.erase(m, 255), 0);
    assert.equal(L.restore(m, 255), 255);
    assert.equal(L.erase(m, 0), m);
  }
  assert.equal(L.erase(255, 128), 127);
});

test('layer matrix: centre pivot, rotation and exact inverse', () => {
  const m = L.layerMatrix(100, 50, 1, 1, 0, 40, 20);
  assert.deepEqual(L.apply(m, 0, 0), [80, 40]);
  const r = L.layerMatrix(0, 0, 2, 2, Math.PI / 2, 10, 10);
  const [x, y] = L.apply(r, 10, 5); // right-middle of the layer → below the centre
  close(x, 0, 1e-12);
  close(y, 10, 1e-12);
  const g = L.layerMatrix(31, -7, 1.7, 0.6, 0.83, 300, 200);
  const [u, v] = L.apply(L.invert(g), ...L.apply(g, 12.5, 77.25));
  close(u, 12.5, 1e-9);
  close(v, 77.25, 1e-9);
});

test('refine profile: neutral settings change nothing; shift moves the edge by whole pixels', () => {
  const edge = Array.from({ length: 40 }, (_, i) => (i < 20 ? 0 : 255));
  assert.deepEqual(L.refineProfile(edge, { smooth: 0, shift: 0, contrast: 0, feather: 0 }), edge);
  const grown = L.refineProfile(edge, { smooth: 0, shift: 3, contrast: 0, feather: 0 });
  assert.equal(grown.indexOf(255), 17);
  const feathered = L.refineProfile(edge, { smooth: 0, shift: 0, contrast: 0, feather: 2 });
  assert.ok(feathered[19] > 0 && feathered[20] < 255);
  assert.equal(L.gaussBoxRadius(1), 1);
  assert.equal(L.gaussBoxRadius(4), 4);
});

test('box blur preserves a constant signal (engine test)', () => {
  assert.ok(L.box1d(Array(9).fill(0.5), 2).every((v) => Math.abs(v - 0.5) < 1e-12));
});

test('binary16: known encodings', () => {
  const cases = [
    [1, 0x3c00], [-2, 0xc000], [65504, 0x7bff], [65520, 0x7c00], [0.1, 0x2e66], [1 / 3, 0x3555],
    [2 ** -24, 0x0001], [2 ** -14, 0x0400], [0.5, 0x3800], [0, 0], [-0, 0x8000], [1e-9, 0],
  ];
  for (const [v, bits] of cases) assert.equal(L.f16Bits(v), bits, `${v} → 0x${L.f16Bits(v).toString(16)}`);
});

test('binary16: every finite pattern survives a decode → encode round trip', () => {
  for (let b = 0; b < 0x10000; b++) {
    if ((b & 0x7c00) === 0x7c00) continue;
    assert.equal(L.f16Bits(L.f16FromBits(b)), b, `0x${b.toString(16)}`);
  }
});

test('binary16 rounding agrees with the platform where Math.f16round exists', { skip: typeof Math.f16round !== 'function' }, () => {
  for (let i = 0; i < 20000; i++) {
    const v = (Math.random() - 0.5) * 10 ** (Math.random() * 10 - 6);
    assert.equal(L.f16FromBits(L.f16Bits(v)), Math.f16round(v), `${v}`);
  }
});

test('ulp: 2^-10 at 1 for FP16, 2^-23 at 1 for FP32; spacing below 1 is 2^-11', () => {
  assert.equal(L.ulp16(1), 2 ** -10);
  assert.equal(L.ulp32(1), 2 ** -23);
  assert.equal(L.ulp16(0.75), 2 ** -11);
});
