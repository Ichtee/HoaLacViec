import mongoose from 'mongoose';

const employerProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  storeName: { type: String, required: true },
  storeType: { type: String, default: 'Quán cà phê' },
  address: { type: String, required: true },
  area: { type: String, default: 'fpt_university' },
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
    enum: ['unconfirmed', 'pending_confirmation', 'confirmed', 'legacy_unverified'],
    default: 'unconfirmed',
  },
  locationSource: {
    type: String,
    enum: ['device', 'places', 'map_pin', 'manual_coordinates', 'geocoded', null],
    default: null,
  },
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
  contactName: { type: String, default: '' },
  contactPhone: { type: String, default: '' },
  description: { type: String, default: '' },
  verified: { type: Boolean, default: false },
  verifiedAt: { type: Date, default: null },
  checkinRadius: { type: Number, default: 150, min: 50, max: 500 },
  busRoutes: [{ type: String }],
  rating: { type: Number, default: 5.0 },
  ratingCount: { type: Number, default: 0 },
}, { timestamps: true });

employerProfileSchema.pre('save', function (next) {
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

employerProfileSchema.index({ userId: 1 }, { unique: true });
employerProfileSchema.index({ geoPoint: '2dsphere' }, { sparse: true });

export const EmployerProfile = mongoose.model('EmployerProfile', employerProfileSchema);
