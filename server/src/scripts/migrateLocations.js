/**
 * Safe Idempotent Migration Script for Geolocation & GeoJSON Point Data
 * - Synchronizes geoPoint [lng, lat] with 2dsphere index for Job, EmployerProfile, and StudentProfile
 * - Marks existing data with legacy default coordinates as 'legacy_unverified'
 * - Does NOT delete any data
 * - Supports dry run mode with flag: `node src/scripts/migrateLocations.js --dry-run`
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Job } from '../models/Job.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { isValidCoordinate } from '../utils/geoHelper.js';

dotenv.config();

export async function runLocationMigration(options = {}) {
  const isDryRun = options.dryRun || process.argv.includes('--dry-run');
  console.log(`[Migration] Starting location data normalization... (Dry Run: ${isDryRun ? 'YES' : 'NO'})`);

  const isOldDefaultCoord = (lat, lng) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return true;
    const isHoaLac = Math.abs(lat - 21.0128) < 0.0001 && Math.abs(lng - 105.5255) < 0.0001;
    const isTanXa = Math.abs(lat - 21.0175) < 0.0001 && Math.abs(lng - 105.5220) < 0.0001;
    const isFpt = Math.abs(lat - 21.0134) < 0.0001 && Math.abs(lng - 105.5263) < 0.0001;
    return isHoaLac || isTanXa || isFpt;
  };

  const stats = {
    jobs: { total: 0, updated: 0, geoPointAdded: 0, unconfirmed: 0, legacyUnverified: 0 },
    employers: { total: 0, updated: 0, geoPointAdded: 0, unconfirmed: 0, legacyUnverified: 0 },
    students: { total: 0, updated: 0, geoPointAdded: 0, unconfirmed: 0, legacyUnverified: 0 },
  };

  // 1. Migrate Jobs
  const jobs = await Job.find({});
  stats.jobs.total = jobs.length;
  for (const job of jobs) {
    let changed = false;
    const lat = job.location?.lat;
    const lng = job.location?.lng;

    if (!isValidCoordinate(lat, lng)) {
      job.location = { lat: null, lng: null };
      job.geoPoint = undefined;
      job.locationStatus = 'unconfirmed';
      job.locationSource = null;
      stats.jobs.unconfirmed++;
      changed = true;
    } else {
      if (!job.locationStatus || job.locationStatus === 'unconfirmed') {
        job.locationStatus = isOldDefaultCoord(lat, lng) ? 'legacy_unverified' : 'confirmed';
        if (job.locationStatus === 'legacy_unverified') stats.jobs.legacyUnverified++;
        changed = true;
      }
      if (!job.geoPoint || !job.geoPoint.coordinates || job.geoPoint.coordinates.length !== 2) {
        job.geoPoint = {
          type: 'Point',
          coordinates: [lng, lat],
        };
        stats.jobs.geoPointAdded++;
        changed = true;
      }
    }

    if (changed) {
      stats.jobs.updated++;
      if (!isDryRun) {
        await job.save();
      }
    }
  }

  // 2. Migrate EmployerProfiles
  const employers = await EmployerProfile.find({});
  stats.employers.total = employers.length;
  for (const emp of employers) {
    let changed = false;
    const lat = emp.location?.lat;
    const lng = emp.location?.lng;

    if (!isValidCoordinate(lat, lng)) {
      emp.location = { lat: null, lng: null };
      emp.geoPoint = undefined;
      emp.locationStatus = 'unconfirmed';
      emp.locationSource = null;
      stats.employers.unconfirmed++;
      changed = true;
    } else {
      if (!emp.locationStatus || emp.locationStatus === 'unconfirmed') {
        emp.locationStatus = 'legacy_unverified';
        stats.employers.legacyUnverified++;
        changed = true;
      }
      if (!emp.geoPoint || !emp.geoPoint.coordinates || emp.geoPoint.coordinates.length !== 2) {
        emp.geoPoint = {
          type: 'Point',
          coordinates: [lng, lat],
        };
        stats.employers.geoPointAdded++;
        changed = true;
      }
    }

    if (!emp.checkinRadius || emp.checkinRadius < 50 || emp.checkinRadius > 500) {
      emp.checkinRadius = 150;
      changed = true;
    }

    if (changed) {
      stats.employers.updated++;
      if (!isDryRun) {
        await emp.save();
      }
    }
  }

  // 3. Migrate StudentProfiles
  const students = await StudentProfile.find({});
  stats.students.total = students.length;
  for (const stu of students) {
    let changed = false;
    const lat = stu.location?.lat;
    const lng = stu.location?.lng;

    if (!isValidCoordinate(lat, lng)) {
      stu.location = { lat: null, lng: null };
      stu.geoPoint = undefined;
      stu.locationStatus = 'unconfirmed';
      stu.locationSource = null;
      stats.students.unconfirmed++;
      changed = true;
    } else {
      if (!stu.locationStatus || stu.locationStatus === 'unconfirmed') {
        stu.locationStatus = 'legacy_unverified';
        stats.students.legacyUnverified++;
        changed = true;
      }
      if (!stu.geoPoint || !stu.geoPoint.coordinates || stu.geoPoint.coordinates.length !== 2) {
        stu.geoPoint = {
          type: 'Point',
          coordinates: [lng, lat],
        };
        stats.students.geoPointAdded++;
        changed = true;
      }
    }

    if (changed) {
      stats.students.updated++;
      if (!isDryRun) {
        await stu.save();
      }
    }
  }

  console.log('----------------------------------------------------');
  console.log(`[Migration] Results (Dry Run: ${isDryRun ? 'YES' : 'NO'}):`);
  console.log(`- Jobs: ${stats.jobs.updated}/${stats.jobs.total} updated (GeoPoint: +${stats.jobs.geoPointAdded}, Unconfirmed: ${stats.jobs.unconfirmed}, Legacy: ${stats.jobs.legacyUnverified})`);
  console.log(`- EmployerProfiles: ${stats.employers.updated}/${stats.employers.total} updated (GeoPoint: +${stats.employers.geoPointAdded}, Unconfirmed: ${stats.employers.unconfirmed}, Legacy: ${stats.employers.legacyUnverified})`);
  console.log(`- StudentProfiles: ${stats.students.updated}/${stats.students.total} updated (GeoPoint: +${stats.students.geoPointAdded}, Unconfirmed: ${stats.students.unconfirmed}, Legacy: ${stats.students.legacyUnverified})`);
  console.log('----------------------------------------------------');
  return stats;
}

if (process.argv[1] && process.argv[1].endsWith('migrateLocations.js')) {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hoalacviec';
  mongoose.connect(uri)
    .then(() => runLocationMigration())
    .then(() => mongoose.disconnect())
    .catch((err) => {
      console.error('[Migration Error]', err);
      process.exit(1);
    });
}
