import { useState } from 'react';
import { ArrowRight, LocateFixed, Loader2, MapPin, Play, RotateCcw } from 'lucide-react';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { FuelData, GeoPoint, TripLegCost, TripResult } from '../../types';

// -- Model assumptions ------------------------------------------------------
// The user said: assume the car can drive 900 km on a full tank.
// We pick 50 L as a typical sedan tank size to convert that into litres, so:
//   consumption = 50 / 900 ≈ 5.56 L / 100 km
const TANK_LITRES = 50;
const RANGE_KM = 900;
const LITRES_PER_KM = TANK_LITRES / RANGE_KM;

// Three pre-wired routes the user can load with one click.
const PRESET_ROUTES: Array<{ label: string; from: GeoPoint; to: GeoPoint }> = [
  {
    label: 'Paris → Munich',
    from: { label: 'Paris, France', lat: 48.8566, lng: 2.3522 },
    to: { label: 'Munich, Germany', lat: 48.1374, lng: 11.5755 },
  },
  {
    label: 'Madrid → Warsaw',
    from: { label: 'Madrid, Spain', lat: 40.4168, lng: -3.7038 },
    to: { label: 'Warsaw, Poland', lat: 52.2297, lng: 21.0122 },
  },
  {
    label: 'Istanbul → Berlin',
    from: { label: 'Istanbul, Türkiye', lat: 41.0082, lng: 28.9784 },
    to: { label: 'Berlin, Germany', lat: 52.52, lng: 13.405 },
  },
];

interface Props {
  data: FuelData | null;
  countries: FeatureCollection | null;
  trip: TripResult | null;
  setTrip: (t: TripResult | null) => void;
}

export default function TripCalculator({ data, countries, trip, setTrip }: Props) {
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [fromPoint, setFromPoint] = useState<GeoPoint | null>(null);
  const [toPoint, setToPoint] = useState<GeoPoint | null>(null);
  const [loading, setLoading] = useState<'idle' | 'geocoding' | 'routing' | 'locating'>('idle');
  const [error, setError] = useState<string | null>(null);

  const applyPreset = (p: (typeof PRESET_ROUTES)[number]) => {
    setFromPoint(p.from);
    setToPoint(p.to);
    setFromText(p.from.label);
    setToText(p.to.label);
    setError(null);
  };

  const geocode = async (query: string): Promise<GeoPoint> => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en' },
    });
    if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
    const results = await res.json();
    if (!Array.isArray(results) || results.length === 0) {
      throw new Error(`Could not find "${query}"`);
    }
    const r = results[0];
    return {
      label: r.display_name?.split(',').slice(0, 2).join(',').trim() || query,
      lat: Number(r.lat),
      lng: Number(r.lon),
    };
  };

  const useCurrentLocation = async (slot: 'from' | 'to') => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not available in this browser.');
      return;
    }
    setError(null);
    setLoading('locating');
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 60_000,
        });
      });
      const { latitude, longitude } = pos.coords;
      // Try a reverse-geocode for a nice label, fall back silently.
      let label = `Current location (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`;
      try {
        const rev = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
          { headers: { 'Accept-Language': 'en' } }
        );
        if (rev.ok) {
          const j = await rev.json();
          if (j?.display_name) label = j.display_name.split(',').slice(0, 2).join(',').trim();
        }
      } catch {
        /* ignore */
      }
      const gp: GeoPoint = { label, lat: latitude, lng: longitude };
      if (slot === 'from') {
        setFromPoint(gp);
        setFromText(label);
      } else {
        setToPoint(gp);
        setToText(label);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to get current location.');
    } finally {
      setLoading('idle');
    }
  };

  const calculate = async () => {
    setError(null);
    setLoading('geocoding');
    try {
      // Resolve both endpoints. If the user edited the text field after
      // picking a preset / current location, re-geocode.
      let from = fromPoint;
      let to = toPoint;
      if (!from || from.label !== fromText) from = await geocode(fromText);
      if (!to || to.label !== toText) to = await geocode(toText);
      setFromPoint(from);
      setToPoint(to);

      setLoading('routing');
      const result = await routeAndPrice(from, to, data, countries);
      setTrip(result);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.');
      setTrip(null);
    } finally {
      setLoading('idle');
    }
  };

  const reset = () => {
    setFromText('');
    setToText('');
    setFromPoint(null);
    setToPoint(null);
    setTrip(null);
    setError(null);
  };

  return (
    <div className="trip-panel">
      <div className="trip-form">
        <label className="trip-label">From</label>
        <div className="trip-input-row">
          <input
            className="trip-input"
            placeholder="City, address, landmark…"
            value={fromText}
            onChange={(e) => setFromText(e.target.value)}
          />
          <button
            type="button"
            className="trip-loc-btn"
            title="Use current location"
            onClick={() => useCurrentLocation('from')}
            disabled={loading !== 'idle'}
          >
            <LocateFixed size={14} />
          </button>
        </div>

        <label className="trip-label" style={{ marginTop: 10 }}>
          To
        </label>
        <div className="trip-input-row">
          <input
            className="trip-input"
            placeholder="City, address, landmark…"
            value={toText}
            onChange={(e) => setToText(e.target.value)}
          />
          <button
            type="button"
            className="trip-loc-btn"
            title="Use current location"
            onClick={() => useCurrentLocation('to')}
            disabled={loading !== 'idle'}
          >
            <LocateFixed size={14} />
          </button>
        </div>

        <div className="trip-presets">
          {PRESET_ROUTES.map((p) => (
            <button
              key={p.label}
              type="button"
              className="trip-preset"
              onClick={() => applyPreset(p)}
              disabled={loading !== 'idle'}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="trip-actions">
          <button
            type="button"
            className="trip-calc-btn"
            onClick={calculate}
            disabled={loading !== 'idle' || !fromText || !toText}
          >
            {loading === 'idle' ? <Play size={14} /> : <Loader2 size={14} className="spin" />}
            <span>
              {loading === 'geocoding'
                ? 'Looking up places…'
                : loading === 'routing'
                ? 'Computing route…'
                : loading === 'locating'
                ? 'Getting location…'
                : 'Calculate'}
            </span>
          </button>
          <button
            type="button"
            className="trip-reset-btn"
            onClick={reset}
            disabled={loading !== 'idle'}
            title="Reset"
          >
            <RotateCcw size={14} />
          </button>
        </div>

        {error && <div className="trip-error">{error}</div>}
      </div>

      {trip && <TripReceipt trip={trip} />}

      <div className="trip-footnote">
        Assumes a {TANK_LITRES} L tank delivering {RANGE_KM} km per fill
        (~{(LITRES_PER_KM * 100).toFixed(1)} L / 100 km). Routing via OSRM, geocoding via
        Nominatim (OpenStreetMap).
      </div>
    </div>
  );
}

function TripReceipt({ trip }: { trip: TripResult }) {
  const hours = Math.floor(trip.durationMinutes / 60);
  const mins = Math.round(trip.durationMinutes - hours * 60);
  return (
    <div className="trip-receipt">
      <div className="trip-receipt-header">
        <div className="trip-endpoint">
          <MapPin size={12} />
          <span>{trip.from.label}</span>
        </div>
        <ArrowRight size={14} />
        <div className="trip-endpoint">
          <MapPin size={12} />
          <span>{trip.to.label}</span>
        </div>
      </div>
      <div className="trip-metrics">
        <div>
          <span className="trip-metric-label">Distance</span>
          <span className="trip-metric-value">{trip.totalKm.toFixed(0)} km</span>
        </div>
        <div>
          <span className="trip-metric-label">Drive time</span>
          <span className="trip-metric-value">
            {hours}h {mins}m
          </span>
        </div>
        <div>
          <span className="trip-metric-label">Fuel</span>
          <span className="trip-metric-value">
            {trip.totalLitres.toFixed(1)} L · {trip.totalTanks.toFixed(2)} tanks
          </span>
        </div>
        <div>
          <span className="trip-metric-label">Cost (USD)</span>
          <span className="trip-metric-value trip-metric-cost">
            ${trip.totalCostUSD.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="trip-legs">
        {trip.legs.map((leg, i) => (
          <div key={`${leg.countryId}-${i}`} className="trip-leg">
            <div className="trip-leg-left">
              <span className="trip-leg-country">{leg.countryName}</span>
              <span className="trip-leg-sub">
                {leg.kilometers.toFixed(0)} km · {leg.litres.toFixed(1)} L ·{' '}
                {leg.pricePerLitreUSD > 0
                  ? `$${leg.pricePerLitreUSD.toFixed(2)}/L`
                  : 'no price data'}
              </span>
            </div>
            <div className="trip-leg-cost">
              {leg.pricePerLitreUSD > 0 ? `$${leg.costUSD.toFixed(2)}` : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// -- Routing + country assignment -------------------------------------------

async function routeAndPrice(
  from: GeoPoint,
  to: GeoPoint,
  data: FuelData | null,
  countries: FeatureCollection | null
): Promise<TripResult> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);
  const json = await res.json();
  if (json.code !== 'Ok' || !json.routes?.length) {
    throw new Error('No route found between these two points.');
  }
  const route = json.routes[0];
  const totalKm = route.distance / 1000;
  const durationMinutes = route.duration / 60;
  const coords: Array<[number, number]> = route.geometry.coordinates.map(
    ([lng, lat]: [number, number]) => [lat, lng]
  );

  // Walk the polyline, assigning each segment to the country its midpoint
  // falls inside. Accumulate km per country.
  const perCountry = new Map<string, { km: number; name: string }>();
  for (let i = 1; i < coords.length; i++) {
    const [aLat, aLng] = coords[i - 1];
    const [bLat, bLng] = coords[i];
    const segKm = haversineKm(aLat, aLng, bLat, bLng);
    const midLat = (aLat + bLat) / 2;
    const midLng = (aLng + bLng) / 2;
    const hit = findCountry(midLng, midLat, countries);
    const key = hit?.id ?? 'unknown';
    const name = hit?.name ?? 'Unknown region';
    const prev = perCountry.get(key);
    perCountry.set(key, { km: (prev?.km ?? 0) + segKm, name });
  }

  // Build ordered leg list in the order countries first appear along the route.
  const order: string[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < coords.length; i++) {
    const [aLat, aLng] = coords[i - 1];
    const [bLat, bLng] = coords[i];
    const midLat = (aLat + bLat) / 2;
    const midLng = (aLng + bLng) / 2;
    const hit = findCountry(midLng, midLat, countries);
    const key = hit?.id ?? 'unknown';
    if (!seen.has(key)) {
      seen.add(key);
      order.push(key);
    }
  }

  const legs: TripLegCost[] = order.map((key) => {
    const entry = perCountry.get(key)!;
    const region = data?.regions.find((r) => r.id.toUpperCase() === key.toUpperCase());
    const price = region && region.pricesUSD.gasoline > 0 ? region.pricesUSD.gasoline : 0;
    const litres = entry.km * LITRES_PER_KM;
    const costUSD = litres * price;
    return {
      countryId: key,
      countryName: region?.name || entry.name,
      kilometers: entry.km,
      litres,
      pricePerLitreUSD: price,
      costUSD,
      source: region?.source,
    };
  });

  const totalLitres = totalKm * LITRES_PER_KM;
  const totalTanks = totalKm / RANGE_KM;
  const totalCostUSD = legs.reduce((a, l) => a + l.costUSD, 0);

  return {
    from,
    to,
    totalKm,
    durationMinutes,
    polyline: coords,
    totalLitres,
    totalTanks,
    totalCostUSD,
    legs,
  };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// -- Point-in-country ------------------------------------------------------
// Cheap ray-casting test against the Natural Earth polygons we already bundle.

function findCountry(
  lng: number,
  lat: number,
  countries: FeatureCollection | null
): { id: string; name: string } | null {
  if (!countries) return null;
  for (const feature of countries.features) {
    const bbox = featureBBox(feature);
    if (!bbox) continue;
    if (lng < bbox[0] || lng > bbox[2] || lat < bbox[1] || lat > bbox[3]) continue;
    if (pointInFeature(lng, lat, feature)) {
      const p: any = feature.properties || {};
      const iso2 = (p.ISO_A2_EH || p.ISO_A2 || '').toUpperCase();
      const name = p.NAME || p.ADMIN || iso2 || 'Unknown';
      return { id: iso2 || name, name };
    }
  }
  return null;
}

const bboxCache = new WeakMap<Feature, [number, number, number, number] | null>();
function featureBBox(feature: Feature): [number, number, number, number] | null {
  const cached = bboxCache.get(feature);
  if (cached !== undefined) return cached;
  const g = feature.geometry as Geometry | null;
  if (!g) {
    bboxCache.set(feature, null);
    return null;
  }
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const walk = (coords: any) => {
    if (typeof coords[0] === 'number') {
      const [x, y] = coords;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      return;
    }
    for (const c of coords) walk(c);
  };
  if ('coordinates' in g && g.coordinates) walk(g.coordinates);
  const bbox: [number, number, number, number] | null = isFinite(minX)
    ? [minX, minY, maxX, maxY]
    : null;
  bboxCache.set(feature, bbox);
  return bbox;
}

function pointInFeature(lng: number, lat: number, feature: Feature): boolean {
  const g = feature.geometry;
  if (!g) return false;
  if (g.type === 'Polygon') return pointInPolygon(lng, lat, g.coordinates as number[][][]);
  if (g.type === 'MultiPolygon') {
    for (const poly of g.coordinates as number[][][][]) {
      if (pointInPolygon(lng, lat, poly)) return true;
    }
  }
  return false;
}

function pointInPolygon(lng: number, lat: number, polygon: number[][][]): boolean {
  if (!pointInRing(lng, lat, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i++) {
    if (pointInRing(lng, lat, polygon[i])) return false;
  }
  return true;
}

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1];
    const xj = ring[j][0],
      yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
