// Gate for every build: fails the build (and therefore any deployment) when dist/ violates a rule.
//
//  • every page has a title, description, canonical URL, Open Graph image and the CSP meta tag
//  • the CSP is the expected strict policy (no unsafe-inline / unsafe-eval / remote origins)
//  • no inline <script> (other than none) and no style="" attributes (CSP would block them)
//  • every local href/src/srcset resolves to a file in dist/, and stays under the site base
//  • every external URL uses https and an allow-listed host; no external scripts/styles/fonts
//  • download links (if any) point only at the app repository's GitHub release assets
//  • no source maps, no .env files, nothing that looks like a credential
//  • gzip budgets for JavaScript (site, hero scene, Science page) and CSS
import { readFile, readdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { SITE_BASE, APP_REPO } from '../site.config.mjs';

const root = resolve('dist');
const errors = [];
const fail = (file, msg) => errors.push(`${relative(root, file) || file}: ${msg}`);
const ALLOWED_HOSTS = new Set([
  'ca-works.github.io',
  'github.com',
  'docs.github.com',
  'commons.wikimedia.org',
  'creativecommons.org',
  'astro.build',
  'onnxruntime.ai',
  'www.rust-lang.org',
  // References on the Science page (papers, model card, vendor documentation).
  'arxiv.org',
  'doi.org',
  'huggingface.co',
  'developer.apple.com',
  'katex.org',
]);
const EXPECTED_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
  "require-trusted-types-for 'script'",
  "trusted-types 'none'",
].join('; ');
const SECRET_PATTERNS = [
  /gh[pousr]_[A-Za-z0-9]{36,}/, // GitHub tokens
  /github_pat_[A-Za-z0-9_]{60,}/,
  /AKIA[0-9A-Z]{16}/, // AWS
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /xox[abpr]-[A-Za-z0-9-]{10,}/, // Slack
  /sk-[A-Za-z0-9]{32,}/,
];

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    out.push(...(e.isDirectory() ? await walk(p) : [p]));
  }
  return out;
}

const files = await walk(root);
let js = 0, css = 0, heroJs = 0, sciJs = 0, pages = 0;

const resolveLocal = (file, url) => {
  const clean = decodeURIComponent(url.split(/[?#]/)[0]);
  if (!clean) return null;
  if (clean.startsWith('/')) {
    if (!clean.startsWith(SITE_BASE)) return { escape: true };
    return { path: resolve(root, clean.slice(SITE_BASE.length)) };
  }
  return { path: resolve(dirname(file), clean) };
};

for (const file of files) {
  const name = relative(root, file);
  if (/\.map$/.test(name)) fail(file, 'source map published');
  if (/(^|\/)\.env/.test(name) || /\.(pem|key|p12)$/.test(name)) fail(file, 'sensitive-looking file published');
  if (/\.(js|css|html|json|xml|txt|webmanifest)$/.test(name)) {
    const text = await readFile(file, 'utf8');
    for (const re of SECRET_PATTERNS) if (re.test(text)) fail(file, `matches secret pattern ${re}`);
    if (name.endsWith('.js')) {
      const size = gzipSync(text).length;
      if (name.includes('hero-gl')) heroJs += size;
      else if (/(^|\/)(sci-|science\.astro)/.test(name)) sciJs += size; // Science page demos, loaded on that page only
      else js += size;
      if (/\beval\(|new Function\(/.test(text)) fail(file, 'eval/new Function in bundle');
      if (/\.innerHTML\s*=|outerHTML\s*=|insertAdjacentHTML|document\.write/.test(text)) fail(file, 'HTML injection sink in bundle');
    }
    if (name.endsWith('.css')) css += gzipSync(text).length;
  }
  if (!name.endsWith('.html')) continue;
  pages++;
  const html = await readFile(file, 'utf8');
  for (const tag of ['<title>', 'name="description"', 'rel="canonical"', 'property="og:image"', 'name="viewport"', 'lang="en-GB"'])
    if (!html.includes(tag)) fail(file, `missing ${tag}`);
  const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html);
  if (!csp) fail(file, 'missing CSP meta');
  else if (csp[1].replaceAll('&#39;', "'") !== EXPECTED_CSP) fail(file, `unexpected CSP: ${csp[1]}`);
  if (html.indexOf('http-equiv="Content-Security-Policy"') > html.indexOf('<link')) fail(file, 'CSP must come before any resource');
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const attrs = m[1];
    if (/type="application\/ld\+json"/.test(attrs)) continue;
    if (!/\bsrc="/.test(attrs) || m[2].trim()) fail(file, 'inline script');
  }
  if (/\sstyle="/.test(html)) fail(file, 'inline style attribute');
  if (/<style[\s>]/.test(html)) fail(file, 'inline <style> element');
  if (/\son[a-z]+="/.test(html)) fail(file, 'inline event handler');
  if (/<iframe|<object|<embed/.test(html)) fail(file, 'embedded frame/object');

  const urls = [];
  for (const m of html.matchAll(/\s(?:href|src|poster|content)="([^"]+)"/g)) urls.push(m[1]);
  for (const m of html.matchAll(/\s(?:srcset|imagesrcset)="([^"]+)"/g))
    for (const part of m[1].split(',')) urls.push(part.trim().split(/\s+/)[0]);
  for (const m of html.matchAll(/\sdata-[a-z0-9-]+="(\/[^"]+\.(?:webp|png|jpg|avif|json))"/g)) urls.push(m[1]);

  for (const u of urls) {
    if (/^(#|mailto:|data:image\/)/.test(u)) continue;
    if (/^[a-z]+:/i.test(u) && !/^https?:/.test(u)) {
      if (!u.startsWith('data:')) fail(file, `unexpected scheme ${u}`);
      continue;
    }
    if (/^https?:/.test(u)) {
      const url = new URL(u);
      if (url.protocol !== 'https:') fail(file, `insecure URL ${u}`);
      if (!ALLOWED_HOSTS.has(url.hostname)) fail(file, `unexpected external host ${url.hostname}`);
      if (url.pathname.includes('/releases/download/') && !url.pathname.startsWith(`/${APP_REPO}/releases/download/`))
        fail(file, `download outside ${APP_REPO}: ${u}`);
      continue;
    }
    if (!u.startsWith('/') && !u.startsWith('.')) continue; // meta content text
    const r = resolveLocal(file, u);
    if (!r) continue;
    if (r.escape) {
      fail(file, `link escapes base ${SITE_BASE}: ${u}`);
      continue;
    }
    const target = existsSync(r.path) && statSync(r.path).isDirectory() ? join(r.path, 'index.html') : r.path;
    if (!existsSync(target)) fail(file, `missing ${u}`);
  }
  // In-page anchors must exist on the page.
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(/\shref="#([^"]+)"/g)) if (!ids.has(m[1])) fail(file, `broken in-page anchor #${m[1]}`);
  // Cross-page anchors.
  for (const m of html.matchAll(new RegExp(`\\shref="${SITE_BASE.replaceAll('/', '\\/')}([^"#]*)#([^"]+)"`, 'g'))) {
    const page = resolve(root, m[1] || '.', m[1].endsWith('.html') ? '' : 'index.html');
    if (existsSync(page)) {
      const other = await readFile(page, 'utf8');
      if (!other.includes(`id="${m[2]}"`)) fail(file, `broken anchor ${SITE_BASE}${m[1]}#${m[2]}`);
    }
  }
}

const KB = 1024;
if (js > 24 * KB) fail(root, `site JavaScript ${(js / KB).toFixed(1)} KiB gzip exceeds 24 KiB`);
if (heroJs > 16 * KB) fail(root, `hero scene ${(heroJs / KB).toFixed(1)} KiB gzip exceeds 16 KiB`);
if (sciJs > 40 * KB) fail(root, `Science page JavaScript ${(sciJs / KB).toFixed(1)} KiB gzip exceeds 40 KiB`);
if (css > 30 * KB) fail(root, `CSS ${(css / KB).toFixed(1)} KiB gzip exceeds 30 KiB`);
if (pages < 4) fail(root, `only ${pages} pages built`);

if (errors.length) {
  console.error(`verify-dist: ${errors.length} problem(s)\n  ` + errors.join('\n  '));
  process.exit(1);
}
console.log(
  `verify-dist: ${pages} pages OK under ${SITE_BASE}; JS ${(js / KB).toFixed(1)} KiB + hero ${(heroJs / KB).toFixed(1)} KiB + science ${(sciJs / KB).toFixed(1)} KiB, CSS ${(css / KB).toFixed(1)} KiB (gzip).`,
);
