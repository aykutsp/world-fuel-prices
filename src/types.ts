export interface FuelPrices {
  gasoline: number;
  diesel: number;
  lpg: number;
  average: number;
}

export interface CityPrice {
  name: string;
  pricesUSD: FuelPrices;
  lat: number;
  lng: number;
}

export interface RegionPrice {
  id: string;
  iso3?: string;
  name: string;
  currency: string;
  source?: string;
  pricesUSD: FuelPrices;
  pricesLocal: FuelPrices;
  lat: number;
  lng: number;
  cities: CityPrice[];
}

export interface FuelData {
  lastUpdated: string;
  sources?: string[];
  globalAverageUSD: number;
  regions: RegionPrice[];
}

export interface GeoPoint {
  label: string;
  lat: number;
  lng: number;
}

export interface TripRefuel {
  countryId: string;          // ISO-A2 or 'unknown'
  countryName: string;
  atKm: number;               // cumulative distance at which the fill happens
  litres: number;             // how many litres were pumped into the tank
  pricePerLitreUSD: number;   // 0 if no price data for that country
  costUSD: number;
  source?: string;
  isInitial: boolean;         // true for the starting full-tank fill
}

export interface TripResult {
  from: GeoPoint;
  to: GeoPoint;
  totalKm: number;
  durationMinutes: number;
  polyline: Array<[number, number]>; // [lat, lng] pairs for Leaflet
  totalLitres: number;
  totalTanks: number;
  totalCostUSD: number;
  refuels: TripRefuel[];
}
