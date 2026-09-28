import mongoose from 'mongoose';

const timeOffRequestSchema = new mongoose.Schema({
  employeeUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  employerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  employmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employment', default: null },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reason: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending',
    index: true,
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  reviewNote: { type: String, default: '' },
}, { timestamps: true });

timeOffRequestSchema.index({ employeeUserId: 1, startDate: 1, endDate: 1 });
timeOffRequestSchema.index({ employerUserId: 1, status: 1 });

export const TimeOffRequest = mongoose.model('TimeOffRequest', timeOffRequestSchema);
