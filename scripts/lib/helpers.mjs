// Pure helpers extracted from scripts/generateData.js so they can be unit
// tested in isolation. Nothing in here talks to the network or to disk.

export function round(n, d = 3) {
  if (n == null || !Number.isFinite(Number(n))) return null;
  return Number(Number(n).toFixed(d));
}

export function xmlEscape(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Refuel simulation. Returns an array of discrete fill events given total
 * distance, tank characteristics and a lookup that maps cumulative km to a
 * (country, pricePerLitreUSD) pair.
 *
 * Exported so unit tests can pin the refuel model in ADR-0005 against a
 * deterministic implementation without needing the browser or Leaflet.
 */
export function simulateRefuels({
  totalKm,
  tankLitres = 50,
  rangeKm = 900,
  reserveFraction = 0.02,
  locate,
}) {
  const usableKmPerTank = rangeKm * (1 - reserveFraction);
  const refillLitres = tankLitres * (1 - reserveFraction);

  const refuels = [];
  // Fill #0: start at origin with a full tank.
  const origin = locate(0);
  refuels.push({
    atKm: 0,
    litres: tankLitres,
    pricePerLitreUSD: origin.price,
    costUSD: tankLitres * origin.price,
    countryId: origin.id,
    countryName: origin.name,
    isInitial: true,
  });

  let covered = Math.min(usableKmPerTank, totalKm);
  while (covered < totalKm) {
    const hit = locate(covered);
    refuels.push({
      atKm: covered,
      litres: refillLitres,
      pricePerLitreUSD: hit.price,
      costUSD: refillLitres * hit.price,
      countryId: hit.id,
      countryName: hit.name,
      isInitial: false,
    });
    covered += usableKmPerTank;
  }
  return refuels;
}
