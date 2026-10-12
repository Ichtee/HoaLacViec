/** Sổ cái credit: cấp, trừ nguyên tử, hoàn; chạy trên MongoDB replica set trong bộ nhớ. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, createUser } from '../e2e/testServer.mjs';
import { grantCredits, spendCredits, getBalance } from '../../src/services/creditService.js';

let t;
before(async () => {
  t = await startTestServer();
  await t.models.CreditTransaction.init(); // dựng index unique của 'welcome'
});
after(async () => { await t.stop(); });

const newEmployer = () => createUser(t.models, { role: 'employer' });

test('grant 50 then spend featured_3d -> balance 20 with matching ledger rows', async () => {
  const e = await newEmployer();
  await grantCredits({ employerUserId: e._id, amount: 50, type: 'topup', reason: 'p50' });
  const { balance } = await spendCredits({ employerUserId: e._id, reason: 'featured_3d' });
  assert.equal(balance, 20);
  const rows = await t.models.CreditTransaction.find({ employerUserId: e._id }).sort({ createdAt: 1, _id: 1 });
  assert.deepEqual(rows.map((r) => [r.amount, r.type, r.balanceAfter]), [[50, 'topup', 50], [-30, 'spend', 20]]);
});

test('spend with insufficient balance -> 402, balance unchanged, no spend row', async () => {
  const e = await newEmployer();
  await grantCredits({ employerUserId: e._id, amount: 10, type: 'topup', reason: 'p50' });
  await assert.rejects(spendCredits({ employerUserId: e._id, reason: 'featured_3d' }), { status: 402, code: 'INSUFFICIENT_CREDITS' });
  assert.equal(await getBalance(e._id), 10);
  assert.equal(await t.models.CreditTransaction.countDocuments({ employerUserId: e._id, type: 'spend' }), 0);
});

test('two concurrent spends on balance 30 -> exactly one succeeds', async () => {
  const e = await newEmployer();
  await grantCredits({ employerUserId: e._id, amount: 30, type: 'topup', reason: 'p50' });
  const res = await Promise.allSettled([
    spendCredits({ employerUserId: e._id, reason: 'featured_3d' }),
    spendCredits({ employerUserId: e._id, reason: 'featured_3d' }),
  ]);
  assert.equal(res.filter((r) => r.status === 'fulfilled').length, 1);
  const rej = res.find((r) => r.status === 'rejected');
  assert.equal(rej.reason.status, 402);
  assert.equal(await getBalance(e._id), 0);
});

test('welcome granted twice -> second rejects, balance increases once', async () => {
  const e = await newEmployer();
  const args = { employerUserId: e._id, amount: 30, type: 'welcome', reason: 'welcome' };
  await grantCredits(args);
  await assert.rejects(grantCredits(args));
  assert.equal(await getBalance(e._id), 30);
});

test('missing employer profile -> 404', async () => {
  const s = await createUser(t.models, { role: 'student' });
  await assert.rejects(grantCredits({ employerUserId: s._id, amount: 5, type: 'topup', reason: 'x' }), { status: 404, code: 'EMPLOYER_PROFILE_NOT_FOUND' });
});
