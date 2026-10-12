/** Sổ cái credit: cấp, trừ nguyên tử, hoàn; chạy trên MongoDB replica set trong bộ nhớ. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, createUser, api } from '../e2e/testServer.mjs';
import { grantCredits, spendCredits, refundCredits, getBalance } from '../../src/services/creditService.js';
import { setSepayClientForTests } from '../../src/services/sepayClient.js';

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
  assert.equal(await t.models.CreditTransaction.countDocuments({ employerUserId: e._id, type: 'welcome' }), 1);
});

test('missing employer profile -> 404', async () => {
  const s = await createUser(t.models, { role: 'student' });
  await assert.rejects(grantCredits({ employerUserId: s._id, amount: 5, type: 'topup', reason: 'x' }), { status: 404, code: 'EMPLOYER_PROFILE_NOT_FOUND' });
});

test('invalid amount / unknown reason reject asynchronously (no sync throw)', async () => {
  const id = (await newEmployer())._id;
  let p;
  assert.doesNotThrow(() => { p = grantCredits({ employerUserId: id, amount: 0, type: 'topup', reason: 'x' }); });
  await assert.rejects(p, { status: 400, code: 'INVALID_AMOUNT' });
  assert.doesNotThrow(() => { p = spendCredits({ employerUserId: id, reason: 'nope' }); });
  await assert.rejects(p, { code: 'UNKNOWN_CREDIT_REASON' });
  assert.doesNotThrow(() => { p = refundCredits({ employerUserId: id, reason: 'nope' }); });
  await assert.rejects(p, { code: 'UNKNOWN_CREDIT_REASON' });
});

// ---- SePay checkout / IPN / API (chỉ dùng client giả, không gọi mạng SePay) ----
const SECRET = 'test-ipn-secret';
const ENV_KEYS = ['SEPAY_ENV', 'SEPAY_MERCHANT_ID', 'SEPAY_SECRET_KEY', 'PUBLIC_APP_URL'];
const setEnv = () => Object.assign(process.env, { SEPAY_ENV: 'sandbox', SEPAY_MERCHANT_ID: 'MERCH_TEST', SEPAY_SECRET_KEY: SECRET, PUBLIC_APP_URL: 'http://app.test' });
let order; // kết quả retrieveOrder giả
let recorded;
const useFake = () => {
  recorded = [];
  order = { order_status: 'CAPTURED', order_amount: '100000.00' };
  setSepayClientForTests({
    initCheckoutUrl: () => 'https://sandbox.fake/checkout',
    initOneTimePaymentFields: (p) => { recorded.push(p); return { ...p, signature: 'sig-fake' }; },
    retrieveOrder: async (invoice) => { if (order instanceof Error) throw order; return { order_invoice_number: invoice, ...order }; },
  });
};
const call = (...a) => api(t.url).call(...a);
const login = async (u) => (await api(t.url).login(u.email)).token;
const rawIpn = async (invoice, secret = SECRET, type = 'ORDER_PAID') => {
  const res = await fetch(`${t.url}/api/credits/sepay/ipn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(secret === null ? {} : { 'X-Secret-Key': secret }) },
    body: JSON.stringify({ notification_type: type, order: { order_invoice_number: invoice, order_amount: '100000.00', order_status: 'CAPTURED' } }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};
async function topUpFor(employer, packId = 'p100') {
  const token = await login(employer);
  const r = await call('/credits/topups', { method: 'POST', token, body: { packId } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { token, topUp: r.body.topUp, res: r };
}
const bal = (e) => getBalance(e._id);
const reload = (id) => t.models.TopUpRequest.findById(id);

test('GET /pricing is public', async () => {
  const r = await call('/credits/pricing');
  assert.equal(r.status, 200);
  assert.equal(r.body.packs.length, 3);
  assert.equal(r.body.prices.extra_slot, 30);
});

test('POST /topups creates pending request and checkout fields', async () => {
  setEnv(); useFake();
  const e = await newEmployer();
  const { topUp, res } = await topUpFor(e);
  assert.match(topUp.invoiceNumber, /^HLV[A-Z0-9]{8}$/);
  assert.equal(recorded[0].order_amount, 100000);
  assert.equal(recorded[0].payment_method, 'BANK_TRANSFER');
  assert.ok(recorded[0].success_url.endsWith(String(topUp._id)));
  assert.equal(res.body.checkout.fields.signature, 'sig-fake');
  assert.equal(res.body.checkout.url, 'https://sandbox.fake/checkout');
});

test('POST /topups: 400 bad pack, 429 on fourth pending, 403 student, 503 without env', async () => {
  setEnv(); useFake();
  const e = await newEmployer();
  const token = await login(e);
  assert.equal((await call('/credits/topups', { method: 'POST', token, body: { packId: 'zzz' } })).status, 400);
  for (let i = 0; i < 3; i++) await call('/credits/topups', { method: 'POST', token, body: { packId: 'p50' } });
  assert.equal((await call('/credits/topups', { method: 'POST', token, body: { packId: 'p50' } })).status, 429);
  const stu = await createUser(t.models, { role: 'student' });
  assert.equal((await call('/credits/topups', { method: 'POST', token: await login(stu), body: { packId: 'p50' } })).status, 403);
  setSepayClientForTests(null);
  for (const k of ENV_KEYS) delete process.env[k];
  const r = await call('/credits/topups', { method: 'POST', token: await login(await newEmployer()), body: { packId: 'p50' } });
  assert.equal(r.status, 503);
  assert.equal(r.body.code, 'TOPUP_UNAVAILABLE');
});

test('IPN ORDER_PAID grants once; /me shows balance and ledger row', async () => {
  setEnv(); useFake();
  const e = await newEmployer();
  const { token, topUp } = await topUpFor(e);
  assert.equal((await rawIpn(topUp.invoiceNumber)).status, 200);
  const me = await call('/credits/me', { token });
  assert.equal(me.body.balance, 110);
  assert.equal(me.body.transactions.filter((x) => x.type === 'topup').length, 1);
  assert.equal((await reload(topUp._id)).status, 'paid');
  const note = await t.models.EmployerProfile.db.collection('notifications').findOne({ userId: e._id, type: 'credit' });
  assert.equal(note.link, '/employer/credits');
});

test('IPN replay (sequential and parallel) credits once', async () => {
  setEnv(); useFake();
  const e = await newEmployer();
  const { topUp } = await topUpFor(e);
  await rawIpn(topUp.invoiceNumber);
  await rawIpn(topUp.invoiceNumber);
  assert.equal(await bal(e), 110);
  const e2 = await newEmployer();
  const second = await topUpFor(e2);
  const rs = await Promise.all([1, 2, 3, 4].map(() => rawIpn(second.topUp.invoiceNumber)));
  assert.ok(rs.every((x) => x.status === 200));
  assert.equal(await bal(e2), 110);
  assert.equal(await t.models.CreditTransaction.countDocuments({ employerUserId: e2._id, type: 'topup' }), 1);
});

test('IPN rejects missing or wrong secret', async () => {
  setEnv(); useFake();
  const e = await newEmployer();
  const { topUp } = await topUpFor(e);
  for (const s of [null, 'wrong', `${SECRET}x`]) {
    const r = await rawIpn(topUp.invoiceNumber, s);
    assert.equal(r.status, 401);
    assert.equal(r.body.code, 'INVALID_IPN_SECRET');
  }
  assert.equal(await bal(e), 0);
  assert.equal((await reload(topUp._id)).status, 'pending');
});

test('IPN trusts retrieveOrder, not the body: amount mismatch, unpaid, throw, unknown', async () => {
  setEnv(); useFake();
  const e = await newEmployer();
  const a = await topUpFor(e);
  order = { order_status: 'CAPTURED', order_amount: '50000.00' };
  assert.equal((await rawIpn(a.topUp.invoiceNumber)).status, 200);
  assert.equal(await bal(e), 0);
  const failed = await reload(a.topUp._id);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.failureReason, 'amount_mismatch');

  const b = await topUpFor(e);
  order = { order_status: 'PENDING', order_amount: '100000.00' };
  assert.equal((await rawIpn(b.topUp.invoiceNumber)).status, 200);
  assert.equal(await bal(e), 0);
  assert.equal((await reload(b.topUp._id)).status, 'pending');

  order = new Error('boom');
  assert.equal((await rawIpn(b.topUp.invoiceNumber)).status, 502);
  assert.equal((await reload(b.topUp._id)).status, 'pending');

  assert.equal((await rawIpn('HLVZZZZZZZZ')).status, 200);
});

test('reconcile: owner grants once, other employer 404, student 403', async () => {
  setEnv(); useFake();
  const e = await newEmployer();
  const { token, topUp } = await topUpFor(e);
  assert.equal((await call(`/credits/topups/${topUp._id}/reconcile`, { method: 'POST', token: await login(await newEmployer()) })).status, 404);
  const stu = await createUser(t.models, { role: 'student' });
  assert.equal((await call(`/credits/topups/${topUp._id}/reconcile`, { method: 'POST', token: await login(stu) })).status, 403);
  const r = await call(`/credits/topups/${topUp._id}/reconcile`, { method: 'POST', token });
  assert.equal(r.status, 200);
  assert.equal(r.body.result, 'granted');
  assert.equal(r.body.balance, 110);
  assert.equal((await call(`/credits/topups/${topUp._id}/reconcile`, { method: 'POST', token })).body.result, 'already_paid');
  assert.equal(await bal(e), 110);
  assert.equal((await call(`/credits/topups/${topUp._id}`, { token })).body.balance, 110);
  assert.equal((await call('/credits/topups/mine', { token })).body.topUps.length, 1);
});

test('TRANSACTION_VOID marks voided without touching balance', async () => {
  setEnv(); useFake();
  const e = await newEmployer();
  const { topUp } = await topUpFor(e);
  assert.equal((await rawIpn(topUp.invoiceNumber, SECRET, 'TRANSACTION_VOID')).status, 200);
  assert.equal((await reload(topUp._id)).status, 'voided');
  assert.equal(await bal(e), 0);
});

test('admin topups: employer 403, admin lists with employer info and reconciles', async () => {
  setEnv(); useFake();
  const e = await newEmployer();
  const { token, topUp } = await topUpFor(e);
  assert.equal((await call('/credits/admin/topups', { token })).status, 403);
  const at = await login(await createUser(t.models, { role: 'admin' }));
  const list = await call('/credits/admin/topups?status=pending', { token: at });
  assert.equal(list.status, 200);
  assert.equal(list.body.topUps.find((x) => x.invoiceNumber === topUp.invoiceNumber).employer.email, e.email);
  assert.equal((await call(`/credits/admin/topups/${topUp._id}/reconcile`, { method: 'POST', token: at })).body.result, 'granted');
});

test('pending cap only counts requests from the last 24h', async () => {
  setEnv(); useFake();
  const e = await newEmployer();
  const token = await login(e);
  for (let i = 0; i < 3; i++) await call('/credits/topups', { method: 'POST', token, body: { packId: 'p50' } });
  assert.equal((await call('/credits/topups', { method: 'POST', token, body: { packId: 'p50' } })).status, 429);
  const old = new Date(Date.now() - 25 * 3600 * 1000);
  await t.models.TopUpRequest.collection.updateMany({ employerUserId: e._id }, { $set: { createdAt: old } });
  assert.equal((await call('/credits/topups', { method: 'POST', token, body: { packId: 'p50' } })).status, 201);
});

test('POST /topups -> 503 when PUBLIC_APP_URL is missing', async () => {
  setEnv(); useFake();
  delete process.env.PUBLIC_APP_URL;
  const r = await call('/credits/topups', { method: 'POST', token: await login(await newEmployer()), body: { packId: 'p50' } });
  assert.equal(r.status, 503);
  assert.equal(r.body.code, 'TOPUP_UNAVAILABLE');
});

test('TRANSACTION_VOID after paid -> voided, no clawback; on failed stays failed', async () => {
  setEnv(); useFake();
  const e = await newEmployer();
  const paid = await topUpFor(e);
  await rawIpn(paid.topUp.invoiceNumber);
  assert.equal(await bal(e), 110);
  assert.equal((await rawIpn(paid.topUp.invoiceNumber, SECRET, 'TRANSACTION_VOID')).status, 200);
  assert.equal((await reload(paid.topUp._id)).status, 'voided');
  assert.equal(await bal(e), 110);
  const failed = await topUpFor(e);
  await t.models.TopUpRequest.updateOne({ _id: failed.topUp._id }, { status: 'failed' });
  await rawIpn(failed.topUp.invoiceNumber, SECRET, 'TRANSACTION_VOID');
  assert.equal((await reload(failed.topUp._id)).status, 'failed');
});

test('reconcile of a failed/voided top-up -> not_pending, nothing granted', async () => {
  setEnv(); useFake();
  const e = await newEmployer();
  const { token, topUp } = await topUpFor(e);
  await t.models.TopUpRequest.updateOne({ _id: topUp._id }, { status: 'failed' });
  const r = await call(`/credits/topups/${topUp._id}/reconcile`, { method: 'POST', token });
  assert.equal(r.body.result, 'not_pending');
  assert.equal(await bal(e), 0);
  assert.equal((await reload(topUp._id)).status, 'failed');
});

test('grant failure after the paid flip rolls back: top-up stays pending', async () => {
  setEnv(); useFake();
  const e = await newEmployer();
  const { topUp } = await topUpFor(e);
  await t.models.EmployerProfile.deleteOne({ userId: e._id }); // grantCredits will 404 inside the transaction
  const r = await rawIpn(topUp.invoiceNumber);
  assert.equal(r.status, 502);
  assert.equal((await reload(topUp._id)).status, 'pending');
  assert.equal(await t.models.CreditTransaction.countDocuments({ employerUserId: e._id }), 0);
});

test('verification approval grants 30 welcome credits once, even after reject and re-approve', async () => {
  const { EmployerVerification } = await import('../../src/models/EmployerVerification.js');
  const e = await newEmployer();
  const v = await EmployerVerification.create({
    employerUserId: e._id, storeName: 'Quán A', legalName: 'Nguyễn A', businessAddress: '1 Lê Lợi', contactPhone: '0900000001', status: 'pending',
  });
  const at = await login(await createUser(t.models, { role: 'admin' }));
  const approve = () => call(`/admin/verifications/${v._id}/approve`, { method: 'POST', token: at });
  assert.equal((await approve()).status, 200);
  const token = await login(e);
  let me = await call('/credits/me', { token });
  assert.equal(me.body.balance, 30);
  assert.equal(me.body.transactions.filter((x) => x.type === 'welcome').length, 1);
  await EmployerVerification.updateOne({ _id: v._id }, { status: 'rejected' });
  assert.equal((await approve()).status, 200); // duplicate grant must not fail the approval
  me = await call('/credits/me', { token });
  assert.equal(me.body.balance, 30);
  assert.equal(await t.models.CreditTransaction.countDocuments({ employerUserId: e._id, type: 'welcome' }), 1);
});

// ---- Hạn mức tin miễn phí, slot trả phí, cửa sổ 14 ngày, hoàn credit khi từ chối ----
const DAY = 86400000;
const jobBody = (extra = {}) => ({
  title: 'Phục vụ', storeName: 'Quán', salaryAmount: 30000, slots: 2, address: 'Thôn 3, Thạch Hòa',
  location: { lat: 21.0201, lng: 105.5312 }, locationStatus: 'confirmed', ...extra,
});
const postJob = (token, extra) => call('/jobs', { method: 'POST', token, body: jobBody(extra) });
const seedJob = (e, extra = {}) => t.models.Job.create({
  employerUserId: e._id, title: 'Tin', storeName: 'Quán', category: 'cafe', salaryAmount: 30000, salaryUnit: 'hour',
  address: 'Hòa Lạc', location: { lat: 21.0135, lng: 105.5252 }, locationStatus: 'confirmed', slots: 1,
  headcountTarget: 1, remainingOpenings: 1, status: 'approved', ...extra,
});
const fundedEmployerWithTwoJobs = async (credits = 0) => {
  const e = await newEmployer();
  await seedJob(e); await seedJob(e);
  if (credits) await grantCredits({ employerUserId: e._id, amount: credits, type: 'welcome', reason: 'welcome' });
  return e;
};

test('third active listing -> 402 LISTING_QUOTA_REACHED, nothing charged', async () => {
  const e = await fundedEmployerWithTwoJobs(30);
  const r = await postJob(await login(e));
  assert.equal(r.status, 402);
  assert.equal(r.body.code, 'LISTING_QUOTA_REACHED');
  assert.equal(r.body.freeActiveListings, 2);
  assert.equal(r.body.activeListings, 2);
  assert.equal(await bal(e), 30);
});

test('useExtraSlot with 30 credits -> 201 paidSlot, balance 0, ledger refId = job id', async () => {
  const e = await fundedEmployerWithTwoJobs(30);
  const r = await postJob(await login(e), { useExtraSlot: true });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.paidSlot, true);
  assert.equal(await bal(e), 0);
  const row = await t.models.CreditTransaction.findOne({ employerUserId: e._id, reason: 'extra_slot' });
  assert.equal(String(row.refId), r.body._id);
  assert.equal(row.refType, 'Job');
});

test('useExtraSlot with no credits -> 402 INSUFFICIENT_CREDITS and no job created', async () => {
  const e = await fundedEmployerWithTwoJobs();
  const r = await postJob(await login(e), { useExtraSlot: true });
  assert.equal(r.status, 402);
  assert.equal(r.body.code, 'INSUFFICIENT_CREDITS');
  assert.equal(await t.models.Job.countDocuments({ employerUserId: e._id }), 2);
});

test('expired job and draft do not count; paused job counts', async () => {
  const e = await newEmployer();
  await seedJob(e, { closesAt: new Date(Date.now() - DAY) });
  await seedJob(e, { status: 'draft' });
  const token = await login(e);
  assert.equal((await postJob(token)).status, 201);
  assert.equal((await postJob(token)).status, 201);
  assert.equal((await postJob(token)).status, 402);
  assert.equal((await postJob(token, { status: 'draft' })).status, 201); // drafts never blocked
  const f = await newEmployer();
  await seedJob(f); await seedJob(f, { status: 'paused' });
  assert.equal((await postJob(await login(f))).status, 402);
});

test('both approve endpoints set closesAt ~14 days ahead', async () => {
  const e = await newEmployer();
  const at = await login(await createUser(t.models, { role: 'admin' }));
  for (const mk of [(id) => `/jobs/${id}/approve`, (id) => `/admin/jobs/${id}/approve`]) {
    const job = await seedJob(e, { status: 'pending' });
    assert.equal((await call(mk(job._id), { method: 'POST', token: at })).status, 200);
    const after = await t.models.Job.findById(job._id);
    assert.ok(Math.abs(after.closesAt.getTime() - (Date.now() + 14 * DAY)) < 60000);
  }
});

test('re-approval after a core edit keeps the original closesAt', async () => {
  const e = await newEmployer();
  const closesAt = new Date(Date.now() + 5 * DAY);
  const job = await seedJob(e, { closesAt });
  const token = await login(e);
  const put = await call(`/jobs/${job._id}`, { method: 'PUT', token, body: { title: 'Tên mới' } });
  assert.equal(put.body.status, 'pending');
  const at = await login(await createUser(t.models, { role: 'admin' }));
  await call(`/jobs/${job._id}/approve`, { method: 'POST', token: at });
  assert.equal((await t.models.Job.findById(job._id)).closesAt.getTime(), closesAt.getTime());
});

for (const [name, rejectPath] of [['jobs', (id) => `/jobs/${id}/reject`], ['admin', (id) => `/admin/jobs/${id}/reject`]]) {
  test(`reject via ${name} refunds the paid slot and featured purchase`, async () => {
    const e = await fundedEmployerWithTwoJobs(30);
    const r = await postJob(await login(e), { useExtraSlot: true });
    await t.models.Job.updateOne({ _id: r.body._id }, { featuredDaysPending: 3 });
    await grantCredits({ employerUserId: e._id, amount: 30, type: 'topup', reason: 'p50' }); // covers the featured price paid earlier
    assert.equal(await bal(e), 30);
    const at = await login(await createUser(t.models, { role: 'admin' }));
    assert.equal((await call(rejectPath(r.body._id), { method: 'POST', token: at, body: { reason: 'x' } })).status, 200);
    assert.equal(await bal(e), 90);
    const refunds = await t.models.CreditTransaction.find({ employerUserId: e._id, type: 'refund' });
    assert.deepEqual(refunds.map((x) => x.reason).sort(), ['extra_slot', 'featured_3d']);
    assert.ok(refunds.every((x) => String(x.refId) === r.body._id));
    const after = await t.models.Job.findById(r.body._id);
    assert.equal(after.paidSlot, false);
    assert.equal(after.featuredDaysPending, 0);
  });
}

test('GET /jobs marks featured by featuredUntil', async () => {
  const e = await newEmployer();
  const future = await seedJob(e, { title: 'FeatTomorrow', featuredUntil: new Date(Date.now() + DAY) });
  const past = await seedJob(e, { title: 'FeatYesterday', featuredUntil: new Date(Date.now() - DAY) });
  const list = (await call('/jobs?limit=500')).body.jobs;
  assert.equal(list.find((j) => j._id === String(future._id)).featured, true);
  assert.equal(list.find((j) => j._id === String(past._id)).featured, false);
  const only = (await call('/jobs?featured=true&limit=500')).body.jobs;
  assert.ok(only.some((j) => j._id === String(future._id)));
  assert.ok(!only.some((j) => j._id === String(past._id)));
});

// ---- Mua ngày nổi bật, gia hạn tin, phí ca lẻ ----
const fund = (e, amount) => grantCredits({ employerUserId: e._id, amount, type: 'topup', reason: 'p50' });
const feature = (token, id, days) => call(`/credits/jobs/${id}/feature`, { method: 'POST', token, body: { days } });
const near = (date, ms) => Math.abs(new Date(date).getTime() - ms) < 60000;

test('feature 7 days on approved job -> featuredUntil ~ now+7d, balance 0', async () => {
  const e = await newEmployer(); await fund(e, 60);
  const job = await seedJob(e);
  const r = await feature(await login(e), job._id, 7);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.balance, 0);
  assert.ok(near((await t.models.Job.findById(job._id)).featuredUntil, Date.now() + 7 * DAY));
  const row = await t.models.CreditTransaction.findOne({ employerUserId: e._id, reason: 'featured_7d' });
  assert.equal(String(row.refId), String(job._id));
});

test('feature again extends from the previous featuredUntil', async () => {
  const e = await newEmployer(); await fund(e, 30);
  const until = new Date(Date.now() + 5 * DAY);
  const job = await seedJob(e, { featuredUntil: until });
  assert.equal((await feature(await login(e), job._id, 3)).status, 200);
  assert.equal((await t.models.Job.findById(job._id)).featuredUntil.getTime(), until.getTime() + 3 * DAY);
});

test('feature on pending job -> featuredDaysPending, applied on approval; second purchase 409', async () => {
  const e = await newEmployer(); await fund(e, 60);
  const job = await seedJob(e, { status: 'pending' });
  const token = await login(e);
  assert.equal((await feature(token, job._id, 3)).status, 200);
  assert.equal((await t.models.Job.findById(job._id)).featuredDaysPending, 3);
  const again = await feature(token, job._id, 3);
  assert.equal(again.status, 409); assert.equal(again.body.code, 'FEATURE_ALREADY_PENDING');
  assert.equal(await bal(e), 30);
  const at = await login(await createUser(t.models, { role: 'admin' }));
  await call(`/jobs/${job._id}/approve`, { method: 'POST', token: at });
  assert.ok(near((await t.models.Job.findById(job._id)).featuredUntil, Date.now() + 3 * DAY));
});

test('feature rejects bad days, wrong status, non-owner, missing job, and no credits', async () => {
  const e = await newEmployer(); await fund(e, 30);
  const token = await login(e);
  const job = await seedJob(e);
  assert.equal((await feature(token, job._id, 5)).body.code, 'INVALID_DAYS');
  const paused = await seedJob(e, { status: 'paused' });
  const bad = await feature(token, paused._id, 3);
  assert.equal(bad.status, 409); assert.equal(bad.body.code, 'INVALID_STATE');
  assert.equal((await feature(await login(await newEmployer()), job._id, 3)).status, 403);
  assert.equal((await feature(token, '507f1f77bcf86cd799439099', 3)).status, 404);
  assert.equal((await feature(token, job._id, 7)).status, 402);
  assert.equal(await bal(e), 30);
  assert.equal((await t.models.Job.findById(job._id)).featuredUntil, null);
});

test('renew an expired job -> closesAt ~ now+14d, visible in GET /jobs again, reminder reset', async () => {
  const e = await newEmployer(); await fund(e, 20);
  const job = await seedJob(e, { closesAt: new Date(Date.now() - DAY), expiryReminderSentAt: new Date() });
  const list = async () => (await call('/jobs')).body;
  const ids = (b) => (b.jobs || b).map((j) => String(j._id || j.id));
  assert.ok(!ids(await list()).includes(String(job._id)));
  const r = await call(`/credits/jobs/${job._id}/renew`, { method: 'POST', token: await login(e) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.balance, 0);
  const after = await t.models.Job.findById(job._id);
  assert.ok(near(after.closesAt, Date.now() + 14 * DAY));
  assert.equal(after.expiryReminderSentAt, null);
  assert.ok(ids(await list()).includes(String(job._id)));
});

test('renew: not owner 403, pending job 409, no credits 402', async () => {
  const e = await newEmployer();
  const token = await login(e);
  const renew = (tk, id) => call(`/credits/jobs/${id}/renew`, { method: 'POST', token: tk });
  const job = await seedJob(e);
  assert.equal((await renew(await login(await newEmployer()), job._id)).status, 403);
  assert.equal((await renew(token, (await seedJob(e, { status: 'pending' }))._id)).status, 409);
  assert.equal((await renew(token, job._id)).status, 402);
});

test('quick shift: balance 0 -> 402 and no doc; balance 15 -> 201, balance 0, ledger refId = shift', async () => {
  const e = await newEmployer();
  const token = await login(e);
  const start = new Date(Date.now() + 3 * 3600000);
  const vn = (d) => new Date(d.getTime() + 7 * 3600000).toISOString();
  const body = { title: 'Phục vụ', date: vn(start).slice(0, 10), startTime: vn(start).slice(11, 16), endTime: vn(new Date(start.getTime() + 3 * 3600000)).slice(11, 16), headcount: 1, wageRate: 30000 };
  const post = () => call('/quick-shifts', { method: 'POST', token, body });
  assert.equal((await post()).status, 402);
  assert.equal(await (await import('../../src/models/QuickShift.js')).QuickShift.countDocuments({ employerUserId: e._id }), 0);
  await fund(e, 15);
  const r = await post();
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(await bal(e), 0);
  const row = await t.models.CreditTransaction.findOne({ employerUserId: e._id, reason: 'quick_shift' });
  assert.equal(String(row.refId), String(r.body._id));
  assert.equal(row.refType, 'QuickShift');
});
