import mongoose from 'mongoose';

const availabilitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  // Format: { mon: ['morning', 'evening'], tue: ['afternoon'], ... }
  slots: {
    mon: [{ type: String }],
    tue: [{ type: String }],
    wed: [{ type: String }],
    thu: [{ type: String }],
    fri: [{ type: String }],
    sat: [{ type: String }],
    sun: [{ type: String }],
  }
}, { timestamps: true });

export const Availability = mongoose.model('Availability', availabilitySchema);

