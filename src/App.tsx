import { useEffect, useState } from 'react';
import FuelMap from './components/Map/FuelMap';
import Sidebar from './components/Dashboard/Sidebar';
import type { FuelData, RegionPrice } from './types';

export type FuelType = 'average' | 'gasoline' | 'diesel' | 'lpg';
export type ThemeType = 'dark' | 'light' | 'system';

function App() {
  const [data, setData] = useState<FuelData | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<RegionPrice | null>(null);
  const [activeFuel, setActiveFuel] = useState<FuelType>('average');
  const [theme, setTheme] = useState<ThemeType>('system');

  useEffect(() => {
    let effectiveTheme = theme;
    if (theme === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', effectiveTheme);
  }, [theme]);

  // Fetch from our local public directory (will be served as static API on Github Pages)
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/v1/prices.json`)
      .then(res => res.json())
      .then((json: FuelData) => setData(json))
      .catch(err => console.error("Error fetching mock data:", err));
  }, []);

  return (
    <div className="app-container">
      <Sidebar 
        data={data} 
        selectedRegion={selectedRegion} 
        onSelectRegion={setSelectedRegion} 
        activeFuel={activeFuel}
        setActiveFuel={setActiveFuel}
        theme={theme}
        setTheme={setTheme}
      />
      <FuelMap
        data={data}
        selectedRegion={selectedRegion}
        activeFuel={activeFuel}
        theme={theme}
        onSelectRegion={setSelectedRegion}
      />
    </div>
  );
}

export default App;
