import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { User } from '../src/models/User.js';
import { StudentProfile } from '../src/models/StudentProfile.js';
import { RefreshToken } from '../src/models/RefreshToken.js';
import { parseCookies } from '../src/services/refreshTokenService.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'test-secret-refresh';
const { default: app } = await import('../src/app.js');

const userId = '507f1f77bcf86cd799439111';
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');

test('parseCookies handles multiple, encoded and malformed cookies', () => {
  assert.deepEqual(parseCookies('a=1; hlv_rt=abc%2Fdef; broken; b=two=2'), { a: '1', hlv_rt: 'abc/def', b: 'two=2' });
  assert.deepEqual(parseCookies(undefined), {});
});

test('refresh tokens rotate, are single-use, httpOnly and revoked on logout', async (t) => {
  const originals = {
    userFindById: User.findById, profileFindOne: StudentProfile.findOne,
    rtCreate: RefreshToken.create, rtFindOneAndDelete: RefreshToken.findOneAndDelete, rtDeleteOne: RefreshToken.deleteOne,
  };
  const readyState = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(async () => {
    User.findById = originals.userFindById; StudentProfile.findOne = originals.profileFindOne;
    RefreshToken.create = originals.rtCreate; RefreshToken.findOneAndDelete = originals.rtFindOneAndDelete;
    RefreshToken.deleteOne = originals.rtDeleteOne;
    if (readyState) Object.defineProperty(mongoose.connection, 'readyState', readyState); else delete mongoose.connection.readyState;
    await new Promise((resolve) => server.close(resolve));
  });

  let user = { _id: userId, name: 'Sinh viên', email: 's@x.vn', role: 'student', status: 'active', tokenVersion: 0, password: 'x' };
  User.findById = async () => user;
  StudentProfile.findOne = async () => null;

  const store = new Map(); // tokenHash -> record
  RefreshToken.create = async (record) => { store.set(record.tokenHash, record); return record; };
  RefreshToken.findOneAndDelete = async (filter) => {
    const record = store.get(filter.tokenHash);
    if (!record || record.expiresAt <= filter.expiresAt.$gt) return null;
    store.delete(filter.tokenHash);
    return record;
  };
  RefreshToken.deleteOne = async (filter) => { store.delete(filter.tokenHash); return {}; };

  const post = (path, cookie) => fetch(`http://127.0.0.1:${server.address().port}/api/auth${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: '{}',
  });
  const cookieFrom = (res) => {
    const header = res.headers.getSetCookie().find((c) => c.startsWith('hlv_rt='));
    return header ? { header, value: header.split(';')[0].slice('hlv_rt='.length) } : null;
  };

  // Seed a valid refresh token as the login flow would
  const seed = 'seed-token-value';
  store.set(sha(seed), { userId, tokenHash: sha(seed), tokenVersion: 0, expiresAt: new Date(Date.now() + 60_000) });

  assert.equal((await post('/refresh')).status, 401, 'no cookie');
  assert.equal((await post('/refresh', 'hlv_rt=unknown')).status, 401, 'unknown token');

  const ok = await post('/refresh', `hlv_rt=${seed}`);
  assert.equal(ok.status, 200);
  const body = await ok.json();
  const claims = jwt.verify(body.token, process.env.JWT_SECRET);
  assert.equal(claims.id, userId);
  assert.ok(claims.exp - claims.iat <= 15 * 60, 'access token is short-lived');

  const rotated = cookieFrom(ok);
  assert.ok(rotated, 'a new refresh cookie is issued');
  assert.match(rotated.header, /HttpOnly/i);
  assert.match(rotated.header, /Path=\/api\/auth/i);
  assert.match(rotated.header, /SameSite=Lax/i);
  assert.notEqual(rotated.value, seed);
  assert.equal(store.has(sha(seed)), false, 'old token consumed');
  assert.equal(store.has(sha(rotated.value)), true, 'only the hash is stored');
  assert.equal(JSON.stringify([...store.values()]).includes(rotated.value), false);

  // Replaying the old token fails
  assert.equal((await post('/refresh', `hlv_rt=${seed}`)).status, 401);

  // A password change/reset (tokenVersion bump) invalidates outstanding refresh tokens
  user = { ...user, tokenVersion: 1 };
  assert.equal((await post('/refresh', `hlv_rt=${rotated.value}`)).status, 401);

  // Locked accounts cannot refresh
  user = { ...user, tokenVersion: 0, status: 'locked' };
  store.set(sha('locked-token'), { userId, tokenHash: sha('locked-token'), tokenVersion: 0, expiresAt: new Date(Date.now() + 60_000) });
  assert.equal((await post('/refresh', 'hlv_rt=locked-token')).status, 401);

  // Logout revokes the token and clears the cookie
  user = { ...user, status: 'active' };
  store.set(sha('logout-token'), { userId, tokenHash: sha('logout-token'), tokenVersion: 0, expiresAt: new Date(Date.now() + 60_000) });
  const out = await post('/logout', 'hlv_rt=logout-token');
  assert.equal(out.status, 200);
  assert.equal(store.has(sha('logout-token')), false);
  assert.match(out.headers.getSetCookie().join(';'), /hlv_rt=;/);
});
