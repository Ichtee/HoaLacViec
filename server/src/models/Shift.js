import mongoose from 'mongoose';

const shiftSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  storeName: { type: String, default: '' },
  employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  studentName: { type: String, default: '' },
  role: { type: String, default: 'Nhân viên bán ca' },
  date: { type: String, required: true }, // YYYY-MM-DD
  startTime: { type: String, required: true }, // HH:mm
  endTime: { type: String, required: true },
  hours: { type: Number, default: 4 },
  wageRate: { type: Number, default: 25000 },
  status: { type: String, enum: ['scheduled', 'checked_in', 'completed', 'absent', 'cancelled'], default: 'scheduled' },
  attendance: {
    checkInAt: { type: Date, default: null },
    checkOutAt: { type: Date, default: null },
    locationVerified: { type: Boolean, default: true },
  }
}, { timestamps: true });

export const Shift = mongoose.model('Shift', shiftSchema);

