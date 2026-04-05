# world-fuel-prices (TypeScript / JavaScript)

Tiny, zero-dependency client for the [world-fuel-prices](https://github.com/aykutsp/world-fuel-prices) open data API. Works in Node 18+, Deno, Bun and modern browsers.

## Install

```bash
npm install world-fuel-prices
```

## Usage

```ts
import { worldFuelPrices, WorldFuelPricesClient } from 'world-fuel-prices';

// Quick one-liners with the singleton
const de = await worldFuelPrices.getCountry('DE');
console.log(`${de?.name}: $${de?.pricesUSD.gasoline}/L`);

const top10Cheapest = await worldFuelPrices.cheapest('gasoline', 10);
for (const r of top10Cheapest) {
  console.log(`${r.id}  ${r.pricesUSD.gasoline.toFixed(2)}  ${r.name}`);
}

// Or instantiate your own client (e.g. to inject a custom fetch)
const client = new WorldFuelPricesClient({ fetch: myFetch });
const world = await client.getPrices();
console.log(`Global gasoline avg: $${await client.globalAverage('gasoline')}`);

// Pre-computed trip endpoints
const trips = await worldFuelPrices.listTrips();
const istBerlin = await worldFuelPrices.getTrip('istanbul-berlin');
console.log(`${istBerlin.totalKm} km, $${istBerlin.totalCostUSD} across ${istBerlin.refuels.length} refuels`);
```

## API

| Method | Description |
|---|---|
| `getPrices(force?)` | Full dataset (cached per client instance) |
| `getCountry(iso2)` | Single country by ISO 3166-1 alpha-2 |
| `getRegions(sortBy?)` | All regions, optionally sorted by fuel type |
| `cheapest(fuel, n)` | Cheapest `n` countries |
| `mostExpensive(fuel, n)` | Most expensive `n` countries |
| `globalAverage(fuel)` | Global mean for a fuel type |
| `listTrips()` | Pre-computed trip index |
| `getTrip(slug)` | Single pre-computed trip |

## License

MIT — upstream data keeps its original licences (see the main repo).
