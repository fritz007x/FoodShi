import { describe, it, expect } from 'vitest';
import { distanceKm } from '../lib/geo';

describe('distanceKm', () => {
  it('returns 0 for identical coordinates', () => {
    expect(distanceKm(0, 0, 0, 0)).toBe(0);
    expect(distanceKm(48.8566, 2.3522, 48.8566, 2.3522)).toBe(0);
  });

  it('is symmetric', () => {
    const ab = distanceKm(48.8566, 2.3522, 51.5074, -0.1278);
    const ba = distanceKm(51.5074, -0.1278, 48.8566, 2.3522);
    expect(Math.abs(ab - ba)).toBeLessThan(0.001);
  });

  it('approximates Paris → London distance (~341 km)', () => {
    const d = distanceKm(48.8566, 2.3522, 51.5074, -0.1278);
    expect(d).toBeGreaterThan(330);
    expect(d).toBeLessThan(350);
  });

  it('returns < 5 km for points within the geofence radius', () => {
    // ~1 km north of origin
    const d = distanceKm(0, 0, 0.009, 0);
    expect(d).toBeLessThan(5);
  });

  it('returns > 5 km for points outside the geofence radius', () => {
    // ~10 km north of origin
    const d = distanceKm(0, 0, 0.09, 0);
    expect(d).toBeGreaterThan(5);
  });
});
