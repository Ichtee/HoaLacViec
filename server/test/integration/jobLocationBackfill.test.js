/**
 * Script bổ sung tọa độ ước tính trên MongoDB trong bộ nhớ, với bộ tìm tọa độ giả lập (không gọi Vietmap).
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { startTestServer, createUser, createApprovedJob } from '../e2e/testServer.mjs';
import { backfillJobLocations, isDefaultPoint } from '../../src/scripts/backfillJobLocations.js';

let t;
before(async () => { t = await startTestServer(); });
after(async () => { await t.stop(); });

test('isDefaultPoint nhận ra các điểm mặc định và bỏ qua vị trí thật', () => {
  assert.equal(isDefaultPoint(21.0128, 105.5255), true);
  assert.equal(isDefaultPoint(21.0135, 105.526), true);
  assert.equal(isDefaultPoint(21.0302, 105.5121), false);
});

test('dry-run báo cáo không ghi; --apply chỉ thêm approxLocation/cờ, không đụng location', async () => {
  const m = t.models;
  const col = mongoose.connection.collection('jobs');
  const employer = await createUser(m, { role: 'employer' });

  const unpinned = await createApprovedJob(m, employer, { address: 'Thôn 3, Thạch Hòa, Thạch Thất' });
  await col.updateOne({ _id: unpinned._id }, { $set: { locationStatus: 'unconfirmed', location: { lat: null, lng: null } }, $unset: { geoPoint: '' } });
  const far = await createApprovedJob(m, employer, { address: 'Thôn 3, Xã Khác, Tỉnh Xa' });
  await col.updateOne({ _id: far._id }, { $set: { locationStatus: 'unconfirmed', location: { lat: null, lng: null } }, $unset: { geoPoint: '' } });
  const atDefault = await createApprovedJob(m, employer, { address: 'Số 150, thôn 4, Hòa Lạc' });
  await col.updateOne({ _id: atDefault._id }, { $set: { locationStatus: 'confirmed', location: { lat: 21.0135, lng: 105.526 }, geoPoint: { type: 'Point', coordinates: [105.526, 21.0135] } } });
  const real = await createApprovedJob(m, employer, { address: 'Cổng ĐH FPT' });
  await col.updateOne({ _id: real._id }, { $set: { locationStatus: 'confirmed', location: { lat: 21.0302, lng: 105.5121 }, geoPoint: { type: 'Point', coordinates: [105.5121, 21.0302] } } });

  const fakeGeocode = async (address) => {
    if (address.includes('Tỉnh Xa')) return { success: true, lat: 10.77, lng: 106.69 }; // ~1000 km
    if (address.includes('Thạch Hòa')) return { success: true, lat: 21.0205, lng: 105.5302 };
    if (address.includes('Hòa Lạc')) return { success: true, lat: 21.0251, lng: 105.5188 };
    return { success: false, code: 'ZERO_RESULTS' };
  };

  const dry = await backfillJobLocations({ apply: false, geocode: fakeGeocode });
  assert.equal(dry.applied, false);
  assert.equal(dry.approxFound, 2);
  assert.equal(dry.approxRejectedFar.length, 1);
  assert.deepEqual(dry.flaggedDefault.map((j) => j.id), [String(atDefault._id)]);
  assert.equal((await col.findOne({ _id: unpinned._id })).approxLocation, undefined, 'dry-run không ghi');

  await backfillJobLocations({ apply: true, geocode: fakeGeocode });
  const u = await col.findOne({ _id: unpinned._id });
  assert.equal(u.approxLocation.lat, 21.0205);
  assert.equal(u.locationStatus, 'unconfirmed', 'không tự xác nhận vị trí');
  assert.equal((await col.findOne({ _id: far._id })).approxLocation, undefined, 'bỏ kết quả ở quá xa Hòa Lạc');
  const d = await col.findOne({ _id: atDefault._id });
  assert.equal(d.locationNeedsReview, true);
  assert.equal(d.location.lat, 21.0135, 'giữ nguyên location cho chấm công');
  assert.equal(d.approxLocation.lat, 21.0251);
  const r = await col.findOne({ _id: real._id });
  assert.equal(r.locationNeedsReview ?? false, false);
  assert.equal(r.approxLocation, undefined);

  const again = await backfillJobLocations({ apply: true, geocode: fakeGeocode });
  assert.equal(again.updates, 0, 'chạy lại không đổi gì');
});
