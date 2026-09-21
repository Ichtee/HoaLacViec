import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Job } from '../models/Job.js';
import { Application } from '../models/Application.js';
import { SavedJob } from '../models/SavedJob.js';
import { Notification } from '../models/Notification.js';

import { connectDB } from '../config/db.js';

dotenv.config();

async function run() {
  console.log('Connecting to MongoDB Atlas...');
  await connectDB();

  try {
    const studentUser = await User.findOne({ role: 'student' });
    const employerUser = await User.findOne({ role: 'employer' });
    const job = await Job.findOne({ status: 'approved' });

    if (!studentUser || !employerUser || !job) {
      throw new Error('Missing sample student, employer, or job in DB');
    }

    console.log(`Testing with Student: ${studentUser.email}, Employer: ${employerUser.email}, Job: "${job.title}"`);

    // 1. Test SavedJob
    console.log('\n--- 1. Testing SavedJob ---');
    const saved = await SavedJob.findOneAndUpdate(
      { userId: studentUser._id, jobId: job._id },
      { userId: studentUser._id, jobId: job._id },
      { upsert: true, new: true }
    );
    console.log('Saved job created/upserted:', saved._id.toString());

    const savedList = await SavedJob.find({ userId: studentUser._id }).populate('jobId');
    console.log(`Student has ${savedList.length} saved jobs.`);
    const foundJob = savedList.find(s => s.jobId?._id.toString() === job._id.toString());
    if (!foundJob) throw new Error('Saved job population failed');
    console.log('Populated saved job title:', foundJob.jobId.title);

    // 2. Test Notification
    console.log('\n--- 2. Testing Notification ---');
    const notif = await Notification.create({
      userId: studentUser._id,
      title: 'Kiểm tra thông báo Phase 3',
      message: 'Hệ thống thông báo thời gian thực hoạt động hoàn hảo.',
      type: 'system',
      link: '/student/applications',
    });
    console.log('Notification created:', notif._id.toString());

    const unreadCount = await Notification.countDocuments({ userId: studentUser._id, read: false });
    console.log(`Unread notifications for student: ${unreadCount}`);

    await Notification.findByIdAndUpdate(notif._id, { read: true, readAt: new Date() });
    const updatedNotif = await Notification.findById(notif._id);
    console.log('Notification read status updated:', updatedNotif.read);

    // Clean up test notification
    await Notification.findByIdAndDelete(notif._id);
    console.log('Test notification cleaned up.');

    // 3. Test Application pipeline & statusHistory
    console.log('\n--- 3. Testing Application Lifecycle & Pipeline ---');
    let testApp = await Application.findOne({ studentId: studentUser._id, jobId: job._id });
    if (!testApp) {
      testApp = await Application.create({
        studentId: studentUser._id,
        employerId: employerUser._id,
        jobId: job._id,
        studentName: studentUser.name,
        studentEmail: studentUser.email,
        jobTitle: job.title,
        storeName: job.storeName,
        status: 'pending',
        coverLetter: 'Em ứng tuyển ca sáng thứ 2, 4, 6 ạ.',
        statusHistory: [{
          status: 'pending',
          changedAt: new Date(),
          changedBy: studentUser._id,
          note: 'Nộp hồ sơ ứng tuyển',
        }],
      });
      console.log('Created test application:', testApp._id.toString());
    } else {
      console.log('Found existing application:', testApp._id.toString());
    }

    // Transition to 'interview'
    testApp.status = 'interview';
    testApp.candidateFeedback = 'Mời em phỏng vấn vào 9h sáng Thứ 2 tại quán.';
    testApp.internalNote = 'Ứng viên nhanh nhẹn, tiếng Anh tốt.';
    testApp.statusHistory.push({
      status: 'interview',
      changedAt: new Date(),
      changedBy: employerUser._id,
      note: testApp.candidateFeedback,
    });
    await testApp.save();

    const verifiedApp = await Application.findById(testApp._id);
    console.log('Application updated status:', verifiedApp.status);
    console.log('Status history count:', verifiedApp.statusHistory.length);
    console.log('Latest history note:', verifiedApp.statusHistory[verifiedApp.statusHistory.length - 1].note);

    console.log('\n Phase 3 Backend Verification Passed Successfully!');
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected DB.');
  }
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
