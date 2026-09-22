import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Job } from '../models/Job.js';
import { User } from '../models/User.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { EmployerVerification } from '../models/EmployerVerification.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('[Migration Error] MONGO_URI environment variable is missing!');
  process.exit(1);
}

async function migrate() {
  try {
    console.log('[Migration] Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGO_URI);
    console.log('[Migration] Connected to MongoDB Atlas successfully.');

    // 1. Find default employer fallback in case any job is orphaned
    const fallbackEmployer = await User.findOne({ role: 'employer' });
    const fallbackUserId = fallbackEmployer ? fallbackEmployer._id : null;

    // 2. Migrate Jobs
    const jobs = await Job.find();
    console.log(`[Migration] Found ${jobs.length} jobs to inspect and normalize.`);

    let updatedJobsCount = 0;
    for (const job of jobs) {
      let needsSave = false;

      // Normalize status: map legacy 'active' to 'approved'
      if (!job.status || job.status === 'active') {
        job.status = 'approved';
        needsSave = true;
      }

      // Resolve employerUserId and employerProfileId
      if (!job.employerUserId) {
        if (job.employerId) {
          // Check if employerId points to an EmployerProfile
          const profile = await EmployerProfile.findById(job.employerId);
          if (profile && profile.userId) {
            job.employerUserId = profile.userId;
            job.employerProfileId = profile._id;
            needsSave = true;
          } else {
            // Check if employerId points directly to a User
            const user = await User.findById(job.employerId);
            if (user) {
              job.employerUserId = user._id;
              const userProfile = await EmployerProfile.findOne({ userId: user._id });
              if (userProfile) job.employerProfileId = userProfile._id;
              needsSave = true;
            } else if (fallbackUserId) {
              job.employerUserId = fallbackUserId;
              needsSave = true;
            }
          }
        } else if (fallbackUserId) {
          job.employerUserId = fallbackUserId;
          needsSave = true;
        }
      }

      if (needsSave) {
        await job.save();
        updatedJobsCount++;
      }
    }
    console.log(`[Migration] Jobs normalization complete. Updated: ${updatedJobsCount}/${jobs.length}.`);

    // 3. Normalize EmployerVerification for existing verified profiles
    const verifiedProfiles = await EmployerProfile.find({ verified: true });
    console.log(`[Migration] Found ${verifiedProfiles.length} verified employer profiles.`);

    let verificationsCreated = 0;
    for (const profile of verifiedProfiles) {
      const existing = await EmployerVerification.findOne({ employerUserId: profile.userId });
      if (!existing) {
        await EmployerVerification.create({
          employerUserId: profile.userId,
          storeName: profile.storeName,
          legalName: profile.contactName || profile.storeName,
          businessAddress: profile.address || 'Hòa Lạc, Thạch Thất',
          contactPhone: profile.contactPhone || '0901234567',
          status: 'approved',
          reviewedAt: profile.verifiedAt || new Date(),
        });
        verificationsCreated++;
      }
    }
    console.log(`[Migration] Created ${verificationsCreated} EmployerVerification records.`);

    console.log('\n=== MIGRATION COMPLETED SUCCESSFULLY ===\n');
    process.exit(0);
  } catch (err) {
    console.error('[Migration Error]', err);
    process.exit(1);
  }
}

migrate();

