# ADR-0002 — Station-level feeds preferred over national aggregates

- **Status**: accepted
- **Date**: 2026-04-05

## Context

Two classes of fuel price data exist:

1. **Station-level feeds** — government-mandated open data where every filling station publishes its own prices. France, Italy, Spain, the UK and the US have these. Updated daily (France: hourly). Thousands of data points per country.
2. **National aggregates** — weekly / monthly averages published by statistics offices or international bodies (EU Commission, World Bank). Updated slowly.

Station-level data is much closer to "what the user would actually pay at the pump". But it only exists for a handful of countries.

## Decision

For every country where a live station-level feed exists **and** has a redistribution-friendly licence, use it as the primary source. Compute the national average by averaging over all stations we see. Fall through to national aggregates only for countries without station-level coverage:

- **FR** → `data.economie.gouv.fr` Prix des carburants (Etalab OL 2.0)
- **IT** → MIMIT Osservaprezzi (IODL 2.0)
- **ES** → Minetur REST API (public)
- **UK** → CMA Road Fuel Price Transparency Scheme (4 retailers aggregated)
- **US** → EIA weekly retail (U.S. public domain)
- **EU27 fallback** → EU Weekly Oil Bulletin (CC BY 4.0)
- **Rest of the world** → World Bank Global Fuel Prices Database (ODbL)

Every loader returns the same shape so `main()` can merge them without caring which source provided which country.

## Consequences

### Positive
- Prices for the 5 covered countries are updated daily with thousands of data points, not weekly averages. They're noticeably closer to what you'd pay at the pump.
- Adding a sixth country is a new function in `scripts/generateData.js` plus an entry in the README's data sources table. No architectural change.
- The "national aggregates" sources stay in the build as a cross-check. When the EU Bulletin and our MIMIT average diverge meaningfully, that's a signal.

### Negative
- Each source has its own quirks. FR publishes some stations with `null` for SP95 (only E10 is available); IT has per-impianto rows for self-service and full-service; UK aggregates over 4 retailer JSONs with slightly different schemas. Each loader has a small amount of source-specific logic.
- Licence review has to happen before a new source is added. Documented in `docs/paid-upgrades.md` and in the per-loader source comment.

### Neutral
- The merge order ("station-level wins, then EU Bulletin, then World Bank") is a policy, not a physical constraint. If a better national aggregate appears for a country we already cover station-level, we keep the station-level view.

## Alternatives considered

1. **Use the EU Weekly Oil Bulletin for all of EU27.** Rejected: it's a weekly national average. We throw away a lot of information that's publicly available at daily station granularity.
2. **Use only station-level feeds.** Rejected: coverage is 5 countries. We'd need a fallback anyway.
3. **Use a commercial aggregator** (GlobalPetrolPrices, S&P Platts). Possible but requires a paid licence; documented as a paid upgrade in `docs/paid-upgrades.md`.

## References

- `scripts/generateData.js` → `loadFuel()` and the station-level loader functions
- `docs/paid-upgrades.md` → Fuel prices section
