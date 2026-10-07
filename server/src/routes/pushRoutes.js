import express from 'express';
import { PushSubscription } from '../models/PushSubscription.js';
import { authenticate } from '../middlewares/auth.js';
import { getPublicKey } from '../services/pushService.js';

const router = express.Router();

// GET /api/push/public-key - khóa VAPID công khai (503 nếu máy chủ chưa cấu hình Web Push)
router.get('/public-key', (req, res) => {
  const key = getPublicKey();
  if (!key) return res.status(503).json({ error: 'Thông báo đẩy chưa được cấu hình.', code: 'PUSH_DISABLED' });
  res.json({ publicKey: key });
});

router.use(authenticate);

function validSubscription(body) {
  const sub = body?.subscription;
  return sub && typeof sub.endpoint === 'string' && sub.endpoint.startsWith('https://') && sub.endpoint.length < 1000 &&
    typeof sub.keys?.p256dh === 'string' && typeof sub.keys?.auth === 'string' ? sub : null;
}

// POST /api/push/subscribe { subscription }
router.post('/subscribe', async (req, res, next) => {
  try {
    const sub = validSubscription(req.body);
    if (!sub) return res.status(400).json({ error: 'Bản đăng ký thông báo không hợp lệ.', code: 'INVALID_SUBSCRIPTION' });
    // Một thiết bị thuộc về đúng một tài khoản: đăng ký lại sẽ chuyển quyền sở hữu
    await PushSubscription.findOneAndUpdate(
      { endpoint: sub.endpoint },
      {
        $set: {
          userId: req.user._id,
          keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
          userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ message: 'Đã bật thông báo đẩy.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/push/unsubscribe { endpoint }
router.post('/unsubscribe', async (req, res, next) => {
  try {
    if (typeof req.body.endpoint !== 'string') {
      return res.status(400).json({ error: 'Thiếu endpoint.', code: 'INVALID_SUBSCRIPTION' });
    }
    await PushSubscription.deleteOne({ endpoint: req.body.endpoint, userId: req.user._id });
    res.json({ message: 'Đã tắt thông báo đẩy.' });
  } catch (err) {
    next(err);
  }
});

export default router;
