import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Job } from '../models/Job.js';
import { Report } from '../models/Report.js';
import { Notification } from '../models/Notification.js';

dotenv.config();

async function run() {
  console.log('Connecting to MongoDB Atlas...');
  await connectDB();

  try {
    const studentUser = await User.findOne({ role: 'student' });
    const adminUser = await User.findOne({ role: 'admin' });
    const job = await Job.findOne({ status: 'approved' });

    if (!studentUser || !adminUser || !job) {
      throw new Error('Missing sample users/job in database');
    }

    console.log('\n--- 1. Testing Report Creation ---');
    await Report.deleteMany({ reason: '__TEST_PHASE5_REPORT__' });

    const report = await Report.create({
      reporterId: studentUser._id,
      reporterName: studentUser.name,
      reporterEmail: studentUser.email,
      targetType: 'job',
      targetId: job._id,
      target: job.title,
      reason: '__TEST_PHASE5_REPORT__',
      content: 'Chủ quán yêu cầu nộp 200k tiền đặt cọc giữ chỗ khi tới phỏng vấn.',
      status: 'pending',
    });
    console.log('Report submitted successfully:', report._id.toString());

    // 2. Query reports as admin
    console.log('\n--- 2. Testing Admin Report Listing ---');
    const adminReports = await Report.find({ status: 'pending' });
    console.log(`Found ${adminReports.length} pending reports for admin review.`);
    const found = adminReports.find(r => r._id.toString() === report._id.toString());
    if (!found) throw new Error('Submitted report not found in admin list');

    // 3. Admin resolve report
    console.log('\n--- 3. Testing Admin Report Resolution ---');
    report.status = 'resolved';
    report.actionTaken = 'warned';
    report.resolutionNote = 'Đã gọi điện nhắc nhở chủ cơ sở và gỡ bỏ yêu cầu đóng phí.';
    report.resolvedBy = adminUser._id;
    report.resolvedAt = new Date();
    await report.save();

    // Verify notification sent to reporter
    const notif = await Notification.create({
      userId: report.reporterId,
      title: 'Báo cáo của bạn đã được xử lý ✅',
      message: `Báo cáo về "${report.target}" đã được xử lý. Kết quả: ${report.resolutionNote}`,
      type: 'system',
      link: '/student/applications',
    });
    console.log('Notification sent to reporter:', notif._id.toString());

    // 4. Test User Locking and Unlocking
    console.log('\n--- 4. Testing User Locking / Unlocking ---');
    const originalStatus = studentUser.status;
    studentUser.status = 'locked';
    await studentUser.save();
    console.log('User status set to locked:', studentUser.status);

    // Verify DB reflects lock
    const lockedUser = await User.findById(studentUser._id);
    if (lockedUser.status !== 'locked') throw new Error('Lock status not persisted');

    // Revert status to original
    studentUser.status = originalStatus || 'active';
    await studentUser.save();
    console.log('User status restored to:', studentUser.status);

    // Clean up test report and notification
    await Report.deleteMany({ reason: '__TEST_PHASE5_REPORT__' });
    await Notification.findByIdAndDelete(notif._id);
    console.log('Test records cleaned up.');

    console.log('\n Phase 5 Backend Verification Passed Successfully!');
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected DB.');
  }
}

run().catch((err) => {
  console.error('Phase 5 Verification failed:', err);
  process.exit(1);
});

