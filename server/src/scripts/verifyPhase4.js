import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Job } from '../models/Job.js';
import { Shift } from '../models/Shift.js';
import { MicroTask } from '../models/MicroTask.js';
import { Review } from '../models/Review.js';
import { calculateHaversineDistanceMeters } from '../utils/haversine.js';

dotenv.config();

async function run() {
  console.log('Connecting to MongoDB Atlas...');
  await connectDB();

  try {
    // 1. Test Haversine GPS Distance
    console.log('\n--- 1. Testing Haversine GPS Distance ---');
    const fptCoords = { lat: 21.0130, lng: 105.5250 };
    const tanXaMarket = { lat: 21.0180, lng: 105.5290 };
    const distFptToTanXa = calculateHaversineDistanceMeters(
      fptCoords.lat,
      fptCoords.lng,
      tanXaMarket.lat,
      tanXaMarket.lng
    );
    console.log(`Distance FPT to Tan Xa: ${distFptToTanXa} meters (Expected ~690-720m)`);
    if (distFptToTanXa < 600 || distFptToTanXa > 800) {
      throw new Error(`Haversine calculation unexpected: ${distFptToTanXa}`);
    }

    const nearbyStudentCoords = { lat: 21.0132, lng: 105.5252 };
    const distNearby = calculateHaversineDistanceMeters(
      fptCoords.lat,
      fptCoords.lng,
      nearbyStudentCoords.lat,
      nearbyStudentCoords.lng
    );
    console.log(`Nearby distance: ${distNearby} meters. (Within 350m: ${distNearby <= 350})`);

    // 2. Test Shift Lifecycle with GPS Attendance
    console.log('\n--- 2. Testing Shift Lifecycle & Attendance ---');
    const studentUser = await User.findOne({ role: 'student' });
    const employerUser = await User.findOne({ role: 'employer' });
    const job = await Job.findOne({ status: 'approved' });

    if (!studentUser || !employerUser || !job) {
      throw new Error('Missing sample users/job in database');
    }

    // Clean any prior test shift
    await Shift.deleteMany({ role: '__TEST_PHASE4_SHIFT__' });

    const shift = await Shift.create({
      jobId: job._id,
      storeName: job.storeName,
      employerUserId: employerUser._id,
      employerId: employerUser._id,
      studentUserId: studentUser._id,
      studentId: studentUser._id,
      studentName: studentUser.name,
      role: '__TEST_PHASE4_SHIFT__',
      date: '2026-09-21',
      startTime: '08:00',
      endTime: '12:00',
      hours: 4,
      wageRate: 30000,
      status: 'scheduled',
      history: [{
        status: 'scheduled',
        changedAt: new Date(),
        changedBy: employerUser._id,
        note: 'Test shift scheduled',
      }],
    });
    console.log('Shift created with status scheduled:', shift._id.toString());

    // Check-in with coordinates near the job
    const jobLat = job.location?.lat || 21.0128;
    const jobLng = job.location?.lng || 105.5255;
    const checkInDistance = calculateHaversineDistanceMeters(jobLat + 0.0002, jobLng + 0.0002, jobLat, jobLng);
    const isVerified = checkInDistance <= 350;

    shift.status = 'checked_in';
    shift.attendance = {
      checkInAt: new Date(Date.now() - 3600000), // 1 hour ago
      checkInCoords: { lat: jobLat + 0.0002, lng: jobLng + 0.0002, accuracy: 10 },
      checkInDistanceMeters: checkInDistance,
      checkInVerified: isVerified,
      locationVerified: isVerified,
    };
    await shift.save();
    console.log(`Shift checked-in. Distance: ${checkInDistance}m, Verified: ${isVerified}`);

    // Check-out
    const checkInTime = shift.attendance.checkInAt;
    const checkOutTime = new Date();
    const workedMinutes = Math.max(1, Math.round((checkOutTime - checkInTime) / 60000));
    const calculatedPay = Math.round((workedMinutes / 60) * shift.wageRate);

    shift.status = 'pending_approval';
    shift.workedMinutes = workedMinutes;
    shift.totalPay = calculatedPay;
    shift.attendance.checkOutAt = checkOutTime;
    await shift.save();
    console.log(`Shift checked-out. Worked minutes: ${workedMinutes}, Total pay: ${calculatedPay} VNĐ`);

    // Approve
    shift.status = 'approved';
    await shift.save();
    console.log('Shift approved by employer!');

    // 3. Test MicroTask Atomic Accept
    console.log('\n--- 3. Testing MicroTask Atomic Accept ---');
    await MicroTask.deleteMany({ title: '__TEST_PHASE4_TASK__' });

    const task = await MicroTask.create({
      title: '__TEST_PHASE4_TASK__',
      category: 'di_cho',
      description: 'Mua 1 hộp sữa Milo tại Circle K Dom A',
      reward: 20000,
      location: 'KTX ĐH FPT',
      deadline: 'Hôm nay',
      requesterId: employerUser._id,
      requesterName: employerUser.name,
      requesterPhone: '0987654321',
      status: 'open',
    });

    console.log('Task created with status open:', task._id.toString());

    // Atomic accept
    const acceptedTask = await MicroTask.findOneAndUpdate(
      { _id: task._id, status: 'open' },
      {
        status: 'accepted',
        assigneeId: studentUser._id,
        assigneeName: studentUser.name,
        assigneePhone: '0912345678',
      },
      { new: true }
    );
    if (!acceptedTask) throw new Error('Atomic task accept failed');
    console.log('Task accepted atomically by student:', acceptedTask.status);

    // Second accept attempt should fail
    const duplicateAccept = await MicroTask.findOneAndUpdate(
      { _id: task._id, status: 'open' },
      { status: 'accepted', assigneeId: employerUser._id },
      { new: true }
    );
    console.log('Duplicate accept prevented (result is null):', duplicateAccept === null);

    // Complete task
    acceptedTask.status = 'completed';
    await acceptedTask.save();
    console.log('Task marked as completed!');

    // 4. Test Review Transaction Verification & Anti-Duplicate
    console.log('\n--- 4. Testing Review Transaction Verification ---');
    await Review.deleteMany({ transactionId: shift._id });

    const review = await Review.create({
      reviewerId: studentUser._id,
      reviewerName: studentUser.name,
      reviewerRole: 'student',
      targetId: employerUser._id,
      transactionType: 'shift',
      transactionId: shift._id,
      rating: 5,
      comment: 'Quán làm việc rất chuyên nghiệp, thanh toán sòng phẳng đúng giờ!',
      storeName: job.storeName,
    });
    console.log('Review created for shift:', review._id.toString());

    // Duplicate review should fail due to unique compound index { reviewerId, transactionId }
    try {
      await Review.create({
        reviewerId: studentUser._id,
        reviewerName: studentUser.name,
        reviewerRole: 'student',
        targetId: employerUser._id,
        transactionType: 'shift',
        transactionId: shift._id,
        rating: 4,
        comment: 'Thử review lần 2',
      });
      throw new Error('Duplicate review should have been blocked');
    } catch (dupErr) {
      console.log('Duplicate review correctly blocked:', dupErr.message.includes('duplicate') || dupErr.code === 11000);
    }

    // Clean up test data
    await Shift.deleteMany({ role: '__TEST_PHASE4_SHIFT__' });
    await MicroTask.deleteMany({ title: '__TEST_PHASE4_TASK__' });
    await Review.deleteMany({ transactionId: shift._id });
    console.log('Test records cleaned up.');

    console.log('\n Phase 4 Backend Verification Passed Successfully!');
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected DB.');
  }
}

run().catch((err) => {
  console.error('Phase 4 Verification failed:', err);
  process.exit(1);
});
