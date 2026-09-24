import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/User.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('[Error] MONGO_URI environment variable is required!');
  process.exit(1);
}

async function run() {
  try {
    console.log('[Script] Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('[Script] Connected successfully.');

    // 1. Check admin accounts
    const admins = await User.find({ role: 'admin' }).select('name email role status');
    console.log(`[Script] Found ${admins.length} admin account(s) (will NOT be changed):`);
    admins.forEach((a) => {
      console.log(`  - Admin: ${a.email} (${a.name}) | Status: ${a.status}`);
    });

    // 2. Find all non-admin accounts
    const nonAdmins = await User.find({ role: { $ne: 'admin' } }).select('name email role status');
    console.log(`\n[Script] Found ${nonAdmins.length} non-admin user(s) to update to pending:`);
    nonAdmins.forEach((u) => {
      console.log(`  - User: ${u.email} (${u.name}) | Current role: ${u.role}, Current status: ${u.status}`);
    });

    // 3. Update all non-admin accounts to role: 'pending', status: 'pending'
    const result = await User.updateMany(
      { role: { $ne: 'admin' } },
      { $set: { role: 'pending', status: 'pending' } }
    );

    console.log(`\n[Script] Successfully updated ${result.modifiedCount} account(s) to role: 'pending' & status: 'pending'.`);
  } catch (err) {
    console.error('[Script Error]:', err);
  } finally {
    await mongoose.disconnect();
    console.log('[Script] Disconnected from MongoDB.');
    process.exit(0);
  }
}

run();
