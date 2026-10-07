import mongoose from 'mongoose';

/**
 * Đề nghị nhờ đồng nghiệp làm thay một ca.
 * pending_peer -> (đồng nghiệp đồng ý) pending_employer -> (cửa hàng duyệt) approved
 * Có thể bị declined (đồng nghiệp từ chối), rejected (cửa hàng từ chối),
 * cancelled (người nhờ rút lại) hoặc expired (ca đã bắt đầu).
 */
export const SWAP_STATUSES = Object.freeze([
  'pending_peer', 'pending_employer', 'approved', 'declined', 'rejected', 'cancelled', 'expired',
]);
export const OPEN_SWAP_STATUSES = Object.freeze(['pending_peer', 'pending_employer']);

const shiftSwapSchema = new mongoose.Schema({
  shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift', required: true, index: true },
  employerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  requesterUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  requesterName: { type: String, default: '' },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  targetName: { type: String, default: '' },
  message: { type: String, default: '', maxlength: 300 },
  status: { type: String, enum: SWAP_STATUSES, default: 'pending_peer', index: true },
  responseNote: { type: String, default: '', maxlength: 300 },
  decidedAt: { type: Date, default: null },
}, { timestamps: true });

export const ShiftSwap = mongoose.model('ShiftSwap', shiftSwapSchema);
