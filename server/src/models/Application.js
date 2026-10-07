import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName: { type: String, required: true },
  studentPhone: { type: String, default: '' },
  studentEmail: { type: String, default: '' },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  employerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: {
    type: String,
    enum: [
      // Standard workflow
      'submitted',        // Mới nộp (thay thế pending)
      'screening',        // Đang sàng lọc hồ sơ (thay thế reviewing)
      'shortlisted',      // Đạt tiêu chuẩn / vào vòng trong
      'interview',        // Mời/xếp lịch phỏng vấn
      'offer_sent',       // Đã gửi đề nghị nhận việc (offer)
      'offer_accepted',   // Ứng viên đã chấp nhận offer
      'hired',            // Đã tạo Employment và hoàn tất tuyển dụng

      // Terminal / exit branches
      'rejected',         // Nhà tuyển dụng từ chối
      'withdrawn',        // Sinh viên rút đơn
      'offer_declined',   // Ứng viên từ chối offer
      'offer_expired',    // Offer hết hạn phản hồi
      'offer_rescinded',  // Nhà tuyển dụng rút lại offer trước khi chấp nhận

      // Legacy compatibility values
      'pending',
      'reviewing',
      'accepted',
      'approved',
    ],
    default: 'submitted',
  },
  selectedPosition: { type: String, default: '' },
  selectedShift: { type: String, default: '' },
  note: { type: String, default: '' }, // Lời nhắn từ sinh viên khi nộp
  employerNote: { type: String, default: '' }, // Legacy employer note
  internalNote: { type: String, default: '' }, // Ghi chú nội bộ bí mật dành riêng cho NTD
  candidateFeedback: { type: String, default: '' }, // Lời nhắn công khai gửi cho sinh viên

  // Structured interview scheduling
  interviewSchedule: {
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    timezone: { type: String, default: 'Asia/Ho_Chi_Minh' },
    location: { type: String, default: '' },
    meetingUrl: { type: String, default: '' },
    contactNote: { type: String, default: '' },
    // Legacy support
    date: { type: String },
    time: { type: String },
    note: { type: String },
  },

  // Immutable snapshot of job offer
  offer: {
    position: { type: String, default: '' },
    workplace: { type: String, default: '' },
    wage: { type: Number, default: 0 },
    wageUnit: { type: String, enum: ['hour', 'shift', 'month'], default: 'hour' },
    currency: { type: String, default: 'VND' },
    expectedSchedule: { type: String, default: '' },
    proposedStartDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    note: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'sent', 'accepted', 'declined', 'expired', 'rescinded', null],
      default: null,
    },
    sentAt: { type: Date, default: null },
    respondedAt: { type: Date, default: null },
    responseNote: { type: String, default: '' },
  },

  // Comprehensive audit trail
  statusHistory: [{
    fromStatus: { type: String, default: '' },
    toStatus: { type: String, default: '' },
    status: { type: String }, // Legacy compatibility
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String, default: '' },
    candidateVisibleMessage: { type: String, default: '' },
    note: { type: String, default: '' }, // Legacy compatibility
  }],

  appliedAt: { type: Date, default: Date.now },
  // false khi đơn đã kết thúc (rút, bị từ chối, offer bị từ chối/hết hạn/thu hồi) -> cho phép nộp lại
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Trạng thái kết thúc không cản trở việc nộp lại đơn cho cùng một tin.
export const INACTIVE_APPLICATION_STATUSES = Object.freeze([
  'rejected',
  'withdrawn',
  'offer_declined',
  'offer_expired',
  'offer_rescinded',
]);

applicationSchema.pre('validate', function (next) {
  this.isActive = !INACTIVE_APPLICATION_STATUSES.includes(this.status);
  next();
});

// Prevent duplicate active applications from the same student for the same job
// Partial index: chỉ một đơn đang hoạt động cho mỗi (sinh viên, tin). Đơn đã kết thúc không bị tính.
applicationSchema.index(
  { studentId: 1, jobId: 1 },
  { unique: true, partialFilterExpression: { isActive: true }, name: 'uniq_active_student_job' }
);
applicationSchema.index({ studentId: 1, jobId: 1, createdAt: -1 });
applicationSchema.index({ studentId: 1 });
applicationSchema.index({ employerId: 1 });
applicationSchema.index({ employerUserId: 1 });
applicationSchema.index({ status: 1 });

export const Application = mongoose.model('Application', applicationSchema);
