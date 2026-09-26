/**
 * Idempotent Data Migration for Vietmap Location Contract
 *
 * Safe & Non-destructive:
 * - Does NOT delete legacy districtCode or districtName.
 * - Sets default geocodingProvider ('vietmap' / 'manual') without touching existing confirmed data.
 * - Synchronizes formattedAddress with address text.
 * - Ensures geoPoint [lng, lat] is synchronized with location { lat, lng } for 2dsphere queries.
 * - Migrates MicroTask single-point and route (pickup/destination) representations safely.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Job } from '../models/Job.js';
import { MicroTask } from '../models/MicroTask.js';
import { isValidCoordinate } from '../utils/coordinateHelper.js';

dotenv.config();

export async function runLocationMigration() {
  console.log('[Migration] Starting Vietmap Location Contract migration...');

  // 1. Migrate Jobs
  const jobs = await Job.find({}).lean();
  let jobsUpdated = 0;

  for (const job of jobs) {
    const updates = {};

    // formattedAddress
    if (!job.formattedAddress && job.address) {
      updates.formattedAddress = job.address.trim();
    }

    // geocodingProvider
    if (!job.geocodingProvider) {
      if (job.locationSource === 'geocoded') {
        updates.geocodingProvider = 'vietmap';
      } else if (['map_pin', 'device', 'manual_coordinates'].includes(job.locationSource)) {
        updates.geocodingProvider = 'manual';
      }
    }

    // Ensure geoPoint [lng, lat] sync with location { lat, lng }
    const lat = job.location?.lat;
    const lng = job.location?.lng;
    if (isValidCoordinate(lat, lng)) {
      if (
        !job.geoPoint ||
        !Array.isArray(job.geoPoint.coordinates) ||
        job.geoPoint.coordinates[0] !== lng ||
        job.geoPoint.coordinates[1] !== lat
      ) {
        updates.geoPoint = {
          type: 'Point',
          coordinates: [lng, lat],
        };
      }
    }

    if (Object.keys(updates).length > 0) {
      await Job.updateOne({ _id: job._id }, { $set: updates });
      jobsUpdated++;
    }
  }

  console.log(`[Migration] Jobs processed: ${jobs.length}, updated: ${jobsUpdated}`);

  // 2. Migrate MicroTasks
  const tasks = await MicroTask.find({}).lean();
  let tasksUpdated = 0;

  for (const task of tasks) {
    const updates = {};

    if (!task.locationAddress && task.location) {
      updates.locationAddress = task.location.trim();
    }

    if (task.pickupAddress && (!task.pickup || !task.pickup.address)) {
      updates.pickup = {
        address: task.pickupAddress.trim(),
        lat: task.pickup?.lat ?? null,
        lng: task.pickup?.lng ?? null,
        refId: task.pickup?.refId ?? null,
        status: task.pickup?.status || 'unconfirmed',
      };
    }

    if (task.destinationAddress && (!task.destination || !task.destination.address)) {
      updates.destination = {
        address: task.destinationAddress.trim(),
        lat: task.destination?.lat ?? null,
        lng: task.destination?.lng ?? null,
        refId: task.destination?.refId ?? null,
        status: task.destination?.status || 'unconfirmed',
      };
    }

    if (Object.keys(updates).length > 0) {
      await MicroTask.updateOne({ _id: task._id }, { $set: updates });
      tasksUpdated++;
    }
  }

  console.log(`[Migration] MicroTasks processed: ${tasks.length}, updated: ${tasksUpdated}`);
  console.log('[Migration] Vietmap Location Contract migration finished successfully.');

  return { jobsUpdated, tasksUpdated };
}

// Execute directly if run via CLI
if (process.argv[1]?.endsWith('migrateLocationVietmap.js')) {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/hoalacviec';
  mongoose
    .connect(mongoUri)
    .then(() => runLocationMigration())
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[MigrationError]', err);
      process.exit(1);
    });
}
