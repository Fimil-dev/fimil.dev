---
title: 'What Is Fimil? A Unified Approach to Application Security'
description: "Fimil orchestrates 12+ open-source security scanners into a single dashboard, cutting through alert noise so your team fixes what matters. Here's why we built it and how it works."
date: 2026-03-02
author: 'Ethan'
tags: ['product', 'application-security', 'announcement']
---

If you've ever tried to secure a modern application, you know the drill. You set up Semgrep for static analysis. Then Trivy for dependency scanning. Gitleaks for secrets. Checkov for your Terraform files. Maybe Grype as a second opinion on your dependencies. Before you know it, you're managing half a dozen tools, each with its own CLI, its own output format, its own dashboard, and its own wall of alerts.

I built Fimil because I lived that reality for years — and I got tired of it.

## The Problem Nobody Talks About

The application security industry has an embarrassment of riches when it comes to scanners. Open-source tools like Semgrep, Trivy, and Gitleaks are genuinely excellent. They're maintained by talented teams, they're free, and they catch real vulnerabilities.

But here's what nobody tells you: **running great scanners is the easy part. Making sense of the results is the hard part.**

A typical scan of a mid-size application produces hundreds or thousands of findings across multiple tools. Many of those findings are duplicates — Trivy and Grype both flagging the same CVE in the same package. Some are false positives. Some are real but buried under a mountain of low-severity noise. And when you're staring at a spreadsheet trying to figure out which of these 2,000 alerts actually deserves your attention on a Friday afternoon, the fact that each scanner has a different severity scale and output format doesn't help.

I've watched teams respond to this in one of two ways:

1. **Alert fatigue.** They stop looking at security findings altogether because the signal-to-noise ratio is unbearable.
2. **Spreadsheet hell.** They build elaborate manual processes to deduplicate, triage, and track findings across tools — processes that break every time a scanner updates its output format.

Neither outcome is acceptable when you're responsible for the security of production software.

> **The core insight:** The problem isn't the scanners — they're excellent. The problem is that nobody is orchestrating, normalizing, and prioritizing the results across tools.

---

## What Fimil Actually Does

Fimil is a platform that [orchestrates open-source security scanners](/features) behind a single, unified dashboard. Instead of replacing the scanners you already trust, we run them for you and make sense of the results.

Here's the high-level workflow:

1. **Connect your repositories.** Link your GitHub, GitLab, or Bitbucket accounts. Fimil discovers your repos and their tech stacks automatically.

2. **Scan.** Fimil detects what languages, frameworks, and infrastructure-as-code you're using, then runs the appropriate combination of scanners. Each scanner runs in an isolated Docker container with no network access — your code is cloned, scanned, and deleted. We never persist your source code.

3. **Normalize and deduplicate.** Scanner outputs are parsed into a common format. Findings that appear across multiple tools (like the same CVE found by both Trivy and Grype) are merged into a single finding, not listed twice.

4. **Prioritize intelligently.** Not all vulnerabilities are created equal. Fimil scores each finding using a weighted combination of severity, [EPSS](https://www.first.org/epss/) (Exploit Prediction Scoring System), reachability analysis, and finding age. The result is a priority score from 0-100 that tells you what actually needs attention.

5. **Present and act.** You get a single dashboard showing your security posture across all repositories. Filter by severity, category, scanner, or status. Get fix suggestions. Set up auto-triage rules to handle known patterns automatically.

The goal is simple: instead of managing 12 tools and 2,000 alerts, you manage one dashboard and the 15 findings that actually matter.

---

## Who Is Fimil For?

Fimil is built for development teams that care about security but don't want it to become a full-time job.

**Small teams (2-10 developers)** get the most immediate value. You probably don't have a dedicated security engineer, but you know you should be scanning. Fimil lets you set up comprehensive security scanning in under 5 minutes, with a [free tier](/pricing) that covers 3 repositories and 10 scans per month.

**Growing teams (10-50 developers)** benefit from the noise reduction. You might already be running a scanner or two, but the volume of alerts is starting to overwhelm your triage process. Fimil's deduplication and intelligent prioritization cut through that noise so your limited security bandwidth goes to the right issues.

**Security teams at larger organizations** appreciate the unified view. When you're responsible for the security posture of dozens or hundreds of repositories, having a single dashboard that normalizes findings across all scanner types is the difference between staying on top of things and drowning in spreadsheets.

## The Scanners Under the Hood

Fimil currently orchestrates [12+ open-source security scanners](/features) across five categories:

<ul class="tool-grid">
<li><strong>Semgrep</strong> — SAST for 30+ languages</li>
<li><strong>Bandit</strong> — Python security linter</li>
<li><strong>Gosec</strong> — Go security checker</li>
<li><strong>Trivy</strong> — SCA, containers, and more</li>
<li><strong>Grype</strong> — Vulnerability scanner</li>
<li><strong>OSV-Scanner</strong> — Google's vuln database</li>
<li><strong>Gitleaks</strong> — Secrets in git history</li>
<li><strong>TruffleHog</strong> — Deep secrets scanning</li>
<li><strong>Checkov</strong> — IaC policy-as-code</li>
<li><strong>Hadolint</strong> — Dockerfile linter</li>
<li><strong>Trivy Image</strong> — Container image scanning</li>
<li><strong>Syft</strong> — SBOM generation</li>
</ul>

Each scanner is selected because it's best-in-class at what it does. We don't build our own proprietary scanner — we believe the open-source community has already solved the detection problem. Our job is orchestration, normalization, and prioritization.

---

## How Fimil Is Different

There are other application security platforms out there. [Here's how Fimil compares](/compare) to tools like SonarQube, Snyk, and GitHub Advanced Security:

**We orchestrate, we don't reinvent.** Most competitors build their own proprietary scanning engines. That means you're locked into their detection capabilities and their update cycle. Fimil uses the same open-source scanners that millions of developers already trust. When Semgrep ships a new rule pack, you get it immediately.

**We're obsessed with noise reduction.** Running 12 scanners simultaneously would normally mean 12x the alert volume. Fimil's deduplication engine uses content-based fingerprinting to identify when multiple tools find the same issue, and merges them into a single finding. In practice, this reduces alert volume by about 90% compared to running the tools separately.

**Your code stays ephemeral.** Some platforms require you to upload source code to their cloud infrastructure. Fimil clones your repository into an isolated container, runs the scan, and deletes the source code. Nothing is persisted. Nothing is shared. For teams that can't send code to third parties, we also offer [self-hosted deployment](/pricing).

**Two modes for two audiences.** Security engineers want granular detail — CVE IDs, CVSS vectors, affected code paths. Engineering managers want a high-level summary — "are we getting better or worse?" Fimil's Simple and Advanced view modes serve both audiences from the same data.

## Deploy Your Way

Fimil runs as a cloud service at [app.fimil.dev](https://app.fimil.dev) or as a self-hosted deployment on your own infrastructure.

**Fimil Cloud** is multi-tenant SaaS with plans starting at free. You connect your repos, we handle the infrastructure. Scans run on our compute, findings stay in our managed database, and you access everything through the web dashboard or API.

**Fimil Enterprise** is a licensed self-hosted deployment for teams that need full control. Same platform, same features, but running on your Kubernetes cluster. Your source code never touches external infrastructure. Air-gapped deployments are supported.

Both deployment models support the same API, the same CLI tool, and the same CI/CD integrations.

---

## Getting Started

Fimil is currently in private beta. You can [join the waitlist](/#waitlist) to get early access, or [contact our team](/contact) to schedule a demo.

If you want to see the full feature breakdown, check out our [features page](/features). If you're curious about pricing, we have a [transparent pricing page](/pricing) with details on what's included at each tier.

We're building Fimil because we believe application security should be accessible to every development team — not just the ones with dedicated security engineering headcount. If you've ever felt overwhelmed by the number of security tools you're supposed to be running, we built this for you.
