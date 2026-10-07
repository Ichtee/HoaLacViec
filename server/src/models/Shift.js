import mongoose from 'mongoose';
import {
  SCHEDULE_STATUSES,
  ASSIGNMENT_STATUSES,
  ATTENDANCE_STATUSES,
  PAYROLL_STATUSES,
  computeLegacyStatus,
  migrateLegacyStatusToCanonical,
} from '../domain/shiftLifecycle.js';

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
  employmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employment', default: null },
  shiftTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftTemplate', default: null },
  storeName: { type: String, default: '' },
  workplaceName: { type: String, default: '' },
  employerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Legacy alias for employerUserId
  employeeUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  employeeName: { type: String, default: '' },
  studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Legacy alias for studentUserId
  studentName: { type: String, default: '' },
  studentPhone: { type: String, default: '' },
  role: { type: String, default: 'Nhân viên bán ca' },
  positionTitle: { type: String, default: 'Nhân viên bán ca' },

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

  // -----------------------------------------------------------------
  // CANONICAL SEPARATED LIFECYCLE STATES
  // -----------------------------------------------------------------
  scheduleStatus: {
    type: String,
    enum: Object.values(SCHEDULE_STATUSES),
    default: SCHEDULE_STATUSES.PUBLISHED,
    index: true,
  },
  assignmentStatus: {
    type: String,
    enum: Object.values(ASSIGNMENT_STATUSES),
    default: ASSIGNMENT_STATUSES.ASSIGNED,
    index: true,
  },
  attendanceStatus: {
    type: String,
    enum: Object.values(ATTENDANCE_STATUSES),
    default: ATTENDANCE_STATUSES.NOT_STARTED,
    index: true,
  },
  payrollStatus: {
    type: String,
    enum: Object.values(PAYROLL_STATUSES),
    default: PAYROLL_STATUSES.NOT_READY,
    index: true,
  },

  // Thời điểm đã gửi nhắc ca sắp tới (job nền đảm bảo chỉ nhắc một lần)
  reminderSentAt: { type: Date, default: null },

  // Schedule revisions & audits
  scheduleRevision: { type: Number, default: 1 },
  publishedAt: { type: Date, default: null },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  acknowledgedAt: { type: Date, default: null },
  acknowledgedRevision: { type: Number, default: 0 },
  cancelReason: { type: String, default: '' },

  // Snapshot of wage rate and planned pay at time of schedule creation
  wageSnapshot: {
    hourlyRate: { type: Number, default: 25000 },
    estimatedHours: { type: Number, default: 4 },
    estimatedPay: { type: Number, default: 100000 },
  },

  // Dispute resolution audit
  disputeResolution: {
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolution: { type: String, enum: ['accepted', 'rejected', null], default: null },
    note: { type: String, default: '' },
    adjustedMinutes: { type: Number, default: null },
  },

  // Legacy compatibility status (derived and synchronized)
  status: {
    type: String,
    enum: [
      'draft',
      'published',
      'acknowledged',
      'checked_in',
      'checked_out',
      'completed_pending_review',
      'approved',
      'payroll_ready',
      'paid',
      'disputed',
      'cancelled',
      'no_show',
      // Legacy compatibility
      'scheduled',
      'needs_review',
      'pending_approval',
      'completed',
      'absent',
    ],
    default: 'published',
    index: true,
  },

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
      scheduleStatus: { type: String },
      attendanceStatus: { type: String },
      payrollStatus: { type: String },
      changedAt: { type: Date, default: Date.now },
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      note: { type: String, default: '' },
    },
  ],
}, { timestamps: true });

// Pre-validate hook to calculate startAt, endAt, totalPay and two-way sync canonical states
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

  // Ensure hours is calculated
  if (this.startAt && this.endAt) {
    const diffHours = (new Date(this.endAt).getTime() - new Date(this.startAt).getTime()) / (1000 * 60 * 60);
    if (diffHours > 0) {
      this.hours = Math.round(diffHours * 100) / 100;
    }
  }

  // Ensure wage snapshot
  if (!this.wageSnapshot || !this.wageSnapshot.hourlyRate) {
    this.wageSnapshot = {
      hourlyRate: this.wageRate || 25000,
      estimatedHours: this.hours || 4,
      estimatedPay: (this.hours || 4) * (this.wageRate || 25000),
    };
  }

  // Two-way synchronization between canonical fields and legacy status
  if (this.isModified('scheduleStatus') || this.isModified('assignmentStatus') || this.isModified('attendanceStatus') || this.isModified('payrollStatus')) {
    this.status = computeLegacyStatus(this);
  } else if (this.isModified('status') && !this.scheduleStatus) {
    const canonical = migrateLegacyStatusToCanonical(this.status);
    this.scheduleStatus = canonical.scheduleStatus;
    this.assignmentStatus = canonical.assignmentStatus;
    this.attendanceStatus = canonical.attendanceStatus;
    this.payrollStatus = canonical.payrollStatus;
  } else {
    this.status = computeLegacyStatus(this);
  }

  // Sync employeeUserId and studentUserId / studentId aliases
  if (this.employeeUserId && !this.studentUserId) this.studentUserId = this.employeeUserId;
  if (this.studentUserId && !this.employeeUserId) this.employeeUserId = this.studentUserId;
  if (this.studentUserId && !this.studentId) this.studentId = this.studentUserId;
  if (this.studentId && !this.studentUserId) {
    this.studentUserId = this.studentId;
    this.employeeUserId = this.studentId;
  }
  if (this.employerUserId && !this.employerId) this.employerId = this.employerUserId;
  if (this.employerId && !this.employerUserId) this.employerUserId = this.employerId;

  // Sync snapshot field aliases
  if (this.studentName && !this.employeeName) this.employeeName = this.studentName;
  if (this.employeeName && !this.studentName) this.studentName = this.employeeName;
  if (this.storeName && !this.workplaceName) this.workplaceName = this.storeName;
  if (this.workplaceName && !this.storeName) this.storeName = this.workplaceName;
  if (this.role && !this.positionTitle) this.positionTitle = this.role;
  if (this.positionTitle && !this.role) this.role = this.positionTitle;

  next();
});

// Scheduling & Conflict detection indexes
shiftSchema.index({ employeeUserId: 1, startAt: 1, endAt: 1 });
shiftSchema.index({ studentUserId: 1, startAt: 1, endAt: 1 });
shiftSchema.index({ employmentId: 1 });
shiftSchema.index({ employerUserId: 1, startAt: 1, endAt: 1 });
shiftSchema.index({ employeeUserId: 1, date: -1 });
shiftSchema.index({ studentUserId: 1, date: -1 });
shiftSchema.index({ employerUserId: 1, date: -1 });
shiftSchema.index({ scheduleStatus: 1, attendanceStatus: 1, payrollStatus: 1 });

export const Shift = mongoose.model('Shift', shiftSchema);
