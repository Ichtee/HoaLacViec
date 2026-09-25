import mongoose from 'mongoose';

const studentProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  university: { type: String, default: 'Đại học FPT Hòa Lạc' },
  studentCode: { type: String, default: '' },
  yearOfStudy: { type: Number, default: 2 },
  major: { type: String, default: 'Kỹ thuật phần mềm' },
  area: { type: String, default: 'fpt_university' },
  address: { type: String, default: '' },
  location: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  geoPoint: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: undefined,
    },
  },
  locationStatus: {
    type: String,
    enum: ['unconfirmed', 'confirmed', 'legacy_unverified'],
    default: 'unconfirmed',
  },
  locationSource: {
    type: String,
    enum: ['device', 'places', 'map_pin', 'manual_coordinates', 'geocoded', null],
    default: null,
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

studentProfileSchema.pre('save', function (next) {
  if (
    this.location &&
    typeof this.location.lat === 'number' &&
    typeof this.location.lng === 'number' &&
    Number.isFinite(this.location.lat) &&
    Number.isFinite(this.location.lng)
  ) {
    this.geoPoint = {
      type: 'Point',
      coordinates: [this.location.lng, this.location.lat],
    };
  } else {
    this.geoPoint = undefined;
  }
  next();
});

studentProfileSchema.index({ userId: 1 }, { unique: true });
studentProfileSchema.index({ verificationStatus: 1 });
studentProfileSchema.index({ geoPoint: '2dsphere' }, { sparse: true });

export const StudentProfile = mongoose.model('StudentProfile', studentProfileSchema);
