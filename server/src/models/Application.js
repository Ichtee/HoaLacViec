import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName: { type: String, required: true },
  studentPhone: { type: String, default: '' },
  studentEmail: { type: String, default: '' },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: {
    type: String,
    enum: [
      'pending',      // Mới nộp
      'reviewing',    // Đang xem xét hồ sơ
      'shortlisted',  // Đạt tiêu chuẩn / vào vòng trong
      'interview',    // Hẹn phỏng vấn
      'hired',        // Đã tuyển dụng thành công
      'accepted',     // Legacy compatibility (tương đương hired)
      'approved',     // Legacy compatibility (tương đương hired)
      'rejected',     // Từ chối
      'withdrawn',    // Sinh viên rút đơn
    ],
    default: 'pending',
  },
  note: { type: String, default: '' }, // Lời nhắn từ sinh viên khi nộp
  employerNote: { type: String, default: '' }, // Legacy employer note
  internalNote: { type: String, default: '' }, // Ghi chú nội bộ dành riêng cho NTD
  candidateFeedback: { type: String, default: '' }, // Lời nhắn/phản hồi gửi cho sinh viên
  interviewSchedule: {
    date: { type: String },
    time: { type: String },
    location: { type: String },
    note: { type: String },
  },
  statusHistory: [{
    status: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, default: '' },
  }],
  appliedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Prevent duplicate active applications from the same student for the same job
applicationSchema.index({ studentId: 1, jobId: 1 }, { unique: true });
applicationSchema.index({ studentId: 1 });
applicationSchema.index({ employerId: 1 });
applicationSchema.index({ status: 1 });

export const Application = mongoose.model('Application', applicationSchema);

