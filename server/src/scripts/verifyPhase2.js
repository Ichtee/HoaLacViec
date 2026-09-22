import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Job } from '../models/Job.js';
import { User } from '../models/User.js';
import { EmployerVerification } from '../models/EmployerVerification.js';

dotenv.config();

async function runPhase2Tests() {
  console.log('=== Testing Phase 2 Data Models & Lifecycle on MongoDB Atlas ===');
  await mongoose.connect(process.env.MONGO_URI);

  // 1. Check all jobs have employerUserId
  const jobs = await Job.find();
  console.log(`Total jobs in DB: ${jobs.length}`);
  const withoutEmployerUser = jobs.filter(j => !j.employerUserId);
  console.log(`Jobs without employerUserId: ${withoutEmployerUser.length}`);
  if (withoutEmployerUser.length > 0) {
    throw new Error('Some jobs are missing employerUserId!');
  }

  // 2. Check approved jobs
  const approvedJobs = await Job.find({ status: 'approved' });
  console.log(`Approved jobs: ${approvedJobs.length}/${jobs.length}`);

  // 3. Check EmployerVerifications
  const verifications = await EmployerVerification.find();
  console.log(`EmployerVerifications count: ${verifications.length}`);
  verifications.forEach(v => {
    console.log(` - Store: ${v.storeName}, Status: ${v.status}, UserId: ${v.employerUserId}`);
  });

  // 4. Test pagination simulation
  const limit = 5;
  const page = 2;
  const total = await Job.countDocuments({ status: 'approved' });
  const pagedJobs = await Job.find({ status: 'approved' }).skip((page - 1) * limit).limit(limit);
  console.log(`Pagination page 2 (limit 5): got ${pagedJobs.length} items, total: ${total}, totalPages: ${Math.ceil(total / limit)}`);
  if (pagedJobs.length !== 5) {
    throw new Error('Pagination test failed');
  }

  console.log('\nALL PHASE 2 DATA MODEL TESTS PASSED!\n');
  process.exit(0);
}

runPhase2Tests().catch(err => {
  console.error(err);
  process.exit(1);
});

