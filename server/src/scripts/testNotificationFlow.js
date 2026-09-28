import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { User } from '../models/User.js';
import { Notification } from '../models/Notification.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function run() {
  console.log('Connecting to MongoDB Atlas...');
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(uri);
  console.log('MongoDB Connected successfully.\n');

  try {
    // 1. Find a sample student and employer user
    const studentUser = await User.findOne({ role: 'student' }).lean();
    const employerUser = await User.findOne({ role: 'employer' }).lean();

    if (!studentUser || !employerUser) {
      console.log('Warning: Need at least 1 student and 1 employer user to run test.');
      return;
    }

    console.log(`Testing with Student: ${studentUser.name} (${studentUser.email}) [_id: ${studentUser._id}]`);
    console.log(`Testing with Employer: ${employerUser.name} (${employerUser.email}) [_id: ${employerUser._id}]\n`);

    // Clean up any existing test notifications for these users
    await Notification.deleteMany({ title: /\[TEST\]/ });

    // Initial unread count
    const initialStudentUnread = await Notification.countDocuments({ userId: studentUser._id, read: false });
    const initialEmployerUnread = await Notification.countDocuments({ userId: employerUser._id, read: false });

    console.log(`Initial unread count -> Student: ${initialStudentUnread}, Employer: ${initialEmployerUnread}`);

    // TEST 1: Dispatch Job Application Notification to Employer
    const empNotif = await Notification.create({
      userId: employerUser._id,
      title: '[TEST] Ứng viên mới nộp đơn! 🎉',
      message: `${studentUser.name} vừa nộp đơn ứng tuyển vị trí Nhân viên phục vụ.`,
      type: 'application',
      link: '/employer/applications',
    });
    console.log(`[PASS] Created notification for Employer: ${empNotif._id} (read: ${empNotif.read})`);

    // TEST 2: Dispatch Application Status Update Notification to Student
    const stuNotif1 = await Notification.create({
      userId: studentUser._id,
      title: '[TEST] Chúc mừng! Bạn đã trúng tuyển 🎉',
      message: 'Cửa hàng đã tiếp nhận bạn vào làm việc.',
      type: 'application',
      link: '/student/applications',
    });
    console.log(`[PASS] Created status update notification for Student: ${stuNotif1._id}`);

    // TEST 3: Dispatch Shift Notification to Student
    const stuNotif2 = await Notification.create({
      userId: studentUser._id,
      title: '[TEST] Bạn có lịch phân ca mới! 📅',
      message: 'Quán đã xếp bạn vào ca làm ngày mai 08:00 - 12:00.',
      type: 'shift',
      link: '/student/shifts',
    });
    console.log(`[PASS] Created shift notification for Student: ${stuNotif2._id}`);

    // TEST 4: Dispatch Verification Notification
    const stuNotif3 = await Notification.create({
      userId: studentUser._id,
      title: '[TEST] Xác thực thẻ sinh viên thành công! 🎉',
      message: 'Hồ sơ thẻ sinh viên của bạn đã được quản trị viên phê duyệt.',
      type: 'verification',
      link: '/student/profile',
    });
    console.log(`[PASS] Created verification notification for Student: ${stuNotif3._id}`);

    // TEST 5: Verify Unread Count increments
    const newStudentUnread = await Notification.countDocuments({ userId: studentUser._id, read: false });
    const newEmployerUnread = await Notification.countDocuments({ userId: employerUser._id, read: false });
    console.log(`\nUpdated unread count -> Student: ${newStudentUnread} (+3), Employer: ${newEmployerUnread} (+1)`);

    if (newStudentUnread !== initialStudentUnread + 3 || newEmployerUnread !== initialEmployerUnread + 1) {
      throw new Error('Unread count calculation mismatch!');
    }
    console.log('[PASS] Unread counts match expected increments!');

    // TEST 6: Mark single notification as read
    await Notification.findByIdAndUpdate(stuNotif1._id, { read: true, readAt: new Date() });
    const afterSingleRead = await Notification.countDocuments({ userId: studentUser._id, read: false });
    console.log(`After marking stuNotif1 as read -> Student unread count: ${afterSingleRead} (expected: ${initialStudentUnread + 2})`);
    if (afterSingleRead !== initialStudentUnread + 2) {
      throw new Error('Mark single as read count mismatch!');
    }
    console.log('[PASS] Single notification mark-as-read verified!');

    // TEST 7: Query notifications list
    const studentList = await Notification.find({ userId: studentUser._id }).sort({ createdAt: -1 }).limit(5);
    console.log(`Student recent notification count: ${studentList.length}`);
    console.log(`Top student notification title: "${studentList[0].title}", link: "${studentList[0].link}"`);

    // Clean up test notifications
    const deletedCount = await Notification.deleteMany({ title: /\[TEST\]/ });
    console.log(`\nCleaned up ${deletedCount.deletedCount} test notifications.`);

    console.log('\n=============================================');
    console.log('ALL NOTIFICATION FLOW TESTS PASSED SUCCESSFULLY! ✅');
    console.log('=============================================');
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

run();
