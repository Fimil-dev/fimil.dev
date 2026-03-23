---
title: 'SAST vs SCA vs Secrets Detection vs IaC Scanning: A Practical Guide'
description: 'A practical breakdown of the five categories of application security testing — SAST, SCA, secrets detection, IaC scanning, and container security. What each one catches, when you need it, and how they work together.'
date: 2026-03-16
author: 'Fimil Team'
tags: ['guides', 'application-security', 'sast', 'sca', 'secrets-detection', 'iac']
---

Application security testing isn't one thing — it's at least five different things, each catching a fundamentally different class of vulnerability. Most teams know they should be "scanning their code," but the landscape of tools and acronyms can be overwhelming. SAST, SCA, DAST, IAST, SBOM, IaC — it starts to feel like alphabet soup.

This guide breaks down the five categories of application security testing that matter most for modern development teams. For each one, we'll cover what it is, what it catches, what it misses, and which open-source tools are best-in-class. By the end, you'll have a clear mental model for what a comprehensive security testing strategy looks like.

## SAST: Static Application Security Testing

<div class="info-card">
<strong>What it does:</strong> Analyzes your source code without executing it, looking for patterns that indicate security vulnerabilities.
</div>

### What it catches

SAST tools parse your code into an abstract syntax tree (AST) and search for patterns that match known vulnerability signatures. The kinds of issues SAST finds include:

- **Injection vulnerabilities** — SQL injection, command injection, XSS, and other cases where user input flows into dangerous functions without sanitization
- **Insecure cryptography** — Use of weak algorithms (MD5, SHA1 for security-sensitive operations), hardcoded encryption keys, insufficient key lengths
- **Authentication flaws** — Missing authentication checks on sensitive endpoints, insecure session management, improper credential handling
- **Unsafe deserialization** — Deserializing untrusted data that could lead to remote code execution
- **Path traversal** — File system operations using unsanitized user input
- **Race conditions** — Time-of-check-to-time-of-use (TOCTOU) bugs in concurrent code

Here's a concrete example. A SAST scanner would flag this Python code:

```python
@app.route("/users")
def get_user():
    user_id = request.args.get("id")
    query = f"SELECT * FROM users WHERE id = {user_id}"  # SQL injection
    result = db.execute(query)
    return jsonify(result)
```

The tool recognizes that `request.args.get()` is a user-input source and `db.execute()` is a dangerous sink, and that the data flows from source to sink without sanitization.

### What it misses

SAST operates on code patterns, not runtime behavior. It can't detect vulnerabilities that only manifest at runtime (like misconfigured authentication middleware), issues in dynamically-generated code, or business logic flaws. It also tends to produce false positives on complex data flows where sanitization happens in a non-obvious way.

### Best open-source tools

<ul class="tool-grid">
<li><strong>Semgrep</strong> — Pattern-based analysis supporting 30+ languages. Fast, low false-positive rate.</li>
<li><strong>Bandit</strong> — Python-specific security linter. Catches Python security anti-patterns.</li>
<li><strong>Gosec</strong> — Go-specific security checker. Understands Go concurrency pitfalls.</li>
</ul>

> **When you need it:** Always. SAST is the foundation of any application security program. If you're only going to run one type of security testing, make it SAST.

---

## SCA: Software Composition Analysis

<div class="info-card">
<strong>What it does:</strong> Scans your project's dependencies (third-party libraries, packages, modules) for known vulnerabilities by checking them against the NVD and GitHub Advisory Database.
</div>

### What it catches

SCA tools read your dependency manifests and lockfiles, then cross-reference each package and version against known CVE databases:

- **Known CVEs in direct dependencies** — Vulnerabilities in the libraries you explicitly import, like a remote code execution bug in a specific version of `lodash` or `log4j`
- **Known CVEs in transitive dependencies** — Vulnerabilities in the dependencies of your dependencies. Your app doesn't import `minimist` directly, but `webpack` does, and that version of `minimist` has a prototype pollution vulnerability
- **License compliance issues** — Some SCA tools also flag dependencies with licenses that conflict with your project's license requirements (GPL in a proprietary project, for example)
- **Outdated packages** — Identifying dependencies that are significantly behind the latest version, which often correlates with unpatched vulnerabilities

Here's what an SCA finding looks like in practice:

```
Package:   express
Version:   4.17.1
CVE:       CVE-2024-XXXXX
Severity:  High
Fixed In:  4.18.2
Summary:   Open redirect vulnerability in express.static middleware
```

The fix is typically straightforward: update the package to a version where the CVE is patched.

### What it misses

SCA only knows about _known, published_ vulnerabilities. A zero-day in one of your dependencies won't be flagged until a CVE is issued. SCA also can't tell you if a vulnerable function in a dependency is actually _reachable_ from your code — a critical distinction that [reachability analysis](/features) addresses.

### Best open-source tools

<ul class="tool-grid">
<li><strong>Trivy</strong> — Scans dependencies, container images, IaC, and more. Supports virtually every package ecosystem.</li>
<li><strong>Grype</strong> — Anchore's vulnerability scanner. Excellent accuracy, fast scanning.</li>
<li><strong>OSV-Scanner</strong> — Google's scanner using the Open Source Vulnerabilities database.</li>
</ul>

> **When you need it:** As soon as you have any third-party dependencies — which is every modern project.

### Why Run Multiple SCA Scanners?

You might wonder why Fimil runs Trivy, Grype, _and_ OSV-Scanner when they all do SCA. The answer is coverage. Each tool pulls from slightly different vulnerability databases and uses different matching algorithms. Trivy might catch a CVE that Grype misses because it hasn't been added to Grype's database yet, and vice versa. Running multiple tools and [deduplicating the results](/blog/how-fimil-orchestrates-security-scanners) gives you the broadest possible coverage without the noise of seeing the same CVE three times.

---

## Secrets Detection

<div class="info-card">
<strong>What it does:</strong> Scans your codebase and git history for hardcoded secrets — API keys, passwords, tokens, private keys, and other credentials that shouldn't be in source code.
</div>

### What it catches

Secrets scanners use a combination of pattern matching (regex), entropy analysis (detecting high-entropy strings that look like keys), and known key format detection:

- **API keys** — AWS access keys (`AKIA...`), Google Cloud service account keys, Stripe keys (`sk_live_...`), Slack tokens (`xoxb-...`), and hundreds of other vendor-specific formats
- **Database credentials** — Connection strings with embedded passwords, hardcoded database passwords in config files
- **Private keys** — SSH private keys, TLS/SSL certificates with private keys, PGP private keys
- **OAuth tokens** — GitHub personal access tokens, GitLab tokens, Bitbucket app passwords
- **Generic passwords** — Variables named `password`, `secret`, or `api_key` with hardcoded string values

This is one of the most critical scanning categories because **leaked secrets in git history persist forever** — even if you delete the file in a later commit, the secret is still in the git log. Here's a common example:

```python
# config.py
AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE"
AWS_SECRET_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
```

Even if a developer catches this in code review and removes it in the next commit, both keys are permanently in the git history. An attacker with read access to the repository can find them by searching the history.

### What it misses

Secrets scanners can't detect credentials stored in external secret management systems (which is the correct approach). They can also struggle with custom secret formats that don't match known patterns, and with secrets that are split across multiple variables or config files. False positives are common with entropy-based detection — randomly generated IDs and test fixtures often look like secrets.

### Best open-source tools

<ul class="tool-grid">
<li><strong>Gitleaks</strong> — Fast, configurable secrets scanner with git history support. Great for CI/CD pipelines.</li>
<li><strong>TruffleHog</strong> — Deep scanning with secret verification — it can check if a detected key is still valid.</li>
</ul>

> **When you need it:** If your code has ever touched a credential — and it has — you need secrets detection. Scan git history, not just the current state of the code.

> **Pro tip:** Even if you're diligent about never committing secrets, run a one-time full history scan. You'd be surprised what you find from before `.gitignore` rules were in place.

---

## IaC Scanning: Infrastructure as Code Security

<div class="info-card">
<strong>What it does:</strong> Analyzes your infrastructure-as-code templates (Terraform, CloudFormation, Kubernetes manifests, Helm charts, Dockerfiles) for security misconfigurations.
</div>

### What it catches

IaC scanners check your infrastructure definitions against security best practices and compliance frameworks:

- **Overly permissive IAM policies** — S3 buckets with public read access, IAM roles with `*:*` permissions, security groups allowing 0.0.0.0/0 ingress
- **Missing encryption** — Unencrypted EBS volumes, S3 buckets without server-side encryption, RDS instances without encryption at rest
- **Insecure defaults** — Databases accessible from the public internet, containers running as root, Kubernetes pods without security contexts
- **Compliance violations** — Configurations that violate CIS benchmarks, SOC2 controls, PCI-DSS requirements, or HIPAA safeguards
- **Dockerfile issues** — Running as root, using `latest` tag (no version pinning), copying secrets into images, missing health checks

Here's a Terraform example that would be flagged:

```hcl
resource "aws_s3_bucket" "data" {
  bucket = "company-sensitive-data"
  # Missing: encryption configuration
  # Missing: public access block
  # Missing: versioning
  # Missing: logging
}
```

An IaC scanner would flag this bucket for missing encryption, no public access block, no versioning, and no access logging — four distinct security issues, all catchable before the infrastructure is provisioned.

### What it misses

IaC scanners analyze the _definitions_, not the _running infrastructure_. They can't detect drift (where the actual cloud state has diverged from the code), runtime misconfigurations made manually in the cloud console, or vulnerabilities in the applications running on the infrastructure.

### Best open-source tools

<ul class="tool-grid">
<li><strong>Checkov</strong> — The most comprehensive IaC scanner. Supports Terraform, CloudFormation, Kubernetes, Helm, and more. Built-in CIS/SOC2/PCI-DSS mappings.</li>
<li><strong>Hadolint</strong> — Specialized Dockerfile linter. Catches privilege escalation and inefficient layer caching.</li>
</ul>

> **When you need it:** As soon as you manage infrastructure through code. Catching a publicly-accessible S3 bucket in code review is infinitely cheaper than discovering it after a data breach.

---

## Container Security

<div class="info-card">
<strong>What it does:</strong> Scans container images (Docker images) for vulnerabilities in the base OS packages and application-level libraries installed in the image.
</div>

### What it catches

Container image scanning examines the layers of a built container image to find:

- **OS-level vulnerabilities** — Outdated packages in the base image (Alpine, Debian, Ubuntu). A `python:3.11-slim` base image might have 20 known CVEs in its system libraries
- **Application-level vulnerabilities** — Libraries installed via `pip install`, `npm install`, or `apt-get install` inside the Dockerfile
- **Misconfigurations** — Images running as root, missing health checks, excessive capabilities
- **Malware** — Some scanners can detect known malicious packages or backdoors in image layers

Container scanning is distinct from SCA because it scans the _built artifact_, not just the dependency manifest. Your `requirements.txt` might specify `flask>=2.0`, but the actual version installed in the container could be different. Container scanning sees what's actually in the image.

### What it misses

Container scanners analyze images at rest, not running containers. They can't detect runtime attacks, container escapes, or dynamic behavior. They also can't see into encrypted or obfuscated content within the image.

### Best open-source tools

<ul class="tool-grid">
<li><strong>Trivy</strong> — The same Trivy used for SCA also excels at container image scanning. Fast, comprehensive.</li>
<li><strong>Grype</strong> — Also supports container image scanning alongside dependency scanning.</li>
</ul>

> **When you need it:** If you deploy containers — and most modern applications do — you need container image scanning. Base images accumulate vulnerabilities silently over time.

---

## How They All Fit Together

Each scanning category catches a different class of vulnerability:

| Category  | What It Analyzes        | What It Catches                          |
| --------- | ----------------------- | ---------------------------------------- |
| SAST      | Your source code        | Code-level bugs (injection, XSS, crypto) |
| SCA       | Your dependencies       | Known CVEs in libraries                  |
| Secrets   | Your code + git history | Hardcoded credentials                    |
| IaC       | Your infra definitions  | Cloud misconfigurations                  |
| Container | Your built images       | OS and image-level CVEs                  |

None of these categories is a substitute for another. A codebase can have perfect SAST results (no injection vulnerabilities in your own code) while having critical SCA findings (a dependency with a known RCE) and leaked secrets in the git history. A comprehensive security testing strategy runs all five categories.

The challenge, of course, is that running five categories of scanners — potentially 12+ individual tools — produces a massive volume of findings. Many of those findings are duplicates across tools, and the noise can be paralyzing.

> **Bottom line:** No single scanning category covers everything. A comprehensive strategy needs all five.

This is exactly the problem [Fimil](/features) solves. We orchestrate all of these scanner categories behind a single dashboard, [deduplicate findings across tools](/blog/how-fimil-orchestrates-security-scanners), and prioritize using EPSS scores and reachability analysis so you see the 15 findings that matter — not the 2,000 that don't.

---

## A Practical Starting Point

If you're just getting started with application security testing, here's a pragmatic order of operations:

1. **Start with SCA.** It's the easiest to set up (just point it at your lockfiles) and often reveals critical vulnerabilities with straightforward fixes (update a package version). The ROI is immediate.

2. **Add secrets detection.** Run it once against your full git history — you might be surprised what you find. Then add it to CI to prevent new secrets from being committed.

3. **Add SAST.** Start with Semgrep using the `--config=auto` rule set. It has a low false-positive rate and catches the most impactful patterns. Tune from there.

4. **Add IaC scanning** if you have infrastructure-as-code. Checkov's default rules catch the most common cloud misconfigurations.

5. **Add container scanning** if you deploy containers. Scan your images as part of your CI/CD pipeline so vulnerabilities are caught before deployment.

Or skip the incremental setup and [let Fimil run all of them at once](/#waitlist). We'll figure out which scanners your codebase needs, run them, deduplicate the results, and show you what matters. You can [compare how this stacks up](/compare) against running individual tools or using alternative platforms.

---

Have questions about which scanning categories your team should prioritize? [Get in touch](/contact) — we're happy to help you build a security testing strategy that fits your stack and your team size.
