/**
 * Coordinate Helper & Contract Standardization
 * Enforces strict conversions and validation across Leaflet, Vietmap GL / GeoJSON, and Route APIs.
 *
 * Contract:
 * - Route API: "lat,lng" (string format)
 * - Leaflet: [lat, lng] (Array format)
 * - Vietmap GL / GeoJSON: [lng, lat] (Array format)
 */

export function isValidCoordinate(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return false;
  }
  if (typeof lat === 'boolean' || typeof lng === 'boolean') {
    return false;
  }
  if (typeof lat === 'object' || typeof lng === 'object') {
    return false;
  }
  if (typeof lat === 'string' && lat.trim() === '') {
    return false;
  }
  if (typeof lng === 'string' && lng.trim() === '') {
    return false;
  }

  const nLat = typeof lat === 'number' ? lat : Number(lat);
  const nLng = typeof lng === 'number' ? lng : Number(lng);

  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) {
    return false;
  }

  return nLat >= -90 && nLat <= 90 && nLng >= -180 && nLng <= 180;
}

/**
 * Extracts normalized { lat, lng } from various representations.
 * Supports:
 * - { lat, lng }
 * - { latitude, longitude }
 * - GeoJSON Point: { type: 'Point', coordinates: [lng, lat] }
 * - Leaflet LatLng object: { lat, lng }
 * - Array: default expects [lat, lng], or if options.isGeoJson: [lng, lat]
 */
export function extractLatLng(input, options = {}) {
  if (input === null || input === undefined) return null;

  // Support two arguments: extractLatLng(lat, lng)
  if (
    typeof options === 'number' ||
    (typeof options === 'string' &&
      options !== 'geojson' &&
      options !== 'leaflet' &&
      options !== 'route' &&
      options.trim() !== '' &&
      !isNaN(Number(options)))
  ) {
    const lat = Number(input);
    const lng = Number(options);
    return isValidCoordinate(lat, lng) ? { lat, lng } : null;
  }

  if (Array.isArray(input) && input.length >= 2) {
    if (options === 'geojson' || options?.isGeoJson) {
      const lng = Number(input[0]);
      const lat = Number(input[1]);
      return isValidCoordinate(lat, lng) ? { lat, lng } : null;
    }
    const lat = Number(input[0]);
    const lng = Number(input[1]);
    return isValidCoordinate(lat, lng) ? { lat, lng } : null;
  }

  if (typeof input === 'object') {
    // GeoJSON Point
    if (input.type === 'Point' && Array.isArray(input.coordinates) && input.coordinates.length >= 2) {
      const lng = Number(input.coordinates[0]);
      const lat = Number(input.coordinates[1]);
      return isValidCoordinate(lat, lng) ? { lat, lng } : null;
    }

    const lat = input.lat !== undefined ? input.lat : input.latitude;
    const lng = input.lng !== undefined ? input.lng : input.longitude;

    if (isValidCoordinate(lat, lng)) {
      return { lat: Number(lat), lng: Number(lng) };
    }

    if (input.location && isValidCoordinate(input.location.lat, input.location.lng)) {
      return { lat: Number(input.location.lat), lng: Number(input.location.lng) };
    }

    if (input.geoPoint?.coordinates && Array.isArray(input.geoPoint.coordinates)) {
      const gLng = Number(input.geoPoint.coordinates[0]);
      const gLat = Number(input.geoPoint.coordinates[1]);
      return isValidCoordinate(gLat, gLng) ? { lat: gLat, lng: gLng } : null;
    }
  }

  return null;
}

/**
 * Converts any valid coordinate input to Vietmap Route API format: "lat,lng"
 * @param {any} input
 * @param {any} [secondArg] - Optional longitude if first arg is latitude
 * @returns {string|null} e.g. "21.0128,105.5255"
 */
export function toRouteCoordinate(input, secondArg) {
  const norm = extractLatLng(input, secondArg);
  if (!norm) return null;
  return `${Number(norm.lat.toFixed(6))},${Number(norm.lng.toFixed(6))}`;
}

/**
 * Converts any valid coordinate input to Leaflet format: [lat, lng]
 * @param {any} input
 * @param {any} [secondArg] - Optional longitude if first arg is latitude
 * @returns {[number, number]|null} e.g. [21.0128, 105.5255]
 */
export function toLeafletCoordinate(input, secondArg) {
  const norm = extractLatLng(input, secondArg);
  if (!norm) return null;
  return [Number(norm.lat.toFixed(6)), Number(norm.lng.toFixed(6))];
}

/**
 * Converts any valid coordinate input to Vietmap GL / GeoJSON format: [lng, lat]
 * @param {any} input
 * @param {any} [secondArg] - Optional longitude if first arg is latitude
 * @returns {[number, number]|null} e.g. [105.5255, 21.0128]
 */
export function toGeoJsonCoordinate(input, secondArg) {
  const norm = extractLatLng(input, secondArg);
  if (!norm) return null;
  return [Number(norm.lng.toFixed(6)), Number(norm.lat.toFixed(6))];
}

/**
 * Converts coordinate to GeoJSON Point object: { type: 'Point', coordinates: [lng, lat] }
 * @param {any} input
 * @param {any} [secondArg] - Optional longitude if first arg is latitude
 * @returns {object|null}
 */
export function toGeoJsonPoint(input, secondArg) {
  const geoCoords = toGeoJsonCoordinate(input, secondArg);
  if (!geoCoords) return null;
  return {
    type: 'Point',
    coordinates: geoCoords,
  };
}

/**
 * Parses GeoJSON coordinate tuple [lng, lat] back to { lat, lng }
 * @param {[number, number]} tuple
 * @returns {{ lat: number, lng: number }|null}
 */
export function fromGeoJsonCoordinate(tuple) {
  return extractLatLng(tuple, { isGeoJson: true });
}

/**
 * Parses Leaflet coordinate tuple [lat, lng] back to { lat, lng }
 * @param {[number, number]} tuple
 * @returns {{ lat: number, lng: number }|null}
 */
export function fromLeafletCoordinate(tuple) {
  return extractLatLng(tuple, { isGeoJson: false });
}
