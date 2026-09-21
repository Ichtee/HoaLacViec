import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  // Normalized Actor ID: Authoritative User ID of the employer
  employerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // EmployerProfile reference
  employerProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployerProfile' },
  // Legacy employerId kept for backwards compatibility
  employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployerProfile' },
  storeName: { type: String, required: true },
  title: { type: String, required: true, default: 'Chưa đặt tiêu đề' },
  type: { type: String, enum: ['part_time', 'shift', 'hourly', 'event'], default: 'part_time' },
  salaryAmount: { type: Number, required: true },
  salaryUnit: { type: String, enum: ['hour', 'shift', 'month', 'event'], default: 'hour' },
  area: { type: String, default: 'fpt_university' },
  address: { type: String, default: 'Khu công nghệ cao Hòa Lạc' },
  location: {
    lat: { type: Number, default: 21.0128 },
    lng: { type: Number, default: 105.5255 },
  },
  schedule: [{ 
    dayOfWeek: { type: Number, min: 1, max: 7 },
    startTime: { type: String },
    endTime: { type: String },
    slot: { type: String },
  }],
  slots: { type: Number, default: 1 },
  description: { type: String, default: '' },
  requirements: [{ type: String }],
  benefits: [{ type: String }],
  busRoutes: [{ type: String }],
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'paused', 'closed', 'rejected', 'expired'],
    default: 'pending',
  },
  moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  moderatedAt: { type: Date, default: null },
  moderationNote: { type: String, default: '' },
  rejectionReason: { type: String, default: '' },
  featured: { type: Boolean, default: false },
  tags: [{ type: String }],
  contactPhone: { type: String, default: '' },
  postedAt: { type: Date, default: Date.now },
  closesAt: { type: Date },
}, { timestamps: true });

// Performance indexes
jobSchema.index({ status: 1 });
jobSchema.index({ employerUserId: 1 });
jobSchema.index({ area: 1 });
jobSchema.index({ createdAt: -1 });
jobSchema.index({ featured: -1, createdAt: -1 });

export const Job = mongoose.model('Job', jobSchema);

