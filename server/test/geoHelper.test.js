import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidCoordinate,
  calculateHaversineDistanceMeters,
  clampRadius,
  evaluateAttendanceGPS,
} from '../src/utils/geoHelper.js';

test('1. Coordinate Validation: isValidCoordinate', async (t) => {
  await t.test('Valid coordinates (numbers and numeric strings, including 0)', () => {
    // Standard valid points
    assert.equal(isValidCoordinate(21.0128, 105.5255), true);
    assert.equal(isValidCoordinate(-33.8688, 151.2093), true);

    // Boundary values
    assert.equal(isValidCoordinate(90, 180), true);
    assert.equal(isValidCoordinate(-90, -180), true);

    // 0 (Equator & Prime Meridian) - CRITICAL: truthiness checks fail here!
    assert.equal(isValidCoordinate(0, 0), true);
    assert.equal(isValidCoordinate(0, 105.5), true);
    assert.equal(isValidCoordinate(21.0, 0), true);

    // Valid numeric strings
    assert.equal(isValidCoordinate('21.0128', '105.5255'), true);
    assert.equal(isValidCoordinate('0', '0'), true);
  });

  await t.test('Invalid coordinates: out of range, NaN, Infinity, strings, nulls', () => {
    // Latitude out of range
    assert.equal(isValidCoordinate(90.0001, 100), false);
    assert.equal(isValidCoordinate(-91, 100), false);

    // Longitude out of range
    assert.equal(isValidCoordinate(20, 180.001), false);
    assert.equal(isValidCoordinate(20, -181), false);

    // NaN and Infinity
    assert.equal(isValidCoordinate(NaN, 100), false);
    assert.equal(isValidCoordinate(20, NaN), false);
    assert.equal(isValidCoordinate(Infinity, 100), false);
    assert.equal(isValidCoordinate(20, -Infinity), false);

    // Non-numeric types (null, undefined, non-numeric strings, empty strings, booleans, objects)
    assert.equal(isValidCoordinate(null, 105), false);
    assert.equal(isValidCoordinate(21, undefined), false);
    assert.equal(isValidCoordinate('', ''), false);
    assert.equal(isValidCoordinate('   ', '   '), false);
    assert.equal(isValidCoordinate('abc', '105'), false);
    assert.equal(isValidCoordinate(true, false), false);
    assert.equal(isValidCoordinate({}, []), false);
  });
});

test('2. Haversine Formula Distance Calculation', async (t) => {
  await t.test('Same coordinate returns 0 meters', () => {
    const dist = calculateHaversineDistanceMeters(21.0128, 105.5255, 21.0128, 105.5255);
    assert.equal(dist, 0);
  });

  await t.test('Known distance benchmark: FPT University to Tan Xa Lake (~620m)', () => {
    const fpt = { lat: 21.0134, lng: 105.5263 };
    const tanXa = { lat: 21.0175, lng: 105.5220 };
    const dist = calculateHaversineDistanceMeters(fpt.lat, fpt.lng, tanXa.lat, tanXa.lng);

    // Distance should be approximately 628 meters (within 10m tolerance)
    assert.ok(dist >= 610 && dist <= 645, `Expected ~628m, got ${dist}`);
  });

  await t.test('Handles coordinates at (0, 0)', () => {
    const dist = calculateHaversineDistanceMeters(0, 0, 0, 1);
    // 1 degree longitude at equator is ~111.32 km
    assert.ok(dist >= 111000 && dist <= 112000, `Expected ~111.3km, got ${dist}`);
  });

  await t.test('Returns null for invalid coordinates', () => {
    assert.equal(calculateHaversineDistanceMeters(NaN, 105, 21, 105), null);
    assert.equal(calculateHaversineDistanceMeters(21, 105, 95, 105), null);
  });
});

test('3. Radius Clamping: clampRadius', () => {
  assert.equal(clampRadius(150), 150);
  assert.equal(clampRadius(30), 50); // Min clamp
  assert.equal(clampRadius(1000), 500); // Max clamp
  assert.equal(clampRadius('invalid'), 150); // Fallback
  assert.equal(clampRadius(null), 150);
});

test('4. GPS Attendance Evaluation: evaluateAttendanceGPS', async (t) => {
  const jobConfirmed = {
    location: { lat: 21.0128, lng: 105.5255 },
    locationStatus: 'confirmed',
  };

  await t.test('Pass: within radius, high accuracy, fresh timestamp, confirmed job location', () => {
    const result = evaluateAttendanceGPS({
      lat: 21.0129, // ~15m away
      lng: 105.5256,
      accuracy: 15,
      timestamp: Date.now() - 5000, // 5s ago
      jobLocation: jobConfirmed.location,
      jobLocationStatus: jobConfirmed.locationStatus,
      checkinRadius: 150,
      isManual: false,
    });

    assert.equal(result.verified, true);
    assert.equal(result.status, 'verified');
    assert.equal(result.reasonCode, 'VERIFIED');
    assert.ok(result.distanceMeters < 30);
  });

  await t.test('Needs Review: Job location unconfirmed', () => {
    const result = evaluateAttendanceGPS({
      lat: 21.0128,
      lng: 105.5255,
      accuracy: 10,
      timestamp: Date.now(),
      jobLocation: { lat: 21.0128, lng: 105.5255 },
      jobLocationStatus: 'unconfirmed',
      checkinRadius: 150,
    });

    assert.equal(result.verified, false);
    assert.equal(result.status, 'needs_review');
    assert.equal(result.reasonCode, 'JOB_LOCATION_UNCONFIRMED');
  });

  await t.test('Needs Review: Low accuracy (> 100m)', () => {
    const result = evaluateAttendanceGPS({
      lat: 21.0128,
      lng: 105.5255,
      accuracy: 250, // 250m accuracy is too blurry
      timestamp: Date.now(),
      jobLocation: jobConfirmed.location,
      jobLocationStatus: jobConfirmed.locationStatus,
      checkinRadius: 150,
    });

    assert.equal(result.verified, false);
    assert.equal(result.status, 'needs_review');
    assert.equal(result.reasonCode, 'LOW_ACCURACY');
  });

  await t.test('Needs Review: Stale timestamp (> 2 minutes)', () => {
    const result = evaluateAttendanceGPS({
      lat: 21.0128,
      lng: 105.5255,
      accuracy: 10,
      timestamp: Date.now() - 150000, // 2.5 minutes ago
      jobLocation: jobConfirmed.location,
      jobLocationStatus: jobConfirmed.locationStatus,
      checkinRadius: 150,
    });

    assert.equal(result.verified, false);
    assert.equal(result.status, 'needs_review');
    assert.equal(result.reasonCode, 'STALE_POSITION');
  });

  await t.test('Outside Radius: distance > configured radius', () => {
    const result = evaluateAttendanceGPS({
      lat: 21.0250, // ~1.3km away
      lng: 105.5255,
      accuracy: 15,
      timestamp: Date.now(),
      jobLocation: jobConfirmed.location,
      jobLocationStatus: jobConfirmed.locationStatus,
      checkinRadius: 150,
    });

    assert.equal(result.verified, false);
    assert.equal(result.reasonCode, 'OUTSIDE_RADIUS');
    assert.ok(result.distanceMeters > 1000);
  });

  await t.test('Rejected: Invalid coordinates (NaN, Infinity, out of bounds)', () => {
    const result = evaluateAttendanceGPS({
      lat: NaN,
      lng: 105.5255,
      accuracy: 15,
      timestamp: Date.now(),
      jobLocation: jobConfirmed.location,
      jobLocationStatus: jobConfirmed.locationStatus,
      checkinRadius: 150,
    });

    assert.equal(result.verified, false);
    assert.equal(result.status, 'rejected');
    assert.equal(result.reasonCode, 'INVALID_COORDINATES');
  });

  await t.test('Manual Request: flags needs_review with reason', () => {
    const result = evaluateAttendanceGPS({
      isManual: true,
      manualReason: 'Thiết bị lỗi GPS, đã có mặt lúc 8h sáng',
      jobLocation: jobConfirmed.location,
      jobLocationStatus: jobConfirmed.locationStatus,
      checkinRadius: 150,
    });

    assert.equal(result.verified, false);
    assert.equal(result.status, 'needs_review');
    assert.equal(result.reasonCode, 'MANUAL_REQUEST');
  });
});
