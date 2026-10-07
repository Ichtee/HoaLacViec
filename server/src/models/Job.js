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
    type: new mongoose.Schema({
      type: { type: String, enum: ['Point'], required: true },
      coordinates: { type: [Number], required: true }, // [longitude, latitude]
    }, { _id: false }),
    default: undefined,
  },
  locationStatus: {
    type: String,
    enum: ['unconfirmed', 'pending_confirmation', 'confirmed', 'legacy_unverified'],
    default: 'unconfirmed',
  },
  locationSource: {
    type: String,
    enum: ['device', 'places', 'map_pin', 'manual_coordinates', 'geocoded', null],
    default: null,
  },
  geocodingProvider: {
    type: String,
    enum: ['vietmap', 'nominatim', 'serpapi', 'manual', null],
    default: null,
  },
  providerPlaceId: { type: String, default: null },
  // Tọa độ ước tính từ địa chỉ (chỉ để hiển thị khoảng cách "~" cho tin chưa ghim vị trí).
  // Không dùng cho chỉ đường hay chấm công: những việc đó chỉ dùng location đã xác nhận.
  approxLocation: {
    type: new mongoose.Schema({
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      source: { type: String, default: 'geocoded' },
      query: { type: String, default: '' },
      geocodedAt: { type: Date, default: Date.now },
    }, { _id: false }),
    default: undefined,
  },
  // true khi vị trí "đã xác nhận" thực ra là điểm mặc định (trung tâm Hòa Lạc) -> cần chủ quán ghim lại
  locationNeedsReview: { type: Boolean, default: false },
  formattedAddress: { type: String, default: '' },
  locationConfirmedAt: { type: Date, default: null },
  addressComponents: {
    addressLine: { type: String, default: '' },
    wardCode: { type: String, default: null },
    wardName: { type: String, default: '' },
    districtCode: { type: String, default: null },
    districtName: { type: String, default: '' },
    provinceCode: { type: String, default: null },
    provinceName: { type: String, default: '' },
  },
  provinceCode: { type: String, default: null },
  districtCode: { type: String, default: null },
  wardCode: { type: String, default: null },
  schedule: [{ 
    dayOfWeek: { type: Number, min: 1, max: 7 },
    startTime: { type: String },
    endTime: { type: String },
    slot: { type: String },
  }],
  positions: [{
    title: { type: String, default: '' },
    shift: { type: String, default: '' },
    quantity: { type: Number, default: 1 },
  }],
  slots: { type: Number, default: 1 }, // Legacy compatibility: equals remainingOpenings
  headcountTarget: { type: Number, default: 1, min: 1 }, // Total openings originally requested
  hiredCount: { type: Number, default: 0, min: 0 },       // Successful hires for this posting (historical, including terminated)
  remainingOpenings: { type: Number, default: 1, min: 0 },// headcountTarget - hiredCount
  recruitmentStatus: {
    type: String,
    enum: ['open', 'paused', 'filled', 'closed'],
    default: 'open',
    index: true,
  },
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
jobSchema.index({ locationStatus: 1 });
jobSchema.index({ provinceCode: 1, districtCode: 1, wardCode: 1 });
jobSchema.index({ geoPoint: '2dsphere' }, { sparse: true });

export const Job = mongoose.model('Job', jobSchema);
