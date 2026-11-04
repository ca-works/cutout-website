# Security: threat model, controls and audit

Last reviewed: 4 November 2026. Scope: this website repository, its build and deployment, and
the path from a published CutOut release to a visitor's download. No production system was
attacked; all tests ran locally.

## 1. Inventory

| Component | Notes |
|---|---|
| Hosting | GitHub Pages, static files only. No server code, database, forms, cookies or accounts. |
| Runtime origins | One: the site itself. No CDNs, fonts, analytics or third-party scripts. |
| Client JavaScript | Own code only: 5.3 KiB site + 3.6 KiB WebGL hero (gzip, the latter loaded on first interaction). No framework runtime. |
| Build-time network | `scripts/sync-release.mjs` reads `api.github.com` (repository metadata, releases) and the release's `SHA256SUMS.txt`. Read-only. |
| CI/CD | GitHub Actions: `check.yml` (PRs/branches), `deploy.yml` (main → Pages), `codeql.yml`. |
| Secrets | None. Workflows use only the automatic `GITHUB_TOKEN`, scoped per job. |
| Binaries | Never hosted here. Downloads link to GitHub Releases of `ca-works/cutout` (see `site.config.mjs`). |
| Billable services | None. Public-repository Actions minutes and Pages are free; no paid API, storage or domain. |

## 2. What matters most

1. **Download integrity** — a visitor must only ever be pointed at the genuine published build.
2. **Site integrity** — nobody but the owner can change what the site says.
3. **Visitor privacy** — the site collects nothing.
4. **Maintainer credentials** — no token or secret can leak through the site or its workflows.

## 3. Threats and controls

| # | Threat | Control | Residual risk |
|---|---|---|---|
| T1 | A download link points at a substituted, corrupted or unofficial file | `sync-release.mjs` accepts a file only if it is listed in its release's `SHA256SUMS.txt`, **and** that hash equals the SHA-256 digest GitHub itself computed for the asset, **and** the asset is fully uploaded, plausibly sized and served from `github.com/ca-works/cutout/releases/download/<tag>/`. Any mismatch or API error fails the build, so the last good site stays live. Drafts are ignored; pre-releases are labelled. 14 unit tests (`tests/unit/release.test.mjs`). `verify-dist.mjs` rejects any release link outside the app repository. | `SHA256SUMS.txt` lives in the same release as the binary, so it detects corruption and mirror tampering but **not** a maintainer account that is itself compromised. Mitigations for the owner: 2FA/passkeys, GitHub **immutable releases** on the app repository, and later Developer ID signing + notarization or build attestations. |
| T2 | The site shows downloads or source links for a repository that isn't public | The sync treats any private or missing repository as "not public" (also when a token could see it). Locally it runs without a token on purpose. Tests cover both cases. | — |
| T3 | Malicious or compromised npm dependency | Two runtime-build dependencies (Astro, its sitemap integration) plus dev tools; exact versions; `package-lock.json`; `ignore-scripts=true` (no install hooks run); `npm audit` in CI fails on high/critical; Dependabot with a 7-day cooldown; versions chosen ≥ 2 weeks old. Nothing from npm runs in visitors' browsers except Mona Sans font files. | Build-time code from Astro/Vite/sharp still runs in CI with a read-only token and no secrets. |
| T4 | Compromised or re-tagged GitHub Action | Only first-party actions (`actions/*`, `github/codeql-action`), each pinned to a full commit SHA (with the version in a comment). zizmor 1.32.0: no findings (default, pedantic and online audits, including impostor-commit and known-vulnerable-action checks). Dependabot proposes SHA updates. | — |
| T5 | A pull request (e.g. from a fork) abuses workflow privileges | `check.yml` uses `pull_request` (never `pull_request_target`), has `contents: read` only and no secrets. Only `deploy.yml` can publish, only from `main`, only in its `deploy` job, which receives `pages: write` + `id-token: write` and runs no repository code. `persist-credentials: false` everywhere. The `github-pages` environment restricts deployments to `main`. | A maintainer merging a malicious PR — mitigated by review (CODEOWNERS) and a branch ruleset (owner action below). |
| T6 | Cross-site scripting / content injection | The site is static with no user input. Release data is rendered at build time by Astro, which escapes it. No `innerHTML`, `eval` or `document.write` (checked by `verify-dist`). CSP: `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; require-trusted-types-for 'script'; trusted-types 'none'`. No inline scripts, inline styles or event handlers (enforced by `verify-dist`). Browser tests fail on any CSP violation. | CSP is delivered by `<meta>` (see §4). |
| T7 | Clickjacking | The site has no state-changing actions, so framing it gains an attacker little. | `frame-ancestors` cannot be set from `<meta>` and GitHub Pages sends no `X-Frame-Options`; framing cannot be prevented. |
| T8 | Tracking / privacy leaks | No cookies, storage, analytics or third-party requests; fonts self-hosted; `Referrer-Policy: strict-origin-when-cross-origin` via `<meta>`; images re-encoded without metadata (no EXIF/GPS). `/privacy/` documents what GitHub can log. | GitHub's own server logs (outside our control; disclosed). |
| T9 | Secret leakage | No secrets exist. Gitleaks 8.30.1 scanned the full git history and `dist/`; `verify-dist` scans every built text file for token patterns and refuses source maps and `.env`/key files. | — |
| T10 | Hosting or domain takeover | The `*.github.io` address is controlled by GitHub. No custom domain. If one is added later, verify it in the account's Pages settings first (prevents takeover) and enable "Enforce HTTPS". | — |
| T11 | Unexpected cost | Static site, public repository, standard GitHub-hosted runners (free for public repos), no paid services. Daily scheduled deploy ≈ 1–2 runner-minutes. | GitHub can change its free-tier policies; re-check annually. |

## 4. What GitHub Pages can and cannot enforce

Measured on `https://ca-works.github.io/` (4 November 2026):

| Header | Sent by GitHub Pages | Consequence |
|---|---|---|
| HTTPS redirect | Yes (HTTP → 301 → HTTPS) | — |
| `Strict-Transport-Security` | Yes, `max-age=31556952` | — |
| `Cache-Control` | Fixed `max-age=600` | Cannot be changed; content-hashed asset names avoid stale mixes. |
| `Content-Security-Policy` | No | Delivered via `<meta>`. A meta CSP cannot use `frame-ancestors`, `report-uri`/`report-to` or `sandbox`. |
| `X-Frame-Options` | No | See T7. |
| `X-Content-Type-Options` | No | Low impact: all files are same-origin static assets with correct types. |
| `Permissions-Policy`, COOP/COEP | No | Not needed; the site uses no powerful features. |

These are not claimed anywhere on the site.

## 5. Audit record (4 November 2026)

| Check | Tool / version | Result |
|---|---|---|
| Dependency vulnerabilities | `npm audit` (npm 11.19.1) | 0 vulnerabilities |
| Workflow security | zizmor 1.32.0 (offline, online, pedantic) | 0 findings |
| Secrets in history and build | Gitleaks 8.30.1 (`gitleaks git`, `gitleaks dir dist`, `gitleaks dir .`) | No leaks found |
| Build policy gate | `scripts/verify-dist.mjs` | Pass (CSP exact match, no inline code, all links resolve, allow-listed hosts only) |
| CSP / Trusted Types violations in browsers | Playwright (Chromium, WebKit, iPhone, Android profiles) | 0 |
| Release-sync fail-closed rules | `node --test` | 14/14 pass |
| Static analysis | CodeQL (JavaScript/TypeScript + Actions) | Runs in CI after the first push — **not yet run** |

## 6. Lessons from the ENG Drawing Viewer site (not modified)

The earlier site's architecture (separate public website repository, releases verified against
`SHA256SUMS.txt` and GitHub's digest, fail-closed sync) was kept. Improvements made here:
actions pinned to commit SHAs instead of tags; `persist-credentials: false`; per-job instead of
workflow-wide Pages permissions (its build job also held `pages: write` and `id-token: write`);
Dependabot and CodeQL; `npm ci --ignore-scripts`; a CSP with Trusted Types; zizmor/Gitleaks
audits. Applying the same changes to `ca-works/eng-drw` is recommended but was not done.

## 7. Owner actions (dashboard only; not done automatically)

1. Repository → Settings → Pages: Source **GitHub Actions**; **Enforce HTTPS** on.
2. Settings → Environments → `github-pages`: deployment branches **main** only.
3. Settings → Rules: a ruleset for `main` that blocks force pushes and deletion (and, if you
   like, requires the *Check* workflow).
4. Settings → Code security: **Private vulnerability reporting**, **Dependabot alerts and security
   updates**, **Secret scanning** and **Push protection** (all free on public repositories).
5. On the application repository, before the first release: enable **immutable releases**, publish
   `SHA256SUMS.txt` with every release, keep 2FA/passkeys on the `ca-works` account.
