import 'dotenv/config';
import mongoose from 'mongoose';
import { Application } from '../models/Application.js';
import { Job } from '../models/Job.js';
import { Shift, parseVietnamDateTime } from '../models/Shift.js';
import { Employment } from '../models/Employment.js';
import { User } from '../models/User.js';

async function runMigration() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`\n======================================================`);
  console.log(`🚀 RUNNING MIGRATION: Candidate → Employment → Shift`);
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (No changes will be saved)' : '✍️ APPLY (Changes will be written to DB)'}`);
  console.log(`======================================================\n`);

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hoalacviec';
  await mongoose.connect(mongoUri);
  console.log(`Connected to MongoDB: ${mongoUri.replace(/:[^:]*@/, ':****@')}\n`);

  const report = {
    applicationsUpdated: 0,
    employmentsCreated: 0,
    employmentsSkippedExisting: 0,
    jobsUpdated: 0,
    shiftsBackfilledTimestamps: 0,
    shiftsLinkedEmployment: 0,
    warnings: [],
  };

  try {
    // -------------------------------------------------------------------------
    // 1. MIGRATE APPLICATION STATUSES (pending -> submitted, reviewing -> screening)
    // -------------------------------------------------------------------------
    console.log('1. Checking Applications for status modernization...');
    const legacyApps = await Application.find({
      status: { $in: ['pending', 'reviewing'] },
    });

    for (const app of legacyApps) {
      const oldStatus = app.status;
      const newStatus = oldStatus === 'pending' ? 'submitted' : 'screening';
      report.applicationsUpdated++;

      if (!isDryRun) {
        app.status = newStatus;
        app.statusHistory.push({
          fromStatus: oldStatus,
          toStatus: newStatus,
          status: newStatus,
          changedAt: new Date(),
          reason: 'System migration to standard application state machine',
          candidateVisibleMessage: '',
        });
        await app.save();
      }
    }
    console.log(`   Found & ${isDryRun ? 'would update' : 'updated'} ${report.applicationsUpdated} applications.\n`);

    // -------------------------------------------------------------------------
    // 2. MIGRATE HIRED APPLICATIONS TO INDEPENDENT EMPLOYMENT RECORDS
    // -------------------------------------------------------------------------
    console.log('2. Migrating hired applications to independent Employment records...');
    const hiredApps = await Application.find({
      status: { $in: ['hired', 'accepted', 'approved'] },
    }).populate('jobId');

    for (const app of hiredApps) {
      // Check idempotency: does an employment already exist for this application?
      const existingEmployment = await Employment.findOne({ sourceApplicationId: app._id });
      if (existingEmployment) {
        report.employmentsSkippedExisting++;
        continue;
      }

      const job = app.jobId || {};
      const employerUserId = app.employerUserId || app.employerId || job.employerUserId || job.employerId;

      if (!employerUserId) {
        report.warnings.push(`Application ${app._id} missing employerUserId, skipping employment creation.`);
        continue;
      }

      if (!app.studentId) {
        report.warnings.push(`Application ${app._id} missing studentId, skipping employment creation.`);
        continue;
      }

      report.employmentsCreated++;

      if (!isDryRun) {
        await Employment.create({
          employerUserId,
          employeeUserId: app.studentId,
          sourceApplicationId: app._id,
          jobId: job._id || app.jobId,
          workplace: job.storeName || job.title || 'Cửa hàng',
          positionTitle: app.selectedPosition || job.title || 'Nhân viên bán ca',
          status: 'active',
          startDate: app.updatedAt || app.createdAt || new Date(),
          wageRate: job.salaryAmount || 25000,
          wageUnit: job.salaryUnit || 'hour',
          contractType: 'part_time',
          createdBy: employerUserId,
          activatedBy: employerUserId,
          history: [{
            status: 'active',
            changedAt: new Date(),
            note: 'Tạo quan hệ nhân viên tự động từ hồ sơ tuyển dụng đã trúng tuyển.',
          }],
        });
      }
    }
    console.log(`   ${isDryRun ? 'Would create' : 'Created'} ${report.employmentsCreated} Employment records (Skipped ${report.employmentsSkippedExisting} already existing).\n`);

    // -------------------------------------------------------------------------
    // 3. NORMALIZE JOB REQUISITION CAPACITY
    // -------------------------------------------------------------------------
    console.log('3. Normalizing Job capacities (headcountTarget, hiredCount, remainingOpenings)...');
    const jobs = await Job.find({});

    for (const job of jobs) {
      // Determine headcountTarget
      const posSum = Array.isArray(job.positions) && job.positions.length > 0
        ? job.positions.reduce((sum, p) => sum + (Number(p.quantity) || 1), 0)
        : 0;
      const target = job.headcountTarget || posSum || job.slots || 1;

      // Count active employments for this job
      const activeHired = await Employment.countDocuments({
        jobId: job._id,
        status: { $in: ['active', 'onboarding'] },
      });

      const remaining = Math.max(0, target - activeHired);
      const recStatus = remaining === 0 ? 'filled' : (job.status === 'paused' ? 'paused' : 'open');

      report.jobsUpdated++;
      if (!isDryRun) {
        job.headcountTarget = target;
        job.hiredCount = activeHired;
        job.remainingOpenings = remaining;
        job.slots = remaining; // Keep slots strictly in sync
        job.recruitmentStatus = recStatus;
        await job.save();
      }
    }
    console.log(`   ${isDryRun ? 'Would update' : 'Updated'} ${report.jobsUpdated} jobs capacity.\n`);

    // -------------------------------------------------------------------------
    // 4. BACKFILL SHIFT TIMESTAMPS & LINK EMPLOYMENT
    // -------------------------------------------------------------------------
    console.log('4. Backfilling Shift startAt/endAt (Asia/Ho_Chi_Minh) and linking Employment...');
    const shifts = await Shift.find({});

    for (const shift of shifts) {
      let needsSave = false;

      // Timestamps backfill
      if ((!shift.startAt || !shift.endAt) && shift.date && shift.startTime && shift.endTime) {
        const isOvernight = shift.endTime <= shift.startTime;
        shift.startAt = parseVietnamDateTime(shift.date, shift.startTime, false);
        shift.endAt = parseVietnamDateTime(shift.date, shift.endTime, isOvernight);
        report.shiftsBackfilledTimestamps++;
        needsSave = true;
      }

      // Employment linking
      if (!shift.employmentId && (shift.studentUserId || shift.studentId)) {
        const sId = shift.studentUserId || shift.studentId;
        const eId = shift.employerUserId || shift.employerId;
        const emp = await Employment.findOne({
          employeeUserId: sId,
          ...(eId ? { employerUserId: eId } : {}),
        });
        if (emp) {
          shift.employmentId = emp._id;
          report.shiftsLinkedEmployment++;
          needsSave = true;
        }
      }

      // Legacy status modernization
      if (shift.status === 'scheduled') {
        shift.status = 'published';
        needsSave = true;
      } else if (shift.status === 'pending_approval') {
        shift.status = 'completed_pending_review';
        needsSave = true;
      } else if (shift.status === 'completed') {
        shift.status = 'approved';
        needsSave = true;
      }

      if (needsSave && !isDryRun) {
        await shift.save();
      }
    }
    console.log(`   ${isDryRun ? 'Would backfill' : 'Backfilled'} ${report.shiftsBackfilledTimestamps} shift timestamps and linked ${report.shiftsLinkedEmployment} to Employment records.\n`);

    // -------------------------------------------------------------------------
    // SUMMARY REPORT
    // -------------------------------------------------------------------------
    console.log(`==================== MIGRATION REPORT ====================`);
    console.log(`Status:                      ${isDryRun ? 'COMPLETED (DRY RUN)' : 'COMPLETED SUCCESSFULLY'}`);
    console.log(`Applications modernized:     ${report.applicationsUpdated}`);
    console.log(`Employments created:         ${report.employmentsCreated}`);
    console.log(`Employments skipped (exist): ${report.employmentsSkippedExisting}`);
    console.log(`Jobs capacity synchronized:  ${report.jobsUpdated}`);
    console.log(`Shift timestamps backfilled: ${report.shiftsBackfilledTimestamps}`);
    console.log(`Shifts linked to Employment: ${report.shiftsLinkedEmployment}`);
    if (report.warnings.length > 0) {
      console.log(`\nWarnings (${report.warnings.length}):`);
      report.warnings.forEach(w => console.log(` - ${w}`));
    }
    console.log(`==========================================================\n`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

runMigration();
