using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace WorldFuelPrices;

/// <summary>
/// Tiny client for the world-fuel-prices open data API. Targets the static
/// artifacts published at https://aykutsp.github.io/world-fuel-prices/api/v1/.
/// </summary>
public sealed class WorldFuelPricesClient : IDisposable
{
    public const string DefaultBaseUrl = "https://aykutsp.github.io/world-fuel-prices/api/v1/";

    private readonly HttpClient _http;
    private readonly bool _ownsHttp;
    private Dataset? _cached;

    public WorldFuelPricesClient(string? baseUrl = null, HttpClient? httpClient = null)
    {
        _http = httpClient ?? new HttpClient();
        _ownsHttp = httpClient is null;
        var url = baseUrl ?? DefaultBaseUrl;
        _http.BaseAddress = new Uri(url.EndsWith("/") ? url : url + "/");
        _http.DefaultRequestHeaders.UserAgent.ParseAdd("world-fuel-prices-csharp/1.0");
    }

    public async Task<Dataset> GetPricesAsync(bool force = false, CancellationToken ct = default)
    {
        if (!force && _cached is not null) return _cached;
        var data = await _http.GetFromJsonAsync<Dataset>("prices.json", ct)
                   ?? throw new InvalidOperationException("Empty prices.json response");
        _cached = data;
        return data;
    }

    public async Task<Region?> GetCountryAsync(string iso2, CancellationToken ct = default)
    {
        var data = await GetPricesAsync(ct: ct);
        return data.Regions.FirstOrDefault(r => r.Id.Equals(iso2, StringComparison.OrdinalIgnoreCase));
    }

    public async Task<IReadOnlyList<Region>> CheapestAsync(FuelType fuel = FuelType.Gasoline, int n = 10, CancellationToken ct = default)
    {
        var data = await GetPricesAsync(ct: ct);
        return data.Regions
            .Where(r => r.PricesUSD.Get(fuel) > 0)
            .OrderBy(r => r.PricesUSD.Get(fuel))
            .Take(n)
            .ToList();
    }

    public async Task<IReadOnlyList<Region>> MostExpensiveAsync(FuelType fuel = FuelType.Gasoline, int n = 10, CancellationToken ct = default)
    {
        var data = await GetPricesAsync(ct: ct);
        return data.Regions
            .Where(r => r.PricesUSD.Get(fuel) > 0)
            .OrderByDescending(r => r.PricesUSD.Get(fuel))
            .Take(n)
            .ToList();
    }

    public async Task<double> GlobalAverageAsync(FuelType fuel = FuelType.Gasoline, CancellationToken ct = default)
    {
        var data = await GetPricesAsync(ct: ct);
        var values = data.Regions.Select(r => r.PricesUSD.Get(fuel)).Where(v => v > 0).ToList();
        return values.Count == 0 ? 0 : values.Average();
    }

    public Task<TripIndex?> ListTripsAsync(CancellationToken ct = default) =>
        _http.GetFromJsonAsync<TripIndex>("trips/index.json", ct);

    public Task<Trip?> GetTripAsync(string slug, CancellationToken ct = default) =>
        _http.GetFromJsonAsync<Trip>($"trips/{slug}.json", ct);

    public void Dispose()
    {
        if (_ownsHttp) _http.Dispose();
    }
}

public enum FuelType { Gasoline, Diesel, Lpg, Average }

public sealed record FuelPrices(
    [property: JsonPropertyName("gasoline")] double Gasoline,
    [property: JsonPropertyName("diesel")] double Diesel,
    [property: JsonPropertyName("lpg")] double Lpg,
    [property: JsonPropertyName("average")] double Average)
{
    public double Get(FuelType t) => t switch
    {
        FuelType.Diesel => Diesel,
        FuelType.Lpg => Lpg,
        FuelType.Average => Average,
        _ => Gasoline,
    };
}

public sealed record Region(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("iso3")] string? Iso3,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("currency")] string Currency,
    [property: JsonPropertyName("source")] string? Source,
    [property: JsonPropertyName("pricesUSD")] FuelPrices PricesUSD,
    [property: JsonPropertyName("pricesLocal")] FuelPrices PricesLocal,
    [property: JsonPropertyName("lat")] double Lat,
    [property: JsonPropertyName("lng")] double Lng);

public sealed record Dataset(
    [property: JsonPropertyName("lastUpdated")] string LastUpdated,
    [property: JsonPropertyName("sources")] string[]? Sources,
    [property: JsonPropertyName("globalAverageUSD")] double GlobalAverageUSD,
    [property: JsonPropertyName("regions")] Region[] Regions);

public sealed record GeoPoint(
    [property: JsonPropertyName("label")] string Label,
    [property: JsonPropertyName("lat")] double Lat,
    [property: JsonPropertyName("lng")] double Lng);

public sealed record TripRefuel(
    [property: JsonPropertyName("countryId")] string CountryId,
    [property: JsonPropertyName("countryName")] string CountryName,
    [property: JsonPropertyName("atKm")] double AtKm,
    [property: JsonPropertyName("litres")] double Litres,
    [property: JsonPropertyName("pricePerLitreUSD")] double PricePerLitreUSD,
    [property: JsonPropertyName("costUSD")] double CostUSD,
    [property: JsonPropertyName("source")] string? Source,
    [property: JsonPropertyName("isInitial")] bool IsInitial);

public sealed record Trip(
    [property: JsonPropertyName("slug")] string Slug,
    [property: JsonPropertyName("from")] GeoPoint From,
    [property: JsonPropertyName("to")] GeoPoint To,
    [property: JsonPropertyName("totalKm")] double TotalKm,
    [property: JsonPropertyName("durationMinutes")] double DurationMinutes,
    [property: JsonPropertyName("totalLitres")] double TotalLitres,
    [property: JsonPropertyName("totalTanks")] double TotalTanks,
    [property: JsonPropertyName("totalCostUSD")] double TotalCostUSD,
    [property: JsonPropertyName("refuels")] TripRefuel[] Refuels);

public sealed record TripIndexEntry(
    [property: JsonPropertyName("slug")] string Slug,
    [property: JsonPropertyName("from")] string From,
    [property: JsonPropertyName("to")] string To,
    [property: JsonPropertyName("totalKm")] double TotalKm,
    [property: JsonPropertyName("totalCostUSD")] double TotalCostUSD,
    [property: JsonPropertyName("refuelStops")] int RefuelStops,
    [property: JsonPropertyName("url")] string Url);

public sealed record TripIndex(
    [property: JsonPropertyName("lastUpdated")] string LastUpdated,
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("trips")] TripIndexEntry[] Trips);
