import { useState } from 'react';
import { Search, Database, ChevronLeft, Sun, Moon, Monitor, Info, Globe, Route } from 'lucide-react';
import type { FeatureCollection } from 'geojson';
import type { FuelData, RegionPrice, TripResult } from '../../types';
import type { FuelType, ThemeType, ViewMode } from '../../App';
import TripCalculator from '../Trip/TripCalculator';

interface SidebarProps {
  data: FuelData | null;
  countries: FeatureCollection | null;
  selectedRegion: RegionPrice | null;
  onSelectRegion: (region: RegionPrice | null) => void;
  activeFuel: FuelType;
  setActiveFuel: (f: FuelType) => void;
  theme: ThemeType;
  setTheme: (t: ThemeType) => void;
  view: ViewMode;
  setView: (v: ViewMode) => void;
  trip: TripResult | null;
  setTrip: (t: TripResult | null) => void;
}

export default function Sidebar({
  data,
  countries,
  selectedRegion,
  onSelectRegion,
  activeFuel,
  setActiveFuel,
  theme,
  setTheme,
  view,
  setView,
  trip,
  setTrip,
}: SidebarProps) {
  const [query, setQuery] = useState('');
  if (!data) return null;

  const normalizedQuery = query.trim().toLowerCase();
  const filteredRegions = normalizedQuery
    ? data.regions.filter(
        (r) =>
          r.name.toLowerCase().includes(normalizedQuery) ||
          r.id.toLowerCase() === normalizedQuery ||
          (r.iso3 && r.iso3.toLowerCase() === normalizedQuery),
      )
    : data.regions;

  const renderIndicator = (price: number) => {
    const ratio = price / data.globalAverageUSD;
    if (ratio < 0.85) return <div className="indicator cheap" title="Below Average" />;
    if (ratio > 1.15) return <div className="indicator expensive" title="Above Average" />;
    return <div className="indicator moderate" title="Average" />;
  };

  return (
    <div className="sidebar glass-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="header-section">
          <h1>Global Fuel Prices</h1>
          <p>Real-time analytics & visual comparisons</p>
        </div>
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px', gap: '4px' }}>
          <button onClick={() => setTheme('light')} title="Light Mode" style={{ background: theme === 'light' ? 'var(--accent-base)' : 'transparent', color: theme === 'light' ? '#fff' : 'var(--text-secondary)', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}><Sun size={14} /></button>
          <button onClick={() => setTheme('dark')} title="Dark Mode" style={{ background: theme === 'dark' ? 'var(--accent-base)' : 'transparent', color: theme === 'dark' ? '#fff' : 'var(--text-secondary)', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}><Moon size={14} /></button>
          <button onClick={() => setTheme('system')} title="System Default" style={{ background: theme === 'system' ? 'var(--accent-base)' : 'transparent', color: theme === 'system' ? '#fff' : 'var(--text-secondary)', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}><Monitor size={14} /></button>
        </div>
      </div>

      <div className="view-toggle" style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px', marginBottom: '10px' }}>
        {([
          { key: 'explore', label: 'Explore', Icon: Globe },
          { key: 'trip', label: 'Trip', Icon: Route },
        ] as const).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            style={{
              flex: 1,
              padding: '8px 4px',
              background: view === key ? 'var(--accent-base)' : 'transparent',
              color: view === key ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {view === 'trip' && (
        <TripCalculator data={data} countries={countries} trip={trip} setTrip={setTrip} />
      )}

      {view === 'explore' && (
      <>
      <div className="fuel-toggles" style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px', marginBottom: '16px' }}>
        {(['average', 'gasoline', 'diesel', 'lpg'] as FuelType[]).map(type => (
          <button
            key={type}
            onClick={() => setActiveFuel(type)}
            style={{
              flex: 1,
              padding: '8px 4px',
              background: activeFuel === type ? 'var(--accent-base)' : 'transparent',
              color: activeFuel === type ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              textTransform: 'capitalize',
              transition: 'all 0.2s'
            }}
          >
            {type === 'average' ? 'All Fuels' : type}
          </button>
        ))}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-title">Global Average ({activeFuel === 'average' ? 'All' : activeFuel})</span>
          <span className="stat-value text-gradient">
            ${activeFuel === 'average' ? data.globalAverageUSD.toFixed(2) : (data.globalAverageUSD * (activeFuel === 'diesel' ? 0.96 : activeFuel === 'lpg' ? 0.58 : 1)).toFixed(2)}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-title">Tracked Regions</span>
          <span className="stat-value text-gradient">{data.regions.length}</span>
        </div>
      </div>

      <div className="search-container">
        <Search className="search-icon" />
        <input
          type="text"
          className="search-input"
          placeholder="Search countries…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="list-container">
        {selectedRegion && (
          <div 
            className="list-item" 
            style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--border-focus)' }}
            onClick={() => onSelectRegion(null)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: 500 }}>
              <ChevronLeft size={18} />
              Back to Global View
            </div>
          </div>
        )}

        {!selectedRegion ? (
          filteredRegions.length === 0 ? (
            <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              No countries match "{query}".
            </div>
          ) : filteredRegions.map(region => {
            const price = region.pricesUSD[activeFuel];
            return (
              <div key={region.id} className="list-item" onClick={() => onSelectRegion(region)}>
                <div className="list-item-left">
                  <span className="item-name">{region.name}</span>
                  <span className="item-region">{region.source ?? region.currency}</span>
                </div>
                <div className="item-price">
                  {price > 0 ? `$${price.toFixed(2)}` : '—'}
                  {price > 0 && renderIndicator(price)}
                </div>
              </div>
            );
          })
        ) : (
          <div className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedRegion.name}</div>
            {(['gasoline', 'diesel', 'lpg', 'average'] as FuelType[]).map(ft => {
              const v = selectedRegion.pricesUSD[ft];
              return (
                <div key={ft} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{ft === 'average' ? 'Average' : ft}</span>
                  <span style={{ color: 'var(--text-primary)' }}>{v > 0 ? `$${v.toFixed(2)} / l` : '—'}</span>
                </div>
              );
            })}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Source: {selectedRegion.source ?? 'n/a'}
            </div>
          </div>
        )}
      </div>

      <div className="legend-container" style={{ padding: '12px', background: 'var(--bg-panel)', borderRadius: '8px', marginTop: '16px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
          <Info size={14} /> Price Legend
        </div>
        <div
          style={{
            height: 10,
            borderRadius: 5,
            // Matches the 7-bin palette used by the choropleth on the map.
            background:
              'linear-gradient(to right, #006837 0%, #31a354 14%, #78c679 28%, #ffffbf 43%, #fdae61 57%, #f46d43 72%, #a50026 100%)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: 4 }}>
          <span>Very cheap</span>
          <span>Average</span>
          <span>Expensive</span>
        </div>
      </div>
      </>
      )}

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', fontStyle: 'italic' }}>
          <strong>Data Sources:</strong> FR/IT/ES/UK live station feeds · US EIA weekly retail · EU27 Weekly Oil Bulletin · World Bank Global Fuel DB · Natural Earth borders.
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>Developer API Access:</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <a href={`${import.meta.env.BASE_URL}api/v1/prices.json`} target="_blank" className="api-badge" style={{flex: 1}}>
            <Database size={14} /> JSON
          </a>
          <a href={`${import.meta.env.BASE_URL}api/v1/prices.xml`} target="_blank" className="api-badge" style={{flex: 1}}>
            <Database size={14} /> XML
          </a>
          <a href={`${import.meta.env.BASE_URL}api/v1/prices.txt`} target="_blank" className="api-badge" style={{flex: 1}}>
            <Database size={14} /> TXT
          </a>
        </div>
      </div>
    </div>
  );
}
