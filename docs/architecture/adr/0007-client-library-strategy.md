# ADR-0007 — Client libraries are thin wrappers, not an SDK

- **Status**: accepted
- **Date**: 2026-04-05

## Context

We ship official client libraries for five languages (TypeScript, Python, Go, Dart/Flutter, .NET). Each language's users expect an idiomatic package on their registry.

The temptation is to make those libraries *smart*: caching strategies, retry/backoff, synthetic metrics, query builders, observability. Every such feature ships more code, more tests, more bugs, and more reasons to ship a breaking change later.

## Decision

Each client library is a **thin wrapper** around the public JSON endpoints. The entire non-trivial surface per language is:

- `getPrices()` — one HTTP GET, cached per-instance.
- `getCountry(iso2)` — in-memory find.
- `cheapest(fuel, n)` / `mostExpensive(fuel, n)` — simple array sort.
- `globalAverage(fuel)` — arithmetic mean over non-null values.
- `listTrips()` / `getTrip(slug)` — pre-computed trip endpoints.

No offline mode. No incremental fetches. No filtering DSL. No retry libraries. Zero third-party deps for Python and Go, minimal for the others.

## Consequences

### Positive
- One schema change → a 5-line edit per library. A new metric is shipped in an afternoon across five packages.
- Each library is < 400 LOC including types. Ten-minute audit.
- The JSON is the contract. Users who outgrow the library can always drop down to raw `fetch` — that's an intentional escape hatch, not a failure.

### Negative
- Every change has to be made five times. Mitigated by the small surface.
- No fancy features. Users who want retry/backoff bring their own library.

### Neutral
- Library versions are independent (semver per package) but in practice they move together with a project release.

## Alternatives considered

1. **One smart TypeScript SDK, others as bindings.** Rejected — forces Python users into Node idioms.
2. **Protobuf + gRPC.** Rejected — massive toolchain for a dataset that changes once a day and fits in 300 KB of JSON.
3. **OpenAPI + codegen.** Rejected — generated code for a single `GET` is more ceremony than the code itself.

## References

- [`libraries/`](../../../libraries/)
- ADR-0003 — API versioning and stability pledge
