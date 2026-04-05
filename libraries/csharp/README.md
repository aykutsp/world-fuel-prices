# WorldFuelPrices (.NET / C#)

.NET 8+ client for the [world-fuel-prices](https://github.com/aykutsp/world-fuel-prices) open data API.

## Install

```bash
dotnet add package WorldFuelPrices
```

## Usage

```csharp
using WorldFuelPrices;

using var client = new WorldFuelPricesClient();

var de = await client.GetCountryAsync("DE");
Console.WriteLine($"{de!.Name}: ${de.PricesUSD.Gasoline:F2}/L (source: {de.Source})");

foreach (var r in await client.CheapestAsync(FuelType.Gasoline, 10))
    Console.WriteLine($"{r.Id}  {r.PricesUSD.Gasoline:F2}  {r.Name}");

var avg = await client.GlobalAverageAsync(FuelType.Gasoline);
Console.WriteLine($"World gasoline average: ${avg:F2}/L");

var trip = await client.GetTripAsync("istanbul-berlin");
Console.WriteLine($"{trip!.TotalKm:F0} km, ${trip.TotalCostUSD:F2}, {trip.Refuels.Length} refuels");
```

## License

MIT.
