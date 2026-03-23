---
title: 'How Fimil Orchestrates 12+ Open-Source Security Scanners'
description: "A technical deep-dive into Fimil's scanner orchestration architecture: ephemeral Docker containers, output normalization, cross-tool deduplication, and intelligent prioritization with EPSS and reachability analysis."
date: 2026-03-09
author: 'Ethan'
tags: ['engineering', 'scanners', 'architecture']
---

When I tell people that Fimil runs 12+ security scanners on every repository, the first question is usually: "Doesn't that produce an overwhelming number of results?" The short answer is no — and the reason comes down to how we orchestrate, normalize, and deduplicate across tools.

This post walks through the technical architecture behind Fimil's scan pipeline, from the moment you trigger a scan to the moment prioritized findings appear in your dashboard.

## The Scan Lifecycle

Every scan in Fimil follows a six-stage pipeline:

<div class="info-card">
<strong>Clone → Detect → Scan → Normalize → Deduplicate → Prioritize</strong>
<br>Each stage runs automatically with minimal configuration. Let's walk through them.
</div>

---

## Stage 1: Clone

When a scan is triggered — either manually, via webhook on push, or on a schedule — Fimil clones the target repository into a temporary workspace. This clone is ephemeral: it exists only for the duration of the scan and is deleted immediately after.

For pull request scans, Fimil clones both the head branch and the base branch. This enables differential analysis later in the pipeline — separating new findings introduced in the PR from pre-existing issues in the codebase.

The clone happens over authenticated HTTPS using the OAuth tokens from your Git provider integration (GitHub, GitLab, or Bitbucket). Fimil supports repositories up to the limits of your Git provider.

## Stage 2: Detect

Before running any scanners, Fimil's **Project Detector** analyzes the cloned repository to understand what it contains. This stage answers three questions:

1. **What languages and frameworks are present?** — We look for manifest files (`package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, `pom.xml`, etc.), file extensions, and framework-specific config files.

2. **Is there infrastructure-as-code?** — We check for Terraform files (`.tf`), CloudFormation templates, Kubernetes manifests, Helm charts, Ansible playbooks, and Docker Compose files.

3. **Are there container images to scan?** — We look for Dockerfiles and extract image references from Kubernetes manifests and Docker Compose files.

The detection results determine which scanners will run. A Python web application with Terraform infrastructure will trigger Semgrep (SAST), Bandit (Python SAST), Trivy (SCA), Gitleaks (secrets), Checkov (IaC), and potentially Hadolint if Dockerfiles are present. A pure Go service without IaC might only trigger Semgrep, Gosec, Trivy, and Gitleaks.

This adaptive approach means you don't need to configure which scanners to run — Fimil figures it out from your codebase. If you want more control, [Scanner Profiles](/features) let you define reusable configurations that override the defaults.

## Stage 3: Scan

This is where the actual security analysis happens. Each selected scanner runs in its own **ephemeral Docker container** with strict isolation:

```
┌─────────────────────────────────────────────┐
│  Host (Fimil Worker)                        │
│                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Semgrep  │ │  Trivy   │ │ Gitleaks │    │
│  │          │ │          │ │          │    │
│  │ /scan    │ │ /scan    │ │ /scan    │    │
│  │ (ro)     │ │ (ro)     │ │ (ro)     │    │
│  │          │ │          │ │          │    │
│  │ /output  │ │ /output  │ │ /output  │    │
│  │ (rw)     │ │ (rw)     │ │ (rw)     │    │
│  └──────────┘ └──────────┘ └──────────┘    │
│   --net=none   --net=none   --net=none      │
└─────────────────────────────────────────────┘
```

Each container gets:

- **Read-only source mount** at `/scan` — the scanner can read your code but can't modify it
- **Writable output mount** at `/output` — where the scanner writes its JSON results
- **No network access** (`--network=none`) — scanners can't phone home or exfiltrate data
- **Resource limits** — CPU and memory caps prevent runaway processes from affecting other scans
- **Timeout enforcement** — if a scanner hangs, the container is killed after a configurable timeout

This isolation model is a core security property of Fimil. Your source code is never exposed to the internet during scanning, and each scanner operates in its own sandbox. A compromised or misbehaving scanner image can't affect other scanners, access the host system, or leak data.

### Scanner Execution

Each scanner is implemented as a subclass of `BaseScanner` with three key methods:

- `should_run(project_info)` — determines if this scanner is relevant for the detected project
- `get_docker_command(source_path, output_path)` — generates the Docker command to execute
- `parse_output(output_path)` — transforms the scanner's native JSON output into Fimil's internal `RawFinding` format

For example, here's what the Semgrep scanner execution looks like conceptually:

```
Command: semgrep --config=auto --json -o /output/results.json /scan
Timeout: 600 seconds
Memory:  2GB max
CPU:     2 cores max
Network: none
```

The scanner writes its results to `/output/results.json`, and Fimil's parser extracts findings in a normalized format.

### Parallel vs Sequential Execution

Scanners run concurrently where possible. SAST scanners (Semgrep, Bandit, Gosec) analyze source code and can run in parallel with SCA scanners (Trivy, Grype) that analyze dependency manifests. Secrets scanners (Gitleaks, TruffleHog) also run independently.

The scan orchestrator manages this parallelism, coordinating container lifecycle and collecting results as each scanner completes.

> **Key security property:** Your source code is never exposed to the internet during scanning. Each scanner runs in its own sandbox with no network access. A compromised scanner image can't affect other scanners, access the host, or leak data.

---

## Stage 4: Normalize

Different scanners produce wildly different output formats. Semgrep emits SARIF-like JSON with rule IDs and metavariable bindings. Trivy produces JSON with a nested vulnerability array per target. Gitleaks outputs a flat array of secret findings with commit-level metadata. Checkov emits passed/failed check results grouped by runner type.

Fimil's normalization layer transforms all of these into a common internal representation with consistent fields:

- **Title** — human-readable finding name
- **Description** — detailed explanation of the issue
- **Severity** — normalized to a five-level scale: Critical, High, Medium, Low, Info
- **Category** — SAST, SCA, Secrets, IaC, or Container
- **File path and line number** — where the issue was found
- **Tool** — which scanner produced the finding
- **Rule ID** — the scanner's internal rule identifier
- **CVE/CWE IDs** — when available
- **Package name and version** — for SCA findings
- **Fingerprint** — a content-based hash for deduplication (more on this below)

---

Severity normalization is particularly important. Semgrep uses `ERROR`/`WARNING`/`INFO`. Trivy uses `CRITICAL`/`HIGH`/`MEDIUM`/`LOW`/`UNKNOWN`. Checkov uses `HIGH`/`MEDIUM`/`LOW`. Gitleaks doesn't assign severity at all (all secrets are treated as high severity). Fimil maps all of these to a consistent five-level scale using tool-specific logic, so you can meaningfully compare and filter findings across scanners.

## Stage 5: Deduplicate

This is where the magic happens — and it's the stage that delivers the 90% noise reduction we advertise.

### The Duplication Problem

When you run 12 scanners on the same codebase, you get a lot of overlap:

- **Trivy and Grype** both scan dependency manifests for known CVEs. They often find the exact same vulnerability in the exact same package version.
- **Trivy and OSV-Scanner** pull from different vulnerability databases but frequently overlap on well-known CVEs.
- **Semgrep and Bandit** both perform static analysis on Python code. Some findings (like use of `eval()` or weak cryptographic functions) will be flagged by both tools.
- **Gitleaks and TruffleHog** both scan for hardcoded secrets. A leaked API key in your codebase will appear in both outputs.

Without deduplication, a team scanning a typical Node.js application might see 200 findings from Trivy, 180 from Grype, and 150 from OSV-Scanner — with 60-70% overlap between them. That's over 500 findings when the real count of unique issues is closer to 150.

### Content-Based Fingerprinting

Fimil generates a **canonical fingerprint** for each finding based on its essential properties — not its scanner-specific metadata. The fingerprint algorithm varies by finding category:

- **SCA findings**: Fingerprint is based on CVE ID + package name + package version. This means the same CVE found by Trivy, Grype, and OSV-Scanner produces the same fingerprint.
- **SAST findings**: Fingerprint is based on rule pattern + file path + code snippet hash. A SQL injection finding at the same location produces the same fingerprint regardless of whether Semgrep or Bandit found it.
- **Secrets findings**: Fingerprint is based on secret type + partial secret hash + file path. The same leaked key found by Gitleaks and TruffleHog maps to one fingerprint.
- **IaC findings**: Fingerprint is based on check ID + resource identifier + file path.

When multiple scanners produce findings with the same fingerprint, they're merged into a single **Finding** in the database. The individual scanner results are preserved as **FindingOccurrences** — so you can always see which tools detected the issue — but the dashboard, API, and notifications treat it as one finding.

### Cross-Tool Correlation

Beyond simple fingerprint matching, Fimil also correlates findings across categories. A `FindingCorrelation` links related findings — for example, a vulnerable dependency (SCA finding) that's actually imported and used in a code path flagged for injection (SAST finding). These correlations help security teams understand the full risk picture rather than looking at isolated findings.

## Stage 6: Prioritize

After deduplication, the remaining unique findings are scored using Fimil's **priority scoring algorithm**. This is a weighted score from 0 to 100 that combines four signals:

### Severity (60% weight)

The normalized severity of the finding is the strongest signal. Critical findings start with a high base score, Info findings start low. This is table stakes — every security tool does this.

### EPSS Score (5% weight)

For findings with associated CVEs, Fimil fetches the [Exploit Prediction Scoring System](https://www.first.org/epss/) score from FIRST.org. EPSS predicts the probability that a vulnerability will be exploited in the wild within the next 30 days. A critical-severity CVE with a 0.1% EPSS score is very different from one with a 95% EPSS score — and your prioritization should reflect that.

EPSS scores are cached in Redis with a 24-hour TTL to avoid hammering the FIRST.org API.

### Reachability (15% weight)

For SCA findings, Fimil performs **reachability analysis** by parsing your project's lockfiles (package-lock.json, yarn.lock, poetry.lock, go.sum, Cargo.lock, and others). A vulnerability in a direct dependency that your code imports and calls is more urgent than one buried three levels deep in a transitive dependency that's only used at build time.

Fimil classifies each SCA finding as either a **direct** or **transitive** dependency and adjusts the priority score accordingly.

### Finding Age (20% weight)

Newly introduced vulnerabilities get a priority boost. A critical CVE that appeared in yesterday's commit is more actionable than one that's been sitting in your codebase for six months. The age signal encourages teams to address new issues before they become entrenched technical debt.

### The Combined Score

The final priority score determines the order in which findings appear in your dashboard. The weighting is designed so that:

- A critical-severity, high-EPSS, directly-reachable, recently-introduced vulnerability scores near 100
- A low-severity, zero-EPSS, transitively-reachable, year-old finding scores near 0
- Everything else falls on a spectrum between them

Both the score and the individual contributing factors are stored on each finding, so you can always understand _why_ a finding is ranked where it is.

---

## PR-Aware Scanning

When Fimil scans a pull request, the pipeline includes an additional comparison step. The scan runs on both the head branch (the PR) and the base branch (what you're merging into), and findings are categorized as:

- **New** — findings present in the head branch but not in the base branch (introduced by this PR)
- **Fixed** — findings present in the base branch but not in the head branch (resolved by this PR)
- **Unchanged** — findings present in both branches (pre-existing)

> **The math is simple:** New = head - base. Fixed = base - head. Unchanged = intersection.

This differential view is critical for PR review workflows. A policy that says "no new critical vulnerabilities in PRs" can be enforced via Fimil's `PolicyEvaluator` — it only evaluates the _new_ findings, not the pre-existing ones. The result is reported as a GitHub Check Run, GitLab commit status, or Bitbucket build status, so developers get immediate feedback in their PR without leaving their Git provider.

## What Happens to Your Code

I want to be explicit about the data lifecycle, because it matters:

1. Your source code is cloned into a temporary directory on the scan worker
2. Source code is mounted read-only into scanner containers
3. Scanners produce JSON output files (findings, not source code)
4. Source code is deleted immediately after all scanners complete
5. Only the normalized findings (metadata, not code) are stored in the database

Fimil never persists your source code. The clone exists only during the scan and is deleted as part of the orchestrator's cleanup step. Scanner containers have no network access, so your code can't be exfiltrated during the scan.

For teams that require even stronger guarantees, [Fimil Enterprise](/pricing) runs entirely on your own infrastructure — source code never leaves your network.

## Extending the Pipeline

The orchestration architecture is designed to be extensible. Adding a new scanner requires implementing three methods (`should_run`, `get_docker_command`, `parse_output`) and registering the scanner. The container isolation model means any tool that can run in Docker and produce JSON output can be integrated.

We're continuously evaluating new open-source scanners to add to the pipeline. The community builds incredible security tools — our job is to make them work together.

---

Want to see this pipeline in action on your own repositories? [Join the waitlist](/#waitlist) for early access, or check out the [full feature list](/features) to see what's included at each tier.
