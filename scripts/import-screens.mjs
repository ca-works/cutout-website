// Copies the two app windows shown on the home page from a CutOut self-test run into
// src/assets/screens/, cropping the empty 104 px strip that offscreen renders have at the top.
// The pixels are otherwise untouched. See docs/MAINTENANCE.md ("Updating the app screenshots").
// Usage: node scripts/import-screens.mjs <self-test output folder>
import sharp from 'sharp';
import { existsSync } from 'node:fs';

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node scripts/import-screens.mjs <self-test output folder>');
  process.exit(1);
}
const TOP = 104;
const pairs = [
  ['05-best-removed-layers.png', 'app-removed.png'],
  ['08-magic-eraser-tool-layers.png', 'app-tools.png'],
];
for (const [from, to] of pairs) {
  const file = `${dir}/${from}`;
  if (!existsSync(file)) throw new Error(`${file} not found; did the self-test pass?`);
  const { width, height } = await sharp(file).metadata();
  await sharp(file)
    .extract({ left: 0, top: TOP, width, height: height - TOP })
    .png({ compressionLevel: 9 })
    .toFile(`src/assets/screens/${to}`);
  console.log(`src/assets/screens/${to}  ${width} × ${height - TOP}`);
}
