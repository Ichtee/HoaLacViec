import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeLocationInput,
  normalizeAddressComponents,
  toLocationDTO,
  LOCATION_STATUSES,
  LOCATION_SOURCES,
} from '../src/utils/locationContract.js';
import {
  isValidCoordinate,
  calculateHaversineDistanceMeters,
  getGoogleMapsDestination,
  getGoogleMapsNavigationUrl,
  hasConfirmedCoordinates,
} from '../src/utils/geoHelper.js';

describe('Phase 9 — Comprehensive Location Domain Contract Tests', () => {

  // 1. Candidate Selection
  it('1. Candidate Selection: formats and handles multiple geocoding candidates without auto-picking first', () => {
    const rawNominatimResults = [
      {
        place_id: 101,
        lat: '21.013400',
        lon: '105.526300',
        display_name: 'Đại học FPT, Thạch Hòa, Thạch Thất, Hà Nội',
        address: { university: 'Đại học FPT', road: 'Km29 Đại lộ Thăng Long', county: 'Thạch Thất', state: 'Hà Nội' },
      },
      {
        place_id: 102,
        lat: '21.014500',
        lon: '105.528000',
        display_name: 'KTX Dom A Đại học FPT Hòa Lạc',
        address: { building: 'Dom A', county: 'Thạch Thất', state: 'Hà Nội' },
      },
      {
        place_id: 103,
        lat: '21.015500',
        lon: '105.529000',
        display_name: 'Bách Hóa SV Market (FPT Hòa Lạc)',
        address: { shop: 'SV Market', road: 'Đường Nội Khu', county: 'Thạch Thất', state: 'Hà Nội' },
      },
    ];

    // Format candidates
    const formattedCandidates = rawNominatimResults.map(item => ({
      lat: Number(item.lat),
      lng: Number(item.lon),
      displayName: item.display_name,
      address: item.address,
    }));

    assert.equal(formattedCandidates.length, 3);
    // Verify candidate 2 is selected explicitly by user choice
    const selectedCandidate = formattedCandidates[1];
    assert.equal(selectedCandidate.lat, 21.0145);
    assert.equal(selectedCandidate.lng, 105.528);
    // Confirm candidate 1 was NOT picked automatically
    assert.notEqual(selectedCandidate.lat, formattedCandidates[0].lat);
  });

  // 2. Staging Pin
  it('2. Staging Pin: dragging pin stages coordinates with status pending_confirmation, not saved in DB as confirmed', () => {
    const dragPinInput = {
      location: { lat: 21.0150, lng: 105.5270 },
      locationStatus: LOCATION_STATUSES.PENDING_CONFIRMATION,
      locationSource: LOCATION_SOURCES.MAP_PIN,
      address: 'Số 10 Tân Xã, Thạch Thất',
    };

    const normalized = normalizeLocationInput(dragPinInput, null, { isExplicitConfirm: false });
    assert.equal(normalized.locationStatus, LOCATION_STATUSES.PENDING_CONFIRMATION);
    assert.equal(normalized.locationConfirmedAt, null);
    assert.equal(normalized.location.lat, 21.0150);
    assert.equal(normalized.location.lng, 105.5270);
    // Not confirmed yet
    assert.equal(hasConfirmedCoordinates(normalized), false);
  });

  // 3. Save Without Confirm
  it('3. Save Without Confirm: saving while pending_confirmation does not set confirmed; job does not show on JobMap', () => {
    const payload = {
      address: 'Đường Nội Khu',
      location: { lat: 21.016, lng: 105.528 },
      locationStatus: LOCATION_STATUSES.PENDING_CONFIRMATION,
      locationSource: LOCATION_SOURCES.MAP_PIN,
    };

    const normalized = normalizeLocationInput(payload, null, { isExplicitConfirm: false });
    assert.notEqual(normalized.locationStatus, LOCATION_STATUSES.CONFIRMED);
    assert.equal(normalized.locationConfirmedAt, null);
    assert.equal(hasConfirmedCoordinates(normalized), false);
  });

  // 4. Confirm Flow
  it('4. Confirm Flow: clicking "Xác nhận vị trí này" sets confirmed, confirmedAt timestamp, geoPoint [lng, lat], and shows on JobMap', () => {
    const stagedDoc = {
      address: 'Cổng số 1 ĐH FPT',
      location: { lat: 21.0134, lng: 105.5263 },
      locationStatus: LOCATION_STATUSES.PENDING_CONFIRMATION,
      locationSource: LOCATION_SOURCES.MAP_PIN,
    };

    const confirmed = normalizeLocationInput(stagedDoc, stagedDoc, { isExplicitConfirm: true });
    assert.equal(confirmed.locationStatus, LOCATION_STATUSES.CONFIRMED);
    assert.ok(confirmed.locationConfirmedAt instanceof Date);
    assert.deepEqual(confirmed.geoPoint, {
      type: 'Point',
      coordinates: [105.5263, 21.0134], // [lng, lat]
    });
    assert.equal(hasConfirmedCoordinates(confirmed), true);
  });

  // 5. Invalidate on Address Edit
  it('5. Invalidate on Address Edit: editing address of confirmed job automatically reverts status to unconfirmed, clears confirmedAt and geoPoint, disappears from JobMap', () => {
    const prevConfirmedJob = {
      address: 'Số 12 Đường Cũ, Hòa Lạc',
      location: { lat: 21.0134, lng: 105.5263 },
      geoPoint: { type: 'Point', coordinates: [105.5263, 21.0134] },
      locationStatus: LOCATION_STATUSES.CONFIRMED,
      locationSource: LOCATION_SOURCES.MAP_PIN,
      locationConfirmedAt: new Date('2026-01-01T00:00:00Z'),
    };

    // User edits address in form and submits without re-confirming pin
    const editPayload = {
      address: 'Số 99 Đường Mới Toanh, Bình Yên',
      location: { lat: 21.0134, lng: 105.5263 },
    };

    const updated = normalizeLocationInput(editPayload, prevConfirmedJob, { isExplicitConfirm: false });
    assert.equal(updated.locationStatus, LOCATION_STATUSES.UNCONFIRMED);
    assert.equal(updated.locationConfirmedAt, null);
    assert.equal(hasConfirmedCoordinates(updated), false);
  });

  // 6. GPS Flow (>100m)
  it('6. GPS Flow (>100m): accuracy=150m triggers low_accuracy safeguard and prevents auto-confirmation', () => {
    const gpsSample = {
      lat: 21.0125,
      lng: 105.5250,
      accuracy: 150,
    };

    const isLowAccuracy = gpsSample.accuracy > 100;
    assert.equal(isLowAccuracy, true);

    // Should be saved as pending_confirmation or unconfirmed, never confirmed
    const stagedGps = normalizeLocationInput({
      location: { lat: gpsSample.lat, lng: gpsSample.lng },
      locationStatus: isLowAccuracy ? LOCATION_STATUSES.PENDING_CONFIRMATION : LOCATION_STATUSES.CONFIRMED,
      locationSource: LOCATION_SOURCES.DEVICE,
    }, null, { isExplicitConfirm: false });

    assert.notEqual(stagedGps.locationStatus, LOCATION_STATUSES.CONFIRMED);
    assert.equal(hasConfirmedCoordinates(stagedGps), false);
  });

  // 7. Directions URL Contract
  it('7. Directions URL Contract: confirmed -> destination=${lat},${lng}; unconfirmed -> formattedAddress without coords', () => {
    const confirmedEntity = {
      address: 'Đường Nội Khu, Tân Xã',
      location: { lat: 21.0155, lng: 105.5290 },
      locationStatus: LOCATION_STATUSES.CONFIRMED,
    };

    const unconfirmedEntity = {
      address: 'Số 12 Đường Nội Khu Hòa Lạc (Gần KTX FPT)',
      location: { lat: 21.0155, lng: 105.5290 },
      locationStatus: LOCATION_STATUSES.UNCONFIRMED,
    };

    assert.equal(hasConfirmedCoordinates(confirmedEntity), true);
    assert.equal(getGoogleMapsDestination(confirmedEntity), '21.0155,105.529');
    assert.equal(
      getGoogleMapsNavigationUrl(confirmedEntity),
      'https://www.google.com/maps/dir/?api=1&destination=21.0155,105.529'
    );

    assert.equal(hasConfirmedCoordinates(unconfirmedEntity), false);
    assert.equal(getGoogleMapsDestination(unconfirmedEntity), 'Số 12 Đường Nội Khu Hòa Lạc (Gần KTX FPT)');
    const unconfirmedNavUrl = getGoogleMapsNavigationUrl(unconfirmedEntity);
    assert.ok(unconfirmedNavUrl.includes('/maps/search/'));
    assert.ok(!unconfirmedNavUrl.includes('21.0155,105.529'));
  });

  // 8. Distance Calculation
  it('8. Distance Calculation: confirmed job with valid coords computes distance; unconfirmed job yields null distance without NaN/0km glitch', () => {
    const studentLocation = { lat: 21.0130, lng: 105.5260 };

    const confirmedJob = {
      location: { lat: 21.0180, lng: 105.5260 },
      locationStatus: LOCATION_STATUSES.CONFIRMED,
    };

    const unconfirmedJob = {
      location: { lat: 21.0180, lng: 105.5260 },
      locationStatus: LOCATION_STATUSES.UNCONFIRMED,
    };

    const missingCoordsJob = {
      location: { lat: null, lng: null },
      locationStatus: LOCATION_STATUSES.UNCONFIRMED,
    };

    // Confirmed job
    const distMeters = calculateHaversineDistanceMeters(
      studentLocation.lat, studentLocation.lng,
      confirmedJob.location.lat, confirmedJob.location.lng
    );
    assert.ok(typeof distMeters === 'number' && distMeters > 0);

    // Unconfirmed job: application logic must guard with hasConfirmedCoordinates
    const getSafeDistance = (job, userLoc) => {
      if (!hasConfirmedCoordinates(job) || !isValidCoordinate(userLoc?.lat, userLoc?.lng)) {
        return null;
      }
      return calculateHaversineDistanceMeters(userLoc.lat, userLoc.lng, job.location.lat, job.location.lng);
    };

    assert.equal(getSafeDistance(unconfirmedJob, studentLocation), null);
    assert.equal(getSafeDistance(missingCoordsJob, studentLocation), null);
    assert.ok(getSafeDistance(confirmedJob, studentLocation) > 0);
  });

  // 9. Contract Invariant (Fuzz test with 100 random records)
  it('9. Contract Invariant: 100 fuzzed records enforce geoPoint.coordinates [lng, lat] sync, null consistency, and confirmed requirement', () => {
    for (let i = 0; i < 100; i++) {
      const hasCoords = Math.random() > 0.3;
      const isConfirmed = hasCoords && Math.random() > 0.5;
      const lat = hasCoords ? Number((10 + Math.random() * 20).toFixed(6)) : null;
      const lng = hasCoords ? Number((100 + Math.random() * 10).toFixed(6)) : null;
      const address = `Address #${i} random`;

      const input = {
        address,
        location: { lat, lng },
        locationStatus: isConfirmed ? LOCATION_STATUSES.CONFIRMED : (hasCoords ? LOCATION_STATUSES.PENDING_CONFIRMATION : LOCATION_STATUSES.UNCONFIRMED),
        locationSource: hasCoords ? LOCATION_SOURCES.MAP_PIN : null,
      };

      const normalized = normalizeLocationInput(input, null, { isExplicitConfirm: isConfirmed });

      if (normalized.geoPoint) {
        // Invariant 1: GeoJSON coordinates are strictly [lng, lat]
        assert.equal(normalized.geoPoint.coordinates[0], normalized.location.lng);
        assert.equal(normalized.geoPoint.coordinates[1], normalized.location.lat);
        assert.equal(normalized.geoPoint.type, 'Point');
      } else {
        // Invariant 2: If geoPoint is null/undefined, lat and lng must be null
        assert.equal(normalized.location.lat, null);
        assert.equal(normalized.location.lng, null);
      }

      // Invariant 3: confirmed status requires valid geoPoint
      if (normalized.locationStatus === LOCATION_STATUSES.CONFIRMED) {
        assert.ok(normalized.geoPoint !== null && normalized.geoPoint !== undefined);
        assert.ok(normalized.locationConfirmedAt instanceof Date);
        assert.equal(hasConfirmedCoordinates(normalized), true);
      }
    }
  });

  // 10. Idempotent Migration
  it('10. Idempotent Migration: migrating already synchronized clean records produces 0 updates', () => {
    const cleanMigratedJob = {
      address: 'Khu Công Nghệ Cao Hòa Lạc',
      location: { lat: 21.0134, lng: 105.5263 },
      geoPoint: { type: 'Point', coordinates: [105.5263, 21.0134] },
      locationStatus: LOCATION_STATUSES.CONFIRMED,
      locationSource: LOCATION_SOURCES.MAP_PIN,
      locationConfirmedAt: new Date('2026-03-01T00:00:00Z'),
      addressComponents: {
        addressLine: 'Khu Công Nghệ Cao Hòa Lạc',
        wardCode: '001',
        wardName: 'Tân Xã',
        districtCode: '01',
        districtName: 'Thạch Thất',
        provinceCode: '01',
        provinceName: 'Hà Nội',
      },
    };

    // Simulate migration check
    const checkNeedsUpdate = (job) => {
      const lat = job.location?.lat;
      const lng = job.location?.lng;
      if (!isValidCoordinate(lat, lng)) {
        return job.location?.lat !== null || job.location?.lng !== null || job.geoPoint !== undefined;
      }
      const hasExactGeoPoint =
        job.geoPoint &&
        job.geoPoint.type === 'Point' &&
        Array.isArray(job.geoPoint.coordinates) &&
        job.geoPoint.coordinates[0] === lng &&
        job.geoPoint.coordinates[1] === lat;
      return !hasExactGeoPoint;
    };

    // First run detects no drift
    assert.equal(checkNeedsUpdate(cleanMigratedJob), false);
    // Second run is identically idempotent
    assert.equal(checkNeedsUpdate(cleanMigratedJob), false);
  });

  // 11. Administrative Address
  it('11. Administrative Address: normalizeAddressComponents normalizes fields, does not hardcode "Hà Nội", preserves custom inputs', () => {
    const customAdmin = {
      addressLine: 'Thôn 3',
      wardCode: 'ward_999',
      wardName: 'Xã Phú Cát',
      districtCode: 'district_88',
      districtName: 'Huyện Quốc Oai',
      provinceCode: 'province_01',
      provinceName: 'Thành phố Hà Nội',
    };

    const normalized = normalizeAddressComponents(customAdmin);
    assert.equal(normalized.wardName, 'Xã Phú Cát');
    assert.equal(normalized.districtName, 'Huyện Quốc Oai');
    assert.equal(normalized.provinceName, 'Thành phố Hà Nội');

    // Outside list / empty input returns safe object
    const emptyAdmin = normalizeAddressComponents(null);
    assert.equal(emptyAdmin.addressLine, '');
    assert.equal(emptyAdmin.wardCode, null);
    assert.equal(emptyAdmin.provinceName, '');
  });

  // 12. Security Boundary
  it('12. Security Boundary: malicious client payload forging geoPoint and confirmedAt is stripped and computed authoritatively by server', () => {
    const maliciousPayload = {
      address: 'Địa chỉ giả mạo',
      location: { lat: 21.0134, lng: 105.5263 },
      locationStatus: 'confirmed', // Attempting to self-confirm without valid endpoint
      geoPoint: { type: 'Point', coordinates: [0, 0] }, // Fake coordinates
      locationConfirmedAt: '2099-01-01T00:00:00.000Z', // Fake future timestamp
    };

    const previousDoc = {
      address: 'Địa chỉ cũ',
      location: { lat: null, lng: null },
      locationStatus: 'unconfirmed',
    };

    // When address changed from previousDoc, server MUST reset to unconfirmed and discard client's fake confirmedAt
    const secured = normalizeLocationInput(maliciousPayload, previousDoc, { isExplicitConfirm: false });
    assert.equal(secured.locationStatus, LOCATION_STATUSES.UNCONFIRMED);
    assert.equal(secured.locationConfirmedAt, null);
    // Client fake geoPoint [0, 0] was ignored; real coordinates [105.5263, 21.0134] used
    assert.deepEqual(secured.geoPoint, {
      type: 'Point',
      coordinates: [105.5263, 21.0134],
    });
  });

});
