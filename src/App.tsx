import { useEffect, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import FuelMap from './components/Map/FuelMap';
import Sidebar from './components/Dashboard/Sidebar';
import type { FuelData, RegionPrice, TripResult } from './types';

export type FuelType = 'average' | 'gasoline' | 'diesel' | 'lpg';
export type ThemeType = 'dark' | 'light' | 'system';
export type ViewMode = 'explore' | 'trip';

function App() {
  const [data, setData] = useState<FuelData | null>(null);
  const [countries, setCountries] = useState<FeatureCollection | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<RegionPrice | null>(null);
  const [activeFuel, setActiveFuel] = useState<FuelType>('average');
  const [theme, setTheme] = useState<ThemeType>('system');
  const [view, setView] = useState<ViewMode>('explore');
  const [trip, setTrip] = useState<TripResult | null>(null);

  useEffect(() => {
    let effectiveTheme = theme;
    if (theme === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark';
    }
    document.documentElement.setAttribute('data-theme', effectiveTheme);
  }, [theme]);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    fetch(`${base}api/v1/prices.json`)
      .then((res) => res.json())
      .then((json: FuelData) => setData(json))
      .catch((err) => console.error('Failed to load prices:', err));

    fetch(`${base}api/v1/countries.geojson`)
      .then((res) => res.json())
      .then((json: FeatureCollection) => setCountries(json))
      .catch((err) => console.error('Failed to load countries:', err));
  }, []);

  return (
    <div className="app-container">
      <Sidebar
        data={data}
        countries={countries}
        selectedRegion={selectedRegion}
        onSelectRegion={setSelectedRegion}
        activeFuel={activeFuel}
        setActiveFuel={setActiveFuel}
        theme={theme}
        setTheme={setTheme}
        view={view}
        setView={setView}
        trip={trip}
        setTrip={setTrip}
      />
      <FuelMap
        data={data}
        countries={countries}
        selectedRegion={selectedRegion}
        activeFuel={activeFuel}
        theme={theme}
        onSelectRegion={setSelectedRegion}
        trip={trip}
      />
    </div>
  );
}

export default App;
