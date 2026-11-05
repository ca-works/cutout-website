# Deploying the site and publishing CutOut releases

## Deploying the website

Every push to `main` builds, verifies and deploys (`.github/workflows/deploy.yml`). The same
workflow runs daily at 06:17 UTC and can be started by hand (Actions → Deploy website → Run
workflow), so a newly published app release appears without a code change.

First-time setup was done on 5 November 2026: public repository `ca-works/cutout-website`, Pages
from GitHub Actions with HTTPS enforced, and deployments from `main` only (see `docs/SECURITY.md`
§7). Live address: https://ca-works.github.io/cutout-website/.

After a deployment, check the live site:

```bash
SITE_URL=https://ca-works.github.io/cutout-website/ npm test
```

Rollback: revert the commit on `main` (the next deployment restores the previous site), or re-run
an earlier successful *Deploy website* run.

## How downloads appear

The site never hosts binaries and never links to one by hand. At every deployment
`scripts/sync-release.mjs` reads the app repository (`APP_REPO` in `site.config.mjs`):

* If the repository is **private or missing**: downloads show *Coming soon*, the open-source
  section says the source is being prepared, and nothing links to the repository.
* If it is **public**: its licence (as detected by GitHub) and issue tracker are shown.
* For each edition, the newest non-draft release containing the exact file below is offered —
  after verification. Pre-releases are labelled *Preview*.

| Edition | Release asset name (exact) |
|---|---|
| Mac, Apple silicon (full build, model included) | `CutOut-macOS-Apple-Silicon.dmg` |
| Mac, Universal (would serve Intel Macs) | `CutOut-macOS-Universal.dmg` |
| Windows x64 | `CutOut-Windows-x64.zip` |

Every release must also contain **`SHA256SUMS.txt`**, one line per file in `shasum -a 256` format.

Verification (any failure stops the deployment; the previous site stays live):

1. the asset is listed in `SHA256SUMS.txt`;
2. that hash equals GitHub's own `sha256` digest of the uploaded asset;
3. the asset is fully uploaded and larger than 5 MB;
4. its URL is `https://github.com/<APP_REPO>/releases/download/<tag>/<file>`;
5. tags are semantic versions (`v0.1.0`, `v0.2.0-beta.1`).

## Publishing the first CutOut release (owner, when ready)

This is an outward-facing step and needs the owner's decision; nothing here does it
automatically.

1. Choose the application's licence and add `LICENSE` to the app repository; make the repository
   public (or create a public distribution repository and point `APP_REPO` at it).
2. In the app repository: Settings → General → **Releases: enable immutable releases**.
3. Build the full app: `BUNDLE_COREML=1 scripts/build.sh --dmg`, run `scripts/verify_dist.sh`.
4. Rename the DMG to `CutOut-macOS-Apple-Silicon.dmg`, then:

   ```bash
   shasum -a 256 CutOut-macOS-Apple-Silicon.dmg > SHA256SUMS.txt
   ```

   ```bash
   gh release create v0.1.0 CutOut-macOS-Apple-Silicon.dmg SHA256SUMS.txt --repo ca-works/cutout --title "CutOut 0.1.0" --notes-file RELEASE_NOTES.md
   ```

5. Run *Deploy website* (or wait for the daily run). Check the card's version, size and SHA-256
   against `SHA256SUMS.txt`.

Release notes should repeat that the build is ad-hoc signed and not notarized, and link to the
site's install instructions (`/docs/#install`).

## Free-tier limits (checked 4 November 2026)

* GitHub Pages: 1 GB site (this site ≈ 14 MB), soft 100 GB/month bandwidth, 10 builds/hour soft
  limit (custom workflows are exempt).
* GitHub Releases: each file < 2 GiB (the full DMG is ≈ 420 MB); no documented bandwidth quota.
* GitHub Actions: free for public repositories on standard runners.
