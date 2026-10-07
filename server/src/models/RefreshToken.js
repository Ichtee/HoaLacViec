import mongoose from 'mongoose';

/** Refresh token dùng một lần (xoay vòng). Chỉ lưu hash SHA-256, không lưu token gốc. */
const refreshTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  tokenVersion: { type: Number, default: 0 },
  userAgent: { type: String, default: '', maxlength: 300 },
  expiresAt: { type: Date, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

// MongoDB tự xóa bản ghi sau khi hết hạn
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
