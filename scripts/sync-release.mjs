// Writes src/data/release.json from the application repository's public GitHub data.
// Run by every deployment (and daily). Locally it runs without a token on purpose: a personal
// token could read private repositories, and the public site must only reflect public data.
import { writeFile } from 'node:fs/promises';
import { APP_REPO } from '../site.config.mjs';
import { readReleaseState } from './lib/release.mjs';

const token = process.env.CI === 'true' ? process.env.GITHUB_TOKEN : undefined;
const state = await readReleaseState({ repo: APP_REPO, token });
await writeFile(new URL('../src/data/release.json', import.meta.url), JSON.stringify(state, null, 2) + '\n');
console.log(
  `Repository ${state.repo.name}: ${state.repo.public ? 'public' : 'not public'}` +
    `${state.repo.license ? `, licence ${state.repo.license.spdx}` : ', no licence detected'}; ` +
    `release state ${state.status}` +
    (state.status === 'available' ? ` (${state.version})` : '') +
    `; editions: ${state.editions.map((e) => `${e.id} ${e.available ? e.version + (e.preview ? ' preview' : '') : 'unavailable'}`).join(', ')}`,
);
