import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Feature, FeatureCollection, Geometry, GeoJsonProperties } from 'geojson';
import type { PathOptions, StyleFunction } from 'leaflet';
import type { FuelData, RegionPrice, TripResult } from '../../types';
import type { FuelType, ThemeType } from '../../App';

// --- Map helpers ------------------------------------------------------------

const MapEffect = ({
  selectedRegion,
  zoomLevel,
  trip,
}: {
  selectedRegion: RegionPrice | null;
  zoomLevel: number;
  trip?: TripResult | null;
}) => {
  const map = useMap();
  useEffect(() => {
    if (trip && trip.polyline.length > 1) {
      const bounds = L.latLngBounds(trip.polyline.map((p) => L.latLng(p[0], p[1])));
      map.fitBounds(bounds, { padding: [60, 60], animate: true, duration: 1.2 });
      return;
    }
    if (selectedRegion) {
      map.setView([selectedRegion.lat, selectedRegion.lng], 5, {
        animate: true,
        duration: 1.2,
      });
    } else {
      map.setView([30, 0], zoomLevel, { animate: true, duration: 1.2 });
    }
  }, [selectedRegion, map, zoomLevel, trip]);
  return null;
};

// Subscribes to Leaflet's zoom events so React re-renders labels when
// the user zooms in/out (labels become visible at higher zoom levels).
const ZoomTracker = ({ onZoom }: { onZoom: (z: number) => void }) => {
  const map = useMap();
  useEffect(() => {
    const handler = () => onZoom(map.getZoom());
    handler();
    map.on('zoomend', handler);
    return () => {
      map.off('zoomend', handler);
    };
  }, [map, onZoom]);
  return null;
};

// Builds a DivIcon showing the country name and price on top of the polygon.
const buildPriceLabelIcon = (
  name: string,
  price: number,
  ratio: number | null,
  showName: boolean
): L.DivIcon => {
  let tone = 'mid';
  if (ratio != null) {
    if (ratio < 0.7) tone = 'low';
    else if (ratio > 1.3) tone = 'high';
  }
  const safeName = name
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const nameHtml = showName ? `<div class="price-label-name">${safeName}</div>` : '';
  const html = `<div class="price-label price-label-${tone}">${nameHtml}<div class="price-label-value">$${price.toFixed(2)}</div></div>`;
  return L.divIcon({
    className: 'price-label-wrap',
    html,
    iconSize: showName ? [100, 36] : [62, 22],
    iconAnchor: showName ? [50, 18] : [31, 11],
  });
};

// Sequential green→yellow→red palette. Returns hex for a normalized ratio
// (price / globalAverage) bucketed into 7 bins.
function colorForRatio(ratio: number | null): string {
  if (ratio == null || !isFinite(ratio) || ratio <= 0) return '#2b2f36';
  if (ratio < 0.4) return '#006837';
  if (ratio < 0.7) return '#31a354';
  if (ratio < 0.9) return '#78c679';
  if (ratio < 1.1) return '#ffffbf';
  if (ratio < 1.3) return '#fdae61';
  if (ratio < 1.6) return '#f46d43';
  return '#a50026';
}

function priceForFuel(region: RegionPrice, fuel: FuelType): number | null {
  const v = region.pricesUSD[fuel];
  return typeof v === 'number' && v > 0 ? v : null;
}

interface FuelMapProps {
  data: FuelData | null;
  countries: FeatureCollection | null;
  selectedRegion: RegionPrice | null;
  activeFuel: FuelType;
  theme: ThemeType;
  onSelectRegion?: (region: RegionPrice | null) => void;
  trip?: TripResult | null;
}

export default function FuelMap({
  data,
  countries,
  selectedRegion,
  activeFuel,
  theme,
  onSelectRegion,
  trip,
}: FuelMapProps) {
  const [zoom] = useState(2);
  const [currentZoom, setCurrentZoom] = useState(2);
  const geojson = countries;

  // Index regions by ISO-A2 so the GeoJSON styler can find prices fast.
  const regionById = useMemo(() => {
    const map = new Map<string, RegionPrice>();
    if (!data) return map;
    for (const r of data.regions) {
      if (r.id) map.set(r.id.toUpperCase(), r);
    }
    return map;
  }, [data]);

  const globalForFuel = useMemo(() => {
    if (!data) return 0;
    const vals: number[] = [];
    for (const r of data.regions) {
      const v = priceForFuel(r, activeFuel);
      if (v != null) vals.push(v);
    }
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }, [data, activeFuel]);

  if (!data) return <div className="map-container">Loading Global Environment…</div>;

  // ----- Styling and interactions for the choropleth layer ------------------

  const featureIso2 = (feature: Feature<Geometry, GeoJsonProperties>): string => {
    const p = (feature.properties ?? {}) as Record<string, unknown>;
    return String(p.ISO_A2_EH ?? p.ISO_A2 ?? p.iso_a2 ?? '').toUpperCase();
  };

  const styleFor: StyleFunction<GeoJsonProperties> = (feature) => {
    if (!feature) {
      return {
        weight: 0.5,
        color: '#444',
        fillColor: '#2b2f36',
        fillOpacity: 0.15,
      } as PathOptions;
    }
    const iso2 = featureIso2(feature);
    const region = regionById.get(iso2);
    const price = region ? priceForFuel(region, activeFuel) : null;
    const ratio = price != null && globalForFuel > 0 ? price / globalForFuel : null;
    const isSelected = selectedRegion && selectedRegion.id.toUpperCase() === iso2;
    return {
      weight: isSelected ? 2 : 0.6,
      color: isSelected ? '#ffffff' : '#0006',
      fillColor: colorForRatio(ratio),
      fillOpacity: region ? 0.7 : 0.08,
    };
  };

  const onEachFeature = (feature: Feature<Geometry, GeoJsonProperties>, layer: L.Layer) => {
    const iso2 = featureIso2(feature);
    const region = regionById.get(iso2);
    const props = (feature.properties ?? {}) as Record<string, unknown>;
    const name = (props.NAME as string) || (props.ADMIN as string) || iso2;
    const fmt = (v: number | null) => (v != null ? `$${v.toFixed(2)}` : '—');
    if (region) {
      const price = priceForFuel(region, activeFuel);
      const html = `
        <div class="popup-content">
          <div class="popup-title">${region.name}</div>
          <div class="popup-price" style="font-size:16px;margin-bottom:6px;">
            ${activeFuel === 'average' ? 'Average' : activeFuel[0].toUpperCase() + activeFuel.slice(1)}:
            <strong style="color: var(--accent-base)">${fmt(price)}</strong> USD/l
          </div>
          <div style="border-top:1px solid rgba(255,255,255,.1);padding-top:6px;font-size:12px;">
            <div style="display:flex;justify-content:space-between;"><span>⛽ Gasoline</span><strong>${fmt(
              priceForFuel(region, 'gasoline')
            )}</strong></div>
            <div style="display:flex;justify-content:space-between;"><span>🛢️ Diesel</span><strong>${fmt(
              priceForFuel(region, 'diesel')
            )}</strong></div>
            <div style="display:flex;justify-content:space-between;"><span>🚕 LPG</span><strong>${fmt(
              priceForFuel(region, 'lpg')
            )}</strong></div>
          </div>
          <div style="margin-top:6px;font-size:10px;color:var(--text-muted);">Source: ${region.source ?? '—'}</div>
        </div>`;
      layer.bindPopup(html);
    } else {
      layer.bindPopup(`<div class="popup-content"><div class="popup-title">${name}</div><div style="font-size:12px;color:var(--text-muted)">No price data in current datasets.</div></div>`);
    }

    layer.on({
      mouseover: (e) => {
        const l = e.target as L.Path;
        l.setStyle({ weight: 1.8, color: '#fff' });
        l.bringToFront();
      },
      mouseout: (e) => {
        const l = e.target as L.Path;
        // Reset by re-applying the computed style for this feature.
        const resetStyle = styleFor(feature);
        if (resetStyle) l.setStyle(resetStyle);
      },
      click: () => {
        if (region && onSelectRegion) onSelectRegion(region);
      },
    });
  };

  const getTileLayer = () => {
    let effectiveTheme = theme;
    if (theme === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark';
    }
    if (effectiveTheme === 'light') {
      return 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    }
    return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  };

  // React-Leaflet's GeoJSON component caches styles by data identity, so we
  // give it a key that changes whenever the active fuel or selection changes
  // to force a restyle.
  const layerKey = `${activeFuel}-${selectedRegion?.id ?? 'all'}-${globalForFuel.toFixed(3)}`;

  return (
    <div className="map-container">
      <MapContainer
        center={[30, 0]}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        worldCopyJump
      >
        <MapEffect selectedRegion={selectedRegion} zoomLevel={2} trip={trip} />
        <ZoomTracker onZoom={setCurrentZoom} />
        <TileLayer
          key={theme}
          url={getTileLayer()}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a> &middot; Prices: EC Weekly Oil Bulletin, World Bank'
        />
        {geojson && (
          <GeoJSON
            key={layerKey}
            data={geojson}
            style={styleFor}
            onEachFeature={onEachFeature}
          />
        )}
        {trip && trip.polyline.length > 1 && (
          <>
            <Polyline
              positions={trip.polyline}
              pathOptions={{ color: '#ffffff', weight: 6, opacity: 0.35 }}
            />
            <Polyline
              positions={trip.polyline}
              pathOptions={{ color: '#3b82f6', weight: 3.5, opacity: 0.95 }}
            />
            <Marker
              position={trip.polyline[0]}
              icon={L.divIcon({
                className: 'trip-endpoint-pin',
                html: '<div class="trip-pin trip-pin-from">A</div>',
                iconSize: [22, 22],
                iconAnchor: [11, 11],
              })}
            />
            <Marker
              position={trip.polyline[trip.polyline.length - 1]}
              icon={L.divIcon({
                className: 'trip-endpoint-pin',
                html: '<div class="trip-pin trip-pin-to">B</div>',
                iconSize: [22, 22],
                iconAnchor: [11, 11],
              })}
            />
          </>
        )}
        {data.regions.map((r) => {
          const price = priceForFuel(r, activeFuel);
          if (price == null) return null;
          if (currentZoom < 3 && r.pricesUSD.average < 0.5) return null;
          const ratio = globalForFuel > 0 ? price / globalForFuel : null;
          // Show the country name alongside the price once the map is zoomed
          // in enough for labels not to overlap (zoom ≥ 4).
          const showName = currentZoom >= 4;
          return (
            <Marker
              key={`label-${r.id}`}
              position={[r.lat, r.lng]}
              icon={buildPriceLabelIcon(r.name, price, ratio, showName)}
              interactive={false}
              keyboard={false}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
