# Fuel Prices

An interactive world map of retail fuel prices, built on top of public data from national governments, the European Commission and the World Bank. Countries are shaded by average pump price and labeled with the current value for the selected fuel type. The underlying JSON dataset is regenerated automatically every day so the live site always reflects the latest numbers available from upstream feeds.

🌐 **Live demo:** [aykutsp.github.io/world-fuel-prices](https://aykutsp.github.io/world-fuel-prices/)

![Deploy](https://github.com/aykutsp/world-fuel-prices/actions/workflows/deploy.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-61dafb.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6.svg)
![Vite](https://img.shields.io/badge/Vite-8-646cff.svg)

## ✨ Features

- 🗺 **Choropleth world map** – country polygons are filled on a 7-step green → red scale relative to the global average for the currently selected fuel.
- 🏷 **On-map price labels** – each country shows its current price in USD per litre, rescaled automatically as you zoom.
- ⛽ **Multiple fuel types** – toggle between All Fuels, Gasoline, Diesel and LPG. The choropleth and labels restyle in place.
- 🛰 **Live, station-level data where possible** – France, Italy, Spain, the UK and the United States pull directly from national government feeds that update daily. Remaining countries fall back to the EU Weekly Oil Bulletin and the World Bank Global Fuel Prices Database.
- 🧭 **Trip calculator** – enter a From / To (or use your current location), pick one of the built-in routes, and get a full receipt: total distance, drive time, tanks, per-country fuel cost breakdown, and a route drawn right on the map. Uses OSRM for routing and Nominatim for geocoding. Assumes a 50 L tank with a 900 km range.
- 📦 **Static open data endpoints** – the build ships `prices.json`, `prices.xml` and `prices.txt` under `api/v1/`. No auth, no rate limits.
- 🌓 **Light / dark / system theme** with CARTO base tiles that match.
- 🤖 **Self-updating** – a GitHub Actions workflow regenerates the dataset and redeploys the site on a daily schedule.

## 🛠 Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 19 + Vite 8 |
| Language | TypeScript 5 |
| Mapping | Leaflet + react-leaflet (GeoJSON choropleth) |
| Styling | Plain CSS with CSS variables |
| Data pipeline | Node.js + SheetJS (`xlsx`) |
| Hosting | GitHub Pages (via GitHub Actions) |

## ⚙️ Installation

Prerequisites: **Node.js 20 LTS or newer** and **npm**.

```bash
git clone https://github.com/<your-user>/fuel-prices.git
cd fuel-prices
npm install
```

## 🚀 Usage

Generate the dataset (this hits the upstream feeds once and writes files under `public/api/v1/`):

```bash
npm run generate-data
```

Start the dev server:

```bash
npm run dev
```

Build for production (regenerates data then bundles):

```bash
npm run build
npm run preview   # optional: smoke-test the built output
```

The static API ships inside `dist/` and is also available during `npm run dev`:

| Endpoint | Format |
|---|---|
| `/api/v1/prices.json` | JSON (full payload) |
| `/api/v1/prices.xml`  | XML |
| `/api/v1/prices.txt`  | Plain text summary |
| `/api/v1/countries.geojson` | Country borders (Natural Earth 110m) |

## 📁 Project Structure

```
.
├── .github/
│   └── workflows/
│       └── deploy.yml          # Daily data refresh + GitHub Pages deploy
├── public/
│   └── api/v1/                 # Generated dataset (ignored by git, built in CI)
├── scripts/
│   └── generateData.js         # Data pipeline (fetch → normalize → write)
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── Dashboard/Sidebar.tsx
│   │   └── Map/FuelMap.tsx
│   ├── types.ts
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
├── tsconfig*.json
└── vite.config.ts
```

## 🔧 Configuration

### GitHub Pages subpath

If you deploy under a project page (e.g. `https://your-name.github.io/fuel-prices/`) rather than a user/organisation page, set the base path at build time:

```bash
VITE_BASE_PATH=/fuel-prices/ npm run build
```

The workflow in `.github/workflows/deploy.yml` does this automatically using the repository name.

### Data sources

Per-country priority is `station-level feed > EU Weekly Oil Bulletin > World Bank`:

| Country | Source | License |
|---|---|---|
| 🇫🇷 France | `data.economie.gouv.fr` Prix des carburants (live stations) | Etalab Open Licence 2.0 |
| 🇮🇹 Italy | MIMIT Osservaprezzi (daily CSV) | IODL 2.0 |
| 🇪🇸 Spain | Ministerio REST API (live stations) | Public |
| 🇬🇧 United Kingdom | CMA Road Fuel Price Transparency Scheme (Asda, Sainsbury's, Applegreen, Esso) | Open Government Licence |
| 🇺🇸 United States | EIA weekly retail prices | U.S. public domain |
| 🇪🇺 EU27 (fallback) | European Commission Weekly Oil Bulletin | CC BY 4.0 |
| 🌍 Rest of world | World Bank Global Fuel Prices Database | ODbL |
| Borders | Natural Earth 110m admin_0 | CC0 |

Currency conversion uses live USD rates from `open.er-api.com`, with hardcoded fallbacks if the FX endpoint is unreachable.

## 📌 Roadmap

- [ ] Germany: optional Tankerkönig integration (requires a free API key)
- [ ] Turkey: EPDK SOAP service once registration credentials are available
- [ ] Historical series + sparkline per country
- [ ] Local-currency display toggle
- [ ] City-level drilldown for feeds that expose per-station coordinates
- [ ] Side-by-side country comparison view
- [ ] Configurable tank size / consumption in the trip calculator
- [ ] Save favourite routes

## 📜 Changelog

**v1.1.0** – Trip calculator with from/to geocoding, current-location support, three preset routes, OSRM routing and per-country cost breakdown drawn on the map.

**v1.0.0** – Initial release. Choropleth world map, 129 countries, 5 live station-level feeds, EU Bulletin + World Bank fallback, daily self-updating pipeline.

## 🤝 Contributing

Pull requests are welcome. For non-trivial changes, please open an issue first so we can discuss scope. A few notes:

- Keep the data pipeline in `scripts/generateData.js` self-contained; one function per source, failing gracefully if a feed is down.
- Run `npm run lint` and `npm run build` before submitting.
- When adding a new country feed, include the upstream license in the source header comment and in the README table above.

## 📄 License

Released under the [MIT License](./LICENSE).

The aggregated dataset is redistributed under the terms of each upstream source – see the table above. Attribution to those sources is required when reusing the generated files.
