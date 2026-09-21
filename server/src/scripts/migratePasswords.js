import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from '../models/User.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('[Migration Error] MONGO_URI environment variable is required!');
  process.exit(1);
}

async function migratePasswords() {
  try {
    console.log('[Migration] Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGO_URI);
    console.log('[Migration] Connected to MongoDB.');

    const users = await User.find({});
    console.log(`[Migration] Found ${users.length} total users.`);

    let migratedCount = 0;
    let alreadyHashedCount = 0;

    for (const user of users) {
      let needsUpdate = false;

      // 1. Ensure status is active if not set
      if (!user.status) {
        user.status = 'active';
        needsUpdate = true;
      }

      // 2. Check if password needs bcrypt hashing
      if (user.password && !user.password.startsWith('$2a$') && !user.password.startsWith('$2b$')) {
        console.log(`[Migration] Hashing password for: ${user.email}`);
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
        needsUpdate = true;
        migratedCount++;
      } else {
        alreadyHashedCount++;
      }

      if (needsUpdate) {
        // Use direct collection update to bypass mongoose pre-save hook re-hashing
        await User.collection.updateOne(
          { _id: user._id },
          { $set: { password: user.password, status: user.status } }
        );
      }
    }

    console.log(`[Migration] Complete! Migrated: ${migratedCount}, Already hashed: ${alreadyHashedCount}`);
  } catch (err) {
    console.error('[Migration Error]:', err);
  } finally {
    await mongoose.disconnect();
    console.log('[Migration] Disconnected from MongoDB.');
  }
}

migratePasswords();

