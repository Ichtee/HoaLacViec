import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Job } from '../models/Job.js';
import { Application } from '../models/Application.js';
import { Shift } from '../models/Shift.js';
import { Notification } from '../models/Notification.js';

dotenv.config();

async function run() {
  await connectDB();

  // 1. Find the target user
  const student = await User.findOne({ email: 'xuanthangdth@gmail.com' });
  if (!student) {
    console.error('Không tìm thấy tài khoản xuanthangdth@gmail.com');
    process.exit(1);
  }
  console.log(`✅ Tìm thấy sinh viên: ${student.name} (${student.email}), ID: ${student._id}`);

  // 2. Find a job
  let job = await Job.findOne({ status: 'approved' }).populate('employerUserId');
  if (!job) {
    console.error('Không tìm thấy công việc đã duyệt nào.');
    process.exit(1);
  }

  // Ensure job has coordinates and valid employer
  if (!job.location?.lat || !job.location?.lng) {
    job.location = { lat: 21.0135, lng: 105.5260 };
    job.locationStatus = 'confirmed';
    await job.save();
    console.log(`📍 Đã cập nhật tọa độ chuẩn cho công việc ${job.title}: (21.0135, 105.5260)`);
  }

  const employerId = job.employerUserId?._id || job.employerUserId;
  console.log(`✅ Chọn công việc: "${job.title}" tại "${job.storeName}"`);
  console.log(`   Nhà tuyển dụng ID: ${employerId}`);

  // 3. Create or update Application to 'hired'
  let app = await Application.findOne({ jobId: job._id, studentId: student._id });
  if (!app) {
    app = await Application.create({
      jobId: job._id,
      studentId: student._id,
      employerId: employerId,
      status: 'hired',
      studentName: student.name || 'Tvng',
      studentEmail: student.email,
      studentPhone: student.phone || '0987654321',
      note: 'Em muốn ứng tuyển làm việc ca tối tại quán.',
    });
    console.log(`✅ Đã tạo đơn ứng tuyển mới và duyệt trúng tuyển (status: 'hired'): ${app._id}`);
  } else {
    app.status = 'hired';
    await app.save();
    console.log(`✅ Đã cập nhật đơn ứng tuyển hiện có sang 'hired': ${app._id}`);
  }

  // 4. Create Shift for today
  // Current time is ~20:42. Setting startTime to 20:30 so check-in window (-30m to +60m) is active right now!
  const todayStr = new Date().toISOString().split('T')[0];
  const startTime = '20:30';
  const endTime = '23:30';
  const plannedHours = 3;
  const wageRate = job.salaryAmount || 25000;

  // Clean old scheduled shifts for this student on this job
  await Shift.deleteMany({
    studentUserId: student._id,
    jobId: job._id,
    status: 'scheduled'
  });

  const shift = await Shift.create({
    jobId: job._id,
    applicationId: app._id,
    storeName: job.storeName || 'MOC Tea & Coffee',
    employerUserId: employerId,
    employerId: employerId,
    studentUserId: student._id,
    studentId: student._id,
    studentName: student.name,
    role: job.title || 'Nhân viên pha chế, bưng bê',
    date: todayStr,
    startTime: startTime,
    endTime: endTime,
    hours: plannedHours,
    wageRate: wageRate,
    totalPay: plannedHours * wageRate,
    status: 'scheduled',
    history: [
      {
        status: 'scheduled',
        changedAt: new Date(),
        changedBy: employerId,
        note: `Nhà tuyển dụng ${job.storeName} đã xếp bạn vào ca làm việc tối nay (${startTime} - ${endTime}).`,
      },
    ],
  });

  console.log(`✅ Đã phân ca làm việc thành công! Shift ID: ${shift._id}`);
  console.log(`   - Ngày: ${shift.date}`);
  console.log(`   - Khung giờ: ${shift.startTime} - ${shift.endTime} (${shift.hours} giờ)`);
  console.log(`   - Mức lương: ${shift.wageRate.toLocaleString('vi-VN')} VNĐ/h -> Tổng lương dự tính: ${shift.totalPay.toLocaleString('vi-VN')} VNĐ`);
  console.log(`   - Trạng thái: "${shift.status}"`);

  // 5. Create notification for student
  await Notification.create({
    userId: student._id,
    title: 'Chúc mừng bạn đã trúng tuyển & có lịch làm mới! 🎉',
    message: `Quán ${shift.storeName} đã duyệt đơn ứng tuyển của bạn và xếp bạn vào ca làm lúc ${startTime} - ${endTime} hôm nay (${todayStr}). Hãy kiểm tra và điểm danh ca làm!`,
    type: 'shift',
    link: '/student/shifts',
  });
  console.log(`🔔 Đã gửi thông báo đến tài khoản ${student.email}`);

  console.log('\n🎉 HOÀN TẤT THIẾT LẬP! Bây giờ người dùng có thể refresh trang web để xem và bấm điểm danh.');
  await mongoose.connection.close();
}

run().catch((err) => {
  console.error('Lỗi khi thiết lập:', err);
  process.exit(1);
});
