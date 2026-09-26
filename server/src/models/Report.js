import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reporterName: { type: String, default: '' },
    reporterEmail: { type: String, default: '' },
    targetType: {
      type: String,
      enum: ['job', 'employer', 'student', 'task', 'review', 'user', 'other'],
      default: 'other',
      required: true,
    },
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
    target: { type: String, default: '' }, // Tên hoặc tiêu đề của đối tượng bị báo cáo
    reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Người bị báo cáo (chủ task/job/review)
    openedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Người mở khiếu nại (thường là reporterId)
    reason: { type: String, required: true }, // Lý do tóm tắt
    content: { type: String, required: true }, // Nội dung khiếu nại chi tiết
    evidenceUrl: { type: String, default: '' }, // Link ảnh/minh chứng
    status: {
      type: String,
      enum: ['pending', 'investigating', 'resolved', 'dismissed'],
      default: 'pending',
    },
    actionTaken: {
      type: String,
      enum: ['', 'no_action', 'warned', 'content_removed', 'account_suspended', 'account_locked', 'refund_required'],
      default: '',
    },
    taskResolution: {
      type: String,
      enum: ['', 'completed', 'cancelled'],
      default: '',
    },
    resolutionNote: { type: String, default: '' },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
    history: [
      {
        action: { type: String, required: true },
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ targetType: 1, targetId: 1 });
reportSchema.index({ reportedUserId: 1 });

export const Report = mongoose.model('Report', reportSchema);
