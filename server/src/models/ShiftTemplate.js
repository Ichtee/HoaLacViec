import mongoose from 'mongoose';

const shiftTemplateSchema = new mongoose.Schema({
  employerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },
  workplace: { type: String, default: '' },
  positionTitle: { type: String, required: true },
  dayOfWeek: {
    type: Number,
    required: true,
    min: 0,
    max: 6, // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  },
  startTime: { type: String, required: true }, // '07:00'
  endTime: { type: String, required: true },   // '12:00'
  requiredHeadcount: { type: Number, default: 1, min: 1 },
  wageOverride: { type: Number, default: null },
  effectiveFrom: { type: Date, default: Date.now },
  effectiveTo: { type: Date, default: null },
  active: { type: Boolean, default: true, index: true },
}, { timestamps: true });

shiftTemplateSchema.index({ employerUserId: 1, active: 1, dayOfWeek: 1 });

export const ShiftTemplate = mongoose.model('ShiftTemplate', shiftTemplateSchema);
