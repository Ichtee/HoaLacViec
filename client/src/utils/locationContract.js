import { isValidCoordinate } from './index.js';

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
