// Builds /public/api/v1/prices.{json,xml,txt} and /public/api/v1/countries.geojson
// by combining multiple public data sources in priority order.
//
// Per-country priority (highest first — "station-sign accurate" sources win):
//
//   1) National official station-level feeds (daily, per-station):
//        FR  data.economie.gouv.fr (Etalab OL 2.0)         — gazole, SP98, E10, GPLc
//        IT  MIMIT Osservaprezzi   (IODL 2.0)              — Benzina, Gasolio, GPL
//        ES  Minetur REST API      (public)                — Gasolina 95 E5, Gasóleo A, GLP
//        GB  UK CMA fuel transparency scheme (per retailer, Open Gov Licence)
//              — Asda, Sainsbury's, Applegreen, Esso (E10, B7)
//
//      NOT YET INTEGRATED (require credentials/keys):
//        DE  Tankerkönig           — free API key required (register once at creativecommons.tankerkoenig.de)
//        TR  EPDK SOAP web service — requires registration with EPDK (sorguNo=72)
//
//   2) European Commission Weekly Oil Bulletin (prices WITH taxes) — fills EU27
//      License: Commission reuse policy (Decision 2011/833/EU, CC BY 4.0).
//
//   3) World Bank Global Fuel Prices Database (monthly, ~160 countries) — covers rest of world
//      License: Open Database License (ODbL).
//
// Country borders for the Leaflet choropleth come from Natural Earth 110m admin_0
// (public domain, CC0).

import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

// ----------------------------- Data source URLs -----------------------------

const EU_BULLETIN_URL =
  'https://energy.ec.europa.eu/document/download/264c2d0f-f161-4ea3-a777-78faae59bea0_en';
const WB_DB_URL =
  'https://datacatalogfiles.worldbank.org/ddh-published/0066829/DR0095290/Global_Fuel_Prices_Database.xlsx';
const NE_COUNTRIES_GEOJSON_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';

// EU bulletin row labels -> ISO 3166-1 alpha-2
const EU_NAME_TO_ISO2 = {
  Austria: 'AT',
  Belgium: 'BE',
  Bulgaria: 'BG',
  Croatia: 'HR',
  Cyprus: 'CY',
  Czechia: 'CZ',
  'Czech Republic': 'CZ',
  Denmark: 'DK',
  Estonia: 'EE',
  Finland: 'FI',
  France: 'FR',
  Germany: 'DE',
  Greece: 'GR',
  Hungary: 'HU',
  Ireland: 'IE',
  Italy: 'IT',
  Latvia: 'LV',
  Lithuania: 'LT',
  Luxembourg: 'LU',
  Malta: 'MT',
  Netherlands: 'NL',
  Poland: 'PL',
  Portugal: 'PT',
  Romania: 'RO',
  Slovakia: 'SK',
  Slovenia: 'SI',
  Spain: 'ES',
  Sweden: 'SE',
};

// --------------------------------- Helpers ---------------------------------

async function fetchBuffer(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'fuel-prices-aggregator/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'fuel-prices-aggregator/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

function round(n, d = 3) {
  return Number(Number(n).toFixed(d));
}

// ------------------------------ EU Bulletin --------------------------------
//
// Column layout in the xlsx (1 header row + 1 units row):
//   A: country / aggregate name
//   B: Euro-super 95        EUR per 1000 L
//   C: Diesel (auto)         EUR per 1000 L
//   D: Heating gas oil       (ignored)
//   E-F: Fuel oil            (ignored)
//   G: LPG                   EUR per 1000 L
//
// Aggregates at the bottom (EU27, Euro Area 20) are skipped.

async function loadEUPrices() {
  console.log('Fetching EU Weekly Oil Bulletin...');
  const buf = await fetchBuffer(EU_BULLETIN_URL);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  const out = {}; // iso2 -> { gasoline, diesel, lpg } in EUR/l
  for (const row of rows) {
    const label = row[0];
    if (typeof label !== 'string') continue;
    const key = label.trim();
    const iso2 = EU_NAME_TO_ISO2[key];
    if (!iso2) continue;
    const gasoline1000 = row[1];
    const diesel1000 = row[2];
    const lpg1000 = row[6];
    const gasoline = typeof gasoline1000 === 'number' ? gasoline1000 / 1000 : null;
    const diesel = typeof diesel1000 === 'number' ? diesel1000 / 1000 : null;
    const lpg = typeof lpg1000 === 'number' ? lpg1000 / 1000 : null;
    out[iso2] = { gasoline, diesel, lpg };
  }
  console.log(`  ✓ EU Bulletin: ${Object.keys(out).length} countries`);
  return out;
}

// Live FX rates. Returns map of ISO currency code -> USD per 1 unit.
// Falls back to hardcoded approximations if the live endpoint is unreachable.
async function loadUsdRates() {
  const fallback = { USD: 1.0, EUR: 1.08, GBP: 1.26 };
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const rates = json?.rates || {};
    const out = { USD: 1.0 };
    for (const ccy of ['EUR', 'GBP']) {
      const perUsd = rates[ccy];
      out[ccy] = typeof perUsd === 'number' && perUsd > 0 ? 1 / perUsd : fallback[ccy];
    }
    return out;
  } catch (e) {
    console.warn('  ⚠ Live FX unavailable, using fallback rates');
    return fallback;
  }
}

// --------------------------- World Bank Database ---------------------------
//
// Relevant sheets (already converted to USD/liter):
//   - "Reg Gasoline (below RON 95) USD"
//   - "Premium Gasoline RON95or ab USD"   (fallback if Regular missing)
//   - "Diesel USD"
//   - "LPG USD"
//
// Column layout per sheet:
//   0 desc, 1 country, 2 iso3, 3 orig units, 4 converted, 5 default MAP,
//   6..N monthly values (oldest -> newest).

function extractLatestPerIso3(wb, sheetName) {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return {};
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const result = {};
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[2]) continue;
    const iso3 = String(row[2]).trim().toUpperCase();
    // Find last numeric column (scan from the right).
    let latest = null;
    for (let j = row.length - 1; j >= 6; j--) {
      const v = row[j];
      if (typeof v === 'number' && isFinite(v) && v > 0) {
        latest = v;
        break;
      }
    }
    if (latest != null) result[iso3] = latest;
  }
  return result;
}

async function loadWorldBankPrices() {
  console.log('Fetching World Bank Global Fuel Prices Database (~5 MB)...');
  const buf = await fetchBuffer(WB_DB_URL);
  const wb = XLSX.read(buf, { type: 'buffer' });

  const regular = extractLatestPerIso3(wb, 'Reg Gasoline (below RON 95) USD');
  const premium = extractLatestPerIso3(wb, 'Premium Gasoline RON95or ab USD');
  const diesel = extractLatestPerIso3(wb, 'Diesel USD');
  const lpg = extractLatestPerIso3(wb, 'LPG USD');

  const iso3List = new Set([
    ...Object.keys(regular),
    ...Object.keys(premium),
    ...Object.keys(diesel),
    ...Object.keys(lpg),
  ]);

  const out = {};
  for (const iso3 of iso3List) {
    out[iso3] = {
      gasoline: regular[iso3] ?? premium[iso3] ?? null,
      diesel: diesel[iso3] ?? null,
      lpg: lpg[iso3] ?? null,
    };
  }
  console.log(`  ✓ World Bank: ${Object.keys(out).length} countries`);
  return out;
}

// -------------------------------- GeoJSON ----------------------------------
//
// We use Natural Earth 110m admin_0 countries. Feature properties expose
// ISO_A2_EH (or ISO_A2), ISO_A3_EH (or ADM0_A3), NAME.

function featureCentroid(geometry) {
  // Bounding-box center is good enough for marker/selection purposes.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const walk = (coords) => {
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
  if (geometry?.coordinates) walk(geometry.coordinates);
  if (!isFinite(minX)) return { lat: 0, lng: 0 };
  return { lat: (minY + maxY) / 2, lng: (minX + maxX) / 2 };
}

async function loadGeoJson() {
  console.log('Fetching Natural Earth countries GeoJSON...');
  const text = await fetchText(NE_COUNTRIES_GEOJSON_URL);
  const geo = JSON.parse(text);
  const byIso2 = {};
  const byIso3 = {};
  for (const feature of geo.features) {
    const p = feature.properties || {};
    const iso2 = (p.ISO_A2_EH || p.ISO_A2 || '').toUpperCase();
    const iso3 = (p.ADM0_A3 || p.ISO_A3_EH || p.ISO_A3 || '').toUpperCase();
    const name = p.NAME || p.ADMIN || iso3 || iso2 || '';
    const centroid = featureCentroid(feature.geometry);
    const entry = { iso2, iso3, name, lat: centroid.lat, lng: centroid.lng };
    if (iso2 && iso2 !== '-99') byIso2[iso2] = entry;
    if (iso3 && iso3 !== '-99') byIso3[iso3] = entry;
  }
  console.log(
    `  ✓ GeoJSON: ${geo.features.length} features, ${Object.keys(byIso2).length} by ISO2`
  );
  return { geo, byIso2, byIso3, raw: text };
}

// ---------------------- Station-level national feeds -----------------------
//
// Each loader returns `{ gasoline, diesel, lpg }` in LOCAL CURRENCY per litre
// together with `{ currency, stationCount, source }` metadata. Averages are
// computed across all active stations — closest approximation to "what you'd
// pay at a random pump today".

async function loadFR() {
  // France — data.economie.gouv.fr Opendatasoft v2.1 API supports server-side
  // aggregation, so a single request returns the national average per fuel.
  // Fuel mapping: E10 ≈ 95 octane (dominant in FR), SP98 = 98 octane, Gazole = diesel.
  // LPG in FR (GPLc) is mostly unavailable now; we still query it.
  try {
    console.log('Fetching FR (data.economie.gouv.fr, live stations)...');
    const url =
      'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records?select=avg(gazole_prix)%20as%20diesel,%20avg(e10_prix)%20as%20e10,%20avg(sp98_prix)%20as%20sp98,%20avg(gplc_prix)%20as%20lpg,%20count(*)%20as%20n&limit=1';
    const res = await fetch(url, { headers: { 'User-Agent': 'fuel-prices-aggregator/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const r = json.results?.[0];
    if (!r) throw new Error('no results');
    return {
      iso2: 'FR',
      currency: 'EUR',
      prices: {
        gasoline: typeof r.e10 === 'number' ? r.e10 : null,
        diesel: typeof r.diesel === 'number' ? r.diesel : null,
        lpg: typeof r.lpg === 'number' && r.lpg > 0 ? r.lpg : null,
      },
      stationCount: r.n ?? null,
      source: 'data.economie.gouv.fr (live stations)',
    };
  } catch (e) {
    console.warn(`  ✗ FR failed: ${e.message}`);
    return null;
  }
}

async function loadIT() {
  // Italy — MIMIT Osservaprezzi daily dump. Columns: idImpianto|descCarburante|prezzo|isSelf|dtComu.
  // `descCarburante` values we care about: "Benzina", "Gasolio", "GPL". We use only
  // the servito (isSelf=0) OR self (isSelf=1) row, preferring self-service when both
  // exist. We average per fuel across all stations.
  try {
    console.log('Fetching IT (MIMIT Osservaprezzi, daily CSV)...');
    const res = await fetch('https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv', {
      headers: { 'User-Agent': 'fuel-prices-aggregator/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    // First line is "Estrazione del YYYY-MM-DD", second line is header.
    const lines = text.split(/\r?\n/);
    const sums = { Benzina: 0, Gasolio: 0, GPL: 0 };
    const counts = { Benzina: 0, Gasolio: 0, GPL: 0 };
    // Prefer self-service price when both exist for same station+fuel.
    const seen = new Map(); // key: `${id}|${fuel}` -> price
    for (let i = 2; i < lines.length; i++) {
      const parts = lines[i].split('|');
      if (parts.length < 4) continue;
      const [id, fuel, priceStr, isSelf] = parts;
      if (!(fuel in sums)) continue;
      const price = Number(priceStr);
      if (!isFinite(price) || price <= 0) continue;
      const key = `${id}|${fuel}`;
      const prev = seen.get(key);
      // Prefer self-service (isSelf === '1') over servito.
      if (!prev || (isSelf === '1' && prev.isSelf !== '1')) {
        seen.set(key, { price, isSelf });
      }
    }
    for (const [key, { price }] of seen) {
      const fuel = key.split('|')[1];
      sums[fuel] += price;
      counts[fuel] += 1;
    }
    const avg = (k) => (counts[k] > 0 ? sums[k] / counts[k] : null);
    return {
      iso2: 'IT',
      currency: 'EUR',
      prices: {
        gasoline: avg('Benzina'),
        diesel: avg('Gasolio'),
        lpg: avg('GPL'),
      },
      stationCount: Math.max(...Object.values(counts)),
      source: 'MIMIT Osservaprezzi (live stations)',
    };
  } catch (e) {
    console.warn(`  ✗ IT failed: ${e.message}`);
    return null;
  }
}

async function loadES() {
  // Spain — Ministerio para la Transición Ecológica REST API. Prices use comma
  // as decimal separator in the JSON. Fields of interest:
  //   "Precio Gasolina 95 E5"  — unleaded 95
  //   "Precio Gasoleo A"        — automotive diesel
  //   "Precio Gases licuados del petróleo" — LPG
  try {
    console.log('Fetching ES (Minetur REST, live stations)...');
    const res = await fetch(
      'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/',
      { headers: { 'User-Agent': 'fuel-prices-aggregator/1.0' } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const stations = json.ListaEESSPrecio || [];
    const parse = (v) => {
      if (typeof v !== 'string' || !v) return null;
      const n = Number(v.replace(',', '.'));
      return isFinite(n) && n > 0 ? n : null;
    };
    let gSum = 0, gCnt = 0, dSum = 0, dCnt = 0, lSum = 0, lCnt = 0;
    for (const s of stations) {
      const g = parse(s['Precio Gasolina 95 E5']);
      const d = parse(s['Precio Gasoleo A']);
      const l = parse(s['Precio Gases licuados del petróleo']);
      if (g != null) { gSum += g; gCnt++; }
      if (d != null) { dSum += d; dCnt++; }
      if (l != null) { lSum += l; lCnt++; }
    }
    return {
      iso2: 'ES',
      currency: 'EUR',
      prices: {
        gasoline: gCnt ? gSum / gCnt : null,
        diesel: dCnt ? dSum / dCnt : null,
        lpg: lCnt ? lSum / lCnt : null,
      },
      stationCount: stations.length,
      source: 'Minetur Servicios REST (live stations)',
    };
  } catch (e) {
    console.warn(`  ✗ ES failed: ${e.message}`);
    return null;
  }
}

async function loadGB() {
  // United Kingdom — CMA Road Fuel Price Transparency Scheme. Each participating
  // retailer publishes their own JSON at a well-known URL. We fetch a handful
  // and aggregate. Prices are pence/litre (divide by 100 for GBP/litre).
  // Fuel mapping: E10 = unleaded 95, E5 = 97+ premium, B7 = regular diesel.
  const retailers = [
    { name: 'Asda', url: 'https://storelocator.asda.com/fuel_prices_data.json' },
    { name: "Sainsbury's", url: 'https://api.sainsburys.co.uk/v1/exports/latest/fuel_prices_data.json' },
    { name: 'Applegreen', url: 'https://applegreenstores.com/fuel-prices/data.json' },
    { name: 'Esso', url: 'https://fuelprices.esso.co.uk/latestdata.json' },
  ];
  console.log('Fetching GB (UK CMA transparency scheme)...');
  let gSum = 0, gCnt = 0, dSum = 0, dCnt = 0;
  const okRetailers = [];
  for (const r of retailers) {
    try {
      const res = await fetch(r.url, { headers: { 'User-Agent': 'fuel-prices-aggregator/1.0' } });
      if (!res.ok) { console.warn(`  ✗ ${r.name}: HTTP ${res.status}`); continue; }
      const json = await res.json();
      const stations = json.stations || [];
      for (const s of stations) {
        const p = s.prices || {};
        if (typeof p.E10 === 'number' && p.E10 > 0) { gSum += p.E10; gCnt++; }
        if (typeof p.B7 === 'number' && p.B7 > 0) { dSum += p.B7; dCnt++; }
      }
      okRetailers.push(`${r.name}(${stations.length})`);
    } catch (e) {
      console.warn(`  ✗ ${r.name}: ${e.message}`);
    }
  }
  if (!gCnt && !dCnt) {
    console.warn('  ✗ GB: no retailer data');
    return null;
  }
  // Prices come in pence — convert to GBP/l
  return {
    iso2: 'GB',
    currency: 'GBP',
    prices: {
      gasoline: gCnt ? gSum / gCnt / 100 : null,
      diesel: dCnt ? dSum / dCnt / 100 : null,
      lpg: null, // UK retailers in scheme don't report LPG in standard JSON.
    },
    stationCount: gCnt,
    source: `UK CMA scheme (${okRetailers.join(', ')})`,
  };
}

async function loadUS() {
  // United States — US Energy Information Administration (EIA) weekly retail
  // average prices. Data is public domain (US federal government work).
  //   EMM_EPMR_PTE_NUS_DPGw.xls  = weekly Regular gasoline (US avg, $/gal)
  //   EMD_EPD2D_PTE_NUS_DPGw.xls = weekly Ultra-low-sulfur on-highway Diesel (US avg, $/gal)
  // We grab the most recent numeric row from "Data 1" sheet and convert
  // from USD/gallon to USD/litre (1 gallon = 3.78541 litres).
  const GAL_TO_L = 3.78541;
  const urls = {
    gasoline: 'https://www.eia.gov/dnav/pet/hist_xls/EMM_EPMR_PTE_NUS_DPGw.xls',
    diesel: 'https://www.eia.gov/dnav/pet/hist_xls/EMD_EPD2D_PTE_NUS_DPGw.xls',
  };
  try {
    console.log('Fetching US (EIA weekly retail, $/gal → $/L)...');
    const extract = async (url) => {
      const buf = await fetchBuffer(url);
      const wb = XLSX.read(buf, { type: 'buffer' });
      const sheet = wb.Sheets['Data 1'];
      if (!sheet) return null;
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
      for (let i = rows.length - 1; i >= 3; i--) {
        const row = rows[i];
        if (row && typeof row[0] === 'number' && typeof row[1] === 'number' && row[1] > 0) {
          return row[1];
        }
      }
      return null;
    };
    const [gasGal, dieGal] = await Promise.all([extract(urls.gasoline), extract(urls.diesel)]);
    if (gasGal == null && dieGal == null) throw new Error('no data');
    return {
      iso2: 'US',
      currency: 'USD',
      prices: {
        gasoline: gasGal != null ? gasGal / GAL_TO_L : null,
        diesel: dieGal != null ? dieGal / GAL_TO_L : null,
        lpg: null, // EIA doesn't publish weekly retail LPG/autogas.
      },
      stationCount: null,
      source: 'EIA weekly retail (U.S. national average)',
    };
  } catch (e) {
    console.warn(`  ✗ US failed: ${e.message}`);
    return null;
  }
}

async function loadAllStationLevel() {
  const loaders = [loadFR, loadIT, loadES, loadGB, loadUS];
  const results = await Promise.all(loaders.map((fn) => fn().catch(() => null)));
  const map = {};
  for (const r of results) {
    if (r && r.iso2) {
      map[r.iso2] = r;
      const p = r.prices;
      const fmt = (v) => (v != null ? v.toFixed(3) : '—');
      console.log(
        `  ✓ ${r.iso2}: G=${fmt(p.gasoline)} D=${fmt(p.diesel)} L=${fmt(p.lpg)} ${r.currency}/l (${r.stationCount} st.)`
      );
    }
  }
  return map;
}

// Convert a local-currency station-level record to the normalized region shape.
function stationRecordToRegion(rec, meta, usdRates) {
  const rate = usdRates[rec.currency] ?? null;
  const toUsd = (v) => (v != null && rate ? round(v * rate) : v != null ? round(v) : null);
  const usd = {
    gasoline: toUsd(rec.prices.gasoline),
    diesel: toUsd(rec.prices.diesel),
    lpg: toUsd(rec.prices.lpg),
  };
  const knownUsd = Object.values(usd).filter((v) => v != null);
  const average = knownUsd.length ? round(knownUsd.reduce((a, b) => a + b, 0) / knownUsd.length) : 0;
  const local = {
    gasoline: rec.prices.gasoline != null ? round(rec.prices.gasoline) : 0,
    diesel: rec.prices.diesel != null ? round(rec.prices.diesel) : 0,
    lpg: rec.prices.lpg != null ? round(rec.prices.lpg) : 0,
  };
  const knownLocal = Object.values(local).filter((v) => v > 0);
  const localAvg = knownLocal.length
    ? round(knownLocal.reduce((a, b) => a + b, 0) / knownLocal.length)
    : 0;
  return {
    id: rec.iso2,
    iso3: meta.iso3,
    name: meta.name,
    currency: rec.currency,
    source: rec.source,
    pricesUSD: {
      gasoline: usd.gasoline ?? 0,
      diesel: usd.diesel ?? 0,
      lpg: usd.lpg ?? 0,
      average,
    },
    pricesLocal: { ...local, average: localAvg },
    lat: meta.lat,
    lng: meta.lng,
    cities: [],
  };
}

// -------------------------------- Merger -----------------------------------

function buildRegions({ stationLevel, eu, euToUsdRate, wb, usdRates, geoByIso2, geoByIso3 }) {
  const regions = [];
  const seenIso2 = new Set();

  // Pass 0 — station-level national feeds (highest priority).
  for (const [iso2, rec] of Object.entries(stationLevel)) {
    const meta = geoByIso2[iso2];
    if (!meta) continue;
    const region = stationRecordToRegion(rec, meta, usdRates);
    if (region.pricesUSD.average <= 0) continue;
    regions.push(region);
    seenIso2.add(iso2);
  }

  // EU first: gives the most up-to-date EU27 data.
  for (const [iso2, prices] of Object.entries(eu)) {
    if (seenIso2.has(iso2)) continue;
    const meta = geoByIso2[iso2];
    if (!meta) continue;
    const usd = {
      gasoline: prices.gasoline != null ? round(prices.gasoline * euToUsdRate) : null,
      diesel: prices.diesel != null ? round(prices.diesel * euToUsdRate) : null,
      lpg: prices.lpg != null ? round(prices.lpg * euToUsdRate) : null,
    };
    const known = Object.values(usd).filter((v) => v != null);
    if (!known.length) continue;
    const average = round(known.reduce((a, b) => a + b, 0) / known.length);
    const local = {
      gasoline: prices.gasoline != null ? round(prices.gasoline) : 0,
      diesel: prices.diesel != null ? round(prices.diesel) : 0,
      lpg: prices.lpg != null ? round(prices.lpg) : 0,
    };
    const localKnown = Object.values(local).filter((v) => v > 0);
    const localAvg = localKnown.length
      ? round(localKnown.reduce((a, b) => a + b, 0) / localKnown.length)
      : 0;
    regions.push({
      id: iso2,
      iso3: meta.iso3,
      name: meta.name,
      currency: 'EUR',
      source: 'EU Weekly Oil Bulletin',
      pricesUSD: {
        gasoline: usd.gasoline ?? 0,
        diesel: usd.diesel ?? 0,
        lpg: usd.lpg ?? 0,
        average,
      },
      pricesLocal: { ...local, average: localAvg },
      lat: meta.lat,
      lng: meta.lng,
      cities: [],
    });
    seenIso2.add(iso2);
  }

  // Then World Bank for the rest of the world.
  for (const [iso3, prices] of Object.entries(wb)) {
    const meta = geoByIso3[iso3];
    if (!meta) continue;
    if (seenIso2.has(meta.iso2)) continue;
    const usd = {
      gasoline: prices.gasoline != null ? round(prices.gasoline) : null,
      diesel: prices.diesel != null ? round(prices.diesel) : null,
      lpg: prices.lpg != null ? round(prices.lpg) : null,
    };
    const known = Object.values(usd).filter((v) => v != null);
    if (!known.length) continue;
    const average = round(known.reduce((a, b) => a + b, 0) / known.length);
    regions.push({
      id: meta.iso2 || iso3,
      iso3,
      name: meta.name,
      currency: 'USD',
      source: 'World Bank Global Fuel Prices Database',
      pricesUSD: {
        gasoline: usd.gasoline ?? 0,
        diesel: usd.diesel ?? 0,
        lpg: usd.lpg ?? 0,
        average,
      },
      pricesLocal: {
        gasoline: usd.gasoline ?? 0,
        diesel: usd.diesel ?? 0,
        lpg: usd.lpg ?? 0,
        average,
      },
      lat: meta.lat,
      lng: meta.lng,
      cities: [],
    });
  }

  regions.sort((a, b) => a.name.localeCompare(b.name));
  return regions;
}

// --------------------------------- Main ------------------------------------

async function run() {
  const apiDir = path.join(process.cwd(), 'public', 'api', 'v1');
  if (!fs.existsSync(apiDir)) fs.mkdirSync(apiDir, { recursive: true });

  const [eu, usdRates, wb, geoData, stationLevel] = await Promise.all([
    loadEUPrices(),
    loadUsdRates(),
    loadWorldBankPrices(),
    loadGeoJson(),
    loadAllStationLevel(),
  ]);

  const eurToUsdRate = usdRates.EUR ?? 1.08;
  console.log(`  ✓ EUR→USD: ${eurToUsdRate.toFixed(4)}  GBP→USD: ${(usdRates.GBP ?? 1.26).toFixed(4)}`);
  console.log(`  ✓ Station-level coverage: ${Object.keys(stationLevel).join(', ') || 'none'}`);

  const regions = buildRegions({
    stationLevel,
    eu,
    euToUsdRate: eurToUsdRate,
    wb,
    usdRates,
    geoByIso2: geoData.byIso2,
    geoByIso3: geoData.byIso3,
  });

  const withAvg = regions.filter((r) => r.pricesUSD.average > 0);
  const globalAverageUSD = withAvg.length
    ? round(withAvg.reduce((a, r) => a + r.pricesUSD.average, 0) / withAvg.length)
    : 0;

  const data = {
    lastUpdated: new Date().toISOString(),
    sources: [
      'France: data.economie.gouv.fr Prix des carburants (live stations) — Etalab OL 2.0',
      'Italy: MIMIT Osservaprezzi (live stations) — IODL 2.0',
      'Spain: Minetur Servicios REST Carburantes (live stations) — public',
      'United Kingdom: CMA Road Fuel Price Transparency Scheme — Open Government Licence',
      'United States: EIA weekly retail gasoline & diesel — U.S. public domain',
      'European Commission Weekly Oil Bulletin (EU27 fallback) — CC BY 4.0',
      'World Bank Global Fuel Prices Database (rest of world) — ODbL',
      'Natural Earth 110m admin_0 countries — CC0',
    ],
    globalAverageUSD,
    regions,
  };

  // prices.json
  fs.writeFileSync(path.join(apiDir, 'prices.json'), JSON.stringify(data));

  // prices.xml
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<FuelPrices>\n`;
  xml += `  <LastUpdated>${data.lastUpdated}</LastUpdated>\n`;
  xml += `  <GlobalAverageUSD>${data.globalAverageUSD}</GlobalAverageUSD>\n`;
  xml += `  <Sources>\n`;
  data.sources.forEach((s) => (xml += `    <Source>${s}</Source>\n`));
  xml += `  </Sources>\n  <Regions>\n`;
  regions.forEach((r) => {
    xml += `    <Region id="${r.id}" iso3="${r.iso3}">\n`;
    xml += `      <Name>${r.name.replace(/&/g, '&amp;')}</Name>\n`;
    xml += `      <Currency>${r.currency}</Currency>\n`;
    xml += `      <Source>${r.source}</Source>\n`;
    xml += `      <PricesUSD gasoline="${r.pricesUSD.gasoline}" diesel="${r.pricesUSD.diesel}" lpg="${r.pricesUSD.lpg}" average="${r.pricesUSD.average}" />\n`;
    xml += `      <PricesLocal gasoline="${r.pricesLocal.gasoline}" diesel="${r.pricesLocal.diesel}" lpg="${r.pricesLocal.lpg}" average="${r.pricesLocal.average}" />\n`;
    xml += `    </Region>\n`;
  });
  xml += `  </Regions>\n</FuelPrices>`;
  fs.writeFileSync(path.join(apiDir, 'prices.xml'), xml);

  // prices.txt
  let txt = `Global Fuel Prices (Last Updated: ${data.lastUpdated})\n`;
  txt += `Sources:\n${data.sources.map((s) => '  - ' + s).join('\n')}\n\n`;
  txt += `Global Average: $${data.globalAverageUSD} USD/l\n\n`;
  regions.forEach((r) => {
    txt += `[${r.id}] ${r.name} — avg $${r.pricesUSD.average} (G:$${r.pricesUSD.gasoline} D:$${r.pricesUSD.diesel} L:$${r.pricesUSD.lpg}) — ${r.source}\n`;
  });
  fs.writeFileSync(path.join(apiDir, 'prices.txt'), txt);

  // countries.geojson (raw passthrough; already validated)
  fs.writeFileSync(path.join(apiDir, 'countries.geojson'), geoData.raw);

  console.log(
    `\n✅ Generated ${regions.length} regions. Global avg: $${globalAverageUSD}/l.`
  );
}

run().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
