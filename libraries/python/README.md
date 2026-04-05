# world-fuel-prices (Python)

Stdlib-only Python client for the [world-fuel-prices](https://github.com/aykutsp/world-fuel-prices) open data API. No third-party dependencies.

## Install

```bash
pip install world-fuel-prices
```

## Usage

```python
from world_fuel_prices import WorldFuelPricesClient

client = WorldFuelPricesClient()

de = client.get_country("DE")
print(f"{de.name}: ${de.prices_usd.gasoline}/L (source: {de.source})")

for r in client.cheapest("gasoline", 10):
    print(f"{r.id}\t{r.prices_usd.gasoline:.2f}\t{r.name}")

print(f"World gasoline avg: ${client.global_average('gasoline'):.2f}/L")

# Pre-computed trips
trips = client.list_trips()
trip = client.get_trip("istanbul-berlin")
print(f"{trip.total_km:.0f} km, ${trip.total_cost_usd:.2f} across {len(trip.refuels)} refuels")
```

## License

MIT.
