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
  transport: { type: String, enum: ['di_bo', 'xe_dap', 'xe_may', 'xe_buyt'], default: 'xe_may' },
  reputationScore: { type: Number, default: 5.0 },
  reputationCount: { type: Number, default: 0 },
  profileComplete: { type: Boolean, default: true },
}, { timestamps: true });

studentProfileSchema.index({ userId: 1 }, { unique: true });

export const StudentProfile = mongoose.model('StudentProfile', studentProfileSchema);

