import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reporterName: { type: String, default: '' },
    reporterEmail: { type: String, default: '' },
    targetType: {
      type: String,
      enum: ['job', 'employer', 'student', 'task', 'review', 'other'],
      default: 'other',
    },
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
    target: { type: String, default: '' }, // Display name of target
    reason: { type: String, required: true }, // Category or title of the report
    content: { type: String, required: true }, // Detailed complaint / description
    evidenceUrl: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'investigating', 'resolved', 'dismissed'],
      default: 'pending',
    },
    actionTaken: { type: String, default: '' },
    resolutionNote: { type: String, default: '' },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

reportSchema.index({ status: 1, createdAt: -1 });

export const Report = mongoose.model('Report', reportSchema);

