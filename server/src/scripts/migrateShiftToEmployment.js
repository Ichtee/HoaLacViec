/**
 * Idempotent Migration: Backfill employmentId and standardized employee fields on Shift records
 *
 * Usage: node server/src/scripts/migrateShiftToEmployment.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { Shift } from '../models/Shift.js';
import { Employment } from '../models/Employment.js';
import { EmployerProfile } from '../models/EmployerProfile.js';

export async function migrateShiftsToEmployment() {
  const shifts = await Shift.find({}).lean();
  let updatedCount = 0;
  let skippedCount = 0;
  let unresolvedCount = 0;

  for (const s of shifts) {
    let needsUpdate = false;
    const updateDoc = {};

    const targetEmpUserId = s.employeeUserId || s.studentUserId || s.studentId;
    if (!s.employeeUserId && targetEmpUserId) {
      updateDoc.employeeUserId = targetEmpUserId;
      needsUpdate = true;
    }
    if (!s.employeeName && s.studentName) {
      updateDoc.employeeName = s.studentName;
      needsUpdate = true;
    }
    if (!s.workplaceName && s.storeName) {
      updateDoc.workplaceName = s.storeName;
      needsUpdate = true;
    }
    if (!s.positionTitle && s.role) {
      updateDoc.positionTitle = s.role;
      needsUpdate = true;
    }

    if (!s.employmentId && targetEmpUserId && s.employerUserId) {
      // Try resolving with jobId first if available
      let employment = null;
      if (s.jobId) {
        employment = await Employment.findOne({
          employerUserId: s.employerUserId,
          employeeUserId: targetEmpUserId,
          jobId: s.jobId,
        });
      }
      if (!employment) {
        employment = await Employment.findOne({
          employerUserId: s.employerUserId,
          employeeUserId: targetEmpUserId,
          status: 'active',
        });
      }
      if (!employment) {
        employment = await Employment.findOne({
          employerUserId: s.employerUserId,
          employeeUserId: targetEmpUserId,
        });
      }

      if (employment) {
        updateDoc.employmentId = employment._id;
        if (!s.workplaceName && employment.workplace) {
          updateDoc.workplaceName = employment.workplace;
          updateDoc.storeName = employment.workplace;
        }
        if (!s.positionTitle && employment.positionTitle) {
          updateDoc.positionTitle = employment.positionTitle;
          updateDoc.role = employment.positionTitle;
        }
        needsUpdate = true;
      } else {
        unresolvedCount++;
      }
    }

    if (needsUpdate) {
      await Shift.findByIdAndUpdate(s._id, { $set: updateDoc });
      updatedCount++;
    } else {
      skippedCount++;
    }
  }

  return {
    total: shifts.length,
    updated: updatedCount,
    skipped: skippedCount,
    unresolvedEmployments: unresolvedCount,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hoalacviec';
  mongoose.connect(mongoUri)
    .then(async () => {
      console.log('🔄 Running migration: migrateShiftsToEmployment...');
      const result = await migrateShiftsToEmployment();
      console.log('✅ Migration completed:', result);
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}
