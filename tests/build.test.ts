import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';

describe('project config', () => {
  it('has required config files', () => {
    expect(existsSync('astro.config.mjs')).toBe(true);
    expect(existsSync('tsconfig.json')).toBe(true);
    expect(existsSync('package.json')).toBe(true);
  });

  it('has correct site URL in astro config', () => {
    const config = readFileSync('astro.config.mjs', 'utf-8');
    expect(config).toContain("site: 'https://fimil.dev'");
  });

  it('has robots.txt', () => {
    const robots = readFileSync('public/robots.txt', 'utf-8');
    expect(robots).toContain('Sitemap: https://fimil.dev/sitemap-index.xml');
  });
});
