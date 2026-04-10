import { describe, it, expect } from 'vitest';
import {
  round,
  xmlEscape,
  haversineKm,
  pointInRing,
  simulateRefuels,
} from '../scripts/lib/helpers.mjs';

describe('round', () => {
  it('returns null for non-finite values', () => {
    expect(round(null)).toBe(null);
    expect(round(undefined)).toBe(null);
    expect(round(NaN)).toBe(null);
  });
  it('rounds to the requested precision', () => {
    expect(round(1.23456, 2)).toBe(1.23);
    expect(round(0, 3)).toBe(0);
  });
});

describe('xmlEscape', () => {
  it('escapes the five XML entities', () => {
    expect(xmlEscape('gasoline & diesel')).toBe('gasoline &amp; diesel');
    expect(xmlEscape('<foo>')).toBe('&lt;foo&gt;');
    expect(xmlEscape('"quoted"')).toBe('&quot;quoted&quot;');
    expect(xmlEscape("it's")).toBe('it&apos;s');
  });
  it('regression: EIA source string that once broke the XML parser', () => {
    const out = xmlEscape('United States: EIA weekly retail gasoline & diesel — U.S. public domain');
    expect(out).toContain('&amp;');
    expect(out).not.toMatch(/& [a-z]/);
  });
});

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm(52, 13, 52, 13)).toBe(0);
  });
  it('matches Paris → Berlin within 1 %', () => {
    const d = haversineKm(48.8566, 2.3522, 52.52, 13.405);
    expect(d).toBeGreaterThan(870);
    expect(d).toBeLessThan(886);
  });
});

describe('pointInRing', () => {
  const square = [
    [0, 0], [10, 0], [10, 10], [0, 10], [0, 0],
  ];
  it('detects interior points', () => {
    expect(pointInRing(5, 5, square)).toBe(true);
  });
  it('rejects exterior points', () => {
    expect(pointInRing(-1, 5, square)).toBe(false);
    expect(pointInRing(100, 5, square)).toBe(false);
  });
});

describe('simulateRefuels (ADR-0005)', () => {
  // Synthetic "route" where every kilometre returns the same country at a
  // constant price — lets us assert the fill schedule and totals precisely.
  const flat = () => ({ id: 'XX', name: 'Flatland', price: 1 });

  it('fills only once for short trips', () => {
    const fills = simulateRefuels({ totalKm: 200, locate: flat });
    expect(fills.length).toBe(1);
    expect(fills[0].isInitial).toBe(true);
    expect(fills[0].litres).toBe(50);
    expect(fills[0].atKm).toBe(0);
  });

  it('adds one refill at 882 km for a 1000 km trip (2% reserve)', () => {
    const fills = simulateRefuels({ totalKm: 1000, locate: flat });
    expect(fills.length).toBe(2);
    expect(fills[0].isInitial).toBe(true);
    expect(fills[0].litres).toBe(50);       // full tank at origin
    expect(fills[1].isInitial).toBe(false);
    expect(fills[1].atKm).toBeCloseTo(882, 1);
    expect(fills[1].litres).toBeCloseTo(49, 5); // 2% reserve top-up
  });

  it('adds two refills for a 2189 km trip (Istanbul → Berlin)', () => {
    const fills = simulateRefuels({ totalKm: 2189, locate: flat });
    expect(fills.length).toBe(3);
    expect(fills.map((f) => Math.round(f.atKm))).toEqual([0, 882, 1764]);
  });

  it('total cost is deterministic given deterministic locator', () => {
    const fills = simulateRefuels({ totalKm: 2189, locate: () => ({ id: 'XX', name: 'Flat', price: 2 }) });
    const total = fills.reduce((a, f) => a + f.costUSD, 0);
    // 50 L @ origin + 49 L × 2 subsequent fills = 148 L total
    expect(fills.reduce((a, f) => a + f.litres, 0)).toBe(148);
    expect(total).toBe(148 * 2);
  });
});
