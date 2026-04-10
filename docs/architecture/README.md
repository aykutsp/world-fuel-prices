# Architecture

This directory is the engineering reference for the project. If you are trying to understand *why* the code looks the way it does rather than *what* it does, start here.

## Contents

| Document | What you'll find |
|---|---|
| [`overview.md`](./overview.md) | System context and container diagrams (C4 model) |
| [`adr/`](./adr/) | Architecture Decision Records — every significant decision |
| [`../paid-upgrades.md`](../paid-upgrades.md) | How to swap each free data source for a paid equivalent |
| [`../runbooks/`](../runbooks/) | Step-by-step operational procedures |

## Principles

1. **Station-level accuracy where it's free.** FR, IT, ES, UK, US all publish live feeds — use them. Fall back to weekly / monthly sources elsewhere.
2. **Open-data-only in the default build.** No credentials required to `git clone && npm install && npm run generate-data`.
3. **The JSON is the contract.** ADR-0003 — `/api/v1/` field names and types are stable within a major version.
4. **Reject data we cannot legally redistribute.** The original "fuelo.net" source was rejected on licence grounds — see ADR-0004.
5. **Deliberately boring.** Static site + GitHub Actions cron + CDN. No Kubernetes, no backend, no database.
6. **Contributors productive in 5 minutes.** Anything that slows that down is a bug.
