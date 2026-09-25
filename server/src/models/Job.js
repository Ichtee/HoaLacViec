import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  // Normalized Actor ID: Authoritative User ID of the employer
  employerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // EmployerProfile reference
  employerProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployerProfile' },
  // Legacy employerId kept for backwards compatibility
  employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployerProfile' },
  storeName: { type: String, required: true },
  title: { type: String, required: true, default: 'Chưa đặt tiêu đề' },
  category: { type: String, default: 'other' },
  type: { type: String, enum: ['part_time', 'shift', 'hourly', 'event'], default: 'part_time' },
  salaryAmount: { type: Number, required: true },
  salaryUnit: { type: String, enum: ['hour', 'shift', 'month', 'event'], default: 'hour' },
  area: { type: String, default: 'fpt_university' },
  address: { type: String, default: '' },
  location: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  // GeoJSON Point for MongoDB 2dsphere queries
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
  locationConfirmedAt: { type: Date, default: null },
  schedule: [{ 
    dayOfWeek: { type: Number, min: 1, max: 7 },
    startTime: { type: String },
    endTime: { type: String },
    slot: { type: String },
  }],
  slots: { type: Number, default: 1 },
  description: { type: String, default: '' },
  requirements: [{ type: String }],
  benefits: [{ type: String }],
  busRoutes: [{ type: String }],
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'paused', 'closed', 'rejected', 'expired'],
    default: 'pending',
  },
  moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  moderatedAt: { type: Date, default: null },
  moderationNote: { type: String, default: '' },
  rejectionReason: { type: String, default: '' },
  featured: { type: Boolean, default: false },
  tags: [{ type: String }],
  contactPhone: { type: String, default: '' },
  postedAt: { type: Date, default: Date.now },
  closesAt: { type: Date },
  archivedAt: { type: Date, default: null },
}, { timestamps: true });

// Pre-save hook to synchronize geoPoint from location coords
jobSchema.pre('save', function (next) {
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

// Performance and Geospatial indexes
jobSchema.index({ status: 1, archivedAt: 1 });
jobSchema.index({ employerUserId: 1 });
jobSchema.index({ area: 1 });
jobSchema.index({ category: 1 });
jobSchema.index({ createdAt: -1 });
jobSchema.index({ featured: -1, createdAt: -1 });
jobSchema.index({ geoPoint: '2dsphere' }, { sparse: true });

export const Job = mongoose.model('Job', jobSchema);
