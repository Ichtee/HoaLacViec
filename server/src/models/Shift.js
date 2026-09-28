import mongoose from 'mongoose';

/**
 * Helper to compute Date (UTC) from Vietnam date string (YYYY-MM-DD) and time string (HH:mm)
 * Vietnam is UTC+7
 */
export function parseVietnamDateTime(dateStr, timeStr, isOvernightNextDay = false) {
  if (!dateStr || !timeStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);

  // Month is 0-indexed in JS Date constructor (UTC)
  let d = new Date(Date.UTC(year, month - 1, day, hours - 7, minutes, 0, 0));
  if (isOvernightNextDay) {
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  }
  return d;
}

const shiftSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', default: null },
  employmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employment', default: null, index: true },
  shiftTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftTemplate', default: null },
  storeName: { type: String, default: '' },
  employerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Legacy alias for employerUserId
  studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Legacy alias for studentUserId
  studentName: { type: String, default: '' },
  role: { type: String, default: 'Nhân viên bán ca' },

  // Precise UTC timestamps for conflict checking & scheduling
  startAt: { type: Date, required: true, index: true },
  endAt: { type: Date, required: true, index: true },

  // Derived / legacy readable format for easy display
  date: { type: String, required: true }, // YYYY-MM-DD
  startTime: { type: String, required: true }, // HH:mm
  endTime: { type: String, required: true }, // HH:mm
  hours: { type: Number, default: 4 },
  wageRate: { type: Number, default: 25000 }, // VNĐ / hour
  workedMinutes: { type: Number, default: 0 },
  totalPay: { type: Number, default: 0 }, // Calculated on server

  status: {
    type: String,
    enum: [
      // Standard workflow
      'draft',                      // Ca nháp (chưa thông báo cho nhân viên)
      'published',                  // Đã công bố lịch (nhân viên nhận thông báo)
      'acknowledged',               // Nhân viên đã xác nhận xem lịch
      'checked_in',                 // Đang làm ca
      'checked_out',                // Đã ra ca
      'completed_pending_review',   // Hoàn thành, chờ duyệt công
      'approved',                   // Quản lý đã duyệt công
      'payroll_ready',              // Sẵn sàng tính lương
      'paid',                       // Đã chi trả lương

      // Exceptional statuses
      'disputed',                   // Có khiếu nại / tranh chấp công
      'cancelled',                  // Đã hủy ca
      'no_show',                    // Vắng mặt không phép

      // Legacy compatibility values
      'scheduled',                  // Map to published
      'needs_review',
      'pending_approval',           // Map to completed_pending_review
      'completed',                  // Map to approved
      'absent',                     // Map to no_show
    ],
    default: 'published',
    index: true,
  },

  publishedAt: { type: Date, default: null },
  acknowledgedAt: { type: Date, default: null },
  cancelReason: { type: String, default: '' },

  attendance: {
    checkInAt: { type: Date, default: null },
    checkInCoords: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      accuracy: { type: Number, default: null },
      timestamp: { type: Date, default: null },
    },
    checkInDistanceMeters: { type: Number, default: null },
    checkInVerified: { type: Boolean, default: false },
    checkInVerificationStatus: {
      type: String,
      enum: ['verified', 'needs_review', 'rejected', null],
      default: null,
    },
    checkInReasonCode: { type: String, default: null },
    checkInTargetCoords: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    checkInConfiguredRadius: { type: Number, default: null },
    checkInManualReason: { type: String, default: null },

    checkOutAt: { type: Date, default: null },
    checkOutCoords: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      accuracy: { type: Number, default: null },
      timestamp: { type: Date, default: null },
    },
    checkOutDistanceMeters: { type: Number, default: null },
    checkOutVerified: { type: Boolean, default: false },
    checkOutVerificationStatus: {
      type: String,
      enum: ['verified', 'needs_review', 'rejected', null],
      default: null,
    },
    checkOutReasonCode: { type: String, default: null },
    checkOutTargetCoords: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    checkOutConfiguredRadius: { type: Number, default: null },
    checkOutManualReason: { type: String, default: null },

    locationVerified: { type: Boolean, default: false },
  },

  disputeReason: { type: String, default: '' },
  employerNotes: { type: String, default: '' },
  history: [
    {
      status: { type: String },
      changedAt: { type: Date, default: Date.now },
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      note: { type: String, default: '' },
    },
  ],
}, { timestamps: true });

// Pre-validate hook to calculate startAt and endAt if not explicitly set
shiftSchema.pre('validate', function (next) {
  if (this.date && this.startTime && this.endTime) {
    const isOvernight = this.endTime <= this.startTime;
    if (!this.startAt) {
      this.startAt = parseVietnamDateTime(this.date, this.startTime, false);
    }
    if (!this.endAt) {
      this.endAt = parseVietnamDateTime(this.date, this.endTime, isOvernight);
    }
  }
  // Sync legacy aliases
  if (this.studentUserId && !this.studentId) this.studentId = this.studentUserId;
  if (this.studentId && !this.studentUserId) this.studentUserId = this.studentId;
  if (this.employerUserId && !this.employerId) this.employerId = this.employerUserId;
  if (this.employerId && !this.employerUserId) this.employerUserId = this.employerId;
  next();
});

// Scheduling & Conflict detection indexes
shiftSchema.index({ studentUserId: 1, startAt: 1, endAt: 1 });
shiftSchema.index({ employerUserId: 1, startAt: 1, endAt: 1 });
shiftSchema.index({ studentUserId: 1, date: -1 });
shiftSchema.index({ employerUserId: 1, date: -1 });

export const Shift = mongoose.model('Shift', shiftSchema);
