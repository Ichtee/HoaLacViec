import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, default: '123456' },
  role: { type: String, enum: ['student', 'employer', 'admin'], default: 'student' },
  phone: { type: String, default: '' },
  avatar: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

export const User = mongoose.model('User', userSchema);

