import mongoose from 'mongoose';

const employerVerificationSchema = new mongoose.Schema({
  employerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  storeName: {
    type: String,
    required: true,
    trim: true,
  },
  legalName: {
    type: String,
    required: true,
    trim: true,
  },
  taxCode: {
    type: String,
    default: '',
    trim: true,
  },
  idCardNumber: {
    type: String,
    default: '',
    trim: true,
  },
  businessAddress: {
    type: String,
    required: true,
    trim: true,
  },
  contactPhone: {
    type: String,
    required: true,
    trim: true,
  },
  documents: [{
    name: { type: String },
    url: { type: String, required: true },
    type: { type: String, enum: ['business_license', 'id_card', 'store_photo', 'other'], default: 'store_photo' },
    uploadedAt: { type: Date, default: Date.now },
  }],
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected', 'needs_changes'],
    default: 'pending',
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

employerVerificationSchema.index({ employerUserId: 1 }, { unique: true });
employerVerificationSchema.index({ status: 1 });

export const EmployerVerification = mongoose.model('EmployerVerification', employerVerificationSchema);

