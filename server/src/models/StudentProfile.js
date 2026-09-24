import mongoose from 'mongoose';

const studentProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  university: { type: String, default: 'Đại học FPT Hòa Lạc' },
  studentCode: { type: String, default: '' },
  yearOfStudy: { type: Number, default: 2 },
  major: { type: String, default: 'Kỹ thuật phần mềm' },
  area: { type: String, default: 'fpt_university' },
  address: { type: String, default: 'KTX ĐH FPT Hòa Lạc' },
  location: {
    lat: { type: Number, default: 21.0134 },
    lng: { type: Number, default: 105.5263 },
  },
  bio: { type: String, default: '' },
  skills: [{ type: String }],
  transport: {
    type: String,
    enum: ['xe_may', 'di_bo', 'xe_buyt', 'xe_dap', 'xe_dap_dien', 'o_to'],
    default: 'xe_may',
  },
  reputationScore: { type: Number, default: 5.0 },
  reputationCount: { type: Number, default: 0 },
  profileComplete: { type: Boolean, default: true },
  studentCardPhoto: { type: String, default: '' },
  verified: { type: Boolean, default: false },
  verifiedAt: { type: Date, default: null },
  verificationStatus: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected'],
    default: 'draft',
  },
  rejectionReason: {
    type: String,
    default: '',
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  reviewedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

studentProfileSchema.index({ userId: 1 }, { unique: true });
studentProfileSchema.index({ verificationStatus: 1 });

export const StudentProfile = mongoose.model('StudentProfile', studentProfileSchema);

