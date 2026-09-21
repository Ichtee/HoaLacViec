/**
 * Computes geodesic distance in meters between two coordinates using the Haversine formula
 * @param {number} lat1 Latitude of point 1
 * @param {number} lon1 Longitude of point 1
 * @param {number} lat2 Latitude of point 2
 * @param {number} lon2 Longitude of point 2
 * @returns {number|null} Distance in meters, or null if coordinates are invalid
 */
export function calculateHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);

  if (
    isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2) ||
    nLat1 < -90 || nLat1 > 90 || nLat2 < -90 || nLat2 > 90 ||
    nLon1 < -180 || nLon1 > 180 || nLon2 < -180 || nLon2 > 180
  ) {
    return null;
  }

  const R = 6371e3; // Earth radius in meters
  const rad = Math.PI / 180;
  const phi1 = nLat1 * rad;
  const phi2 = nLat2 * rad;
  const deltaPhi = (nLat2 - nLat1) * rad;
  const deltaLambda = (nLon2 - nLon1) * rad;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}
