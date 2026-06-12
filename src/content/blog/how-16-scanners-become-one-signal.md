---
title: 'How 16 scanners become one signal: fingerprints, finding groups, and priority math'
description: 'Run two scanners on one repo and most findings are duplicates. How Fimil fingerprints, groups, and scores findings so 16 scanners produce one ranked list.'
date: 2026-06-12
author: Ethan Aldrich
tags: [engineering, deduplication, prioritization]
---

Here is an experiment you can run in ten minutes. Pick any Node.js repository with a lockfile, run Trivy against it, then run Grype against the same directory. Dump both outputs to JSON and diff the CVE lists.

Most of the entries are the same. Both tools pull from overlapping vulnerability databases — NVD, the GitHub Advisory Database, OSV — so the same `lodash` prototype-pollution CVE shows up in both outputs, with different severity labels, different field names, and sometimes a GHSA ID in one where the other reports the CVE. To a human, it is obviously one issue. To a dashboard that ingests both files naively, it is two findings. Add OSV-Scanner as a third opinion and it is three.

Fimil runs [16 integrated scanners](/platform). If each one dumped its raw output into a shared list, the platform would be a noise amplifier — strictly worse than running one tool. The whole value of orchestrating that many scanners depends on collapsing their outputs into one deduplicated, correlated, ranked list. This post walks through how that works.

## Normalize first, fingerprint second

You cannot deduplicate what you cannot compare. Before any matching happens, every scanner's native output is parsed into one internal schema: title, severity on a five-level scale, category (SAST, SCA, secrets, IaC, container, DAST), file path and line, package name and version, CVE and CWE IDs where they exist. Severity mapping is tool-specific — Semgrep's `ERROR` is not Trivy's `CRITICAL`, and Gitleaks does not assign severity at all — so each parser owns its own mapping into the common scale.

Once everything is in one schema, Fimil computes a **canonical fingerprint** for each finding: a SHA-256 over the attributes that identify the underlying issue, deliberately excluding the attributes that identify the scanner. The recipe varies by category:

- **SCA and container findings** hash on package name plus CVE ID (package lowercased, CVE uppercased). Same CVE in the same package equals the same finding, whether Trivy, Grype, or OSV-Scanner reported it, and regardless of which severity label the tool attached.
- **SAST findings** hash on file path, a line bucket, and a canonical rule category. Two static analyzers rarely report the same rule ID — Semgrep and Bandit have completely different rule taxonomies — so tool-specific rule IDs are mapped to canonical categories first, and line numbers are bucketed so a one-line drift between tools does not break the match.
- **Secrets findings** hash on file path plus a canonical secret type. The same AWS key flagged by Gitleaks and TruffleHog collapses to one fingerprint.
- **IaC findings** hash on file path, line, and rule category.

Findings that share a canonical fingerprint merge into a single **finding group**. The per-tool results are preserved underneath it, so you can always see that three scanners independently flagged the issue — cross-tool agreement is itself signal. But the dashboard, the API, the notifications, and the priority math all operate on the group, not the raw findings.

## Finding groups: correlation across categories

Fingerprints catch the case where two tools find the _same_ issue. Correlation catches the case where two tools find _related_ issues that a human would want to read together. Fimil links findings with four correlation types:

**Same location.** Two SAST tools flag the same file and overlapping lines under different rule taxonomies — Semgrep's injection rule and Bandit's `B608` on the same query-building line. If the canonical rule categories differ they will not fingerprint-merge, but the location overlap is recorded, so you triage the line once.

**Code plus vulnerable dependency.** An SCA finding says `requests` has a CVE; a SAST finding flags your code making an unverified TLS call through that same package. Separately, each is a line item. Together, they are a story: your code actively exercises the vulnerable library. This is the correlation that most changes triage decisions — it converts "a CVE exists somewhere in the lockfile" into "this file, this call."

**IaC plus container.** Checkov flags a Terraform resource that builds or deploys an image; Trivy's image scan flags vulnerabilities inside that image. The misconfiguration and the artifact it produced are linked, so the fix conversation happens once — usually at the Terraform layer, where the rebuild originates.

**Shared CVE or CWE across artifacts.** The same CVE appearing in your `package-lock.json` and inside a container image layer, or the same CWE pattern recurring across files. One advisory, every place it manifests, in one view.

## The priority formula

After deduplication and correlation, every finding group gets a composite score from 0 to 100:

```text
score = severity * 0.70
      + age * 0.15
      + reachability * 0.10
      + epss * 0.05
```

70% severity, 15% age, 10% reachability, 5% EPSS. The weights are deliberate, and the most common question is why severity dominates so heavily.

The answer is that severity is the only input that is always present. EPSS only exists for findings with a CVE — a hardcoded secret or a SAST injection finding has no EPSS score at all. Reachability only applies where a call graph or lockfile can be built. If those signals carried heavy weight, the formula would systematically punish entire finding categories for lacking a CVE rather than for being less dangerous. Severity is the one judgment every scanner makes about every finding, so it anchors the score; everything else perturbs the ordering within a severity band rather than across bands. EPSS at 5% is explicitly a tiebreaker: among twenty high-severity CVEs, the one with active exploitation prediction floats to the top of its band, but no exploit-probability number drags an info-level finding above a critical.

Severity maps to a base score with wide, non-linear gaps — critical near the top of the scale, high well below it — large enough that lower-severity findings cannot climb past a band boundary on age and EPSS alone.

Age works in buckets, and it rewards the opposite of what people expect: **older findings score higher**, stepping up at roughly the one-day, one-week, one-month, and ninety-day marks. A finding from this morning gets triaged in the normal flow of the day; a critical that has sat open for ninety days is an organizational failure in progress, and the formula applies steadily increasing pressure until someone deals with it. The score and the per-factor contributions are both stored on the finding, so the ranking is always explainable.

## Call-graph reachability

The basic reachability signal for dependency findings is lockfile analysis — direct versus transitive, parsed across 7+ package ecosystems. That is useful but coarse: a direct dependency you never call is less urgent than a transitive one on your hot path.

So Fimil goes further. Per-language analyzers build a call graph of your project, identify entry points, then trace backwards from the vulnerable function through the reverse call graph. If a path from an entry point to the vulnerable function exists, the finding is classified **reachable** and the actual call chain — entry point to vulnerable call, function by function — is exported onto the finding. If the vulnerable module is imported but no complete path is found, it is **potentially reachable**. If the graph is reasonably complete and no path exists, it is **unreachable**. Every classification carries a confidence rating derived from how complete the call graph is — static call graphs miss dynamic dispatch and reflection, and a verdict from a half-built graph should not be trusted like a verdict from a full one.

The classification feeds the formula asymmetrically. A finding **confirmed reachable** has its entire score doubled, capped at 100 — confirmed exposure is the strongest signal the system has. A critical CVE proven **unreachable** keeps its severity contribution but loses essentially everything else, and in practice ranks _below_ a reachable high-severity finding. It does not disappear — unreachable today is one refactor away from reachable — but it stops consuming your best triage hours. That reordering, where proof of exposure outranks raw severity labels, is what the reachability signal exists to do.

## Auto-triage and the audit trail

Ranking decides what you look at first. Auto-triage rules decide what you stop looking at entirely.

A rule matches on rule ID, CVE ID, or package name with glob patterns, and on file path or title with regex. Rules are evaluated in priority order and **first match wins** — no rule blending, so given any finding you can name the single rule that acted on it. Rules only touch findings in the open state: once a human makes a triage call, no rule overrides it.

Every action a rule takes is written down twice: a triage audit log row recording which rule fired, which conditions matched, and the previous status — and a status transition row marking the change as automated rather than human. When a finding group's members are all resolved by rules, the group status follows, and that cascade is recorded too. Six months later, when someone asks why a finding was marked false positive, the answer is a database row, not a guess. The compliance framework references Fimil maps onto findings — SOC 2, PCI-DSS, and similar — are only as defensible as this trail, so the trail is not optional.

## The pipeline, end to end

Sixteen scanners, one signal: normalize every output into one schema, fingerprint on the attributes that identify the issue rather than the tool, merge matching fingerprints into finding groups, correlate related groups across categories, score each group, double the score when reachability is proven, and let auto-triage rules clear the known noise with a full audit trail behind them.

None of the individual scanners changed. What changed is that their disagreement about formats, severity scales, and identifiers stops being your problem. The full pipeline — and the scanners feeding it — is laid out on the [platform page](/platform).
