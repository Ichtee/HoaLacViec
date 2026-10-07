import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import webpush from 'web-push';
import { User } from '../src/models/User.js';
import { PushSubscription } from '../src/models/PushSubscription.js';
import { Notification, pushNewNotification } from '../src/models/Notification.js';
import { sendPushToUser, isPushConfigured } from '../src/services/pushService.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'test-secret-push';
const { default: app } = await import('../src/app.js');

const keys = webpush.generateVAPIDKeys();
const setVapid = () => {
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  process.env.VAPID_SUBJECT = 'mailto:test@example.com';
};
const clearVapid = () => {
  delete process.env.VAPID_PUBLIC_KEY; delete process.env.VAPID_PRIVATE_KEY; delete process.env.VAPID_SUBJECT;
};

test('push is disabled without VAPID config and never throws', async () => {
  clearVapid();
  assert.equal(isPushConfigured(), false);
  assert.equal(await sendPushToUser('u1', { title: 'x' }, async () => { throw new Error('should not send'); }), 0);
});

test('sendPushToUser delivers to every device and prunes expired subscriptions', async (t) => {
  setVapid();
  const originals = { find: PushSubscription.find, deleteOne: PushSubscription.deleteOne };
  t.after(() => { clearVapid(); PushSubscription.find = originals.find; PushSubscription.deleteOne = originals.deleteOne; });

  PushSubscription.find = () => ({ lean: async () => [
    { _id: 's1', endpoint: 'https://push.example/1', keys: { p256dh: 'a', auth: 'b' } },
    { _id: 's2', endpoint: 'https://push.example/gone', keys: { p256dh: 'a', auth: 'b' } },
    { _id: 's3', endpoint: 'https://push.example/flaky', keys: { p256dh: 'a', auth: 'b' } },
  ] });
  const deleted = [];
  PushSubscription.deleteOne = async (f) => { deleted.push(f._id); return {}; };
  const sender = async (sub, body) => {
    if (sub.endpoint.endsWith('gone')) throw Object.assign(new Error('gone'), { statusCode: 410 });
    if (sub.endpoint.endsWith('flaky')) throw Object.assign(new Error('boom'), { statusCode: 500 });
    assert.deepEqual(JSON.parse(body), { title: 'Offer', body: 'Chúc mừng', url: '/student/applications' });
  };
  const delivered = await sendPushToUser('u1', { title: 'Offer', body: 'Chúc mừng', url: '/student/applications' }, sender);
  assert.equal(delivered, 1);
  assert.deepEqual(deleted, ['s2'], 'only 404/410 subscriptions are removed');
});

test('new notifications trigger a push exactly once, updates do not', async (t) => {
  setVapid();
  const originals = { find: PushSubscription.find };
  t.after(() => { clearVapid(); PushSubscription.find = originals.find; });
  let lookups = 0;
  PushSubscription.find = () => { lookups++; return { lean: async () => [] }; };

  const doc = new Notification({ userId: '507f1f77bcf86cd799439011', title: 'Tiêu đề', message: 'Nội dung', link: '/x' });
  doc.$locals.wasNew = true;
  pushNewNotification(doc);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(lookups, 1);

  doc.$locals.wasNew = false;
  pushNewNotification(doc);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(lookups, 1, 'a non-new save does not push');
});

test('push routes: public key, subscribe validation and ownership', async (t) => {
  const originals = { userFindById: User.findById, update: PushSubscription.findOneAndUpdate, del: PushSubscription.deleteOne };
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(async () => {
    clearVapid();
    User.findById = originals.userFindById; PushSubscription.findOneAndUpdate = originals.update; PushSubscription.deleteOne = originals.del;
    await new Promise((resolve) => server.close(resolve));
  });
  const userId = '507f1f77bcf86cd799439099';
  User.findById = async () => ({ _id: userId, role: 'student', status: 'active', tokenVersion: 0 });
  const url = (p) => `http://127.0.0.1:${server.address().port}/api/push${p}`;
  const auth = { Authorization: `Bearer ${jwt.sign({ id: userId, tokenVersion: 0 }, process.env.JWT_SECRET)}`, 'Content-Type': 'application/json' };

  clearVapid();
  assert.equal((await fetch(url('/public-key'))).status, 503);
  setVapid();
  const key = await fetch(url('/public-key'));
  assert.equal((await key.json()).publicKey, keys.publicKey);

  assert.equal((await fetch(url('/subscribe'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
  const bad = await fetch(url('/subscribe'), { method: 'POST', headers: auth, body: JSON.stringify({ subscription: { endpoint: 'http://insecure', keys: { p256dh: 'a', auth: 'b' } } }) });
  assert.equal((await bad.json()).code, 'INVALID_SUBSCRIPTION');

  let saved = null;
  PushSubscription.findOneAndUpdate = async (filter, update) => { saved = { filter, update }; return {}; };
  const ok = await fetch(url('/subscribe'), { method: 'POST', headers: auth, body: JSON.stringify({ subscription: { endpoint: 'https://push.example/abc', keys: { p256dh: 'k1', auth: 'k2' } } }) });
  assert.equal(ok.status, 201);
  assert.equal(saved.filter.endpoint, 'https://push.example/abc');
  assert.equal(String(saved.update.$set.userId), userId);

  let removed = null;
  PushSubscription.deleteOne = async (f) => { removed = f; return {}; };
  await fetch(url('/unsubscribe'), { method: 'POST', headers: auth, body: JSON.stringify({ endpoint: 'https://push.example/abc' }) });
  assert.equal(String(removed.userId), userId, 'users can only remove their own subscriptions');
});
