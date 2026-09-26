import { isValidCoordinate } from './geoHelper.js';

export const LOCATION_STATUSES = {
  UNCONFIRMED: 'unconfirmed',
  PENDING_CONFIRMATION: 'pending_confirmation',
  CONFIRMED: 'confirmed',
  LEGACY_UNVERIFIED: 'legacy_unverified',
};

export const LOCATION_SOURCES = {
  DEVICE: 'device',
  GEOCODED: 'geocoded',
  MAP_PIN: 'map_pin',
  MANUAL_COORDINATES: 'manual_coordinates',
  PLACES: 'places',
};

export const VALID_LOCATION_SOURCES = [
  'device',
  'geocoded',
  'map_pin',
  'manual_coordinates',
  'places',
  null,
];

export const VALID_LOCATION_STATUSES = [
  'unconfirmed',
  'pending_confirmation',
  'confirmed',
  'legacy_unverified',
];

/**
 * Normalizes address components ensuring safe string fields.
 */
export function normalizeAddressComponents(input = {}) {
  if (!input || typeof input !== 'object') {
    return {
      addressLine: '',
      wardCode: null,
      wardName: '',
      districtCode: null,
      districtName: '',
      provinceCode: null,
      provinceName: '',
    };
  }

  return {
    addressLine: typeof input.addressLine === 'string' ? input.addressLine.trim().slice(0, 255) : '',
    wardCode: input.wardCode ? String(input.wardCode).trim() : null,
    wardName: typeof input.wardName === 'string' ? input.wardName.trim().slice(0, 100) : '',
    districtCode: input.districtCode ? String(input.districtCode).trim() : null,
    districtName: typeof input.districtName === 'string' ? input.districtName.trim().slice(0, 100) : '',
    provinceCode: input.provinceCode ? String(input.provinceCode).trim() : null,
    provinceName: typeof input.provinceName === 'string' ? input.provinceName.trim().slice(0, 100) : '',
  };
}

/**
 * Authoritative backend normalizer for writing location to MongoDB.
 * Ensures location { lat, lng } and GeoJSON geoPoint [lng, lat] are strictly synchronized.
 * Never trusts client geoPoint or client confirmedAt.
 *
 * @param {Object} locationInput - User or API payload
 * @param {Object} [previousDocument] - Pre-existing document for differential checks
 * @param {Object} [options]
 * @param {boolean} [options.isExplicitConfirm=false] - Whether this write comes from an explicit confirmation endpoint
 * @returns {Object} Normalized fields to apply on the document/query
 */
export function normalizeLocationInput(locationInput = {}, previousDocument = null, options = {}) {
  const { isExplicitConfirm = false } = options;

  // Extract candidate fields (support flat or nested location)
  const rawLat = locationInput.location?.lat ?? locationInput.lat;
  const rawLng = locationInput.location?.lng ?? locationInput.lng;
  const rawStatus = locationInput.locationStatus ?? locationInput.status;
  const rawSource = locationInput.locationSource ?? locationInput.source;

  // Check coordinates validity
  const hasCoords = isValidCoordinate(rawLat, rawLng);
  const lat = hasCoords ? Number(Number(rawLat).toFixed(6)) : null;
  const lng = hasCoords ? Number(Number(rawLng).toFixed(6)) : null;

  // Validate or normalize location source
  let source = null;
  if (rawSource && VALID_LOCATION_SOURCES.includes(rawSource)) {
    source = rawSource;
  } else if (hasCoords && previousDocument?.locationSource) {
    source = previousDocument.locationSource;
  }

  // Address change detection
  const newAddress = typeof locationInput.address === 'string'
    ? locationInput.address.trim().slice(0, 300)
    : undefined;
  const prevAddress = typeof previousDocument?.address === 'string'
    ? previousDocument.address.trim()
    : '';

  const addressChanged = Boolean(
    previousDocument &&
    typeof previousDocument.address === 'string' &&
    newAddress !== undefined &&
    newAddress !== prevAddress
  );

  // Address components
  const addressComponents = normalizeAddressComponents(
    locationInput.addressComponents || previousDocument?.addressComponents
  );

  // Determine status & confirmedAt
  let status = LOCATION_STATUSES.UNCONFIRMED;
  let confirmedAt = null;

  if (!hasCoords) {
    // No valid coordinates -> must be unconfirmed, no geoPoint
    status = LOCATION_STATUSES.UNCONFIRMED;
    confirmedAt = null;
  } else if (isExplicitConfirm) {
    // Explicit confirmation action with valid coordinates
    status = LOCATION_STATUSES.CONFIRMED;
    confirmedAt = new Date(); // Server-generated timestamp
  } else if (rawStatus === LOCATION_STATUSES.PENDING_CONFIRMATION) {
    status = LOCATION_STATUSES.PENDING_CONFIRMATION;
    confirmedAt = null;
  } else if (addressChanged) {
    // If address text changed and not an explicit confirm action:
    // MUST reset status to unconfirmed even if coordinates exist (Requirement Phase 3 item 1)
    status = LOCATION_STATUSES.UNCONFIRMED;
    confirmedAt = null;
  } else if (rawStatus === LOCATION_STATUSES.CONFIRMED && previousDocument?.locationStatus === LOCATION_STATUSES.CONFIRMED) {
    // Preserving already confirmed status when address did not change
    status = LOCATION_STATUSES.CONFIRMED;
    confirmedAt = previousDocument.locationConfirmedAt || new Date();
  } else if (rawStatus === LOCATION_STATUSES.CONFIRMED && hasCoords) {
    // Client sent confirmed on creation/update with coordinates
    status = LOCATION_STATUSES.CONFIRMED;
    confirmedAt = new Date();
  } else if (rawStatus === LOCATION_STATUSES.LEGACY_UNVERIFIED) {
    status = LOCATION_STATUSES.LEGACY_UNVERIFIED;
    confirmedAt = null;
  } else {
    status = LOCATION_STATUSES.UNCONFIRMED;
    confirmedAt = null;
  }

  // Derive GeoJSON Point [longitude, latitude]
  const geoPoint = hasCoords
    ? {
        type: 'Point',
        coordinates: [lng, lat],
      }
    : null;

  return {
    location: { lat, lng },
    geoPoint,
    locationStatus: status,
    locationSource: source,
    locationConfirmedAt: confirmedAt,
    addressComponents,
    provinceCode: addressComponents.provinceCode || null,
    districtCode: addressComponents.districtCode || null,
    wardCode: addressComponents.wardCode || null,
  };
}

/**
 * Formats a location object for public API response (DTO).
 */
export function toLocationDTO(entity) {
  if (!entity || typeof entity !== 'object') return null;

  const lat = entity.location?.lat ?? entity.geoPoint?.coordinates?.[1] ?? null;
  const lng = entity.location?.lng ?? entity.geoPoint?.coordinates?.[0] ?? null;

  return {
    formattedAddress: entity.address || '',
    addressComponents: normalizeAddressComponents(entity.addressComponents),
    location: isValidCoordinate(lat, lng) ? { lat, lng } : null,
    geoPoint: entity.geoPoint || (isValidCoordinate(lat, lng) ? { type: 'Point', coordinates: [lng, lat] } : null),
    locationStatus: entity.locationStatus || LOCATION_STATUSES.UNCONFIRMED,
    locationSource: entity.locationSource || null,
    locationConfirmedAt: entity.locationConfirmedAt || null,
  };
}
