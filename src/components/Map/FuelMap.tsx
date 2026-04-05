import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { FuelData, RegionPrice } from '../../types';
import type { FuelType, ThemeType } from '../../App';

// --- Map helpers ------------------------------------------------------------

const MapEffect = ({
  selectedRegion,
  zoomLevel,
}: {
  selectedRegion: RegionPrice | null;
  zoomLevel: number;
}) => {
  const map = useMap();
  useEffect(() => {
    if (selectedRegion) {
      map.setView([selectedRegion.lat, selectedRegion.lng], 5, {
        animate: true,
        duration: 1.2,
      });
    } else {
      map.setView([30, 0], zoomLevel, { animate: true, duration: 1.2 });
    }
  }, [selectedRegion, map, zoomLevel]);
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

// Builds a DivIcon showing the price on top of the country polygon.
const buildPriceLabelIcon = (price: number, ratio: number | null): L.DivIcon => {
  let tone = 'mid';
  if (ratio != null) {
    if (ratio < 0.7) tone = 'low';
    else if (ratio > 1.3) tone = 'high';
  }
  const html = `<div class="price-label price-label-${tone}">$${price.toFixed(2)}</div>`;
  return L.divIcon({
    className: 'price-label-wrap',
    html,
    iconSize: [52, 20],
    iconAnchor: [26, 10],
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
  selectedRegion: RegionPrice | null;
  activeFuel: FuelType;
  theme: ThemeType;
  onSelectRegion?: (region: RegionPrice | null) => void;
}

export default function FuelMap({
  data,
  selectedRegion,
  activeFuel,
  theme,
  onSelectRegion,
}: FuelMapProps) {
  const [zoom] = useState(2);
  const [currentZoom, setCurrentZoom] = useState(2);
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/v1/countries.geojson`)
      .then((r) => r.json())
      .then((j: FeatureCollection) => setGeojson(j))
      .catch((e) => console.error('GeoJSON load failed:', e));
  }, []);

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

  const featureIso2 = (feature: Feature<Geometry, any>): string => {
    const p = feature.properties || {};
    return String(p.ISO_A2_EH || p.ISO_A2 || p.iso_a2 || '').toUpperCase();
  };

  const styleFor = (feature?: Feature<Geometry, any>) => {
    if (!feature) {
      return {
        weight: 0.5,
        color: '#444',
        fillColor: '#2b2f36',
        fillOpacity: 0.15,
      };
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

  const onEachFeature = (feature: Feature<Geometry, any>, layer: L.Layer) => {
    const iso2 = featureIso2(feature);
    const region = regionById.get(iso2);
    const name = feature.properties?.NAME || feature.properties?.ADMIN || iso2;
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
        (layer as any)._map && (layer as any)._map.eachLayer?.(() => {});
        // Reset by re-applying the computed style.
        l.setStyle(styleFor(feature));
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
        <MapEffect selectedRegion={selectedRegion} zoomLevel={2} />
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
            style={styleFor as any}
            onEachFeature={onEachFeature}
          />
        )}
        {data.regions.map((r) => {
          const price = priceForFuel(r, activeFuel);
          if (price == null) return null;
          // At low zoom levels the world is tiny — only show labels for big
          // markets so the map doesn't drown in overlapping chips. From zoom 4
          // upward, show everything.
          const big = Math.abs(r.lat) + Math.abs(r.lng); // rough proxy, unused
          void big;
          if (currentZoom < 3 && r.pricesUSD.average < 0.5) return null;
          const ratio = globalForFuel > 0 ? price / globalForFuel : null;
          return (
            <Marker
              key={`label-${r.id}`}
              position={[r.lat, r.lng]}
              icon={buildPriceLabelIcon(price, ratio)}
              interactive={false}
              keyboard={false}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
