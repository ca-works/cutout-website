// Runs the Astro CLI with its anonymous usage telemetry switched off.
import { spawnSync } from 'node:child_process';
const bin = new URL('../node_modules/astro/bin/astro.mjs', import.meta.url).pathname;
const r = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
});
process.exit(r.status ?? 1);
