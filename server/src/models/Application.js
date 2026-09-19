import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName: { type: String, required: true },
  studentPhone: { type: String, default: '' },
  studentEmail: { type: String, default: '' },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'accepted', 'approved', 'rejected', 'withdrawn'], default: 'pending' },
  note: { type: String, default: '' },
  employerNote: { type: String, default: '' },
  appliedAt: { type: Date, default: Date.now },
}, { timestamps: true });

export const Application = mongoose.model('Application', applicationSchema);

