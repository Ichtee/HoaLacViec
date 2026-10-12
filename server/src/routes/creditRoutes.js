import crypto from 'node:crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { TopUpRequest } from '../models/TopUpRequest.js';
import { CreditTransaction } from '../models/CreditTransaction.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { Notification } from '../models/Notification.js';
import { Job } from '../models/Job.js';
import { authenticate, authorize, requireActiveUser } from '../middlewares/auth.js';
import { httpError } from '../utils/httpError.js';
import { CREDIT_PACKS, CREDIT_PRICES, FREE_ACTIVE_LISTINGS, LISTING_DAYS, WELCOME_CREDITS } from '../config/credits.js';
import { SEPAY_NOTIFICATION } from '../config/sepay.js';
import { getSepayClient } from '../services/sepayClient.js';
import { applySepayOrderPaid } from '../services/topUpService.js';
import { getBalance } from '../services/creditService.js';

const router = express.Router();
const employerOnly = [authenticate, authorize('employer')];
const adminOnly = [authenticate, authorize('admin')];
const MAX_PENDING = 3;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const newInvoiceNumber = () => `HLV${Array.from(crypto.randomBytes(8), (b) => ALPHABET[b % ALPHABET.length]).join('')}`;

const reconcileLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `credit-reconcile:${req.user?._id || 'anon'}`,
  validate: { keyGeneratorIpFallback: false },
  message: { error: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.', code: 'RATE_LIMIT_EXCEEDED' },
});

async function createTopUp(base) {
  try {
    return await TopUpRequest.create({ ...base, invoiceNumber: newInvoiceNumber() });
  } catch (err) {
    if (err.code !== 11000) throw err;
    return TopUpRequest.create({ ...base, invoiceNumber: newInvoiceNumber() }); // one retry on duplicate invoice
  }
}

const notifyGranted = (topUp) => Notification.create({
  userId: topUp.employerUserId,
  title: 'Nạp credit thành công',
  message: `Bạn đã nạp ${topUp.credits} credit vào tài khoản.`,
  type: 'credit',
  link: '/employer/credits',
}).catch(() => {});

async function reconcile(topUp) {
  const { status, topUp: updated } = await applySepayOrderPaid(topUp.invoiceNumber, { source: 'reconcile' });
  if (status === 'granted') await notifyGranted(updated);
  return { result: status, topUp: updated || topUp, balance: await getBalance(topUp.employerUserId) };
}

router.get('/pricing', (req, res) => {
  res.json({ packs: CREDIT_PACKS, prices: CREDIT_PRICES, freeActiveListings: FREE_ACTIVE_LISTINGS, listingDays: LISTING_DAYS, welcomeCredits: WELCOME_CREDITS });
});

router.get('/me', ...employerOnly, async (req, res, next) => {
  try {
    const [balance, activeListings, transactions] = await Promise.all([
      getBalance(req.user._id),
      Job.countDocuments({ employerUserId: req.user._id, status: 'approved', recruitmentStatus: 'open' }),
      CreditTransaction.find({ employerUserId: req.user._id }).sort({ createdAt: -1, _id: -1 }).limit(50).lean(),
    ]);
    res.json({ balance, freeActiveListings: FREE_ACTIVE_LISTINGS, activeListings, transactions });
  } catch (err) { next(err); }
});

router.post('/topups', ...employerOnly, requireActiveUser, async (req, res, next) => {
  try {
    const pack = CREDIT_PACKS.find((p) => p.id === req.body?.packId);
    if (!pack) throw httpError(400, 'INVALID_PACK', 'Gói nạp không hợp lệ.');
    const sepay = getSepayClient(); // 503 before any row is created
    const pending = await TopUpRequest.countDocuments({ employerUserId: req.user._id, status: 'pending' });
    if (pending >= MAX_PENDING) throw httpError(429, 'TOO_MANY_PENDING_TOPUPS', 'Bạn đang có quá nhiều yêu cầu nạp chưa hoàn tất. Vui lòng hoàn tất hoặc chờ hết hạn.');
    const topUp = await createTopUp({ employerUserId: req.user._id, packId: pack.id, amountVnd: pack.vnd, credits: pack.credits });
    const back = `${process.env.PUBLIC_APP_URL || ''}/employer/credits?topup=${topUp._id}`;
    const fields = sepay.initOneTimePaymentFields({
      operation: 'PURCHASE',
      payment_method: 'BANK_TRANSFER',
      order_invoice_number: topUp.invoiceNumber,
      order_amount: topUp.amountVnd,
      currency: 'VND',
      order_description: `Nap ${topUp.credits} credit Hoa Lac Viec`,
      customer_id: String(req.user._id),
      success_url: back,
      error_url: `${back}&result=error`,
      cancel_url: `${back}&result=cancel`,
    });
    res.status(201).json({ topUp, checkout: { url: sepay.initCheckoutUrl(), fields } });
  } catch (err) { next(err); }
});

router.get('/topups/mine', ...employerOnly, async (req, res, next) => {
  try {
    res.json({ topUps: await TopUpRequest.find({ employerUserId: req.user._id }).sort({ createdAt: -1 }).limit(20).lean() });
  } catch (err) { next(err); }
});

async function ownedTopUp(req) {
  const topUp = await TopUpRequest.findOne({ _id: req.params.id, employerUserId: req.user._id });
  if (!topUp) throw httpError(404, 'TOPUP_NOT_FOUND', 'Không tìm thấy yêu cầu nạp credit.');
  return topUp;
}

router.get('/topups/:id', ...employerOnly, async (req, res, next) => {
  try {
    const topUp = await ownedTopUp(req);
    res.json({ topUp, balance: await getBalance(req.user._id) });
  } catch (err) { next(err); }
});

router.post('/topups/:id/reconcile', ...employerOnly, reconcileLimiter, async (req, res, next) => {
  try {
    res.json(await reconcile(await ownedTopUp(req)));
  } catch (err) { next(err); }
});

// Public (no JWT): authenticated by the shared secret header only.
const secretMatches = (given) => {
  const expected = Buffer.from(process.env.SEPAY_SECRET_KEY || '');
  const got = Buffer.from(typeof given === 'string' ? given : '');
  return expected.length > 0 && expected.length === got.length && crypto.timingSafeEqual(expected, got);
};

router.post('/sepay/ipn', async (req, res, next) => {
  try {
    if (!secretMatches(req.get('X-Secret-Key'))) {
      return res.status(401).json({ error: 'Sai khóa xác thực IPN.', code: 'INVALID_IPN_SECRET' });
    }
    const { notification_type: type, order } = req.body || {};
    const invoice = String(order?.order_invoice_number || '');
    if (type === SEPAY_NOTIFICATION.ORDER_PAID) {
      let outcome;
      try {
        outcome = await applySepayOrderPaid(invoice, { source: 'ipn' });
      } catch (err) {
        console.error(`[credits] ipn lookup failed invoice=${invoice}: ${err.message}`);
        return res.status(502).json({ error: 'Không xác minh được đơn hàng, vui lòng thử lại.', code: 'ORDER_LOOKUP_FAILED' });
      }
      console.log(`[credits] ipn ORDER_PAID invoice=${invoice} -> ${outcome.status}`);
      if (outcome.status === 'granted') await notifyGranted(outcome.topUp);
    } else if (type === SEPAY_NOTIFICATION.TRANSACTION_VOID) {
      const voided = await TopUpRequest.findOneAndUpdate({ invoiceNumber: invoice }, { status: 'voided' });
      console.warn(`[credits] ipn TRANSACTION_VOID invoice=${invoice} found=${Boolean(voided)} (credits not clawed back; admin review needed)`);
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/admin/topups', ...adminOnly, async (req, res, next) => {
  try {
    const filter = req.query.status ? { status: String(req.query.status) } : {};
    const rows = await TopUpRequest.find(filter).sort({ createdAt: -1 }).limit(100).populate('employerUserId', 'name email').lean();
    const profiles = await EmployerProfile.find({ userId: { $in: rows.map((r) => r.employerUserId?._id) } }).select('userId storeName').lean();
    const store = new Map(profiles.map((p) => [String(p.userId), p.storeName]));
    res.json({
      topUps: rows.map(({ employerUserId: u, ...r }) => ({
        ...r,
        employerUserId: u?._id,
        employer: { name: u?.name, email: u?.email, storeName: store.get(String(u?._id)) || '' },
      })),
    });
  } catch (err) { next(err); }
});

router.post('/admin/topups/:id/reconcile', ...adminOnly, async (req, res, next) => {
  try {
    const topUp = await TopUpRequest.findById(req.params.id);
    if (!topUp) throw httpError(404, 'TOPUP_NOT_FOUND', 'Không tìm thấy yêu cầu nạp credit.');
    res.json(await reconcile(topUp));
  } catch (err) { next(err); }
});

export default router;
