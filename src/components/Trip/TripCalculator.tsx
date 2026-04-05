import { useState } from 'react';
import {
  ArrowRight,
  LocateFixed,
  Loader2,
  MapPin,
  Play,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { FuelData, GeoPoint, TripRefuel, TripResult } from '../../types';

// -- Model assumptions ------------------------------------------------------
// Full tank: 50 L = 900 km → consumption ~5.56 L / 100 km.
// Driver tops up when the tank drops to 2 % reserve (1 L, ≈ 18 km buffer),
// so each refill after the starting fill puts 49 L into the tank.
const TANK_LITRES = 50;
const RANGE_KM = 900;
const RESERVE_FRACTION = 0.02;
const USABLE_KM_PER_TANK = RANGE_KM * (1 - RESERVE_FRACTION); // 882 km
const REFILL_LITRES = TANK_LITRES * (1 - RESERVE_FRACTION);   // 49 L
const LITRES_PER_KM = TANK_LITRES / RANGE_KM;

const MAX_STOPS = 8; // max intermediate stops (total waypoints = 2 + MAX_STOPS)

// Built-in routes the user can load with one click.
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

type WaypointKind = 'from' | 'stop' | 'to';
interface Waypoint {
  id: string;
  kind: WaypointKind;
  text: string;
  point: GeoPoint | null;
}

let wpCounter = 0;
const makeWp = (kind: WaypointKind, text = '', point: GeoPoint | null = null): Waypoint => ({
  id: `wp-${++wpCounter}`,
  kind,
  text,
  point,
});

interface Props {
  data: FuelData | null;
  countries: FeatureCollection | null;
  trip: TripResult | null;
  setTrip: (t: TripResult | null) => void;
}

export default function TripCalculator({ data, countries, trip, setTrip }: Props) {
  const [waypoints, setWaypoints] = useState<Waypoint[]>(() => [makeWp('from'), makeWp('to')]);
  const [loading, setLoading] = useState<'idle' | 'geocoding' | 'routing' | 'locating'>('idle');
  const [error, setError] = useState<string | null>(null);

  const stopCount = waypoints.filter((w) => w.kind === 'stop').length;

  const updateWp = (id: string, patch: Partial<Waypoint>) => {
    setWaypoints((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  };

  const addStop = () => {
    if (stopCount >= MAX_STOPS) return;
    setWaypoints((prev) => {
      const out = [...prev];
      out.splice(out.length - 1, 0, makeWp('stop'));
      return out;
    });
  };

  const removeStop = (id: string) => {
    setWaypoints((prev) => prev.filter((w) => w.id !== id));
  };

  const applyPreset = (p: (typeof PRESET_ROUTES)[number]) => {
    setWaypoints([makeWp('from', p.from.label, p.from), makeWp('to', p.to.label, p.to)]);
    setError(null);
  };

  const resetAll = () => {
    setWaypoints([makeWp('from'), makeWp('to')]);
    setTrip(null);
    setError(null);
  };

  const geocode = async (query: string): Promise<GeoPoint> => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
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

  const useCurrentLocation = async (id: string) => {
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
      updateWp(id, { text: label, point: { label, lat: latitude, lng: longitude } });
    } catch (e: any) {
      setError(e?.message || 'Failed to get current location.');
    } finally {
      setLoading('idle');
    }
  };

  const calculate = async () => {
    setError(null);
    const slots = waypoints;
    if (slots.some((w) => !w.text.trim())) {
      setError('Please fill in every From / Stop / To field.');
      return;
    }
    try {
      setLoading('geocoding');
      const resolved: GeoPoint[] = [];
      for (const w of slots) {
        if (w.point && w.point.label === w.text) {
          resolved.push(w.point);
        } else {
          resolved.push(await geocode(w.text));
        }
      }
      // Write back resolved points so subsequent edits can skip geocoding.
      setWaypoints((prev) => prev.map((w, i) => ({ ...w, point: resolved[i] })));

      setLoading('routing');
      const result = await routeAndPrice(resolved, data, countries);
      setTrip(result);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.');
      setTrip(null);
    } finally {
      setLoading('idle');
    }
  };

  const from = waypoints[0];
  const to = waypoints[waypoints.length - 1];
  const stops = waypoints.slice(1, -1);

  return (
    <div className="trip-panel">
      <div className="trip-form">
        <WaypointRow
          waypoint={from}
          labelText="From"
          loading={loading !== 'idle'}
          onText={(t) => updateWp(from.id, { text: t })}
          onLocate={() => useCurrentLocation(from.id)}
        />

        {stops.map((s, i) => (
          <WaypointRow
            key={s.id}
            waypoint={s}
            labelText={`Stop ${i + 1}`}
            loading={loading !== 'idle'}
            onText={(t) => updateWp(s.id, { text: t })}
            onLocate={() => useCurrentLocation(s.id)}
            onRemove={() => removeStop(s.id)}
          />
        ))}

        <WaypointRow
          waypoint={to}
          labelText="To"
          loading={loading !== 'idle'}
          onText={(t) => updateWp(to.id, { text: t })}
          onLocate={() => useCurrentLocation(to.id)}
        />

        <button
          type="button"
          className="trip-add-stop"
          onClick={addStop}
          disabled={loading !== 'idle' || stopCount >= MAX_STOPS}
        >
          <Plus size={12} /> Add stop{stopCount >= MAX_STOPS ? ` (max ${MAX_STOPS})` : ''}
        </button>

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
            disabled={loading !== 'idle' || waypoints.some((w) => !w.text.trim())}
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
            onClick={resetAll}
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
        Assumes a {TANK_LITRES} L tank with {RANGE_KM} km range
        (~{(LITRES_PER_KM * 100).toFixed(1)} L / 100 km). Starts with a full tank at the origin and
        refuels {REFILL_LITRES.toFixed(0)} L whenever the tank drops to {Math.round(RESERVE_FRACTION * 100)} %
        reserve (~{USABLE_KM_PER_TANK.toFixed(0)} km per fill). Routing via OSRM, geocoding via
        Nominatim (OpenStreetMap).
      </div>
    </div>
  );
}

// ---------- Waypoint input row ---------------------------------------------

function WaypointRow({
  waypoint,
  labelText,
  loading,
  onText,
  onLocate,
  onRemove,
}: {
  waypoint: Waypoint;
  labelText: string;
  loading: boolean;
  onText: (t: string) => void;
  onLocate: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="trip-wp">
      <label className="trip-label">{labelText}</label>
      <div className="trip-input-row">
        <input
          className="trip-input"
          placeholder="City, address, landmark…"
          value={waypoint.text}
          onChange={(e) => onText(e.target.value)}
        />
        <button
          type="button"
          className="trip-loc-btn"
          title="Use current location"
          onClick={onLocate}
          disabled={loading}
        >
          <LocateFixed size={14} />
        </button>
        {onRemove && (
          <button
            type="button"
            className="trip-loc-btn trip-remove-btn"
            title="Remove stop"
            onClick={onRemove}
            disabled={loading}
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- Trip receipt ----------------------------------------------------

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
          <span className="trip-metric-label">Fuel pumped</span>
          <span className="trip-metric-value">
            {trip.totalLitres.toFixed(1)} L · {trip.refuels.length} stop
            {trip.refuels.length === 1 ? '' : 's'}
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
        {trip.refuels.map((r, i) => (
          <div key={i} className="trip-leg">
            <div className="trip-leg-left">
              <span className="trip-leg-country">
                {r.isInitial ? 'Start · ' : `@ ${r.atKm.toFixed(0)} km · `}
                {r.countryName}
              </span>
              <span className="trip-leg-sub">
                {r.litres.toFixed(0)} L ·{' '}
                {r.pricePerLitreUSD > 0
                  ? `$${r.pricePerLitreUSD.toFixed(2)}/L`
                  : 'no price data'}
              </span>
            </div>
            <div className="trip-leg-cost">
              {r.pricePerLitreUSD > 0 ? `$${r.costUSD.toFixed(2)}` : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Routing + cost model -------------------------------------------

async function routeAndPrice(
  waypoints: GeoPoint[],
  data: FuelData | null,
  countries: FeatureCollection | null
): Promise<TripResult> {
  const coordsStr = waypoints.map((w) => `${w.lng},${w.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson&steps=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);
  const json = await res.json();
  if (json.code !== 'Ok' || !json.routes?.length) {
    throw new Error('No route found for these waypoints.');
  }
  const route = json.routes[0];
  const totalKm = route.distance / 1000;
  const durationMinutes = route.duration / 60;
  const polyline: Array<[number, number]> = route.geometry.coordinates.map(
    ([lng, lat]: [number, number]) => [lat, lng]
  );

  // Refuel schedule:
  //   fill #0  = full 50 L at origin
  //   fill #k  = 49 L at the country you are in at cumulative distance k * 882 km
  //              (once the tank has dropped to 2 % reserve)
  const refuels: TripRefuel[] = [];

  const originHit = resolvePrice(waypoints[0].lng, waypoints[0].lat, countries, data);
  refuels.push({
    countryId: originHit.id,
    countryName: originHit.name,
    atKm: 0,
    litres: TANK_LITRES,
    pricePerLitreUSD: originHit.price,
    costUSD: TANK_LITRES * originHit.price,
    source: originHit.source,
    isInitial: true,
  });

  let coveredKm = Math.min(USABLE_KM_PER_TANK, totalKm);
  while (coveredKm < totalKm) {
    const [lat, lng] = pointOnPolylineAtKm(polyline, coveredKm);
    const hit = resolvePrice(lng, lat, countries, data);
    refuels.push({
      countryId: hit.id,
      countryName: hit.name,
      atKm: coveredKm,
      litres: REFILL_LITRES,
      pricePerLitreUSD: hit.price,
      costUSD: REFILL_LITRES * hit.price,
      source: hit.source,
      isInitial: false,
    });
    coveredKm += USABLE_KM_PER_TANK;
  }

  const totalLitres = refuels.reduce((a, r) => a + r.litres, 0);
  const totalCostUSD = refuels.reduce((a, r) => a + r.costUSD, 0);
  const totalTanks = totalLitres / TANK_LITRES;

  return {
    from: waypoints[0],
    to: waypoints[waypoints.length - 1],
    totalKm,
    durationMinutes,
    polyline,
    totalLitres,
    totalTanks,
    totalCostUSD,
    refuels,
  };
}

interface PriceHit {
  id: string;
  name: string;
  price: number;
  source?: string;
}

function resolvePrice(
  lng: number,
  lat: number,
  countries: FeatureCollection | null,
  data: FuelData | null
): PriceHit {
  const hit = findCountry(lng, lat, countries);
  if (!hit) return { id: 'unknown', name: 'International waters / no data', price: 0 };
  const region = data?.regions.find((r) => r.id.toUpperCase() === hit.id.toUpperCase());
  const price = region && region.pricesUSD.gasoline > 0 ? region.pricesUSD.gasoline : 0;
  return {
    id: hit.id,
    name: region?.name || hit.name,
    price,
    source: region?.source,
  };
}

// ---------- Geometry helpers -----------------------------------------------

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

function pointOnPolylineAtKm(
  polyline: Array<[number, number]>,
  targetKm: number
): [number, number] {
  let acc = 0;
  for (let i = 1; i < polyline.length; i++) {
    const [aLat, aLng] = polyline[i - 1];
    const [bLat, bLng] = polyline[i];
    const d = haversineKm(aLat, aLng, bLat, bLng);
    if (acc + d >= targetKm) {
      const t = d === 0 ? 0 : (targetKm - acc) / d;
      return [aLat + (bLat - aLat) * t, aLng + (bLng - aLng) * t];
    }
    acc += d;
  }
  return polyline[polyline.length - 1];
}

// ---------- Point-in-country ------------------------------------------------

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
