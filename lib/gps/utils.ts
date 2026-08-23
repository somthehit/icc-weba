import { GPSPosition, GeofenceZone } from '@/types';

const EARTH_RADIUS_KM = 6371;

export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

export function calculateDistance(
  pos1: { latitude: number; longitude: number },
  pos2: { latitude: number; longitude: number },
): number {
  const dLat = toRadians(pos2.latitude - pos1.latitude);
  const dLon = toRadians(pos2.longitude - pos1.longitude);
  const lat1 = toRadians(pos1.latitude);
  const lat2 = toRadians(pos2.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

export function calculateBearing(
  pos1: { latitude: number; longitude: number },
  pos2: { latitude: number; longitude: number },
): number {
  const lat1 = toRadians(pos1.latitude);
  const lat2 = toRadians(pos2.latitude);
  const dLon = toRadians(pos2.longitude - pos1.longitude);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

export function estimateArrivalTime(
  currentPosition: GPSPosition,
  destination: { latitude: number; longitude: number },
  averageSpeedKmh: number = 30,
): Date {
  const distanceKm = calculateDistance(
    { latitude: currentPosition.latitude, longitude: currentPosition.longitude },
    destination,
  );

  const hours = distanceKm / averageSpeedKmh;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export function isWithinGeofence(
  position: GPSPosition,
  zone: GeofenceZone,
): boolean {
  const distance = calculateDistance(
    { latitude: position.latitude, longitude: position.longitude },
    { latitude: zone.center.lat, longitude: zone.center.lng },
  );
  return distance <= zone.radiusKm;
}

export function calculateRouteDistance(positions: GPSPosition[]): number {
  let totalDistance = 0;
  for (let i = 1; i < positions.length; i++) {
    totalDistance += calculateDistance(
      { latitude: positions[i - 1].latitude, longitude: positions[i - 1].longitude },
      { latitude: positions[i].latitude, longitude: positions[i].longitude },
    );
  }
  return totalDistance;
}

export function simplifyPath(
  positions: GPSPosition[],
  toleranceKm: number = 0.01,
): GPSPosition[] {
  if (positions.length <= 2) return positions;

  const result: GPSPosition[] = [positions[0]];
  let lastKept = positions[0];

  for (let i = 1; i < positions.length - 1; i++) {
    const distance = calculateDistance(
      { latitude: lastKept.latitude, longitude: lastKept.longitude },
      { latitude: positions[i].latitude, longitude: positions[i].longitude },
    );
    if (distance >= toleranceKm) {
      result.push(positions[i]);
      lastKept = positions[i];
    }
  }

  result.push(positions[positions.length - 1]);
  return result;
}
