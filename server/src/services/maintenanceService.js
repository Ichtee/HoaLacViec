import { Application } from '../models/Application.js';
import { Job } from '../models/Job.js';
import { Shift } from '../models/Shift.js';
import { QuickShift } from '../models/QuickShift.js';
import { Notification } from '../models/Notification.js';
import { EXPIRY_REMINDER_DAYS } from '../config/credits.js';
import { TopUpRequest } from '../models/TopUpRequest.js';
import { applySepayOrderPaid } from './topUpService.js';

const SHIFT_REMINDER_WINDOW_MS = 2 * 60 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;

async function notify(data) {
  try {
    await Notification.create(data);
  } catch (err) {
    console.warn('[maintenance] Không gửi được thông báo:', err.message);
  }
}

/**
 * Offer quá hạn phản hồi -> offer_expired (nhà tuyển dụng có thể gửi lại offer).
 * Mỗi đơn được cập nhật có điều kiện status = offer_sent nên chạy lặp/song song vẫn an toàn.
 */
export async function expireOverdueOffers(now = new Date()) {
  const overdue = await Application.find({
    status: 'offer_sent',
    'offer.expiryDate': { $ne: null, $lt: now },
  }).select('_id studentId employerUserId offer.position');

  let expired = 0;
  for (const app of overdue) {
    const updated = await Application.findOneAndUpdate(
      { _id: app._id, status: 'offer_sent' },
      {
        $set: { status: 'offer_expired', 'offer.status': 'expired', isActive: false },
        $push: {
          statusHistory: {
            fromStatus: 'offer_sent',
            toStatus: 'offer_expired',
            status: 'offer_expired',
            changedAt: now,
            reason: 'Offer hết hạn phản hồi (tự động)',
            candidateVisibleMessage: 'Đề nghị nhận việc đã hết hạn phản hồi.',
          },
        },
      },
      { new: true }
    );
    if (!updated) continue;
    expired++;
    const position = app.offer?.position || 'vị trí đã ứng tuyển';
    await notify({
      userId: app.studentId,
      title: 'Đề nghị nhận việc đã hết hạn',
      message: `Đề nghị nhận việc "${position}" đã hết hạn phản hồi.`,
      type: 'application',
      link: '/student/applications',
    });
    if (app.employerUserId) {
      await notify({
        userId: app.employerUserId,
        title: 'Offer đã hết hạn',
        message: `Ứng viên chưa phản hồi offer "${position}" đúng hạn. Bạn có thể gửi lại offer.`,
        type: 'application',
        link: '/employer/applications',
      });
    }
  }
  return expired;
}

/** Tin đã duyệt nhưng quá hạn tuyển (closesAt) -> expired. */
export async function expireOverdueJobs(now = new Date()) {
  const overdue = await Job.find({
    status: 'approved',
    closesAt: { $ne: null, $lt: now },
  }).select('_id title employerUserId');

  let expired = 0;
  for (const job of overdue) {
    const updated = await Job.findOneAndUpdate(
      { _id: job._id, status: 'approved' },
      { $set: { status: 'expired' } }
    );
    if (!updated) continue;
    expired++;
    if (job.employerUserId) {
      await notify({
        userId: job.employerUserId,
        title: 'Tin tuyển dụng đã hết hạn',
        message: `Tin "${job.title}" đã quá hạn nhận hồ sơ và được chuyển sang trạng thái hết hạn.`,
        type: 'job',
        link: '/employer/jobs',
      });
    }
  }
  return expired;
}

/** Nhắc nhà tuyển dụng tin sắp hết hạn (mỗi tin đúng một lần, nhận quyền gửi bằng cập nhật có điều kiện). */
export async function notifyExpiringJobs(now = new Date()) {
  const soon = await Job.find({
    status: 'approved',
    expiryReminderSentAt: null,
    closesAt: { $gt: now, $lte: new Date(now.getTime() + EXPIRY_REMINDER_DAYS * 86400000) },
  }).select('_id title employerUserId closesAt');

  let sent = 0;
  for (const job of soon) {
    const claimed = await Job.findOneAndUpdate(
      { _id: job._id, expiryReminderSentAt: null },
      { $set: { expiryReminderSentAt: now } }
    );
    if (!claimed) continue;
    sent++;
    if (!job.employerUserId) continue;
    const date = new Date(job.closesAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    await notify({
      userId: job.employerUserId,
      title: 'Tin tuyển dụng sắp hết hạn',
      message: `Tin "${job.title}" sẽ hết hạn vào ${date}. Gia hạn để tiếp tục nhận hồ sơ.`,
      type: 'job',
      link: '/employer/jobs',
    });
  }
  return sent;
}

/** Nhắc nhân viên các ca bắt đầu trong vòng 2 giờ tới (mỗi ca nhắc đúng một lần). */
export async function sendShiftReminders(now = new Date()) {
  const upcoming = await Shift.find({
    scheduleStatus: 'published',
    attendanceStatus: 'not_started',
    assignmentStatus: { $ne: 'declined' },
    reminderSentAt: null,
    startAt: { $gt: now, $lte: new Date(now.getTime() + SHIFT_REMINDER_WINDOW_MS) },
  }).select('_id studentUserId storeName startAt');

  let sent = 0;
  for (const shift of upcoming) {
    if (!shift.studentUserId) continue;
    const claimed = await Shift.findOneAndUpdate(
      { _id: shift._id, reminderSentAt: null },
      { $set: { reminderSentAt: now } }
    );
    if (!claimed) continue;
    sent++;
    const time = new Date(shift.startAt).toLocaleTimeString('vi-VN', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh',
    });
    await notify({
      userId: shift.studentUserId,
      title: 'Sắp đến giờ vào ca ⏰',
      message: `Ca làm tại ${shift.storeName || 'cửa hàng'} bắt đầu lúc ${time}. Hãy đến đúng giờ nhé!`,
      type: 'shift',
      link: '/student/shifts',
    });
  }
  return sent;
}

/** Ca lẻ còn trống nhưng đã quá giờ bắt đầu -> expired. */
export async function expireQuickShifts(now = new Date()) {
  const result = await QuickShift.updateMany(
    { status: 'open', startAt: { $lte: now } },
    { $set: { status: 'expired' } }
  );
  return result?.modifiedCount || 0;
}

/** Stands in for the SePay IPN: asks SePay about top-ups still pending from the last 24h (applySepayOrderPaid is idempotent). */
export async function reconcilePendingTopUps(now = new Date()) {
  if (!process.env.SEPAY_MERCHANT_ID || !process.env.SEPAY_SECRET_KEY) return 0;
  const pending = await TopUpRequest.find({ status: 'pending', createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } }).limit(50);
  let granted = 0;
  for (const topUp of pending) {
    try {
      if ((await applySepayOrderPaid(topUp.invoiceNumber, { source: 'poll' })).status === 'granted') granted += 1;
    } catch (err) {
      console.warn('[maintenance] topup poll', topUp.invoiceNumber, err.message);
    }
  }
  return granted;
}

export async function runMaintenance(now = new Date()) {
  const result = { offersExpired: 0, jobsExpired: 0, remindersSent: 0, quickShiftsExpired: 0, expiryReminders: 0 };
  const tasks = [
    ['offersExpired', expireOverdueOffers],
    ['jobsExpired', expireOverdueJobs],
    ['remindersSent', sendShiftReminders],
    ['quickShiftsExpired', expireQuickShifts],
    ['expiryReminders', notifyExpiringJobs],
  ];
  for (const [key, task] of tasks) {
    try {
      result[key] = await task(now);
    } catch (err) {
      console.error(`[maintenance] ${key} lỗi:`, err.message);
    }
  }
  return result;
}

let timer = null;
let topUpTimer = null;
let topUpRunning = false;
let running = false;

/** Chạy định kỳ trong tiến trình server. Tắt bằng DISABLE_MAINTENANCE_JOBS=true. */
export function startMaintenanceScheduler() {
  if (timer || String(process.env.DISABLE_MAINTENANCE_JOBS).toLowerCase() === 'true') return null;
  const intervalMs = Number(process.env.MAINTENANCE_INTERVAL_MS) || DEFAULT_INTERVAL_MS;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await runMaintenance();
      if (result.offersExpired || result.jobsExpired || result.remindersSent || result.quickShiftsExpired) {
        console.log('[maintenance]', JSON.stringify(result));
      }
    } finally {
      running = false;
    }
  };
  const topUpTick = async () => {
    if (topUpRunning) return;
    topUpRunning = true;
    try {
      const granted = await reconcilePendingTopUps();
      if (granted) console.log('[maintenance] top-ups granted by polling:', granted);
    } catch (err) {
      console.error('[maintenance] topup poll lỗi:', err.message);
    } finally {
      topUpRunning = false;
    }
  };
  topUpTimer = setInterval(topUpTick, Number(process.env.TOPUP_POLL_INTERVAL_MS) || 2 * 60 * 1000);
  topUpTimer.unref?.();
  timer = setInterval(tick, intervalMs);
  timer.unref?.();
  setTimeout(tick, 15000).unref?.();
  return timer;
}

export function stopMaintenanceScheduler() {
  if (timer) clearInterval(timer);
  if (topUpTimer) clearInterval(topUpTimer);
  timer = null;
  topUpTimer = null;
}
