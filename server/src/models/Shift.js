import mongoose from 'mongoose';

const shiftSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', default: null },
  storeName: { type: String, default: '' },
  employerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Alias for employerUserId
  studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Alias for studentUserId
  studentName: { type: String, default: '' },
  role: { type: String, default: 'Nhân viên bán ca' },
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
      'scheduled',
      'checked_in',
      'checked_out',
      'pending_approval',
      'approved',
      'completed', // Alias for approved
      'disputed',
      'cancelled',
      'absent',
    ],
    default: 'scheduled',
  },
  attendance: {
    checkInAt: { type: Date, default: null },
    checkInCoords: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      accuracy: { type: Number, default: null },
    },
    checkInDistanceMeters: { type: Number, default: null },
    checkInVerified: { type: Boolean, default: false },

    checkOutAt: { type: Date, default: null },
    checkOutCoords: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      accuracy: { type: Number, default: null },
    },
    checkOutDistanceMeters: { type: Number, default: null },
    checkOutVerified: { type: Boolean, default: false },

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

// Performance index
shiftSchema.index({ studentUserId: 1, date: -1 });
shiftSchema.index({ employerUserId: 1, date: -1 });
shiftSchema.index({ status: 1 });

export const Shift = mongoose.model('Shift', shiftSchema);
