// Release and repository state for the download and open-source sections.
//
// Rules (each one is covered by tests/unit/release.test.mjs):
// * Only a PUBLIC repository is read. A private or missing repository (HTTP 404) gives the
//   "not public / coming soon" state; no other status is accepted — any API failure throws, so a
//   deployment never shows stale or unverified downloads.
// * Draft releases are ignored. Pre-releases are offered as "Preview".
// * Each edition comes from the newest published release that contains its exact file name.
// * Every offered file must (1) be listed in that release's SHA256SUMS.txt, (2) have the same
//   SHA-256 that GitHub itself reports as the asset digest, (3) be fully uploaded, and (4) be
//   served from this repository's own release download URL. Otherwise the sync fails.
// * Nothing here ever downloads or executes a binary; only SHA256SUMS.txt (text) is fetched.

export const EDITIONS = [
  // Full build: Best Quality model included, works offline from the first launch.
  { id: 'macos-apple-silicon', file: 'CutOut-macOS-Apple-Silicon.dmg', minBytes: 5_000_000 },
  // A Universal (Apple silicon + Intel) build would serve Intel Macs.
  { id: 'macos-universal', file: 'CutOut-macOS-Universal.dmg', minBytes: 5_000_000 },
  { id: 'windows-x64', file: 'CutOut-Windows-x64.zip', minBytes: 5_000_000 },
];

const VERSION = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;
const SHA = /^[a-f0-9]{64}$/;

export function parseVersion(tag) {
  const m = VERSION.exec(tag);
  if (!m) throw new Error(`Invalid release tag ${JSON.stringify(tag)}`);
  return { text: tag.replace(/^v/, ''), parts: [+m[1], +m[2], +m[3]], pre: m[4] ?? null };
}

export function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) if (a.parts[i] !== b.parts[i]) return a.parts[i] - b.parts[i];
  if (a.pre === b.pre) return 0;
  if (a.pre === null) return 1; // 1.0.0 > 1.0.0-beta
  if (b.pre === null) return -1;
  return a.pre < b.pre ? -1 : 1;
}

export function parseSums(text) {
  const sums = new Map();
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^([a-fA-F0-9]{64})\s+\*?(.+)$/.exec(line);
    if (!m) throw new Error(`Malformed SHA256SUMS line: ${JSON.stringify(line)}`);
    const name = m[2].trim();
    if (sums.has(name)) throw new Error(`Duplicate checksum entry for ${name}`);
    sums.set(name, m[1].toLowerCase());
  }
  return sums;
}

function unreleased(repo) {
  return {
    status: 'unreleased',
    version: null,
    repo,
    editions: EDITIONS.map(({ id, file }) => ({ id, file, available: false })),
    releases: [],
    published: null,
    notesUrl: null,
  };
}

/**
 * @param {{ repo: string, fetch?: typeof fetch, token?: string }} options
 */
export async function readReleaseState({ repo, fetch = globalThis.fetch, token }) {
  if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(repo)) throw new Error(`Invalid repository ${repo}`);
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'cutout-website-release-sync',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const api = (path) => fetch(`https://api.github.com/repos/${repo}${path}`, { headers });

  const repoRes = await api('');
  if (repoRes.status === 404) {
    return unreleased({ name: repo, public: false, url: null, license: null });
  }
  if (!repoRes.ok) throw new Error(`Repository API failed (${repoRes.status}); refusing stale data`);
  const meta = await repoRes.json();
  if (meta.private || meta.visibility !== 'public') {
    // A token can see private repositories; the public website must never link to one.
    return unreleased({ name: repo, public: false, url: null, license: null });
  }
  const spdx = meta.license?.spdx_id;
  const repoInfo = {
    name: meta.full_name,
    public: true,
    url: meta.html_url,
    issues: meta.has_issues ? `${meta.html_url}/issues` : null,
    license:
      spdx && spdx !== 'NOASSERTION'
        ? { spdx, name: meta.license.name, url: `${meta.html_url}/blob/${meta.default_branch}/LICENSE` }
        : null,
  };

  const relRes = await api('/releases?per_page=30');
  if (!relRes.ok) throw new Error(`Release API failed (${relRes.status}); refusing stale data`);
  const releases = (await relRes.json())
    .filter((r) => !r.draft && r.published_at)
    .map((r) => ({ ...r, v: parseVersion(r.tag_name) }))
    .sort((a, b) => compareVersions(b.v, a.v) || Date.parse(b.published_at) - Date.parse(a.published_at));

  const downloadPrefix = `https://github.com/${repoInfo.name}/releases/download/`;
  const sumsCache = new Map();
  async function sumsFor(r) {
    if (!sumsCache.has(r.id)) {
      const asset = r.assets.find((a) => a.name === 'SHA256SUMS.txt');
      if (!asset) throw new Error(`${r.tag_name} has downloads but no SHA256SUMS.txt`);
      if (!asset.browser_download_url.startsWith(downloadPrefix)) throw new Error('Unexpected checksum host');
      const res = await fetch(asset.browser_download_url, { headers: { 'User-Agent': headers['User-Agent'] } });
      if (!res.ok) throw new Error(`Cannot read SHA256SUMS.txt of ${r.tag_name} (${res.status})`);
      sumsCache.set(r.id, parseSums(await res.text()));
    }
    return sumsCache.get(r.id);
  }

  async function verified(r, edition) {
    const asset = r.assets.find((a) => a.name === edition.file);
    if (!asset) return null;
    if (asset.state && asset.state !== 'uploaded') throw new Error(`${edition.file} in ${r.tag_name} is not fully uploaded`);
    if (!asset.browser_download_url.startsWith(`${downloadPrefix}${encodeURIComponent(r.tag_name)}/`))
      throw new Error(`Unexpected download URL for ${edition.file}`);
    if (!(asset.size >= edition.minBytes)) throw new Error(`${edition.file} in ${r.tag_name} is implausibly small`);
    const listed = (await sumsFor(r)).get(edition.file);
    if (!listed || !SHA.test(listed)) throw new Error(`${edition.file} is not listed in SHA256SUMS.txt of ${r.tag_name}`);
    if (asset.digest !== `sha256:${listed}`)
      throw new Error(`Checksum mismatch for ${edition.file} in ${r.tag_name} (GitHub digest ${asset.digest ?? 'missing'})`);
    return {
      id: edition.id,
      file: edition.file,
      available: true,
      url: asset.browser_download_url,
      size: asset.size,
      sha256: listed,
      version: r.v.text,
      preview: Boolean(r.prerelease),
      immutable: r.immutable === true,
      published: r.published_at,
      releaseUrl: r.html_url,
    };
  }

  const used = new Map();
  const editions = [];
  for (const edition of EDITIONS) {
    let found = { id: edition.id, file: edition.file, available: false };
    for (const r of releases) {
      const v = await verified(r, edition);
      if (v) {
        found = v;
        used.set(r.id, r);
        break;
      }
    }
    editions.push(found);
  }
  const offered = editions.filter((e) => e.available);
  if (!offered.length) return { ...unreleased(repoInfo), repo: repoInfo };

  const stable = offered.filter((e) => !e.preview);
  const newest = [...used.values()].sort((a, b) => compareVersions(b.v, a.v))[0];
  return {
    status: 'available',
    version: (stable.length ? stable : offered)
      .map((e) => parseVersion(e.version))
      .sort(compareVersions)
      .at(-1).text,
    repo: repoInfo,
    editions,
    releases: [...used.values()].map((r) => ({ version: r.v.text, url: r.html_url, published: r.published_at, preview: Boolean(r.prerelease) })),
    published: newest.published_at,
    notesUrl: newest.html_url,
  };
}
