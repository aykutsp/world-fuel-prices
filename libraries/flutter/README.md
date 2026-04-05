# world_fuel_prices (Dart / Flutter)

Dart client for the [world-fuel-prices](https://github.com/aykutsp/world-fuel-prices) open data API. Works from pure Dart projects as well as Flutter apps (mobile, web, desktop).

## Install

```yaml
dependencies:
  world_fuel_prices: ^1.0.0
```

## Usage

```dart
import 'package:world_fuel_prices/world_fuel_prices.dart';

void main() async {
  final client = WorldFuelPricesClient();

  final de = await client.getCountry('DE');
  print('${de?.name}: \$${de?.pricesUSD.gasoline}/L (${de?.source})');

  for (final r in await client.cheapest(FuelType.gasoline, n: 10)) {
    print('${r.id}\t${r.pricesUSD.gasoline.toStringAsFixed(2)}\t${r.name}');
  }

  final avg = await client.globalAverage(FuelType.gasoline);
  print('World gasoline avg: \$${avg.toStringAsFixed(2)}/L');

  final trip = await client.getTrip('istanbul-berlin');
  print('${trip.totalKm.toStringAsFixed(0)} km, '
      '\$${trip.totalCostUSD.toStringAsFixed(2)}, '
      '${trip.refuels.length} refuels');

  client.close();
}
```

## License

MIT.
