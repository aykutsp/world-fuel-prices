# ADR-0003 — API versioning and stability pledge

- **Status**: accepted
- **Date**: 2026-04-05

## Context

People (and scripts, and other apps, and dashboards, and AI agents) will build on top of the JSON endpoints. The moment we ship a breaking change silently, all of them break silently too.

The dataset is also redistributed under an open licence, so consumers have every right to mirror or hot-link to the endpoints.

## Decision

Public endpoints live under `/api/v1/`. That `v1` is a load-bearing commitment:

1. **No removed fields within a major version.** Once a field is in the schema, it stays. If we want to replace it, we add the new field and deprecate the old one. The old one only disappears in `/api/v2/`.
2. **No field type changes.** A number stays a number. `null` is a valid value for every optional field and the schema says so explicitly.
3. **Values change every day; shape changes on tagged releases.**

Enforcement:

- `schemas/prices.schema.json` is the machine-readable version of this pledge.
- The build validates `prices.json` against the schema before publishing. **Schema mismatch fails the build**, which means the live site stays on the last known good dataset.
- Breaking changes ship as `/api/v2/` side-by-side with v1 for at least 6 months.

## Consequences

### Positive
- Downstream consumers are safe. They can pin to `/api/v1/prices.json`.
- Client libraries (see ADR-0007) stay small — they can hardcode field names without defensive coding.
- Validation is free (AJV runs on a 300 KB payload in milliseconds).

### Negative
- Migrations are expensive. Shipping `/api/v2/` means two parallel pipeline paths for six months.
- Some field names will outlive their usefulness. They stay in v1 forever.

## References

- `schemas/prices.schema.json`
- `scripts/validateDataset.mjs`
