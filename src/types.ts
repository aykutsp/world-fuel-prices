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
