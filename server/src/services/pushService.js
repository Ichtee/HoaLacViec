import webpush from 'web-push';
import { PushSubscription } from '../models/PushSubscription.js';

let configuredKey = null;

/** Web Push chỉ bật khi đủ VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY và VAPID_SUBJECT (mailto: hoặc https:). */
export function isPushConfigured() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) return false;
  const signature = `${VAPID_PUBLIC_KEY}|${VAPID_PRIVATE_KEY}|${VAPID_SUBJECT}`;
  if (configuredKey !== signature) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configuredKey = signature;
  }
  return true;
}

export function getPublicKey() {
  return isPushConfigured() ? process.env.VAPID_PUBLIC_KEY : null;
}

/**
 * Gửi push tới mọi thiết bị đã đăng ký của người dùng. Bản đăng ký hết hạn (404/410) bị xóa.
 * Không bao giờ ném lỗi: push chỉ là kênh bổ sung cho thông báo trong ứng dụng.
 */
export async function sendPushToUser(userId, payload, sender = webpush.sendNotification) {
  if (!isPushConfigured()) return 0;
  try {
    const subscriptions = await PushSubscription.find({ userId }).lean();
    const body = JSON.stringify(payload);
    let delivered = 0;
    await Promise.all(subscriptions.map(async (sub) => {
      try {
        await sender({ endpoint: sub.endpoint, keys: sub.keys }, body, { TTL: 60 * 60 });
        delivered++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: sub._id });
        } else {
          console.warn('[push] send failed:', err.statusCode || err.message);
        }
      }
    }));
    return delivered;
  } catch (err) {
    console.warn('[push] failed:', err.message);
    return 0;
  }
}
