import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://fimil.dev',
  trailingSlash: 'never',
  prefetch: {
    defaultStrategy: 'viewport',
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark-default',
    },
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/legal'),
      serialize: (item) => {
        item.lastmod = new Date().toISOString();
        if (item.url === 'https://fimil.dev/') {
          item.priority = 1.0;
          item.changefreq = 'weekly';
        } else if (
          ['/pentest', '/platform', '/pricing', '/compare'].some(
            (p) => item.url.endsWith(p) || item.url.endsWith(p + '/'),
          )
        ) {
          item.priority = 0.9;
          item.changefreq = 'weekly';
        } else if (
          ['/features', '/changelog'].some(
            (p) => item.url.endsWith(p) || item.url.endsWith(p + '/'),
          )
        ) {
          item.priority = 0.8;
          item.changefreq = 'weekly';
        } else if (item.url.includes('/blog')) {
          item.priority = 0.8;
          item.changefreq = 'weekly';
        } else if (
          item.url.includes('/about') ||
          item.url.includes('/contact') ||
          item.url.includes('/security')
        ) {
          item.priority = 0.7;
          item.changefreq = 'monthly';
        }
        return item;
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
