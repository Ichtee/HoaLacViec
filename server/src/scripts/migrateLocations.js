/**
 * Safe Idempotent Migration Script for Geolocation & GeoJSON Point Data
 * - Synchronizes geoPoint [lng, lat] with 2dsphere index for Job, EmployerProfile, and StudentProfile
 * - Marks existing data with legacy default coordinates as 'legacy_unverified'
 * - Default is --dry-run; only writes to DB when --apply is passed
 * - Verifies geoPoint.coordinates[0] === location.lng && geoPoint.coordinates[1] === location.lat
 * - 100% Idempotent: running a second time on migrated DB produces updated: 0
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Job } from '../models/Job.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { isValidCoordinate } from '../utils/geoHelper.js';
import { normalizeAddressComponents, LOCATION_STATUSES } from '../utils/locationContract.js';

dotenv.config();

export async function runLocationMigration(options = {}) {
  const isApply = Boolean(options.apply || process.argv.includes('--apply'));
  const isDryRun = !isApply;

  console.log(`[Migration] Starting location data normalization... (Mode: ${isDryRun ? 'DRY-RUN (read-only)' : 'APPLY (writing changes)'})`);

  const isOldDefaultCoord = (lat, lng) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return true;
    const isHoaLac = Math.abs(lat - 21.0128) < 0.0001 && Math.abs(lng - 105.5255) < 0.0001;
    const isTanXa = Math.abs(lat - 21.0175) < 0.0001 && Math.abs(lng - 105.5220) < 0.0001;
    const isFpt = Math.abs(lat - 21.0134) < 0.0001 && Math.abs(lng - 105.5263) < 0.0001;
    return isHoaLac || isTanXa || isFpt;
  };

  const stats = {
    jobs: { total: 0, updated: 0, geoPointAdded: 0, unconfirmed: 0, legacyUnverified: 0, verifiedValid: 0 },
    employers: { total: 0, updated: 0, geoPointAdded: 0, unconfirmed: 0, legacyUnverified: 0, verifiedValid: 0 },
    students: { total: 0, updated: 0, geoPointAdded: 0, unconfirmed: 0, legacyUnverified: 0, verifiedValid: 0 },
    mismatches: 0,
  };

  // 1. Migrate Jobs
  const jobs = await Job.find({});
  stats.jobs.total = jobs.length;
  for (const job of jobs) {
    let changed = false;
    const lat = job.location?.lat;
    const lng = job.location?.lng;

    if (!isValidCoordinate(lat, lng)) {
      // Record has missing/invalid coordinates -> clean and set to unconfirmed
      if (
        job.location?.lat !== null ||
        job.location?.lng !== null ||
        job.geoPoint !== undefined ||
        job.locationStatus !== LOCATION_STATUSES.UNCONFIRMED ||
        job.locationSource !== null
      ) {
        job.location = { lat: null, lng: null };
        job.geoPoint = undefined;
        job.locationStatus = LOCATION_STATUSES.UNCONFIRMED;
        job.locationSource = null;
        job.locationConfirmedAt = null;
        stats.jobs.unconfirmed++;
        changed = true;
      }
    } else {
      // Record has valid coordinates -> ensure geoPoint is [lng, lat]
      const nLat = Number(Number(lat).toFixed(6));
      const nLng = Number(Number(lng).toFixed(6));

      if (
        !job.locationStatus ||
        job.locationStatus === LOCATION_STATUSES.UNCONFIRMED ||
        job.locationStatus === 'draft'
      ) {
        const nextStatus = isOldDefaultCoord(nLat, nLng)
          ? LOCATION_STATUSES.LEGACY_UNVERIFIED
          : LOCATION_STATUSES.CONFIRMED;
        job.locationStatus = nextStatus;
        if (nextStatus === LOCATION_STATUSES.LEGACY_UNVERIFIED) {
          stats.jobs.legacyUnverified++;
        }
        changed = true;
      }

      const hasExactGeoPoint =
        job.geoPoint &&
        job.geoPoint.type === 'Point' &&
        Array.isArray(job.geoPoint.coordinates) &&
        job.geoPoint.coordinates.length === 2 &&
        job.geoPoint.coordinates[0] === nLng &&
        job.geoPoint.coordinates[1] === nLat;

      if (!hasExactGeoPoint) {
        job.location = { lat: nLat, lng: nLng };
        job.geoPoint = {
          type: 'Point',
          coordinates: [nLng, nLat],
        };
        stats.jobs.geoPointAdded++;
        changed = true;
      }
    }

    // Ensure addressComponents structure exists
    if (!job.addressComponents || !job.addressComponents.addressLine !== undefined) {
      job.addressComponents = normalizeAddressComponents(job.addressComponents || { addressLine: job.address });
      job.provinceCode = job.addressComponents.provinceCode || null;
      job.districtCode = job.addressComponents.districtCode || null;
      job.wardCode = job.addressComponents.wardCode || null;
    }

    // Verify coordinate sync
    if (job.geoPoint?.coordinates) {
      if (job.geoPoint.coordinates[0] === job.location.lng && job.geoPoint.coordinates[1] === job.location.lat) {
        stats.jobs.verifiedValid++;
      } else {
        stats.mismatches++;
        console.error(`[Mismatch] Job ${job._id}: geoPoint [${job.geoPoint.coordinates}] vs location [${job.location.lat}, ${job.location.lng}]`);
      }
    }

    if (changed) {
      stats.jobs.updated++;
      if (isApply) {
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
      if (
        emp.location?.lat !== null ||
        emp.location?.lng !== null ||
        emp.geoPoint !== undefined ||
        emp.locationStatus !== LOCATION_STATUSES.UNCONFIRMED ||
        emp.locationSource !== null
      ) {
        emp.location = { lat: null, lng: null };
        emp.geoPoint = undefined;
        emp.locationStatus = LOCATION_STATUSES.UNCONFIRMED;
        emp.locationSource = null;
        emp.locationConfirmedAt = null;
        stats.employers.unconfirmed++;
        changed = true;
      }
    } else {
      const nLat = Number(Number(lat).toFixed(6));
      const nLng = Number(Number(lng).toFixed(6));

      if (!emp.locationStatus || emp.locationStatus === LOCATION_STATUSES.UNCONFIRMED) {
        emp.locationStatus = LOCATION_STATUSES.LEGACY_UNVERIFIED;
        stats.employers.legacyUnverified++;
        changed = true;
      }

      const hasExactGeoPoint =
        emp.geoPoint &&
        emp.geoPoint.type === 'Point' &&
        Array.isArray(emp.geoPoint.coordinates) &&
        emp.geoPoint.coordinates.length === 2 &&
        emp.geoPoint.coordinates[0] === nLng &&
        emp.geoPoint.coordinates[1] === nLat;

      if (!hasExactGeoPoint) {
        emp.location = { lat: nLat, lng: nLng };
        emp.geoPoint = {
          type: 'Point',
          coordinates: [nLng, nLat],
        };
        stats.employers.geoPointAdded++;
        changed = true;
      }
    }

    if (!emp.checkinRadius || emp.checkinRadius < 50 || emp.checkinRadius > 500) {
      emp.checkinRadius = 150;
      changed = true;
    }

    if (!emp.addressComponents) {
      emp.addressComponents = normalizeAddressComponents(emp.addressComponents || { addressLine: emp.address });
      emp.provinceCode = emp.addressComponents.provinceCode || null;
      emp.districtCode = emp.addressComponents.districtCode || null;
      emp.wardCode = emp.addressComponents.wardCode || null;
    }

    if (emp.geoPoint?.coordinates) {
      if (emp.geoPoint.coordinates[0] === emp.location.lng && emp.geoPoint.coordinates[1] === emp.location.lat) {
        stats.employers.verifiedValid++;
      } else {
        stats.mismatches++;
        console.error(`[Mismatch] Employer ${emp._id}: geoPoint [${emp.geoPoint.coordinates}] vs location [${emp.location.lat}, ${emp.location.lng}]`);
      }
    }

    if (changed) {
      stats.employers.updated++;
      if (isApply) {
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
      if (
        stu.location?.lat !== null ||
        stu.location?.lng !== null ||
        stu.geoPoint !== undefined ||
        stu.locationStatus !== LOCATION_STATUSES.UNCONFIRMED ||
        stu.locationSource !== null
      ) {
        stu.location = { lat: null, lng: null };
        stu.geoPoint = undefined;
        stu.locationStatus = LOCATION_STATUSES.UNCONFIRMED;
        stu.locationSource = null;
        stu.locationConfirmedAt = null;
        stats.students.unconfirmed++;
        changed = true;
      }
    } else {
      const nLat = Number(Number(lat).toFixed(6));
      const nLng = Number(Number(lng).toFixed(6));

      if (!stu.locationStatus || stu.locationStatus === LOCATION_STATUSES.UNCONFIRMED) {
        stu.locationStatus = LOCATION_STATUSES.LEGACY_UNVERIFIED;
        stats.students.legacyUnverified++;
        changed = true;
      }

      const hasExactGeoPoint =
        stu.geoPoint &&
        stu.geoPoint.type === 'Point' &&
        Array.isArray(stu.geoPoint.coordinates) &&
        stu.geoPoint.coordinates.length === 2 &&
        stu.geoPoint.coordinates[0] === nLng &&
        stu.geoPoint.coordinates[1] === nLat;

      if (!hasExactGeoPoint) {
        stu.location = { lat: nLat, lng: nLng };
        stu.geoPoint = {
          type: 'Point',
          coordinates: [nLng, nLat],
        };
        stats.students.geoPointAdded++;
        changed = true;
      }
    }

    if (!stu.addressComponents) {
      stu.addressComponents = normalizeAddressComponents(stu.addressComponents || { addressLine: stu.address });
      stu.provinceCode = stu.addressComponents.provinceCode || null;
      stu.districtCode = stu.addressComponents.districtCode || null;
      stu.wardCode = stu.addressComponents.wardCode || null;
    }

    if (stu.geoPoint?.coordinates) {
      if (stu.geoPoint.coordinates[0] === stu.location.lng && stu.geoPoint.coordinates[1] === stu.location.lat) {
        stats.students.verifiedValid++;
      } else {
        stats.mismatches++;
        console.error(`[Mismatch] Student ${stu._id}: geoPoint [${stu.geoPoint.coordinates}] vs location [${stu.location.lat}, ${stu.location.lng}]`);
      }
    }

    if (changed) {
      stats.students.updated++;
      if (isApply) {
        await stu.save();
      }
    }
  }

  console.log('----------------------------------------------------');
  console.log(`[Migration] Results (Mode: ${isDryRun ? 'DRY-RUN' : 'APPLIED'}):`);
  console.log(`- Jobs: ${stats.jobs.updated}/${stats.jobs.total} changes detected (Verified Valid: ${stats.jobs.verifiedValid})`);
  console.log(`- EmployerProfiles: ${stats.employers.updated}/${stats.employers.total} changes detected (Verified Valid: ${stats.employers.verifiedValid})`);
  console.log(`- StudentProfiles: ${stats.students.updated}/${stats.students.total} changes detected (Verified Valid: ${stats.students.verifiedValid})`);
  console.log(`- Coordinate Mismatches: ${stats.mismatches}`);
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
