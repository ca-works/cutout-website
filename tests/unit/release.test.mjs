import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readReleaseState, parseSums, parseVersion, compareVersions } from '../../scripts/lib/release.mjs';

const REPO = 'ca-works/cutout';
const H1 = 'a'.repeat(64);
const H2 = 'b'.repeat(64);
const DL = `https://github.com/${REPO}/releases/download`;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function asset(tag, name, { size = 400_000_000, digest, state = 'uploaded', url } = {}) {
  return { name, size, state, digest, browser_download_url: url ?? `${DL}/${tag}/${name}` };
}

function release(tag, assets, extra = {}) {
  return {
    id: tag,
    tag_name: tag,
    draft: false,
    prerelease: false,
    published_at: '2026-11-10T10:00:00Z',
    html_url: `https://github.com/${REPO}/releases/tag/${tag}`,
    assets,
    ...extra,
  };
}

const publicRepo = {
  full_name: REPO,
  private: false,
  visibility: 'public',
  html_url: `https://github.com/${REPO}`,
  has_issues: true,
  default_branch: 'main',
  license: { spdx_id: 'MIT', name: 'MIT License' },
};

function fakeFetch({ repo = publicRepo, repoStatus = 200, releases = [], sums = {}, releasesStatus = 200 }) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    if (url === `https://api.github.com/repos/${REPO}`) return repoStatus === 200 ? json(repo) : json({}, repoStatus);
    if (url.startsWith(`https://api.github.com/repos/${REPO}/releases`)) return json(releases, releasesStatus);
    if (url.endsWith('/SHA256SUMS.txt')) {
      const tag = url.split('/').at(-2);
      return sums[tag] === undefined ? new Response('', { status: 404 }) : new Response(sums[tag]);
    }
    throw new Error(`Unexpected request ${url}`);
  };
  fn.calls = calls;
  return fn;
}

test('a private or missing repository is shown as not public, with nothing to download', async () => {
  const f = fakeFetch({ repoStatus: 404 });
  const s = await readReleaseState({ repo: REPO, fetch: f });
  assert.equal(s.status, 'unreleased');
  assert.equal(s.repo.public, false);
  assert.equal(s.repo.url, null);
  assert.ok(s.editions.every((e) => !e.available));
  assert.equal(f.calls.length, 1, 'releases of a non-public repository are never read');
});

test('a repository visible only through a token is still treated as private', async () => {
  const f = fakeFetch({ repo: { ...publicRepo, private: true, visibility: 'private' } });
  const s = await readReleaseState({ repo: REPO, fetch: f, token: 'x' });
  assert.equal(s.repo.public, false);
  assert.equal(s.status, 'unreleased');
});

test('API failures stop the build instead of showing stale data', async () => {
  await assert.rejects(readReleaseState({ repo: REPO, fetch: fakeFetch({ repoStatus: 500 }) }), /refusing stale/);
  await assert.rejects(readReleaseState({ repo: REPO, fetch: fakeFetch({ releasesStatus: 403 }) }), /refusing stale/);
});

test('public repository without releases: licence is reported, downloads are not', async () => {
  const s = await readReleaseState({ repo: REPO, fetch: fakeFetch({}) });
  assert.equal(s.status, 'unreleased');
  assert.equal(s.repo.public, true);
  assert.equal(s.repo.license.spdx, 'MIT');
  assert.equal(s.repo.issues, `https://github.com/${REPO}/issues`);
});

test('NOASSERTION licence is not presented as a licence', async () => {
  const s = await readReleaseState({
    repo: REPO,
    fetch: fakeFetch({ repo: { ...publicRepo, license: { spdx_id: 'NOASSERTION', name: 'Other' } } }),
  });
  assert.equal(s.repo.license, null);
});

test('a verified release is offered with size, checksum and version', async () => {
  const tag = 'v0.1.0';
  const s = await readReleaseState({
    repo: REPO,
    fetch: fakeFetch({
      releases: [
        release(tag, [
          asset(tag, 'CutOut-macOS-Apple-Silicon.dmg', { digest: `sha256:${H1}` }),
          asset(tag, 'SHA256SUMS.txt', { size: 200 }),
        ]),
      ],
      sums: { [tag]: `${H1}  CutOut-macOS-Apple-Silicon.dmg\n` },
    }),
  });
  assert.equal(s.status, 'available');
  assert.equal(s.version, '0.1.0');
  const mac = s.editions.find((e) => e.id === 'macos-apple-silicon');
  assert.equal(mac.available, true);
  assert.equal(mac.sha256, H1);
  assert.equal(mac.url, `${DL}/${tag}/CutOut-macOS-Apple-Silicon.dmg`);
  assert.equal(s.editions.find((e) => e.id === 'windows-x64').available, false);
});

test('a digest that disagrees with SHA256SUMS.txt fails the sync', async () => {
  const tag = 'v0.1.0';
  const f = fakeFetch({
    releases: [release(tag, [asset(tag, 'CutOut-macOS-Apple-Silicon.dmg', { digest: `sha256:${H2}` }), asset(tag, 'SHA256SUMS.txt')])],
    sums: { [tag]: `${H1}  CutOut-macOS-Apple-Silicon.dmg\n` },
  });
  await assert.rejects(readReleaseState({ repo: REPO, fetch: f }), /Checksum mismatch/);
});

test('a missing digest fails the sync', async () => {
  const tag = 'v0.1.0';
  const f = fakeFetch({
    releases: [release(tag, [asset(tag, 'CutOut-macOS-Apple-Silicon.dmg'), asset(tag, 'SHA256SUMS.txt')])],
    sums: { [tag]: `${H1}  CutOut-macOS-Apple-Silicon.dmg\n` },
  });
  await assert.rejects(readReleaseState({ repo: REPO, fetch: f }), /Checksum mismatch/);
});

test('a file not listed in SHA256SUMS.txt fails the sync', async () => {
  const tag = 'v0.1.0';
  const f = fakeFetch({
    releases: [release(tag, [asset(tag, 'CutOut-macOS-Apple-Silicon.dmg', { digest: `sha256:${H1}` }), asset(tag, 'SHA256SUMS.txt')])],
    sums: { [tag]: `${H1}  Something-else.dmg\n` },
  });
  await assert.rejects(readReleaseState({ repo: REPO, fetch: f }), /not listed/);
});

test('a release with downloads but no SHA256SUMS.txt fails the sync', async () => {
  const tag = 'v0.1.0';
  const f = fakeFetch({ releases: [release(tag, [asset(tag, 'CutOut-macOS-Apple-Silicon.dmg', { digest: `sha256:${H1}` })])] });
  await assert.rejects(readReleaseState({ repo: REPO, fetch: f }), /no SHA256SUMS/);
});

test('a download served from anywhere but this repository fails the sync', async () => {
  const tag = 'v0.1.0';
  const f = fakeFetch({
    releases: [
      release(tag, [
        asset(tag, 'CutOut-macOS-Apple-Silicon.dmg', { digest: `sha256:${H1}`, url: 'https://example.com/CutOut-macOS-Apple-Silicon.dmg' }),
        asset(tag, 'SHA256SUMS.txt'),
      ]),
    ],
    sums: { [tag]: `${H1}  CutOut-macOS-Apple-Silicon.dmg\n` },
  });
  await assert.rejects(readReleaseState({ repo: REPO, fetch: f }), /Unexpected download URL/);
});

test('partially uploaded or implausibly small files fail the sync', async () => {
  const tag = 'v0.1.0';
  const sums = { [tag]: `${H1}  CutOut-macOS-Apple-Silicon.dmg\n` };
  await assert.rejects(
    readReleaseState({
      repo: REPO,
      fetch: fakeFetch({ releases: [release(tag, [asset(tag, 'CutOut-macOS-Apple-Silicon.dmg', { digest: `sha256:${H1}`, state: 'starter' }), asset(tag, 'SHA256SUMS.txt')])], sums }),
    }),
    /not fully uploaded/,
  );
  await assert.rejects(
    readReleaseState({
      repo: REPO,
      fetch: fakeFetch({ releases: [release(tag, [asset(tag, 'CutOut-macOS-Apple-Silicon.dmg', { digest: `sha256:${H1}`, size: 1000 }), asset(tag, 'SHA256SUMS.txt')])], sums }),
    }),
    /implausibly small/,
  );
});

test('drafts are ignored; pre-releases are previews; newest version wins per edition', async () => {
  const a = 'v0.1.0', b = 'v0.2.0-beta.1', c = 'v0.3.0';
  const s = await readReleaseState({
    repo: REPO,
    fetch: fakeFetch({
      releases: [
        release(c, [asset(c, 'CutOut-macOS-Apple-Silicon.dmg', { digest: `sha256:${H2}` }), asset(c, 'SHA256SUMS.txt')], { draft: true }),
        release(b, [asset(b, 'CutOut-macOS-Apple-Silicon.dmg', { digest: `sha256:${H2}` }), asset(b, 'SHA256SUMS.txt')], { prerelease: true }),
        release(a, [asset(a, 'CutOut-macOS-Apple-Silicon.dmg', { digest: `sha256:${H1}` }), asset(a, 'SHA256SUMS.txt')]),
      ],
      sums: { [b]: `${H2}  CutOut-macOS-Apple-Silicon.dmg\n`, [a]: `${H1}  CutOut-macOS-Apple-Silicon.dmg\n` },
    }),
  });
  const mac = s.editions.find((e) => e.id === 'macos-apple-silicon');
  assert.equal(mac.version, '0.2.0-beta.1');
  assert.equal(mac.preview, true);
  assert.equal(s.version, '0.2.0-beta.1', 'only a preview is offered, so it is the headline version');
});

test('checksum and version parsing', () => {
  assert.deepEqual([...parseSums(`${H1}  a.dmg\n${H2} *b.zip\n\n# comment\n`)], [['a.dmg', H1], ['b.zip', H2]]);
  assert.throws(() => parseSums('nonsense'), /Malformed/);
  assert.throws(() => parseSums(`${H1}  a.dmg\n${H2}  a.dmg`), /Duplicate/);
  assert.throws(() => parseVersion('latest'), /Invalid release tag/);
  assert.ok(compareVersions(parseVersion('v1.0.0'), parseVersion('v1.0.0-rc.1')) > 0);
  assert.ok(compareVersions(parseVersion('0.10.0'), parseVersion('0.9.9')) > 0);
});
