import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { Job } from '../models/Job.js';

dotenv.config();

async function createEmployerAndJob() {
  await connectDB();

  const email = 'nhatuyendung.hoalac@gmail.com';
  const rawPassword = 'Password@123';

  // 1. Check if user already exists, remove old test data if so
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    console.log(`Đang dọn dẹp tài khoản cũ: ${email}...`);
    await Job.deleteMany({ employerUserId: existingUser._id });
    await EmployerProfile.deleteMany({ userId: existingUser._id });
    await User.deleteOne({ _id: existingUser._id });
  }

  // 2. Create Employer User
  const employerUser = await User.create({
    name: 'The Coffee House Hòa Lạc',
    email,
    password: rawPassword, // will be automatically hashed by User pre-save hook
    role: 'employer',
    status: 'active',
    phone: '0988776655',
    emailVerifiedAt: new Date(),
  });

  console.log('✅ Đã tạo tài khoản Nhà tuyển dụng:');
  console.log(`   - ID: ${employerUser._id}`);
  console.log(`   - Email: ${employerUser.email}`);
  console.log(`   - Role: ${employerUser.role}`);
  console.log(`   - Status: ${employerUser.status}`);

  // 3. Create Employer Profile
  const employerProfile = await EmployerProfile.create({
    userId: employerUser._id,
    storeName: 'The Coffee House Hòa Lạc',
    storeType: 'Quán cà phê',
    address: 'Khu Công nghệ cao Hòa Lạc, Xã Thạch Hòa, Huyện Thạch Thất, Hà Nội',
    area: 'fpt_university',
    location: {
      lat: 21.0132,
      lng: 105.5255,
    },
    locationStatus: 'confirmed',
    locationSource: 'map_pin',
    locationConfirmedAt: new Date(),
    contactName: 'Quản lý cơ sở - Nguyễn Văn An',
    contactPhone: '0988776655',
    description: 'Chi nhánh The Coffee House tại khu Công nghệ cao Hòa Lạc, phục vụ học sinh sinh viên và cán bộ nhân viên FPT, Viettel, VNPT.',
    verified: true,
    verifiedAt: new Date(),
    checkinRadius: 150,
  });

  console.log('✅ Đã tạo hồ sơ nhà tuyển dụng (EmployerProfile):');
  console.log(`   - Store: ${employerProfile.storeName}`);
  console.log(`   - Địa chỉ: ${employerProfile.address}`);
  console.log(`   - Bán kính điểm danh: ${employerProfile.checkinRadius}m`);

  // 4. Create Job
  const job = await Job.create({
    employerUserId: employerUser._id,
    employerProfileId: employerProfile._id,
    employerId: employerProfile._id,
    storeName: employerProfile.storeName,
    title: 'Nhân viên phục vụ & Hỗ trợ pha chế ca xoay',
    category: 'service',
    type: 'shift',
    salaryAmount: 28000,
    salaryUnit: 'hour',
    area: 'fpt_university',
    address: employerProfile.address,
    location: employerProfile.location,
    locationStatus: 'confirmed',
    locationSource: 'map_pin',
    locationConfirmedAt: new Date(),
    status: 'approved',
    approvedAt: new Date(),
    description: 'Tuyển dụng 3 bạn sinh viên làm nhân viên phục vụ và phụ việc quầy bar theo ca. Lịch làm việc được đăng ký linh động theo tuần phù hợp với lịch học tại FPT / ĐHQG.',
    requirements: [
      'Nhanh nhẹn, chăm chỉ, có tinh thần trách nhiệm',
      'Đăng ký tối thiểu 4 ca/tuần',
      'Không yêu cầu kinh nghiệm, được đào tạo bài bản',
    ],
    benefits: [
      'Lương 28.000 VNĐ / giờ + phụ cấp chuyên cần',
      'Giảm giá 50% đồ uống tại quán',
      'Môi trường làm việc trẻ trung, năng động',
    ],
  });

  console.log('✅ Đã tạo tin tuyển dụng (Job):');
  console.log(`   - Mã việc: ${job._id}`);
  console.log(`   - Tiêu đề: ${job.title}`);
  console.log(`   - Trạng thái: ${job.status}`);
  console.log(`   - Mức lương: ${job.salaryAmount.toLocaleString('vi-VN')} VNĐ/${job.salaryUnit}`);

  // 5. Test password comparison
  const isValid = await employerUser.comparePassword(rawPassword);
  console.log(`🔒 Kiểm tra xác thực mật khẩu: ${isValid ? 'THÀNH CÔNG' : 'THẤT BẠI'}`);

  console.log('\n======================================================');
  console.log('THÔNG TIN ĐĂNG NHẬP NHÀ TUYỂN DỤNG:');
  console.log(`Email:    ${email}`);
  console.log(`Mật khẩu: ${rawPassword}`);
  console.log('======================================================');

  await mongoose.connection.close();
}

createEmployerAndJob().catch((err) => {
  console.error('Lỗi:', err);
  process.exit(1);
});
