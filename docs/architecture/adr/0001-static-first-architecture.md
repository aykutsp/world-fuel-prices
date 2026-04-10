# ADR-0001 — Static-first architecture on GitHub Pages

- **Status**: accepted
- **Date**: 2026-04-05

## Context

The product is "a world map of fuel prices with a trip cost calculator". The dataset changes at most once a day, every consumer wants the same bytes, and there is zero per-user state. Running a server is pure cost.

## Decision

Ship as a **static site** on GitHub Pages. A GitHub Actions cron regenerates `prices.json` at 06:15 UTC and atomically swaps it into the live site via `actions/deploy-pages`. No backend, no database, no per-request compute.

## Consequences

### Positive
- Zero marginal cost per user.
- The same URL can sit behind any CDN (Cloudflare / Fastly / CloudFront) with a DNS change.
- Replayable deployments. Rollback is `git revert + push`.
- Contributors productive in 5 minutes.

### Negative
- Intra-day refreshes need a rebuild. At 1 M MAU with minute-level freshness we'd migrate to Temporal/EventBridge — see the System Design section in the root README.
- No write paths. No comments, no saved trips without a backend.

### Neutral
- Dataset size becomes a UX concern. `prices.json` is kept under 300 KB; the per-country split (ADR-0002) handles the library use case.

## Alternatives considered

1. **Next.js + serverless API routes.** Rejected: cold-start tail latency for data that doesn't change per-request.
2. **Cloudflare Workers + R2.** Target of Phase 1 of the scaling plan; until then, GitHub Pages is free and sufficient.
3. **Full Express + Postgres.** Over-engineering a daily cron job.

## References

- System design section in the root README
