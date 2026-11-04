import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { SITE_ORIGIN, SITE_BASE } from './site.config.mjs';

export default defineConfig({
  site: SITE_ORIGIN,
  base: SITE_BASE,
  trailingSlash: 'always',
  output: 'static',
  compressHTML: true,
  devToolbar: { enabled: false },
  prefetch: false,
  build: {
    // External stylesheets only, so the Content-Security-Policy can forbid inline styles.
    inlineStylesheets: 'never',
    assets: '_assets',
  },
  integrations: [sitemap({ filter: (page) => !page.includes('/404') })],
  vite: {
    build: {
      // Never turn fonts or images into data: URIs; every asset is a same-origin file.
      assetsInlineLimit: 0,
    },
  },
});
