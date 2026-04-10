# Paid upgrade paths

The shipped pipeline uses **only free, open-licensed sources** (see ADR-0006). This document is the reference for teams who want to replace any free feed with a commercial equivalent: per data type, what we use today, what the paid alternative is, what it costs, what breaks, and which loader file to edit.

---

## 1. Fuel prices (gasoline, diesel, LPG)

**Current free sources**
- **Station-level**: `data.economie.gouv.fr` (FR, Etalab OL 2.0), MIMIT Osservaprezzi (IT, IODL 2.0), Minetur REST (ES, public), UK CMA transparency scheme (4 retailer JSONs, OGL), US EIA weekly retail (U.S. public domain).
- **National aggregates**: EU Weekly Oil Bulletin (CC BY 4.0), World Bank Global Fuel Prices Database (ODbL).
- Loaders: `scripts/generateData.js` → `loadFR() / loadIT() / loadES() / loadGB() / loadUS() / loadFuel()`.

**Paid upgrade — GlobalPetrolPrices.com API**
- **What you get**: weekly national averages for ~170 countries, three fuels. Licence allows redistribution only to licensed clients of yours — you need a "re-distribution" tier if you publish the data publicly.
- **Cost**: ~ €600-1200 / year standard, ~ €3000+ for redistribution. Quote-based.
- **Effort**: ~1 day. Replace the `loadFuel()` body, map ISO codes. Keep the EU Bulletin as a secondary source for divergence checks.
- **Where to plug it in**: `scripts/generateData.js` → `loadFuel()`.

**Paid upgrade — S&P Global Platts**
- **What you get**: intraday benchmark prices + per-country retail. The industry gold standard.
- **Cost**: enterprise, low five figures per year minimum.
- **Effort**: ~3 days + legal review.
- **When it's worth it**: commercial customers who need freshness below a week.

**Paid upgrade — Deutsche Tankerkönig API** (Germany only)
- **What you get**: live station-level German prices, updated multiple times per hour. Free API key required (no cost), data licensed under CC BY-SA.
- **Cost**: free — but classified as "paid" here because it requires registration.
- **Effort**: ~0.5 days.
- **Where to plug it in**: new `loadDE()` function, same shape as `loadFR()`.

**Paid upgrade — EPDK XML web service** (Turkey only)
- **What you get**: official Turkish regulator data. Daily, station-level.
- **Cost**: free — but requires registering as an EPDK data consumer (email approval, no public self-serve).
- **Effort**: ~1-2 days including the SOAP/XML plumbing.
- **Where to plug it in**: new `loadTR()` function.

---

## 2. Routing (OSRM)

**Current free source**
- **OSRM public demo server** (`router.project-osrm.org`). Community-run, explicit fair-use disclaimer.

**Paid upgrade — self-hosted OSRM**
- **Cost**: 3 × `c7g.xlarge` ≈ $330 / month (see the scaling section in the root README).
- **Effort**: ~2 days.
- **Where to plug it in**: `src/components/Trip/TripCalculator.tsx` → replace the hardcoded OSRM base URL with `import.meta.env.VITE_ROUTING_BASE_URL`.

**Paid upgrade — Mapbox Directions API**
- **Cost**: $0.50 per 1000 requests above the 100k/month free tier.
- **Effort**: ~0.5 days. Response shape is close to OSRM.

**Paid upgrade — HERE Routing / TomTom Routing**
- **Cost**: quote-based for enterprise, free tier up to 2500 req/day (TomTom).
- **Effort**: ~1 day each.

---

## 3. Geocoding (Nominatim)

**Current free source**
- **Nominatim public instance** (OpenStreetMap Foundation). 1 request per second.

**Paid upgrade — self-hosted Nominatim**
- **Cost**: `r6g.2xlarge` + 1 TB EBS ≈ $340 / month.
- **Effort**: ~1 day.

**Paid upgrade — Mapbox Geocoding / Google Geocoding**
- **Cost**: Mapbox $0.75 per 1000 above free tier; Google $5 per 1000, no commercial free tier.
- **Effort**: ~2 hours each.

---

## 4. Country borders

**Current free source**
- **Natural Earth 110m admin_0 countries** (CC0).

**Paid upgrade**
- **Natural Earth 50m / 10m** — still CC0, just higher resolution.
- **Mapbox Boundaries / HERE / TomTom** — licensed administrative data. Only worth it if you need disputed-territory nuance or daily updates.

---

## Configuring the pipeline for a paid deployment

Every paid integration follows the same pattern:

1. Put the API key into **GitHub Secrets** (`Settings → Secrets → Actions`).
2. Expose it to the build in `.github/workflows/deploy.yml`:

   ```yaml
   - name: Generate dataset
     env:
       TANKERKOENIG_KEY: ${{ secrets.TANKERKOENIG_KEY }}
       GLOBAL_PETROL_PRICES_TOKEN: ${{ secrets.GLOBAL_PETROL_PRICES_TOKEN }}
     run: npm run generate-data
   ```

3. Make the new loader in `scripts/generateData.js` check for the variable and skip gracefully if it isn't set. Every paid loader **must** fall through to the free default so that forks still build.

4. Update this file with a one-line note about the newly integrated provider.

5. If the paid feed forbids public mirroring, disable the public cache for the affected endpoint and note it in the output's `source` field.

---

## What counts as "free" vs "paid" here

- **Free** — anyone can curl it without registration, or with a self-serve free-of-charge API key. CC BY, ODbL, CC0, Etalab OL, Open Government Licence, public domain.
- **Paid** — money changes hands, or the licence requires a signed contract, or redistribution is prohibited.

"Free with registration" (Tankerkönig, EPDK, OpenChargeMap) sits in the middle. We support these as **optional** loaders behind env vars so that the default build has zero barriers.
