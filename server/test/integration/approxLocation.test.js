import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, createUser } from '../e2e/testServer.mjs';
import { ensureApproxLocations } from '../../src/services/approxLocationService.js';

let t;
before(async () => { t = await startTestServer(); });
after(async () => { await t.stop(); });

const seed = (owner, extra) => t.models.Job.create({
  employerUserId: owner._id, title: 'Tin', storeName: 'Quán', category: 'cafe', salaryAmount: 30000, salaryUnit: 'hour',
  address: 'Thôn 3, Thạch Hòa', slots: 1, headcountTarget: 1, remainingOpenings: 1, status: 'approved', ...extra,
});

test('unpinned listing gets a stored approxLocation once; pinned, far and failing addresses do not', async () => {
  const owner = await createUser(t.models, { role: 'employer' });
  const unpinned = await seed(owner, { address: 'A-near' });
  const pinned = await seed(owner, { address: 'B-pinned', location: { lat: 21.0135, lng: 105.5252 }, locationStatus: 'confirmed' });
  const far = await seed(owner, { address: 'C-far' });
  const broken = await seed(owner, { address: 'D-broken' });
  const calls = [];
  const geocode = async (address) => {
    calls.push(address);
    if (address === 'A-near') return { success: true, lat: 21.02, lng: 105.53 };
    if (address === 'C-far') return { success: true, lat: 21.03, lng: 105.85 }; // ~33 km from Hòa Lạc
    return { success: false };
  };
  const jobs = await t.models.Job.find({ _id: { $in: [unpinned._id, pinned._id, far._id, broken._id] } }).lean();
  await ensureApproxLocations(jobs, geocode);
  assert.deepEqual(calls.sort(), ['A-near', 'C-far', 'D-broken']); // the pinned job is never geocoded
  const stored = await t.models.Job.findById(unpinned._id).lean();
  assert.deepEqual([stored.approxLocation.lat, stored.approxLocation.lng], [21.02, 105.53]);
  assert.equal((await t.models.Job.findById(far._id).lean()).approxLocation, undefined);
  assert.equal((await t.models.Job.findById(broken._id).lean()).approxLocation, undefined);
  calls.length = 0;
  await ensureApproxLocations(jobs, geocode);
  assert.deepEqual(calls, []); // already stored or already tried: no repeat calls
});
