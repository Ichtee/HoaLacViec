import mongoose from 'mongoose';

/**
 * Ca lẻ / tuyển nhanh: cửa hàng đã xác minh đăng "cần N người cho ca X hôm nay",
 * người lao động đã xác minh nhận ca theo thứ tự đến trước được trước.
 * Mỗi lượt nhận tạo một Shift thật để dùng chung chấm công, thanh toán và đánh giá.
 */
const claimSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, default: '' },
  phone: { type: String, default: '' },
  shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift', default: null },
  claimedAt: { type: Date, default: Date.now },
}, { _id: false });

const quickShiftSchema = new mongoose.Schema({
  employerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  storeName: { type: String, required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: '', maxlength: 1000 },
  address: { type: String, default: '' },
  location: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  date: { type: String, required: true }, // YYYY-MM-DD (giờ Việt Nam)
  startTime: { type: String, required: true }, // HH:mm
  endTime: { type: String, required: true }, // HH:mm
  startAt: { type: Date, required: true, index: true },
  endAt: { type: Date, required: true },
  headcount: { type: Number, required: true, min: 1, max: 20 },
  wageRate: { type: Number, required: true, min: 10000, max: 500000 }, // VNĐ / giờ
  status: { type: String, enum: ['open', 'filled', 'cancelled', 'expired'], default: 'open', index: true },
  claims: { type: [claimSchema], default: [] },
}, { timestamps: true });

quickShiftSchema.index({ status: 1, startAt: 1 });

export const QuickShift = mongoose.model('QuickShift', quickShiftSchema);
