import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { Job } from '../models/Job.js';
import { Employment } from '../models/Employment.js';
import { Shift, parseVietnamDateTime } from '../models/Shift.js';
import { ShiftTemplate } from '../models/ShiftTemplate.js';
import { Application } from '../models/Application.js';
import {
  SCHEDULE_STATUSES,
  ASSIGNMENT_STATUSES,
  ATTENDANCE_STATUSES,
  PAYROLL_STATUSES,
} from '../domain/shiftLifecycle.js';

dotenv.config();

function getMonday(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${da}`;
}

function getDayString(mondayStr, offset) {
  const [y, m, d] = mondayStr.split('-').map(Number);
  const curr = new Date(y, m - 1, d + offset);
  const yr = curr.getFullYear();
  const mo = String(curr.getMonth() + 1).padStart(2, '0');
  const da = String(curr.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${da}`;
}

async function seedData() {
  await connectDB();
  console.log('🌱 Bắt đầu nạp dữ liệu mẫu cho Quản lý Ca làm việc & Nhân viên...');

  // 1. Ensure Employer User
  const employerEmail = 'nhatuyendung.hoalac@gmail.com';
  let employer = await User.findOne({ email: employerEmail });
  if (!employer) {
    employer = await User.create({
      name: 'The Coffee House Hòa Lạc',
      email: employerEmail,
      password: 'Password@123',
      role: 'employer',
      status: 'active',
      phone: '0988776655',
    });
  }

  // 2. Ensure Employer Profile
  let profile = await EmployerProfile.findOne({ userId: employer._id });
  if (!profile) {
    profile = await EmployerProfile.create({
      userId: employer._id,
      storeName: 'The Coffee House Hòa Lạc',
      storeType: 'Quán cà phê',
      address: 'Khu Công nghệ cao Hòa Lạc, Xã Thạch Hòa, Huyện Thạch Thất, Hà Nội',
      area: 'fpt_university',
      location: { lat: 21.0132, lng: 105.5255 },
      locationStatus: 'confirmed',
      contactName: 'Nguyễn Văn An (Quản lý)',
      contactPhone: '0988776655',
      verified: true,
    });
  }

  // 3. Ensure Job
  let job = await Job.findOne({ employerUserId: employer._id });
  if (!job) {
    job = await Job.create({
      employerUserId: employer._id,
      employerProfileId: profile._id,
      title: 'Nhân viên Phục vụ bàn & Pha chế ca linh hoạt',
      storeName: 'The Coffee House Hòa Lạc',
      storeType: 'Quán cà phê',
      description: 'Cần tuyển các bạn sinh viên FPT, ĐHQG làm ca sáng, chiều, tối linh hoạt.',
      category: 'F&B / Nhà hàng',
      jobType: 'shift',
      salaryAmount: 25000,
      salaryUnit: 'hour',
      area: 'fpt_university',
      address: 'Khu Công nghệ cao Hòa Lạc',
      status: 'approved',
      location: { lat: 21.0132, lng: 105.5255 },
      positions: [
        { title: 'Nhân viên Phục vụ', requiredCount: 3, hiredCount: 1 },
        { title: 'Nhân viên Thu ngân', requiredCount: 2, hiredCount: 1 },
        { title: 'Nhân viên Pha chế (Barista)', requiredCount: 2, hiredCount: 1 },
      ],
    });
  }

  // 4. Ensure Students
  const studentsData = [
    { email: 'khoa.student@fpt.edu.vn', name: 'Nguyễn Minh Khoa', phone: '0912345671', pos: 'Nhân viên Phục vụ', rate: 25000 },
    { email: 'linh.student@fpt.edu.vn', name: 'Trần Thị Linh', phone: '0912345672', pos: 'Nhân viên Thu ngân', rate: 28000 },
    { email: 'bao.student@fpt.edu.vn', name: 'Lê Quốc Bảo', phone: '0912345673', pos: 'Nhân viên Pha chế (Barista)', rate: 30000 },
  ];

  const students = [];
  for (const s of studentsData) {
    let stu = await User.findOne({ email: s.email });
    if (!stu) {
      stu = await User.create({
        name: s.name,
        email: s.email,
        password: 'Password@123',
        role: 'student',
        status: 'active',
        phone: s.phone,
      });
    }
    students.push({ user: stu, ...s });
  }

  // 5. Create Employments
  await Employment.deleteMany({ employerUserId: employer._id });
  const employments = [];
  for (const s of students) {
    const emp = await Employment.create({
      employerUserId: employer._id,
      employeeUserId: s.user._id,
      jobId: job._id,
      workplace: 'The Coffee House Hòa Lạc',
      positionTitle: s.pos,
      status: 'active',
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      wageRate: s.rate,
      wageUnit: 'hour',
      contractType: 'part_time',
    });
    employments.push({ ...s, employment: emp });
    console.log(`✅ Nhân viên chính thức: ${s.name} - ${s.pos} (${s.rate.toLocaleString('vi-VN')} đ/h)`);
  }

  // 6. Create Shift Templates
  await ShiftTemplate.deleteMany({ employerUserId: employer._id });
  const templates = [
    { positionTitle: 'Nhân viên Phục vụ', dayOfWeek: 1, startTime: '07:00', endTime: '11:30' },
    { positionTitle: 'Nhân viên Phục vụ', dayOfWeek: 2, startTime: '12:30', endTime: '17:00' },
    { positionTitle: 'Nhân viên Thu ngân', dayOfWeek: 3, startTime: '17:30', endTime: '22:00' },
    { positionTitle: 'Nhân viên Pha chế (Barista)', dayOfWeek: 4, startTime: '07:00', endTime: '12:00' },
    { positionTitle: 'Nhân viên Phục vụ', dayOfWeek: 5, startTime: '17:30', endTime: '22:00' },
  ];
  for (const t of templates) {
    await ShiftTemplate.create({
      employerUserId: employer._id,
      jobId: job._id,
      workplace: 'The Coffee House Hòa Lạc',
      positionTitle: t.positionTitle,
      dayOfWeek: t.dayOfWeek,
      startTime: t.startTime,
      endTime: t.endTime,
      requiredHeadcount: 1,
      active: true,
    });
  }
  console.log(`✅ Đã tạo ${templates.length} mẫu ca làm việc (Shift Templates)`);

  // 7. Create Shifts for this current week
  await Shift.deleteMany({ employerUserId: employer._id });
  const monday = getMonday();
  const shiftsData = [
    // Thứ 2: Ca Sáng (Đã hoàn thành, đã duyệt lương)
    {
      offset: 0,
      emp: employments[0],
      startTime: '07:00',
      endTime: '11:30',
      hours: 4.5,
      sched: SCHEDULE_STATUSES.PUBLISHED,
      assign: ASSIGNMENT_STATUSES.ASSIGNED,
      att: ATTENDANCE_STATUSES.APPROVED,
      pay: PAYROLL_STATUSES.PAID,
    },
    // Thứ 3: Ca Chiều (Đang làm việc / In progress)
    {
      offset: 1,
      emp: employments[1],
      startTime: '12:30',
      endTime: '17:00',
      hours: 4.5,
      sched: SCHEDULE_STATUSES.PUBLISHED,
      assign: ASSIGNMENT_STATUSES.ASSIGNED,
      att: ATTENDANCE_STATUSES.IN_PROGRESS,
      pay: PAYROLL_STATUSES.UNPAID,
    },
    // Thứ 4: Ca Tối (Đã xếp lịch, chuẩn bị làm)
    {
      offset: 2,
      emp: employments[2],
      startTime: '17:30',
      endTime: '22:00',
      hours: 4.5,
      sched: SCHEDULE_STATUSES.PUBLISHED,
      assign: ASSIGNMENT_STATUSES.ASSIGNED,
      att: ATTENDANCE_STATUSES.NOT_STARTED,
      pay: PAYROLL_STATUSES.UNPAID,
    },
    // Thứ 5: Ca Sáng (Đã xếp lịch cho Khoa)
    {
      offset: 3,
      emp: employments[0],
      startTime: '07:00',
      endTime: '11:30',
      hours: 4.5,
      sched: SCHEDULE_STATUSES.PUBLISHED,
      assign: ASSIGNMENT_STATUSES.ASSIGNED,
      att: ATTENDANCE_STATUSES.NOT_STARTED,
      pay: PAYROLL_STATUSES.UNPAID,
    },
    // Thứ 6: Ca Tối (Đã xếp lịch cho Linh)
    {
      offset: 4,
      emp: employments[1],
      startTime: '17:30',
      endTime: '22:00',
      hours: 4.5,
      sched: SCHEDULE_STATUSES.PUBLISHED,
      assign: ASSIGNMENT_STATUSES.ASSIGNED,
      att: ATTENDANCE_STATUSES.NOT_STARTED,
      pay: PAYROLL_STATUSES.UNPAID,
    },
    // Thứ 7: Ca Sáng (Mẫu ca trống chưa gán người / Unassigned)
    {
      offset: 5,
      emp: null,
      pos: 'Nhân viên Phục vụ',
      startTime: '07:00',
      endTime: '12:00',
      hours: 5.0,
      sched: SCHEDULE_STATUSES.PUBLISHED,
      assign: ASSIGNMENT_STATUSES.UNASSIGNED,
      att: ATTENDANCE_STATUSES.NOT_STARTED,
      pay: PAYROLL_STATUSES.UNPAID,
    },
    // Chủ Nhật: Ca Tối (Bản nháp / Draft)
    {
      offset: 6,
      emp: employments[2],
      startTime: '17:30',
      endTime: '22:00',
      hours: 4.5,
      sched: SCHEDULE_STATUSES.DRAFT,
      assign: ASSIGNMENT_STATUSES.ASSIGNED,
      att: ATTENDANCE_STATUSES.NOT_STARTED,
      pay: PAYROLL_STATUSES.UNPAID,
    },
  ];

  for (const s of shiftsData) {
    const dateStr = getDayString(monday, s.offset);
    const startAt = parseVietnamDateTime(dateStr, s.startTime);
    const endAt = parseVietnamDateTime(dateStr, s.endTime);
    const assignedUser = s.emp?.user;

    await Shift.create({
      jobId: job._id,
      employmentId: s.emp?.employment?._id || null,
      employerUserId: employer._id,
      storeName: 'The Coffee House Hòa Lạc',
      workplaceName: 'The Coffee House Hòa Lạc',
      employeeUserId: assignedUser?._id || null,
      employeeName: assignedUser?.name || '',
      studentUserId: assignedUser?._id || null,
      studentName: assignedUser?.name || '',
      studentPhone: s.emp?.phone || '',
      role: s.emp?.pos || s.pos,
      positionTitle: s.emp?.pos || s.pos,
      startAt,
      endAt,
      date: dateStr,
      startTime: s.startTime,
      endTime: s.endTime,
      hours: s.hours,
      wageRate: s.emp?.rate || 25000,
      workedMinutes: s.att === ATTENDANCE_STATUSES.APPROVED ? s.hours * 60 : 0,
      totalPay: s.att === ATTENDANCE_STATUSES.APPROVED ? (s.emp?.rate || 25000) * s.hours : 0,
      scheduleStatus: s.sched,
      assignmentStatus: s.assign,
      attendanceStatus: s.att,
      payrollStatus: s.pay,
    });
  }

  console.log(`✅ Đã tạo ${shiftsData.length} ca làm việc tuần này (${monday}) đầy đủ các nhóm Sáng, Chiều, Tối!`);
  console.log('\n======================================================');
  console.log('TÀI KHOẢN ĐĂNG NHẬP NHÀ TUYỂN DỤNG ĐỂ XEM:');
  console.log('Email:    nhatuyendung.hoalac@gmail.com');
  console.log('Mật khẩu: Password@123');
  console.log('======================================================\n');
  process.exit(0);
}

seedData().catch((err) => {
  console.error('❌ Lỗi khi nạp dữ liệu:', err);
  process.exit(1);
});
