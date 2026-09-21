import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reviewerName: { type: String, required: true },
  reviewerRole: { type: String, enum: ['student', 'employer', 'admin'], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  storeName: { type: String, default: '' },
  transactionType: { type: String, enum: ['shift', 'task', 'direct'], default: 'direct' },
  transactionId: { type: mongoose.Schema.Types.ObjectId, default: null },
  tags: [{ type: String }],
  type: { type: String, enum: ['received', 'given'], default: 'received' },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, required: true },
  status: { type: String, enum: ['published', 'flagged', 'hidden'], default: 'published' },
}, { timestamps: true });

// Prevent multiple reviews from the same reviewer for the same completed shift/task
reviewSchema.index(
  { reviewerId: 1, transactionId: 1 },
  { unique: true, partialFilterExpression: { transactionId: { $type: 'objectId' } } }
);

reviewSchema.index({ targetId: 1, createdAt: -1 });

export const Review = mongoose.model('Review', reviewSchema);
