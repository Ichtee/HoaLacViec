import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toRouteCoordinate,
  toLeafletCoordinate,
  toGeoJsonCoordinate,
  toGeoJsonPoint,
  fromGeoJsonCoordinate,
  fromLeafletCoordinate,
  extractLatLng,
} from '../src/utils/coordinateHelper.js';
import {
  DEFAULT_HOALAC_BIAS,
  autocompleteCache,
  placeCache,
  reverseCache,
  routeCache,
  normalizeVietmapAddressComponents,
  vietmapAutocomplete,
  vietmapSearch,
  vietmapPlace,
  vietmapReverse,
  vietmapReverseBatch,
  vietmapRoute,
  vietmapRouteTolls,
  vietmapMatchTolls,
} from '../src/services/vietmapService.js';
import { normalizeLocationInput, toLocationDTO } from '../src/utils/locationContract.js';

test('VIETMAP Integration & Security Contract Tests', async (t) => {
  // Set test mock key for service calls
  process.env.VIETMAP_SERVICE_API_KEY = 'mock_vietmap_service_key_for_tests';

  // Clear caches before tests
  autocompleteCache.clear();
  placeCache.clear();
  reverseCache.clear();
  routeCache.clear();

  // 1. Coordinate Conversion Contract
  await t.test('1. Coordinate Contract: 3 distinct formats (Route, Leaflet, GeoJSON)', () => {
    const lat = 21.0128;
    const lng = 105.5255;
    const coordObj = { lat, lng };

    // Format 1: Vietmap Route v4 string "lat,lng" (latitude first)
    const routeCoord = toRouteCoordinate(coordObj);
    assert.equal(routeCoord, '21.0128,105.5255');
    assert.equal(toRouteCoordinate(lat, lng), '21.0128,105.5255');

    // Format 2: Leaflet coordinate [lat, lng] (latitude first)
    const leafletCoord = toLeafletCoordinate(coordObj);
    assert.deepEqual(leafletCoord, [21.0128, 105.5255]);
    assert.equal(leafletCoord[0], lat);
    assert.equal(leafletCoord[1], lng);
    assert.deepEqual(toLeafletCoordinate(lat, lng), [21.0128, 105.5255]);

    // Format 3: Vietmap GL / GeoJSON coordinate [lng, lat] (longitude first)
    const geoJsonCoord = toGeoJsonCoordinate(coordObj);
    assert.deepEqual(geoJsonCoord, [105.5255, 21.0128]);
    assert.equal(geoJsonCoord[0], lng);
    assert.equal(geoJsonCoord[1], lat);
    assert.deepEqual(toGeoJsonCoordinate(lat, lng), [105.5255, 21.0128]);

    // GeoJSON Point object format
    const geoJsonPoint = toGeoJsonPoint(coordObj);
    assert.deepEqual(geoJsonPoint, {
      type: 'Point',
      coordinates: [105.5255, 21.0128],
    });

    // Invert conversions
    const fromGeo = fromGeoJsonCoordinate([105.5255, 21.0128]);
    assert.equal(fromGeo.lat, 21.0128);
    assert.equal(fromGeo.lng, 105.5255);

    const fromLeaf = fromLeafletCoordinate([21.0128, 105.5255]);
    assert.equal(fromLeaf.lat, 21.0128);
    assert.equal(fromLeaf.lng, 105.5255);

    // extractLatLng flexibility
    assert.deepEqual(extractLatLng({ lat: 21, lng: 105 }), { lat: 21, lng: 105 });
    assert.deepEqual(extractLatLng([105, 21], 'geojson'), { lat: 21, lng: 105 });
    assert.deepEqual(extractLatLng([21, 105], 'leaflet'), { lat: 21, lng: 105 });

    // Invalid coordinate safety
    assert.equal(toRouteCoordinate(null), null);
    assert.equal(toLeafletCoordinate(NaN, 100), null);
    assert.equal(toGeoJsonCoordinate(95, 105), null); // lat > 90
    assert.equal(toGeoJsonPoint(-91, 105), null); // lat < -90
    assert.equal(toGeoJsonCoordinate(21, 185), null); // lng > 180
  });

  // 2. Autocomplete v4 Contract
  await t.test('2. Autocomplete v4: Rejects < 2 chars, uses Hoa Lac bias, returns refId without coordinates', async () => {
    // 2.1 Rejects length < 2
    const shortRes = await vietmapAutocomplete('a');
    assert.equal(shortRes.success, true);
    assert.equal(shortRes.suggestions.length, 0);

    const emptyRes = await vietmapAutocomplete('');
    assert.equal(emptyRes.success, true);
    assert.equal(emptyRes.suggestions.length, 0);

    // 2.2 Cache test: populating cache directly and verifying retrieval
    const testQuery = 'Đại học FPT Hòa Lạc';
    const mockSuggestions = [
      {
        refId: 'vietmap_ref_123',
        display: 'Trường Đại học FPT Hà Nội',
        name: 'Trường Đại học FPT',
        address: 'Khu CNC Hòa Lạc, Km29 Đại lộ Thăng Long, Thạch Thất, Hà Nội',
      },
    ];

    // Seed cache
    const cacheKey = `${testQuery.toLowerCase()}|${DEFAULT_HOALAC_BIAS}|6`;
    autocompleteCache.set(cacheKey, mockSuggestions);

    // Fetch should return from cache
    const cached = await vietmapAutocomplete(testQuery);
    assert.equal(cached.success, true);
    assert.equal(cached.suggestions.length, 1);
    assert.equal(cached.suggestions[0].refId, 'vietmap_ref_123');
    assert.equal(cached.suggestions[0].display, 'Trường Đại học FPT Hà Nội');
    // Autocomplete must NOT return coordinates
    assert.equal(cached.suggestions[0].lat, undefined);
    assert.equal(cached.suggestions[0].lng, undefined);

    // 2.3 Search v4 validation
    const emptySearch = await vietmapSearch('');
    assert.equal(emptySearch.success, true);
    assert.equal(emptySearch.results.length, 0);
  });

  // 3. Place v4 Contract
  await t.test('3. Place v4: Requires valid refId, returns authoritative coordinates & addressComponents', async () => {
    // 3.1 Rejects empty refId with safe error code
    const emptyRes = await vietmapPlace('');
    assert.equal(emptyRes.success, false);
    assert.equal(emptyRes.code, 'INVALID_REFID');

    // 3.2 Cache test for place
    const sampleRefId = 'sample_ref_fpt_456';
    const samplePlaceData = {
      provider: 'vietmap',
      refId: sampleRefId,
      displayName: 'Trường Đại học FPT',
      formattedAddress: 'Khu CNC Hòa Lạc, Thạch Thất, Hà Nội',
      lat: 21.0128,
      lng: 105.5255,
      addressComponents: {
        addressLine: 'Khu CNC Hòa Lạc',
        wardCode: '001',
        wardName: 'Thạch Hòa',
        districtCode: '016',
        districtName: 'Thạch Thất',
        provinceCode: '01',
        provinceName: 'Hà Nội',
      },
    };

    placeCache.set(sampleRefId, samplePlaceData);
    const result = await vietmapPlace(sampleRefId);
    assert.equal(result.success, true);
    assert.equal(result.place.provider, 'vietmap');
    assert.equal(result.place.refId, sampleRefId);
    assert.equal(result.place.lat, 21.0128);
    assert.equal(result.place.lng, 105.5255);
    assert.equal(result.place.addressComponents.wardName, 'Thạch Hòa');
  });

  // 4. Reverse v4 Contract
  await t.test('4. Reverse v4: Validates coordinates and returns structured address components', async () => {
    // Invalid coordinates rejected
    const invalidRes = await vietmapReverse(100, 200);
    assert.equal(invalidRes.success, false);
    assert.equal(invalidRes.code, 'INVALID_COORDINATES');

    // Normalizing raw Vietmap address components
    const rawVietmap = {
      address: 'Số 15 Tân Xã',
      ward_id: 1234,
      ward: 'Xã Tân Xã',
      district_id: 567,
      district: 'Huyện Thạch Thất',
      city_id: 1,
      city: 'Thành phố Hà Nội',
    };
    const normalized = normalizeVietmapAddressComponents(rawVietmap);
    assert.equal(normalized.addressLine, 'Số 15 Tân Xã');
    assert.equal(normalized.wardCode, '1234');
    assert.equal(normalized.wardName, 'Xã Tân Xã');
    assert.equal(normalized.districtCode, '567');
    assert.equal(normalized.districtName, 'Huyện Thạch Thất');
    assert.equal(normalized.provinceCode, '1');
    assert.equal(normalized.provinceName, 'Thành phố Hà Nội');
  });

  // 5. Route v4 Contract (motorcycle support)
  await t.test('5. Route v4: Validates origin/destination and uses motorcycle vehicle mode', async () => {
    // Missing origin/destination rejected safely
    const invalidRouteRes = await vietmapRoute({ origin: null, destination: { lat: 21, lng: 105 } });
    assert.equal(invalidRouteRes.success, false);
    assert.equal(invalidRouteRes.code, 'INVALID_POINTS');

    // Cache test for route
    const mockRouteResult = {
      provider: 'vietmap',
      vehicle: 'motorcycle',
      distanceMeters: 4200,
      distanceKm: 4.2,
      durationMs: 480000,
      durationMin: 8,
      points: [
        [21.0128, 105.5255],
        [21.016, 105.53],
      ],
      bbox: [105.5255, 21.0128, 105.53, 21.016],
    };

    const routeKey = '21.0128,105.5255->21.016,105.53|motorcycle';
    routeCache.set(routeKey, mockRouteResult);

    const fetchedRoute = await vietmapRoute({
      origin: { lat: 21.0128, lng: 105.5255 },
      destination: { lat: 21.016, lng: 105.53 },
      vehicle: 'motorcycle',
    });

    assert.equal(fetchedRoute.success, true);
    assert.equal(fetchedRoute.route.vehicle, 'motorcycle');
    assert.equal(fetchedRoute.route.distanceKm, 4.2);
    assert.equal(fetchedRoute.route.durationMin, 8);
    assert.equal(fetchedRoute.route.points.length, 2);
  });

  // 6. Security & Key Protection
  await t.test('6. Security: VIETMAP_SERVICE_API_KEY is backend secret and not exposed in DTOs', () => {
    const jobWithLocation = {
      address: 'ĐH FPT, Hòa Lạc',
      location: { lat: 21.0128, lng: 105.5255 },
      geoPoint: { type: 'Point', coordinates: [105.5255, 21.0128] },
      locationStatus: 'confirmed',
      locationSource: 'geocoded',
      geocodingProvider: 'vietmap',
      providerPlaceId: 'ref_987654',
      formattedAddress: 'Khu Công Nghệ Cao Hòa Lạc, Thạch Thất, Hà Nội',
    };

    const dto = toLocationDTO(jobWithLocation);

    // DTO must include public metadata
    assert.equal(dto.geocodingProvider, 'vietmap');
    assert.equal(dto.providerPlaceId, 'ref_987654');
    assert.equal(dto.formattedAddress, 'Khu Công Nghệ Cao Hòa Lạc, Thạch Thất, Hà Nội');

    // DTO must NEVER contain any API key field
    assert.equal(dto.apiKey, undefined);
    assert.equal(dto.VIETMAP_SERVICE_API_KEY, undefined);
    assert.equal(dto.serviceApiKey, undefined);
  });

  // 7. Non-destructive Location Normalization & Backward Compatibility
  await t.test('7. Backward Compatibility: Preserves legacy records and district fields', () => {
    // Legacy record without vietmap fields
    const legacyJob = {
      _id: '507f1f77bcf86cd799439011',
      title: 'Nhân viên phục vụ part-time',
      address: 'Thôn 3, Thạch Hòa, Thạch Thất',
      district: 'thach-that',
      location: { lat: 21.01, lng: 105.52 },
      locationStatus: 'confirmed',
    };

    const normalized = normalizeLocationInput(legacyJob);

    // Location & GeoPoint synchronized
    assert.equal(normalized.locationStatus, 'confirmed');
    assert.deepEqual(normalized.geoPoint.coordinates, [105.52, 21.01]);

    // Simulating document update: legacy district remains intact
    const updatedJob = {
      ...legacyJob,
      ...normalized,
    };
    assert.equal(updatedJob.district, 'thach-that');

    // Unconfirmed candidate selection sets pending_confirmation, not confirmed
    const unconfirmedCandidate = {
      address: 'Tân Xã, Thạch Thất',
      location: { lat: 21.02, lng: 105.53 },
      locationStatus: 'pending_confirmation',
      locationSource: 'geocoded',
      geocodingProvider: 'vietmap',
      providerPlaceId: 'ref_tan_xa_1',
    };
    const normalizedCandidate = normalizeLocationInput(unconfirmedCandidate);
    assert.equal(normalizedCandidate.locationStatus, 'pending_confirmation');
    // locationConfirmedAt must be null until confirmed
    assert.equal(normalizedCandidate.locationConfirmedAt, null);
  });

  // 8. VietMap Routing & Tolls Integration (Route v4, Route-tolls, Match-tolls)
  await t.test('8. VietMap Routing & Tolls: Route v4 GeoJSON parsing, toll annotations, and tolls APIs', async () => {
    // 8.1 Route v4 cache and annotations
    const tollRouteResult = {
      provider: 'vietmap',
      vehicle: 'car',
      distanceMeters: 12000,
      distanceKm: 12.0,
      durationMs: 900000,
      durationMin: 15,
      tollCost: 35000,
      tolls: [
        { id: 101, name: 'Trạm Thu Phí Hòa Lạc', address: 'Đại lộ Thăng Long', type: 'exit', price: 35000 },
      ],
      points: [
        [21.0128, 105.5255],
        [21.0250, 105.5500],
      ],
      geoJsonCoordinates: [
        [105.5255, 21.0128],
        [105.5500, 21.0250],
      ],
      bbox: [105.5255, 21.0128, 105.55, 21.025],
    };

    const tollKey = '21.0128,105.5255->21.025,105.55|car|toll';
    routeCache.set(tollKey, tollRouteResult);

    const fetchedTollRoute = await vietmapRoute({
      origin: { lat: 21.0128, lng: 105.5255 },
      destination: { lat: 21.025, lng: 105.55 },
      vehicle: 'car',
      annotations: 'toll',
    });

    assert.equal(fetchedTollRoute.success, true);
    assert.equal(fetchedTollRoute.route.tollCost, 35000);
    assert.equal(fetchedTollRoute.route.tolls.length, 1);
    assert.equal(fetchedTollRoute.route.tolls[0].name, 'Trạm Thu Phí Hòa Lạc');
    assert.equal(fetchedTollRoute.route.geoJsonCoordinates[0][0], 105.5255); // longitude first
    assert.equal(fetchedTollRoute.route.geoJsonCoordinates[0][1], 21.0128); // latitude second

    // 8.2 Route-tolls parameter validation
    const invalidRouteTolls = await vietmapRouteTolls({ points: [] });
    assert.equal(invalidRouteTolls.success, false);
    assert.equal(invalidRouteTolls.code, 'INVALID_POINTS');

    // 8.3 Match-tolls parameter validation
    const invalidMatchTolls = await vietmapMatchTolls({ path: [] });
    assert.equal(invalidMatchTolls.success, false);
    assert.equal(invalidMatchTolls.code, 'INVALID_POINTS');

    // 8.4 Reverse-batch parameter validation
    const invalidReverseBatch = await vietmapReverseBatch([]);
    assert.equal(invalidReverseBatch.success, false);
    assert.equal(invalidReverseBatch.code, 'INVALID_POINTS');
  });
});

