# ADR-0004 — Rejected fuelo.net as a data source on licence grounds

- **Status**: accepted
- **Date**: 2026-04-05

## Context

Early in the project, the obvious candidate for "European fuel prices updated daily" was [fuelo.net](https://fuelo.net/). Their 27 country subdomains publish per-country averages for Unleaded 95, Diesel and LPG on the front page, refreshed at least daily. The HTML is trivial to scrape.

Before integrating, we checked the terms. Two things made fuelo.net unsuitable as the primary source:

1. **Terms of use prohibit redistribution.** Fuelo's privacy/terms page reserves the right to forbid automated scraping and explicitly prohibits redistributing their aggregated data.
2. **EU Database Directive (96/9/EC) "sui generis" right.** Fuelo's per-country averages are the product of their own aggregation over crowdsourced station data. Even if the individual station readings are factual, the aggregated view is protectable. Systematic extraction + redistribution would be an infringement in EU jurisdictions.

"We'll credit them" is not a workaround for this. Attribution satisfies licence obligations for CC BY data; it does not override a terms-of-use prohibition.

## Decision

**Do not scrape fuelo.net.** Replace the entire concept with sources whose licences explicitly permit redistribution:

- **EU Weekly Oil Bulletin** (CC BY 4.0) for EU27 national averages.
- **World Bank Global Fuel Prices Database** (ODbL) for the rest of the world.
- **Station-level government feeds** for France, Italy, Spain, the UK and the US (each with its own permissive open data licence — see the data sources table in the root README).

This takes us from "scrape one site" to "integrate seven sources". That's a net win: we get better coverage, better freshness, better data, and we stay on the right side of every applicable licence.

## Consequences

### Positive
- Legally clean. Every byte we redistribute is under a permissive open-data licence.
- Better technical outcome. Station-level feeds (ADR-0002) are closer to "what you'd pay at the pump" than fuelo's crowdsourced averages.
- Reproducible by forks. Nobody running their own instance has to worry about getting cease-and-desist letters.

### Negative
- More upstream surface area to maintain. 7 loaders instead of 1.
- Fuel prices for countries without EU27 / WB coverage are coarser than they could be if we ignored the licence.

### Neutral
- The decision is documented so that future contributors know *why* the obvious source is not the one we use. Re-opening this decision requires a licence change on fuelo's side, not just "it was too much work".

## Alternatives considered

1. **Scrape fuelo.net with attribution.** Rejected — attribution does not override their terms of use.
2. **Ask fuelo for a commercial redistribution licence.** Not pursued — the licensing-clean alternatives already cover the same need.
3. **Use only the EU Weekly Oil Bulletin** and skip the station-level feeds. Rejected because weekly national averages are strictly inferior to daily station-level data when the latter is free.
4. **Use a commercial vendor (GlobalPetrolPrices, S&P Platts).** Left as a documented paid upgrade path — see `docs/paid-upgrades.md`.

## References

- ADR-0002 — Station-level feeds preferred over national aggregates
- ADR-0006 — Free-data-first, with documented paid upgrade paths
- [EU Database Directive 96/9/EC](https://eur-lex.europa.eu/eli/dir/1996/9/oj)
- `docs/paid-upgrades.md` → Fuel prices section
