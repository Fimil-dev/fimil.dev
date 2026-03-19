# fimil.dev

Public marketing site for Fimil. Astro 6 + Tailwind CSS v4. Static output deployed to GitHub Pages.

## Commands

```bash
npm run dev      # local dev server :4321
npm run build    # production build to dist/
npm run preview  # preview production build
npm run check    # Astro type checking
npm run lint     # ESLint + Prettier check
npm run test     # Vitest
```

## Architecture

Pages are `.astro` files in `src/pages/`. No React. No client-side JS except theme toggle and mobile nav (`<script is:inline>`).

Blog uses Astro content collections (`src/content/blog/`). Add `.md` files with frontmatter (title, description, date, author, tags, draft).

## Styling

Tailwind CSS v4 via `@tailwindcss/vite`. Theme tokens in `src/styles/global.css` using `@theme` directive. Dark mode uses `@custom-variant dark` with class-based toggling (`.dark` on `<html>`).

Colors: `fimil-*` sky blue palette (50-900). Fonts: IBM Plex Mono (headings), IBM Plex Sans (body).

## Key Rules

- No React components — .astro only
- Client JS only via `<script is:inline>` for theme toggle and mobile nav
- All interactive elements must be keyboard navigable
- Contact form POSTs to `https://app.fimil.dev/api/v1/contact`
- Legal page URLs must match Fimil-Cloud's route constants

## SEO

- `@astrojs/sitemap` generates sitemap automatically
- Each page sets title, description, OG tags, canonical URL via BaseLayout props
- JSON-LD structured data on key pages (Organization, SoftwareApplication, FAQPage)
- `public/robots.txt` allows all crawlers

## Default Branch

`master` (not `main`)
