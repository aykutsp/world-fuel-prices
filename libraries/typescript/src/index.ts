/**
 * world-fuel-prices — TypeScript/JavaScript client for the daily-refreshed
 * world fuel prices open data API.
 *
 * Base: https://aykutsp.github.io/world-fuel-prices/api/v1/
 */

export interface FuelPrices {
  gasoline: number;
  diesel: number;
  lpg: number;
  average: number;
}

export interface Region {
  id: string;
  iso3?: string;
  name: string;
  currency: string;
  source?: string;
  pricesUSD: FuelPrices;
  pricesLocal: FuelPrices;
  lat: number;
  lng: number;
}

export interface FuelDataset {
  lastUpdated: string;
  sources?: string[];
  globalAverageUSD: number;
  regions: Region[];
}

export interface TripRefuel {
  countryId: string;
  countryName: string;
  atKm: number;
  litres: number;
  pricePerLitreUSD: number;
  costUSD: number;
  source?: string;
  isInitial: boolean;
}

export interface Trip {
  slug: string;
  lastUpdated: string;
  from: { label: string; lat: number; lng: number };
  to: { label: string; lat: number; lng: number };
  totalKm: number;
  durationMinutes: number;
  polyline: Array<[number, number]>;
  totalLitres: number;
  totalTanks: number;
  totalCostUSD: number;
  refuels: TripRefuel[];
}

export interface TripIndexEntry {
  slug: string;
  from: string;
  to: string;
  totalKm: number;
  totalCostUSD: number;
  refuelStops: number;
  url: string;
}

export interface TripIndex {
  lastUpdated: string;
  description: string;
  trips: TripIndexEntry[];
}

export type FuelType = 'gasoline' | 'diesel' | 'lpg' | 'average';

export interface ClientOptions {
  /** Base URL; override only to point at a mirror. */
  baseUrl?: string;
  /** Optional `fetch` implementation (defaults to global fetch). */
  fetch?: typeof fetch;
}

const DEFAULT_BASE = 'https://aykutsp.github.io/world-fuel-prices/api/v1/';

export class WorldFuelPricesClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private cachedDataset: FuelDataset | null = null;

  constructor(options: ClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, '') + '/';
    this.fetcher = options.fetch ?? fetch;
  }

  /** Fetches the full prices dataset (cached per client instance). */
  async getPrices(force = false): Promise<FuelDataset> {
    if (!force && this.cachedDataset) return this.cachedDataset;
    const res = await this.fetcher(`${this.baseUrl}prices.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching prices.json`);
    this.cachedDataset = (await res.json()) as FuelDataset;
    return this.cachedDataset;
  }

  /** Returns a single country (ISO 3166-1 alpha-2), or null if not tracked. */
  async getCountry(id: string): Promise<Region | null> {
    const data = await this.getPrices();
    return data.regions.find((r) => r.id.toUpperCase() === id.toUpperCase()) ?? null;
  }

  /** Returns every tracked region, optionally sorted by one of the fuel types. */
  async getRegions(sortBy?: FuelType): Promise<Region[]> {
    const data = await this.getPrices();
    if (!sortBy) return data.regions;
    return [...data.regions].sort((a, b) => a.pricesUSD[sortBy] - b.pricesUSD[sortBy]);
  }

  /** Cheapest N countries for a fuel type (defaults to gasoline). */
  async cheapest(fuel: FuelType = 'gasoline', n = 10): Promise<Region[]> {
    const data = await this.getPrices();
    return data.regions
      .filter((r) => r.pricesUSD[fuel] > 0)
      .sort((a, b) => a.pricesUSD[fuel] - b.pricesUSD[fuel])
      .slice(0, n);
  }

  /** Most expensive N countries for a fuel type. */
  async mostExpensive(fuel: FuelType = 'gasoline', n = 10): Promise<Region[]> {
    const data = await this.getPrices();
    return data.regions
      .filter((r) => r.pricesUSD[fuel] > 0)
      .sort((a, b) => b.pricesUSD[fuel] - a.pricesUSD[fuel])
      .slice(0, n);
  }

  /** Global average for a fuel type across all tracked regions. */
  async globalAverage(fuel: FuelType = 'gasoline'): Promise<number> {
    const data = await this.getPrices();
    const vals = data.regions.map((r) => r.pricesUSD[fuel]).filter((v) => v > 0);
    if (vals.length === 0) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  /** Lists all pre-computed trip endpoints. */
  async listTrips(): Promise<TripIndex> {
    const res = await this.fetcher(`${this.baseUrl}trips/index.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching trips/index.json`);
    return (await res.json()) as TripIndex;
  }

  /** Fetches a single pre-computed trip by slug (e.g. "istanbul-berlin"). */
  async getTrip(slug: string): Promise<Trip> {
    const res = await this.fetcher(`${this.baseUrl}trips/${slug}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching trips/${slug}.json`);
    return (await res.json()) as Trip;
  }
}

/** Convenience singleton for quick one-liners. */
export const worldFuelPrices = new WorldFuelPricesClient();
