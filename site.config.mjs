// The only place that names the public address and the repositories.
// Changing the website repository name means changing SITE_BASE and WEBSITE_REPO together.
export const SITE_ORIGIN = 'https://ca-works.github.io';
export const SITE_BASE = '/cutout-website/';
export const WEBSITE_REPO = 'ca-works/cutout-website';
// Repository whose GitHub Releases are the only source of downloads, and whose visibility and
// licence decide what the "Free and open source" section says. Read at build time; a private or
// missing repository is shown as "not yet public" and its downloads as "coming soon".
export const APP_REPO = 'ca-works/cutout-app';
