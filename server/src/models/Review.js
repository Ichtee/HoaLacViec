import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reviewerName: { type: String, required: true },
  reviewerRole: { type: String, enum: ['student', 'employer'], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  storeName: { type: String, default: '' },
  tags: [{ type: String }],
  type: { type: String, enum: ['received', 'given'], default: 'received' },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, required: true },
}, { timestamps: true });

export const Review = mongoose.model('Review', reviewSchema);

