/**
 * GPS Verification Service
 * Uses Haversine formula for distance calculation
 */

const EARTH_RADIUS_METERS = 6371000;
const MAX_DISTANCE_METERS = 100; // 100 meters geofence

interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @returns Distance in meters
 */
export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const lat1 = toRadians(coord1.latitude);
  const lat2 = toRadians(coord2.latitude);
  const deltaLat = toRadians(coord2.latitude - coord1.latitude);
  const deltaLon = toRadians(coord2.longitude - coord1.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Check if two coordinates are within the geofence
 */
export function isWithinGeofence(
  donorCoords: Coordinates,
  receiverCoords: Coordinates,
  maxDistance: number = MAX_DISTANCE_METERS
): { isValid: boolean; distance: number } {
  const distance = calculateDistance(donorCoords, receiverCoords);

  return {
    isValid: distance <= maxDistance,
    distance: Math.round(distance),
  };
}

/**
 * Validate coordinates are within valid ranges
 */
export function validateCoordinates(coords: Coordinates): boolean {
  return (
    coords.latitude >= -90 &&
    coords.latitude <= 90 &&
    coords.longitude >= -180 &&
    coords.longitude <= 180
  );
}

export const GPS_CONFIG = {
  MAX_DISTANCE_METERS,
};
