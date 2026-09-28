import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Job } from '../models/Job.js';
import { Shift } from '../models/Shift.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { Notification } from '../models/Notification.js';
import { evaluateAttendanceGPS, evaluateCheckinWindow, clampRadius } from '../utils/geoHelper.js';
import { calculateHaversineDistanceMeters } from '../utils/haversine.js';

dotenv.config();

function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

async function runShiftFlowTest() {
  console.log('================================================================');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ LUỒNG LỊCH LÀM VIỆC (SHIFT WORKFLOW TEST)');
  console.log('================================================================');

  await connectDB();

  let testShiftId = null;

  try {
    // ---------------------------------------------------------
    // BƯỚC 0: CHUẨN BỊ DỮ LIỆU MẪU (Sample Data)
    // ---------------------------------------------------------
    console.log('\n[BƯỚC 0] Tìm kiếm / Khởi tạo người dùng & công việc mẫu...');
    const student = await User.findOne({ role: 'student' });
    const employer = await User.findOne({ role: 'employer' });
    const job = await Job.findOne({ status: 'approved' });

    if (!student || !employer || !job) {
      throw new Error('Thiếu dữ liệu mẫu trong DB (Cần ít nhất 1 sinh viên, 1 nhà tuyển dụng và 1 việc làm).');
    }

    const jobLat = job.location?.lat || 21.0135;
    const jobLng = job.location?.lng || 105.5260;

    console.log(`- Sinh viên: ${student.name} (${student.email})`);
    console.log(`- Nhà tuyển dụng: ${employer.name} (${employer.email})`);
    console.log(`- Nơi làm việc: ${job.storeName || job.title} (Tọa độ: ${jobLat}, ${jobLng})`);

    // Clean up any old test shifts
    await Shift.deleteMany({ role: '__TEST_FLOW_SHIFT__' });

    // ---------------------------------------------------------
    // BƯỚC 1: NHÀ TUYỂN DỤNG PHÂN CA LÀM (Create Shift)
    // ---------------------------------------------------------
    console.log('\n[BƯỚC 1] Nhà tuyển dụng phân ca làm việc cho sinh viên...');
    const todayStr = new Date().toISOString().split('T')[0];
    const wageRate = 30000; // 30.000đ/giờ
    const startTime = '08:00';
    const endTime = '12:00';
    const plannedHours = 4;

    const newShift = await Shift.create({
      jobId: job._id,
      storeName: job.storeName || 'The Coffee House FPT',
      employerUserId: employer._id,
      employerId: employer._id,
      studentUserId: student._id,
      studentId: student._id,
      studentName: student.name,
      role: '__TEST_FLOW_SHIFT__',
      date: todayStr,
      startTime,
      endTime,
      hours: plannedHours,
      wageRate,
      totalPay: plannedHours * wageRate,
      status: 'scheduled',
      history: [
        {
          status: 'scheduled',
          changedAt: new Date(),
          changedBy: employer._id,
          note: `Nhà tuyển dụng ${employer.name} xếp ca ngày ${todayStr} (${startTime} - ${endTime})`,
        },
      ],
    });

    testShiftId = newShift._id;
    console.log(`✅ Tạo ca làm thành công! ID: ${newShift._id}`);
    console.log(`   - Trạng thái ban đầu: ${newShift.status}`);
    console.log(`   - Thời gian dự kiến: ${startTime} - ${endTime} (${plannedHours} giờ)`);
    console.log(`   - Mức lương dự kiến: ${formatVND(wageRate)}/h -> Tổng: ${formatVND(newShift.totalPay)}`);

    // ---------------------------------------------------------
    // BƯỚC 2: KIỂM TRA KHUNG GIỜ CHECK-IN (Time Window Validation)
    // ---------------------------------------------------------
    console.log('\n[BƯỚC 2] Kiểm tra logic khung giờ cho phép điểm danh (Window Validation)...');

    // Case 2.1: Check-in quá sớm (trước giờ bắt đầu 45 phút)
    const earlyTime = new Date(`${todayStr}T07:15:00+07:00`);
    const earlyCheck = evaluateCheckinWindow(todayStr, startTime, earlyTime);
    console.log(`- 2.1 Điểm danh lúc 07:15 (Sớm 45p): Cho phép = ${earlyCheck.allowed} (Mã: ${earlyCheck.code})`);
    if (earlyCheck.allowed) throw new Error('Khung giờ điểm danh lỗi: không được cho phép điểm danh trước >30p');

    // Case 2.2: Check-in đúng khung giờ (trước giờ bắt đầu 15 phút)
    const onTime = new Date(`${todayStr}T07:45:00+07:00`);
    const onTimeCheck = evaluateCheckinWindow(todayStr, startTime, onTime);
    console.log(`- 2.2 Điểm danh lúc 07:45 (Sớm 15p): Cho phép = ${onTimeCheck.allowed} -> Hợp lệ!`);
    if (!onTimeCheck.allowed) throw new Error('Khung giờ điểm danh lỗi: phải cho phép điểm danh trước 15p');

    // Case 2.3: Check-in quá muộn (sau giờ bắt đầu 75 phút)
    const lateTime = new Date(`${todayStr}T09:15:00+07:00`);
    const lateCheck = evaluateCheckinWindow(todayStr, startTime, lateTime);
    console.log(`- 2.3 Điểm danh lúc 09:15 (Trễ 75p): Cho phép = ${lateCheck.allowed} (Mã: ${lateCheck.code})`);
    if (lateCheck.allowed) throw new Error('Khung giờ điểm danh lỗi: không được cho phép điểm danh sau >60p');

    // ---------------------------------------------------------
    // BƯỚC 3: ĐIỂM DANH VÀO CA QUA GPS (Check-in Validation)
    // ---------------------------------------------------------
    console.log('\n[BƯỚC 3] Sinh viên điểm danh vào ca (Check-in GPS)...');

    // Case 3.1: Thử GPS xa quán (Ví dụ sinh viên đang ở cách quán 1.5 km)
    const farLat = jobLat + 0.013;
    const farLng = jobLng + 0.013;
    const farDist = calculateHaversineDistanceMeters(farLat, farLng, jobLat, jobLng);
    const farEval = evaluateAttendanceGPS({
      lat: farLat,
      lng: farLng,
      accuracy: 15,
      jobLocation: { lat: jobLat, lng: jobLng },
      jobLocationStatus: 'confirmed',
      checkinRadius: 150,
    });
    console.log(`- 3.1 GPS ngoài bán kính (~${Math.round(farDist)}m xa quán):`);
    console.log(`      Verified: ${farEval.verified}, Status: ${farEval.status}, ReasonCode: ${farEval.reasonCode}`);
    console.log(`      Thông báo: "${farEval.message}"`);
    if (farEval.verified) throw new Error('GPS xa quán không được tự động verified!');

    // Case 3.2: GPS thực tế tại quán (cách quán 25m, độ chính xác ±12m)
    const nearLat = jobLat + 0.00018;
    const nearLng = jobLng + 0.00015;
    const nearDist = calculateHaversineDistanceMeters(nearLat, nearLng, jobLat, jobLng);
    const nearEval = evaluateAttendanceGPS({
      lat: nearLat,
      lng: nearLng,
      accuracy: 12,
      jobLocation: { lat: jobLat, lng: jobLng },
      jobLocationStatus: 'confirmed',
      checkinRadius: 150,
    });
    console.log(`- 3.2 GPS hợp lệ tại quán (~${Math.round(nearDist)}m, bán kính 150m):`);
    console.log(`      Verified: ${nearEval.verified}, Status: ${nearEval.status}, ReasonCode: ${nearEval.reasonCode}`);
    console.log(`      Thông báo: "${nearEval.message}"`);
    if (!nearEval.verified) throw new Error('GPS tại quán phải được verified!');

    // Thực hiện lưu check-in vào DB
    const checkInTime = new Date(Date.now() - 3.5 * 3600 * 1000); // Giả lập đã làm 3.5 tiếng trước
    newShift.status = 'checked_in';
    newShift.attendance = {
      checkInAt: checkInTime,
      checkInCoords: { lat: nearLat, lng: nearLng, accuracy: 12, timestamp: checkInTime },
      checkInDistanceMeters: nearDist,
      checkInVerified: nearEval.verified,
      checkInVerificationStatus: nearEval.status,
      checkInReasonCode: nearEval.reasonCode,
      locationVerified: nearEval.verified,
    };
    newShift.history.push({
      status: 'checked_in',
      changedAt: checkInTime,
      changedBy: student._id,
      note: `Sinh viên điểm danh vào ca qua GPS (${Math.round(nearDist)}m từ quán)`,
    });
    await newShift.save();
    console.log(`✅ Đã lưu Check-in vào CSDL! Trạng thái ca: "${newShift.status}"`);

    // ---------------------------------------------------------
    // BƯỚC 4: ĐIỂM DANH TAN CA (Check-out & Tính lương)
    // ---------------------------------------------------------
    console.log('\n[BƯỚC 4] Sinh viên điểm danh tan ca (Check-out) & Hệ thống tính giờ công...');
    const checkOutTime = new Date();
    const workedMinutes = Math.max(1, Math.round((checkOutTime.getTime() - checkInTime.getTime()) / (60 * 1000)));
    const workedHours = Number((workedMinutes / 60).toFixed(2));
    const calculatedPay = Math.round((workedMinutes / 60) * wageRate);

    // Điểm danh checkout tại quán
    const checkoutEval = evaluateAttendanceGPS({
      lat: nearLat,
      lng: nearLng,
      accuracy: 10,
      jobLocation: { lat: jobLat, lng: jobLng },
      jobLocationStatus: 'confirmed',
      checkinRadius: 150,
    });

    newShift.status = 'pending_approval';
    newShift.workedMinutes = workedMinutes;
    newShift.totalPay = calculatedPay;
    if (!newShift.attendance) newShift.attendance = {};
    newShift.attendance.checkOutAt = checkOutTime;
    newShift.attendance.checkOutCoords = { lat: nearLat, lng: nearLng, accuracy: 10, timestamp: checkOutTime };
    newShift.attendance.checkOutDistanceMeters = checkoutEval.distanceMeters;
    newShift.attendance.checkOutVerified = checkoutEval.verified;
    newShift.attendance.checkOutVerificationStatus = checkoutEval.status;
    newShift.attendance.checkOutReasonCode = checkoutEval.reasonCode;

    newShift.history.push({
      status: 'pending_approval',
      changedAt: checkOutTime,
      changedBy: student._id,
      note: `Check-out ra ca: làm việc ${workedMinutes} phút (~${workedHours}h). Lương tạm tính: ${formatVND(calculatedPay)}`,
    });
    await newShift.save();

    console.log(`✅ Điểm danh tan ca thành công!`);
    console.log(`   - Thời gian bắt đầu: ${checkInTime.toLocaleTimeString('vi-VN')}`);
    console.log(`   - Thời gian kết thúc: ${checkOutTime.toLocaleTimeString('vi-VN')}`);
    console.log(`   - Số phút làm thực tế: ${workedMinutes} phút (~${workedHours} giờ)`);
    console.log(`   - Lương tính toán: ${formatVND(calculatedPay)} (Mức lương ${formatVND(wageRate)}/h)`);
    console.log(`   - Trạng thái ca: "${newShift.status}" (Chờ nhà tuyển dụng duyệt)`);

    // ---------------------------------------------------------
    // BƯỚC 5: NHÀ TUYỂN DỤNG DUYỆT CÔNG & CHI TRẢ (Employer Approval)
    // ---------------------------------------------------------
    console.log('\n[BƯỚC 5] Nhà tuyển dụng duyệt công & hoàn tất ca làm...');
    newShift.status = 'approved';
    newShift.history.push({
      status: 'approved',
      changedAt: new Date(),
      changedBy: employer._id,
      note: `Nhà tuyển dụng ${employer.name} đã duyệt công và xác nhận chi trả ${formatVND(newShift.totalPay)}`,
    });
    await newShift.save();

    console.log(`✅ Nhà tuyển dụng đã duyệt ca thành công!`);
    console.log(`   - Trạng thái ca làm: "${newShift.status}"`);
    console.log(`   - Tổng lương thanh toán: ${formatVND(newShift.totalPay)}`);

    // ---------------------------------------------------------
    // BƯỚC 6: KIỂM TRA LỊCH SỬ VẾT THAY ĐỔI (Audit Trail)
    // ---------------------------------------------------------
    console.log('\n[BƯỚC 6] Kiểm tra lịch sử ca làm (Audit History Trail):');
    const reloadedShift = await Shift.findById(newShift._id).lean();
    reloadedShift.history.forEach((h, idx) => {
      console.log(`   [${idx + 1}] Trạng thái: ${h.status.padEnd(16)} | Ghi chú: ${h.note}`);
    });

    console.log('\n================================================================');
    console.log('🎉 TOÀN BỘ LUỒNG LỊCH LÀM (SHIFT WORKFLOW) HOẠT ĐỘNG HOÀN HẢO!');
    console.log('================================================================');
  } catch (err) {
    console.error('❌ LỖI TRONG QUÁ TRÌNH KIỂM THỬ:', err);
  } finally {
    if (testShiftId) {
      await Shift.findByIdAndDelete(testShiftId);
      console.log(`\n🧹 [Dọn dẹp] Đã xóa ca làm thử nghiệm ${testShiftId} khỏi CSDL.`);
    }
    await mongoose.connection.close();
    console.log('Đã ngắt kết nối CSDL.');
  }
}

runShiftFlowTest();
