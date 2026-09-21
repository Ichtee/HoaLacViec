import mongoose from 'mongoose';

const employerProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  storeName: { type: String, required: true },
  storeType: { type: String, default: 'Quán cà phê' },
  address: { type: String, required: true },
  area: { type: String, default: 'fpt_university' },
  location: {
    lat: { type: Number, default: 21.0128 },
    lng: { type: Number, default: 105.5255 },
  },
  contactName: { type: String, default: '' },
  contactPhone: { type: String, default: '' },
  description: { type: String, default: '' },
  verified: { type: Boolean, default: false },
  verifiedAt: { type: Date, default: null },
  checkinRadius: { type: Number, default: 150 },
  busRoutes: [{ type: String }],
  rating: { type: Number, default: 5.0 },
  ratingCount: { type: Number, default: 0 },
}, { timestamps: true });

employerProfileSchema.index({ userId: 1 }, { unique: true });

export const EmployerProfile = mongoose.model('EmployerProfile', employerProfileSchema);

