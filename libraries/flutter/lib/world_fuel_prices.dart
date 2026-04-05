/// Dart / Flutter client for the world-fuel-prices open data API.
///
/// See https://aykutsp.github.io/world-fuel-prices/ for the live dataset and
/// https://github.com/aykutsp/world-fuel-prices for the source project.
library world_fuel_prices;

import 'dart:convert';
import 'package:http/http.dart' as http;

const String defaultBaseUrl = 'https://aykutsp.github.io/world-fuel-prices/api/v1/';

enum FuelType { gasoline, diesel, lpg, average }

class FuelPrices {
  final double gasoline;
  final double diesel;
  final double lpg;
  final double average;

  const FuelPrices({
    required this.gasoline,
    required this.diesel,
    required this.lpg,
    required this.average,
  });

  double get(FuelType t) {
    switch (t) {
      case FuelType.diesel:
        return diesel;
      case FuelType.lpg:
        return lpg;
      case FuelType.average:
        return average;
      case FuelType.gasoline:
        return gasoline;
    }
  }

  factory FuelPrices.fromJson(Map<String, dynamic> j) => FuelPrices(
        gasoline: (j['gasoline'] as num?)?.toDouble() ?? 0,
        diesel: (j['diesel'] as num?)?.toDouble() ?? 0,
        lpg: (j['lpg'] as num?)?.toDouble() ?? 0,
        average: (j['average'] as num?)?.toDouble() ?? 0,
      );
}

class Region {
  final String id;
  final String? iso3;
  final String name;
  final String currency;
  final String? source;
  final FuelPrices pricesUSD;
  final FuelPrices pricesLocal;
  final double lat;
  final double lng;

  const Region({
    required this.id,
    required this.name,
    required this.currency,
    required this.pricesUSD,
    required this.pricesLocal,
    required this.lat,
    required this.lng,
    this.iso3,
    this.source,
  });

  factory Region.fromJson(Map<String, dynamic> j) => Region(
        id: j['id'] as String,
        iso3: j['iso3'] as String?,
        name: j['name'] as String,
        currency: j['currency'] as String? ?? 'USD',
        source: j['source'] as String?,
        pricesUSD: FuelPrices.fromJson(j['pricesUSD'] as Map<String, dynamic>),
        pricesLocal: FuelPrices.fromJson(
            (j['pricesLocal'] ?? j['pricesUSD']) as Map<String, dynamic>),
        lat: (j['lat'] as num?)?.toDouble() ?? 0,
        lng: (j['lng'] as num?)?.toDouble() ?? 0,
      );
}

class Dataset {
  final String lastUpdated;
  final double globalAverageUSD;
  final List<String> sources;
  final List<Region> regions;

  const Dataset({
    required this.lastUpdated,
    required this.globalAverageUSD,
    required this.sources,
    required this.regions,
  });

  factory Dataset.fromJson(Map<String, dynamic> j) => Dataset(
        lastUpdated: j['lastUpdated'] as String,
        globalAverageUSD: (j['globalAverageUSD'] as num?)?.toDouble() ?? 0,
        sources: ((j['sources'] as List?) ?? const [])
            .map((e) => e.toString())
            .toList(),
        regions: (j['regions'] as List)
            .map((e) => Region.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class TripRefuel {
  final String countryId;
  final String countryName;
  final double atKm;
  final double litres;
  final double pricePerLitreUSD;
  final double costUSD;
  final bool isInitial;
  final String? source;

  const TripRefuel({
    required this.countryId,
    required this.countryName,
    required this.atKm,
    required this.litres,
    required this.pricePerLitreUSD,
    required this.costUSD,
    required this.isInitial,
    this.source,
  });

  factory TripRefuel.fromJson(Map<String, dynamic> j) => TripRefuel(
        countryId: j['countryId'] as String,
        countryName: j['countryName'] as String,
        atKm: (j['atKm'] as num).toDouble(),
        litres: (j['litres'] as num).toDouble(),
        pricePerLitreUSD: (j['pricePerLitreUSD'] as num).toDouble(),
        costUSD: (j['costUSD'] as num).toDouble(),
        isInitial: j['isInitial'] as bool,
        source: j['source'] as String?,
      );
}

class GeoPoint {
  final String label;
  final double lat;
  final double lng;
  const GeoPoint({required this.label, required this.lat, required this.lng});

  factory GeoPoint.fromJson(Map<String, dynamic> j) => GeoPoint(
        label: j['label'] as String,
        lat: (j['lat'] as num).toDouble(),
        lng: (j['lng'] as num).toDouble(),
      );
}

class Trip {
  final String slug;
  final GeoPoint from;
  final GeoPoint to;
  final double totalKm;
  final double durationMinutes;
  final double totalLitres;
  final double totalTanks;
  final double totalCostUSD;
  final List<TripRefuel> refuels;

  const Trip({
    required this.slug,
    required this.from,
    required this.to,
    required this.totalKm,
    required this.durationMinutes,
    required this.totalLitres,
    required this.totalTanks,
    required this.totalCostUSD,
    required this.refuels,
  });

  factory Trip.fromJson(Map<String, dynamic> j) => Trip(
        slug: j['slug'] as String,
        from: GeoPoint.fromJson(j['from'] as Map<String, dynamic>),
        to: GeoPoint.fromJson(j['to'] as Map<String, dynamic>),
        totalKm: (j['totalKm'] as num).toDouble(),
        durationMinutes: (j['durationMinutes'] as num).toDouble(),
        totalLitres: (j['totalLitres'] as num).toDouble(),
        totalTanks: (j['totalTanks'] as num).toDouble(),
        totalCostUSD: (j['totalCostUSD'] as num).toDouble(),
        refuels: (j['refuels'] as List)
            .map((e) => TripRefuel.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class WorldFuelPricesClient {
  final String baseUrl;
  final http.Client _http;
  Dataset? _cached;

  WorldFuelPricesClient({String? baseUrl, http.Client? httpClient})
      : baseUrl = (baseUrl ?? defaultBaseUrl).endsWith('/')
            ? (baseUrl ?? defaultBaseUrl)
            : '${baseUrl ?? defaultBaseUrl}/',
        _http = httpClient ?? http.Client();

  Future<Map<String, dynamic>> _getJson(String path) async {
    final uri = Uri.parse('$baseUrl$path');
    final res = await _http.get(uri, headers: const {
      'User-Agent': 'world-fuel-prices-dart/1.0',
    });
    if (res.statusCode >= 400) {
      throw Exception('HTTP ${res.statusCode} from $uri');
    }
    return json.decode(res.body) as Map<String, dynamic>;
  }

  Future<Dataset> getPrices({bool force = false}) async {
    if (!force && _cached != null) return _cached!;
    final raw = await _getJson('prices.json');
    _cached = Dataset.fromJson(raw);
    return _cached!;
  }

  Future<Region?> getCountry(String iso2) async {
    final data = await getPrices();
    final up = iso2.toUpperCase();
    for (final r in data.regions) {
      if (r.id.toUpperCase() == up) return r;
    }
    return null;
  }

  Future<List<Region>> cheapest(FuelType fuel, {int n = 10}) async {
    final data = await getPrices();
    final list = data.regions.where((r) => r.pricesUSD.get(fuel) > 0).toList();
    list.sort((a, b) => a.pricesUSD.get(fuel).compareTo(b.pricesUSD.get(fuel)));
    return list.take(n).toList();
  }

  Future<List<Region>> mostExpensive(FuelType fuel, {int n = 10}) async {
    final data = await getPrices();
    final list = data.regions.where((r) => r.pricesUSD.get(fuel) > 0).toList();
    list.sort((a, b) => b.pricesUSD.get(fuel).compareTo(a.pricesUSD.get(fuel)));
    return list.take(n).toList();
  }

  Future<double> globalAverage(FuelType fuel) async {
    final data = await getPrices();
    final values = data.regions
        .map((r) => r.pricesUSD.get(fuel))
        .where((v) => v > 0)
        .toList();
    if (values.isEmpty) return 0;
    return values.reduce((a, b) => a + b) / values.length;
  }

  Future<Map<String, dynamic>> listTrips() => _getJson('trips/index.json');

  Future<Trip> getTrip(String slug) async {
    final raw = await _getJson('trips/$slug.json');
    return Trip.fromJson(raw);
  }

  void close() => _http.close();
}
