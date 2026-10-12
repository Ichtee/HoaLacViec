import { Job } from '../models/Job.js';
import { geocodeAddress } from './geocodingService.js';
import { calculateHaversineDistanceMeters, isValidCoordinate } from '../utils/geoHelper.js';

const HOALAC_CENTER = { lat: 21.0128, lng: 105.5255 };
const MAX_DISTANCE_FROM_HOALAC_M = 15000;
const MAX_PER_CALL = 3; // keeps geocoder usage low; the next list request picks up the rest

const attempted = new Set(); // job ids tried in this process, so a failing address is not retried on every request
const hasPoint = (p) => Boolean(p) && isValidCoordinate(p.lat, p.lng);

/**
 * Lets pins appear for listings the owner never pinned: geocodes the address once and stores approxLocation
 * (display and distance only; attendance and directions still need the confirmed location). Mutates the given jobs.
 */
export async function ensureApproxLocations(jobs, geocode = geocodeAddress) {
  const todo = jobs
    .filter((j) => !hasPoint(j.location) && !hasPoint(j.approxLocation) && j.address?.trim() && !attempted.has(String(j._id)))
    .slice(0, MAX_PER_CALL);
  for (const job of todo) {
    attempted.add(String(job._id));
    try {
      const r = await geocode(job.address);
      if (!r?.success || !isValidCoordinate(r.lat, r.lng)) continue;
      if (calculateHaversineDistanceMeters(r.lat, r.lng, HOALAC_CENTER.lat, HOALAC_CENTER.lng) > MAX_DISTANCE_FROM_HOALAC_M) continue;
      const approxLocation = { lat: Number(Number(r.lat).toFixed(6)), lng: Number(Number(r.lng).toFixed(6)), source: 'geocoded', query: job.address, geocodedAt: new Date() };
      await Job.updateOne({ _id: job._id }, { $set: { approxLocation } });
      job.approxLocation = approxLocation;
    } catch (err) {
      console.warn('[approx-location] failed:', err.message);
    }
  }
  return todo.length;
}
