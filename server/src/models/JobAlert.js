import mongoose from 'mongoose';

/** Bộ lọc việc làm đã lưu: khi có tin mới được duyệt khớp bộ lọc, người dùng nhận thông báo. */
const jobAlertSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  keyword: { type: String, default: '', trim: true, maxlength: 60 },
  category: { type: String, default: '', trim: true, maxlength: 40 },
  area: { type: String, default: '', trim: true, maxlength: 40 },
  type: { type: String, enum: ['', 'part_time', 'shift', 'hourly', 'event'], default: '' },
  minSalary: { type: Number, default: 0, min: 0 },
  active: { type: Boolean, default: true },
  lastNotifiedAt: { type: Date, default: null },
}, { timestamps: true });

export const MAX_ALERTS_PER_USER = 5;

export const JobAlert = mongoose.model('JobAlert', jobAlertSchema);
