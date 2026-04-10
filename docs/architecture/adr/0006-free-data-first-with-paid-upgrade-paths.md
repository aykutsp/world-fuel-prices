# ADR-0006 — Free-data-first, with documented paid upgrade paths

- **Status**: accepted
- **Date**: 2026-04-05

## Context

Every fuel price source falls into one of three classes:

1. **Free + open-licensed** (CC BY, ODbL, Etalab OL, OGL, public domain).
2. **Free with registration** (OpenChargeMap, EPDK, Tankerkönig) — one-time key, rate-limited.
3. **Commercial** (GlobalPetrolPrices, S&P Platts, IEA Energy Prices) — the best freshness and coverage, but explicit licences and $$$.

If the default build required a credential or a paid contract, three things would break:

- Forks couldn't run it.
- PR reviewers couldn't reproduce a change locally.
- The public GitHub Actions cron couldn't run in an untrusted environment.

On the other hand, teams *with* a budget need a clear on-ramp to premium sources. Ignoring them leaves them with nothing to follow.

## Decision

The shipped pipeline uses **only free + open-licensed sources**. Any component that needs a credential is **optional**: the loader checks for its env var and skips itself silently when the var isn't set. (See the `OPENCHARGEMAP_KEY` loader in `scripts/generateData.js` for the template.)

Separately, every source is documented with its paid-upgrade path in [`docs/paid-upgrades.md`](../../paid-upgrades.md):

- Exact vendor and product.
- Licence terms.
- Rough monthly cost.
- Pointer to the loader file + the function that would need to change.
- Estimated integration effort.

## Consequences

### Positive
- Anyone can fork and run. `git clone && npm install && npm run generate-data` works with no tokens.
- Paid upgrades are a configuration decision at deploy time, not a code fork.
- Opt-in keys live in GitHub Secrets, never in source.

### Negative
- Some metrics are coarser than they could be. Data outside FR/IT/ES/UK/US comes from weekly aggregates, not live station feeds. A paid GlobalPetrolPrices subscription would replace that.
- The paid-upgrade doc has to stay current or it becomes disinformation.

### Neutral
- "Free-first" is a policy, not a capability limit. Nothing in the code prevents a fork from wiring in a commercial feed end-to-end.

## References

- [`docs/paid-upgrades.md`](../../paid-upgrades.md)
- ADR-0002 — Station-level feeds preferred over national aggregates
