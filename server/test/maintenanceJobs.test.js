import test from 'node:test';
import assert from 'node:assert/strict';
import { Application } from '../src/models/Application.js';
import { Job } from '../src/models/Job.js';
import { Shift } from '../src/models/Shift.js';
import { Notification } from '../src/models/Notification.js';
import { runMaintenance } from '../src/services/maintenanceService.js';

const chain = (rows) => ({ select: async () => rows });

test('maintenance expires offers/jobs and sends each shift reminder once', async (t) => {
  const originals = {
    appFind: Application.find, appUpdate: Application.findOneAndUpdate,
    jobFind: Job.find, jobUpdate: Job.findOneAndUpdate,
    shiftFind: Shift.find, shiftUpdate: Shift.findOneAndUpdate,
    notify: Notification.create,
  };
  t.after(() => {
    Application.find = originals.appFind; Application.findOneAndUpdate = originals.appUpdate;
    Job.find = originals.jobFind; Job.findOneAndUpdate = originals.jobUpdate;
    Shift.find = originals.shiftFind; Shift.findOneAndUpdate = originals.shiftUpdate;
    Notification.create = originals.notify;
  });

  const now = new Date('2026-10-07T10:00:00Z');
  const filters = {};
  const updates = [];
  const notes = [];
  Application.find = (f) => { filters.app = f; return chain([{ _id: 'a1', studentId: 's1', employerUserId: 'e1', offer: { position: 'Pha chế' } }]); };
  Application.findOneAndUpdate = async (f, u) => { updates.push(['app', f, u]); return { _id: f._id }; };
  Job.find = (f) => { filters.job = f; return chain([{ _id: 'j1', title: 'Phục vụ', employerUserId: 'e1' }]); };
  Job.findOneAndUpdate = async (f, u) => { updates.push(['job', f, u]); return { _id: f._id }; };
  Shift.find = (f) => {
    filters.shift = f;
    return chain([
      { _id: 'sh1', studentUserId: 's1', storeName: 'Quán A', startAt: new Date('2026-10-07T11:00:00Z') },
      { _id: 'sh2', studentUserId: null, storeName: 'Quán B', startAt: new Date('2026-10-07T11:00:00Z') },
    ]);
  };
  Shift.findOneAndUpdate = async (f) => { updates.push(['shift', f]); return { _id: f._id }; };
  Notification.create = async (n) => { notes.push(n); return n; };

  const result = await runMaintenance(now);

  assert.deepEqual(result, { offersExpired: 1, jobsExpired: 1, remindersSent: 1 });
  assert.equal(filters.app.status, 'offer_sent');
  assert.deepEqual(filters.app['offer.expiryDate'].$lt, now);
  assert.equal(filters.job.status, 'approved');
  assert.equal(filters.shift.reminderSentAt, null);
  const appUpdate = updates.find(([k]) => k === 'app');
  assert.equal(appUpdate[2].$set.status, 'offer_expired');
  assert.equal(appUpdate[2].$set.isActive, false);
  assert.equal(updates.find(([k]) => k === 'job')[2].$set.status, 'expired');
  assert.equal(updates.filter(([k]) => k === 'shift').length, 1);
  assert.deepEqual(notes.map((n) => n.userId).sort(), ['e1', 'e1', 's1', 's1']);
});

test('a lost atomic claim skips notifications (idempotent re-runs)', async (t) => {
  const originals = {
    appFind: Application.find, appUpdate: Application.findOneAndUpdate, notify: Notification.create,
    jobFind: Job.find, shiftFind: Shift.find,
  };
  t.after(() => {
    Application.find = originals.appFind; Application.findOneAndUpdate = originals.appUpdate;
    Notification.create = originals.notify; Job.find = originals.jobFind; Shift.find = originals.shiftFind;
  });
  Application.find = () => chain([{ _id: 'a1', studentId: 's1', offer: {} }]);
  Application.findOneAndUpdate = async () => null;
  Job.find = () => chain([]);
  Shift.find = () => chain([]);
  let notified = 0;
  Notification.create = async () => { notified++; };
  assert.deepEqual(await runMaintenance(new Date()), { offersExpired: 0, jobsExpired: 0, remindersSent: 0 });
  assert.equal(notified, 0);
});
