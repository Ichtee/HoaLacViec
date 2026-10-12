import mongoose from 'mongoose';
import { JobAlert } from '../models/JobAlert.js';
import { Notification } from '../models/Notification.js';
import { Job } from '../models/Job.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { isJobFeatured } from './listingService.js';
import { sendPushToUser } from './pushService.js';

const normalize = (value) => String(value || '').toLowerCase().trim();

/** Bộ lọc có khớp với tin không. Các điều kiện để trống được bỏ qua; mọi điều kiện còn lại phải khớp. */
export function alertMatchesJob(alert, job) {
  if (alert.category && alert.category !== job.category) return false;
  if (alert.area && alert.area !== job.area) return false;
  if (alert.type && alert.type !== job.type) return false;
  if (alert.minSalary && Number(job.salaryAmount || 0) < alert.minSalary) return false;
  const keyword = normalize(alert.keyword);
  if (keyword) {
    const haystack = normalize([job.title, job.storeName, job.description, ...(job.tags || [])].join(' '));
    if (!haystack.includes(keyword)) return false;
  }
  return true;
}

/**
 * Gửi thông báo trong ứng dụng cho người có bộ lọc khớp với tin vừa được duyệt.
 * Mỗi người chỉ nhận một thông báo cho mỗi tin dù có nhiều bộ lọc khớp.
 * Lỗi được nuốt vì đây là tác vụ phụ, không được làm hỏng luồng duyệt tin.
 */
export async function notifyJobAlerts(job) {
  if (!job || mongoose.connection.readyState !== 1) return 0;
  try {
    const alerts = await JobAlert.find({ active: true, userId: { $ne: job.employerUserId } }).limit(2000).lean();
    const notified = new Set();
    for (const alert of alerts) {
      const userKey = String(alert.userId);
      if (notified.has(userKey) || !alertMatchesJob(alert, job)) continue;
      notified.add(userKey);
      await Notification.create({
        userId: alert.userId,
        title: 'Có việc mới phù hợp với bộ lọc của bạn 🔔',
        message: `${job.storeName || 'Cửa hàng'} đang tuyển "${job.title}".`,
        type: 'job',
        link: `/jobs/${job._id}`,
      });
    }
    return notified.size;
  } catch (err) {
    console.warn('[job-alerts] failed:', err.message);
    return 0;
  }
}

const FEATURED_RADIUS_KM = 3;
const FEATURED_MAX_RECIPIENTS = 300;
const FEATURED_RENOTIFY_MS = 24 * 60 * 60 * 1000;

function jobPoint(job) {
  for (const p of [job.location, job.approxLocation]) {
    if (p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))) return [Number(p.lng), Number(p.lat)];
  }
  return null;
}

/**
 * Tin vừa được làm nổi bật: báo cho người có bộ lọc khớp + sinh viên ở trong bán kính 3 km (trong app và push).
 * Mỗi tin chỉ gửi một lần mỗi 24 giờ (claim featuredNotifiedAt), tối đa 300 người, bỏ qua chủ tin. Lỗi bị nuốt.
 */
export async function notifyFeaturedJob(job, now = new Date()) {
  if (!job || !isJobFeatured(job, now) || mongoose.connection.readyState !== 1) return 0;
  try {
    const claimed = await Job.findOneAndUpdate(
      { _id: job._id, $or: [{ featuredNotifiedAt: null }, { featuredNotifiedAt: { $lt: new Date(now.getTime() - FEATURED_RENOTIFY_MS) } }] },
      { featuredNotifiedAt: now },
    );
    if (!claimed) return 0;
    const owner = String(job.employerUserId);
    const recipients = new Set();
    const alerts = await JobAlert.find({ active: true }).limit(2000).lean();
    for (const alert of alerts) if (alertMatchesJob(alert, job)) recipients.add(String(alert.userId));
    const point = jobPoint(job);
    if (point) {
      const nearby = await StudentProfile.find({
        geoPoint: { $geoWithin: { $centerSphere: [point, FEATURED_RADIUS_KM / 6378.1] } },
      }).select('userId').limit(FEATURED_MAX_RECIPIENTS).lean();
      for (const p of nearby) recipients.add(String(p.userId));
    }
    recipients.delete(owner);
    const userIds = [...recipients].slice(0, FEATURED_MAX_RECIPIENTS);
    const title = 'Việc nổi bật gần bạn ⭐';
    const message = `${job.storeName || 'Cửa hàng'} đang tuyển "${job.title}".`;
    const link = `/jobs/${job._id}`;
    for (const userId of userIds) {
      await Notification.create({ userId, title, message, type: 'job', link });
      void sendPushToUser(userId, { title, body: message, url: link });
    }
    return userIds.length;
  } catch (err) {
    console.warn('[featured-notify] failed:', err.message);
    return 0;
  }
}
