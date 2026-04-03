---
title: "We Open-Sourced Our Trust Center — Here's Why"
description: "Fimil's Trust Center is now MIT-licensed and free for any startup to fork and deploy. One config file, no backend, no CMS. Here's why we built it and how you can use it."
date: 2026-04-03
author: 'Ethan'
tags: ['open-source', 'compliance', 'trust-center', 'startups']
---

Every startup hits the same wall eventually. A prospect sends over a security questionnaire — 200 questions about your data handling, encryption, access controls, incident response. You scramble to answer it in a Google Doc. Then another prospect sends a different questionnaire. And another. Before you know it, you're spending 10 hours a week on security questionnaires instead of building your product.

The standard advice is to set up a Trust Center — a public page that answers the most common security questions proactively. The problem? The tools that do this well (SafeBase, Vanta Trust Center, Drata Trust) cost $5,000-$15,000 per year. For an early-stage startup, that's absurd. You're paying enterprise prices to host what's essentially a static webpage.

So we built our own. And then we open-sourced it.

## What the Trust Center Does

[Fimil's Trust Center](https://github.com/Fimil-dev/trust-center) is a static site that you configure with a single TypeScript file. No backend, no database, no CMS. Edit `trust.config.ts`, run the build, deploy anywhere.

It covers everything prospects and auditors ask about:

- **Compliance frameworks** — SOC 2, ISO 27001, HIPAA, PCI DSS, GDPR, or anything else. Show your status (certified, in-progress, planned) with visual progress indicators.
- **Security controls** — Organized by domain (Data Protection, Access Control, Infrastructure, etc.) with implementation status for each control.
- **Subprocessors** — Third-party vendors, their purpose, location, and links to DPA agreements.
- **Policy documents** — Privacy policy, terms of service, DPA, SLA, security policy. Link them or host them.
- **Security questionnaires** — Pre-answered MVSP, CAIQ, VSA Core, and VSA Full questionnaires with downloadable PDFs.
- **Contact** — A clear CTA for prospects to reach your security team.

The config is validated at build time with Zod. If you fat-finger a field, the build fails with a clear error message pointing to exactly what's wrong. No silent misconfigurations.

## The Technical Stack

We kept it intentionally simple:

- **[Astro](https://astro.build)** — Static site generator that ships zero JavaScript by default
- **[Tailwind CSS v4](https://tailwindcss.com)** — Styling
- **[Zod](https://zod.dev)** — Config validation

The only client-side JavaScript is a 10-line theme toggle. Everything else renders at build time. The result is a page that loads instantly and costs nothing to host.

Deploy it to GitHub Pages, Cloudflare Pages, Vercel, Netlify — anywhere that serves static files.

## Why Open Source?

Three reasons.

**1. Trust Centers should be commoditized, not monetized.**

A Trust Center is not a product differentiator. It's table stakes. Charging $10K/year for one is rent-seeking on compliance anxiety. The sooner every startup has a decent Trust Center, the sooner we can stop wasting time on repetitive security questionnaires and focus on actual security.

**2. We build security tools. Credibility matters.**

Fimil is an application security platform. If we're asking people to trust us with their security scanning, open-sourcing our own security documentation tooling is the least we can do. It's a proof of work — you can see exactly how we think about security controls, compliance, and transparency.

**3. Community compounds.**

An MIT-licensed Trust Center template that works well will get forked, improved, and shared. Every company that uses it and links back to Fimil is organic awareness. Every GitHub star is social proof. Every pull request improving the template makes it better for everyone, including us.

We're not naive about this — open source is a distribution strategy. But it's one that creates genuine value, which is the only kind of distribution that compounds.

## How to Get Started

It takes about 30 minutes to go from fork to deployed:

```bash
git clone https://github.com/Fimil-dev/trust-center.git
cd trust-center
npm install
```

Open `trust.config.ts` and replace our information with yours:

```typescript
export const config = {
  company: {
    name: 'Your Company',
    securityEmail: 'security@yourcompany.com',
    privacyEmail: 'privacy@yourcompany.com',
    website: 'https://yourcompany.com',
    logo: '/your-logo.svg',
  },
  theme: {
    primary: '#2563eb', // Your brand color
    headingFont: 'Inter',
    bodyFont: 'Inter',
  },
  frameworks: [
    {
      name: 'SOC 2 Type II',
      status: 'in-progress',
      description: 'Pursuing SOC 2 Type II certification...',
    },
    // Add your frameworks
  ],
  controls: [
    // Your security controls by domain
  ],
  subprocessors: [
    // Your third-party vendors
  ],
  // ... more config
};
```

Preview locally:

```bash
npm run dev
```

Build and deploy:

```bash
npm run build
# Deploy dist/ to any static host
```

The [README](https://github.com/Fimil-dev/trust-center) has detailed setup instructions, deployment guides for every major platform, and a full config reference.

## What's Next

We're actively improving the Trust Center based on feedback:

- **More questionnaire frameworks** — We ship with MVSP, CAIQ, VSA Core, and VSA Full. We'd love contributions for SIG Lite, HECVAT, and others.
- **Auto-generated PDF reports** — Already working. Each questionnaire generates a downloadable, branded PDF.
- **Better mobile experience** — It works on mobile now, but there's room to improve the responsive design for the control detail pages.

If you build something with it, we'd love to hear about it. Open an issue, submit a PR, or just drop us a note at security@fimil.dev.

The repo is at [github.com/Fimil-dev/trust-center](https://github.com/Fimil-dev/trust-center). Star it if it's useful — it helps other startups find it.

---

_Fimil is a unified application security platform that orchestrates 12+ open-source scanners into a single dashboard. We're currently in private beta — [join the waitlist](https://fimil.dev/#waitlist) for early access._
