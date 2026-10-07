import mongoose from 'mongoose';
import { JobAlert } from '../models/JobAlert.js';
import { Notification } from '../models/Notification.js';

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
