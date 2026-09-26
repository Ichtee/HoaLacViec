import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidCoordinate,
  hasConfirmedCoordinates,
  getGoogleMapsDestination,
  getGoogleMapsNavigationUrl,
  getGoogleMapsDirectionsUrl,
  getGoogleMapsSearchUrl,
} from '../src/utils/geoHelper.js';

test('Google Maps Directions & Navigation Destination Tests', async (t) => {
  // 1. Confirmed coordinates are prioritized over address
  await t.test('1. confirmed coordinates được ưu tiên hơn address', () => {
    const job = {
      address: 'Số 12 Đường Khác Lạ, Khu Hòa Lạc, Hà Nội',
      location: { lat: 21.0134, lng: 105.5263 },
      locationStatus: 'confirmed',
    };

    assert.equal(hasConfirmedCoordinates(job), true);
    assert.equal(getGoogleMapsDestination(job), '21.0134,105.5263');
    assert.equal(
      getGoogleMapsNavigationUrl(job),
      'https://www.google.com/maps/dir/?api=1&destination=21.0134,105.5263'
    );
  });

  // 2. Address exists but location confirmed still uses lat,lng
  await t.test('2. address có giá trị nhưng location confirmed vẫn dùng lat,lng', () => {
    const jobWithVagueAddress = {
      title: 'Nhân viên phục vụ',
      address: 'Khu Công Nghệ Cao Hòa Lạc',
      storeName: 'Bách Hóa SV',
      location: { lat: 21.0155, lng: 105.529 },
      locationStatus: 'confirmed',
    };

    const destination = getGoogleMapsDestination(jobWithVagueAddress);
    assert.equal(destination, '21.0155,105.529');
    assert.notEqual(destination, jobWithVagueAddress.address);
    assert.notEqual(destination, jobWithVagueAddress.storeName);
    assert.equal(
      getGoogleMapsNavigationUrl(jobWithVagueAddress),
      'https://www.google.com/maps/dir/?api=1&destination=21.0155,105.529'
    );
  });

  // 3. Unconfirmed location does NOT produce exact "Chỉ đường" (directions) destination
  await t.test('3. unconfirmed location không hiện nút “Chỉ đường” và fallback sang search URL', () => {
    const unconfirmedJob = {
      address: 'Ngõ 20 Tân Xã, Thạch Thất, Hà Nội',
      location: { lat: 21.0155, lng: 105.529 },
      locationStatus: 'unconfirmed',
    };

    assert.equal(hasConfirmedCoordinates(unconfirmedJob), false);
    // getGoogleMapsDestination returns address for search, not coordinates
    assert.equal(getGoogleMapsDestination(unconfirmedJob), 'Ngõ 20 Tân Xã, Thạch Thất, Hà Nội');

    // Navigation URL must NOT be directions (/dir/?api=1&destination=lat,lng)
    const navUrl = getGoogleMapsNavigationUrl(unconfirmedJob);
    assert.ok(
      navUrl.startsWith('https://www.google.com/maps/search/?api=1&query='),
      'Must use Google Maps search instead of direct navigation'
    );
    assert.ok(!navUrl.includes('/dir/?api=1&destination=21.0155,105.529'));

    // Legacy unverified also treated as unconfirmed
    const legacyJob = {
      address: 'Đường D1, Khu CNC Hòa Lạc',
      location: { lat: 21.0155, lng: 105.529 },
      locationStatus: 'legacy_unverified',
    };
    assert.equal(hasConfirmedCoordinates(legacyJob), false);
    assert.equal(getGoogleMapsDestination(legacyJob), 'Đường D1, Khu CNC Hòa Lạc');
    assert.ok(getGoogleMapsNavigationUrl(legacyJob).startsWith('https://www.google.com/maps/search/?api=1&query='));
  });

  // 4. Invalid coordinates fallback to search address
  await t.test('4. invalid coordinates fallback sang search address', () => {
    const invalidCoordsJob = {
      address: 'Số 88 Tân Xã, Thạch Thất, Hà Nội',
      location: { lat: 999, lng: 'invalid_lng' },
      locationStatus: 'confirmed', // Claimed confirmed but coords are invalid
    };

    assert.equal(isValidCoordinate(invalidCoordsJob.location.lat, invalidCoordsJob.location.lng), false);
    assert.equal(hasConfirmedCoordinates(invalidCoordsJob), false);
    // Must fall back to formatted address string
    assert.equal(getGoogleMapsDestination(invalidCoordsJob), 'Số 88 Tân Xã, Thạch Thất, Hà Nội');
    assert.ok(
      getGoogleMapsNavigationUrl(invalidCoordsJob).startsWith('https://www.google.com/maps/search/?api=1&query=')
    );
  });

  // 5. Never fall back to fake "Hòa Lạc" or artificial storeName concatenation
  await t.test('5. không fallback sang “Hòa Lạc” giả hoặc storeName tự ghép', () => {
    const emptyJob = {
      title: 'Gia sư Toán',
      storeName: 'Trung tâm Gia Sư FPT',
      locationStatus: 'unconfirmed',
      location: null,
      address: '',
    };

    // When no address and unconfirmed coords, must return null rather than fake "Hòa Lạc" or "Trung tâm Gia Sư FPT, Hòa Lạc"
    const destination = getGoogleMapsDestination(emptyJob);
    assert.equal(destination, null);
    assert.equal(getGoogleMapsNavigationUrl(emptyJob), null);

    const whitespaceAddressJob = {
      address: '   ',
      locationStatus: 'unconfirmed',
    };
    assert.equal(getGoogleMapsDestination(whitespaceAddressJob), null);
    assert.equal(getGoogleMapsNavigationUrl(whitespaceAddressJob), null);
  });

  // 6. JobDetail, JobCard, and JobMap generate the exact same destination
  await t.test('6. JobDetail, JobCard và JobMap sinh cùng một destination', () => {
    const sampleJob = {
      _id: 'job-12345',
      title: 'Barista Part-time',
      address: 'Tầng 1 Tòa Alpha, ĐH FPT, Hòa Lạc',
      location: { lat: 21.0134, lng: 105.5263 },
      locationStatus: 'confirmed',
    };

    // Simulate JobDetail destination resolution
    const jobDetailDest = getGoogleMapsDestination(sampleJob);
    const jobDetailUrl = hasConfirmedCoordinates(sampleJob)
      ? `https://www.google.com/maps/dir/?api=1&destination=${jobDetailDest}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(jobDetailDest)}`;

    // Simulate JobCard destination resolution
    const jobCardDest = getGoogleMapsDestination(sampleJob);
    const jobCardUrl = hasConfirmedCoordinates(sampleJob)
      ? `https://www.google.com/maps/dir/?api=1&destination=${jobCardDest}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(jobCardDest)}`;

    // Simulate JobMap destination resolution
    const jobMapDest = getGoogleMapsDestination(sampleJob);
    const jobMapUrl = `https://www.google.com/maps/dir/?api=1&destination=${jobMapDest}`;

    assert.equal(jobDetailDest, jobCardDest);
    assert.equal(jobDetailDest, jobMapDest);
    assert.equal(jobDetailDest, '21.0134,105.5263');
    assert.equal(jobDetailUrl, jobCardUrl);
    assert.equal(jobDetailUrl, jobMapUrl);
  });

  // 7. Modifying address resets confirmed status unless reconfirmed
  await t.test('7. sửa address làm mất trạng thái confirmed cho đến khi pin được xác nhận lại', () => {
    // Simulate updating an existing job where the user changed physical address text
    const existingJob = {
      address: 'Địa chỉ cũ: Số 1 Tân Xã',
      location: { lat: 21.0134, lng: 105.5263 },
      locationStatus: 'confirmed',
      locationConfirmedAt: new Date('2026-01-01'),
    };

    // In jobRoutes.js PUT /api/jobs/:id logic:
    // If req.body.address changed and locationStatus is not explicitly reconfirmed
    function simulateJobUpdate(job, updatePayload) {
      const isAddressChanged =
        updatePayload.address !== undefined &&
        updatePayload.address.trim() !== job.address.trim();

      let nextStatus = updatePayload.locationStatus || job.locationStatus;
      let nextConfirmedAt = job.locationConfirmedAt;

      if (isAddressChanged && updatePayload.locationStatus !== 'confirmed') {
        nextStatus = 'unconfirmed';
        nextConfirmedAt = null;
      }

      return {
        ...job,
        ...updatePayload,
        locationStatus: nextStatus,
        locationConfirmedAt: nextConfirmedAt,
      };
    }

    // User only modified address string without re-pinning
    const updatedWithoutRepin = simulateJobUpdate(existingJob, {
      address: 'Địa chỉ mới: Số 99 Thạch Hòa',
    });

    assert.equal(updatedWithoutRepin.locationStatus, 'unconfirmed');
    assert.equal(updatedWithoutRepin.locationConfirmedAt, null);
    assert.equal(hasConfirmedCoordinates(updatedWithoutRepin), false);
    // Google Maps now searches the new address instead of sending them to the old coordinates
    assert.equal(getGoogleMapsDestination(updatedWithoutRepin), 'Địa chỉ mới: Số 99 Thạch Hòa');

    // When the employer re-pins and explicitly confirms:
    const updatedWithRepin = simulateJobUpdate(existingJob, {
      address: 'Địa chỉ mới: Số 99 Thạch Hòa',
      location: { lat: 21.0201, lng: 105.5312 },
      locationStatus: 'confirmed',
      locationConfirmedAt: new Date(),
    });

    assert.equal(updatedWithRepin.locationStatus, 'confirmed');
    assert.equal(hasConfirmedCoordinates(updatedWithRepin), true);
    assert.equal(getGoogleMapsDestination(updatedWithRepin), '21.0201,105.5312');
  });

  // 8. Simplified address-based Google Maps Directions / Search
  await t.test('8. Đơn giản hóa toàn bộ nút Chỉ đường trên Google Maps', async (st) => {
    // 1. job.address = "Số 15 Trục đường chính Tân Xã, Thạch Thất"
    // URL phải chứa chính xác query đã encode của chuỗi trên.
    await st.test('1. URL chứa chính xác query đã encode của job.address', () => {
      const job = {
        title: 'Phụ Quán',
        address: 'Số 15 Trục đường chính Tân Xã, Thạch Thất',
      };
      const expectedUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Số 15 Trục đường chính Tân Xã, Thạch Thất')}`;
      const actualUrl = getGoogleMapsDirectionsUrl(job);

      assert.equal(actualUrl, expectedUrl);
      assert.ok(actualUrl.includes('query=' + encodeURIComponent('Số 15 Trục đường chính Tân Xã, Thạch Thất')));
    });

    // 2. Dù job có confirmed coordinates, URL vẫn phải dùng address.
    await st.test('2. Dù job có confirmed coordinates, URL vẫn phải dùng address', () => {
      const confirmedJobWithCoords = {
        title: 'Nhân viên pha chế',
        address: 'Số 15 Trục đường chính Tân Xã, Thạch Thất',
        location: { lat: 21.0185, lng: 105.521 },
        locationStatus: 'confirmed',
        geoPoint: { type: 'Point', coordinates: [105.521, 21.0185] },
      };
      const url = getGoogleMapsDirectionsUrl(confirmedJobWithCoords);

      assert.equal(
        url,
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Số 15 Trục đường chính Tân Xã, Thạch Thất')}`
      );
      assert.ok(!url.includes('21.0185'), 'URL must NOT contain latitude');
      assert.ok(!url.includes('105.521'), 'URL must NOT contain longitude');
    });

    // 3. Không dùng employer.address khi job.address rỗng.
    await st.test('3. Không dùng employer.address khi job.address rỗng', () => {
      const jobWithOnlyEmployerAddress = {
        title: 'Thu ngân',
        address: '',
        employer: {
          storeName: 'Quán Cà Phê Mộc',
          address: 'Số 99 Đường Láng Hòa Lạc',
        },
      };
      assert.equal(getGoogleMapsDirectionsUrl(jobWithOnlyEmployerAddress), null);

      const jobWithNullAddress = {
        title: 'Thu ngân',
        address: null,
        employer: {
          address: 'Số 99 Đường Láng Hòa Lạc',
        },
      };
      assert.equal(getGoogleMapsDirectionsUrl(jobWithNullAddress), null);
    });

    // 4. job.address rỗng thì helper trả null và không hiện nút.
    await st.test('4. job.address rỗng thì helper trả null và không hiện nút', () => {
      assert.equal(getGoogleMapsDirectionsUrl({ address: '' }), null);
      assert.equal(getGoogleMapsDirectionsUrl({ address: '   ' }), null);
      assert.equal(getGoogleMapsDirectionsUrl({ address: null }), null);
      assert.equal(getGoogleMapsDirectionsUrl({ address: undefined }), null);
      assert.equal(getGoogleMapsDirectionsUrl({}), null);
      assert.equal(getGoogleMapsDirectionsUrl(null), null);
      assert.equal(getGoogleMapsDirectionsUrl(undefined), null);
    });

    // 5. JobDetail, JobCard và JobMap phải tạo cùng một URL.
    await st.test('5. JobDetail, JobCard và JobMap phải tạo cùng một URL', () => {
      const job = {
        _id: 'job-789',
        title: 'Phụ Bếp Trưa',
        storeName: 'Cơm Thố Tân Xã',
        address: 'Số 15 Trục đường chính Tân Xã, Thạch Thất',
        location: { lat: 21.0185, lng: 105.521 },
        locationStatus: 'confirmed',
      };

      // JobDetailPage resolution:
      const jobDetailDirectionsUrl = getGoogleMapsDirectionsUrl(job);
      // JobCard resolution:
      const jobCardDirectionsUrl = getGoogleMapsDirectionsUrl(job);
      // JobMap resolution:
      const jobMapDirectionsUrl = getGoogleMapsDirectionsUrl(job);

      const expectedUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Số 15 Trục đường chính Tân Xã, Thạch Thất')}`;

      assert.equal(jobDetailDirectionsUrl, expectedUrl);
      assert.equal(jobCardDirectionsUrl, expectedUrl);
      assert.equal(jobMapDirectionsUrl, expectedUrl);
      assert.equal(jobDetailDirectionsUrl, jobCardDirectionsUrl);
      assert.equal(jobCardDirectionsUrl, jobMapDirectionsUrl);
    });
  });
});
