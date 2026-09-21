import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'employer', 'admin'], default: 'student' },
    phone: { type: String, default: '', trim: true },
    avatar: { type: String, default: '' },
    status: {
      type: String,
      enum: ['active', 'locked', 'suspended', 'deleted'],
      default: 'active',
    },
    emailVerifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Hash password before saving if modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password securely
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password || !candidatePassword) return false;
  // If stored password is a bcrypt hash
  if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) {
    return bcrypt.compare(candidatePassword, this.password);
  }
  // Safety fallback for any legacy unmigrated plaintext
  return candidatePassword === this.password;
};

export const User = mongoose.model('User', userSchema);
