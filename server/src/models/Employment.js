import mongoose from 'mongoose';

const employmentSchema = new mongoose.Schema({
  employerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  employeeUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sourceApplicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', unique: true, sparse: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  workplace: { type: String, default: '' },
  positionTitle: { type: String, required: true, default: 'Nhân viên bán ca' },
  status: {
    type: String,
    enum: ['onboarding', 'active', 'suspended', 'terminated'],
    default: 'active',
    index: true,
  },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, default: null },
  terminationReasonCode: {
    type: String,
    enum: ['resigned', 'contract_ended', 'dismissed', 'other', null],
    default: null,
  },
  terminationNote: { type: String, default: '' },
  wageRate: { type: Number, default: 25000 },
  wageUnit: { type: String, enum: ['hour', 'shift', 'month'], default: 'hour' },
  currency: { type: String, default: 'VND' },
  contractType: { type: String, enum: ['part_time', 'full_time', 'casual', 'seasonal'], default: 'part_time' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  activatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  terminatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  history: [{
    status: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, default: '' },
  }],
}, { timestamps: true });

employmentSchema.index({ employerUserId: 1, status: 1 });
employmentSchema.index({ employeeUserId: 1, status: 1 });
employmentSchema.index({ employerUserId: 1, employeeUserId: 1, jobId: 1 });

export const Employment = mongoose.model('Employment', employmentSchema);
