# ADR-0005 — Refuel simulation (not linear) as the trip cost model

- **Status**: accepted
- **Date**: 2026-04-05

## Context

Given a route between two points that crosses multiple countries, there are two reasonable ways to compute "what the fuel for this trip costs":

1. **Linear model.** Distribute litres proportionally to kilometres driven in each country, multiply by that country's price, sum.
2. **Refuel simulation.** Start with a full tank bought at the origin price. Drive until a reserve threshold is hit. Refuel at that point — at the price of whichever country the car is physically in at that moment. Repeat until arrival.

The linear model is simpler to compute and to explain. The refuel simulation is closer to what actually happens in practice: cross-border price arbitrage matters when you can strategically fill up on the cheap side of a border, and a linear model papers over that.

## Decision

Use the **refuel simulation** as the primary trip cost model:

- Tank size: 50 L
- Full-tank range: 900 km
- Reserve threshold: 2 % (you refuel when 49 L have been used)
- Refuel amount: 49 L (topping up to full)

Starting fill happens at the origin's country price. Each subsequent fill happens at the country the polyline intersects at that cumulative-distance mark. The receipt in the UI lists every fill event.

## Consequences

### Positive
- Matches the user's real-world mental model. The receipt line "@ 882 km · Bulgaria — 49 L × $1.70" is exactly what the user would see at a real petrol station on that route.
- Surfaces cross-border price differences. An Istanbul → Berlin trip shows fills in Turkey (cheap), Bulgaria, Serbia, Hungary, Austria, Germany (expensive) — and the total rewards routes that skip the expensive refills.
- The refuel locations double as a "fill up here" hint for a user planning the trip.

### Negative
- More complex than a linear sum. The simulation has edge cases around very short trips (one fill only) and routes that don't quite divide evenly into tank lengths.
- The assumption of 50 L × 900 km is a fixed vehicle profile. Users with different vehicles see numbers that are the right shape but the wrong magnitude. Mitigated by the roadmap item "configurable tank size".

### Neutral
- EV modes use a linear per-km cost instead, because charging is continuous rather than discrete. Documented inline in `TripCalculator.tsx`.

## Alternatives considered

1. **Linear km × price model.** Rejected: loses the cross-border arbitrage story, which is the whole reason the feature exists.
2. **Ask the user for their vehicle profile.** Rejected for v1 — too much ceremony for a sidebar tool. Kept as a roadmap item.
3. **Use a real fuel economy curve (consumption varies with speed, load, temperature).** Rejected — over-engineering for a sidebar tool, and the upstream price data isn't accurate enough to justify that level of modelling.

## References

- `src/components/Trip/TripCalculator.tsx` → `simulateFuelRefuels()`
- `docs/architecture/adr/0002` — on why station-level feeds make the refuel simulation worth doing at all
