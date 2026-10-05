import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { Job } from '../models/Job.js';
import { Availability } from '../models/Availability.js';
import { MicroTask } from '../models/MicroTask.js';
import { Blog } from '../models/Blog.js';
import { Shift } from '../models/Shift.js';
import { Application } from '../models/Application.js';
import { Review } from '../models/Review.js';
import { EmployerVerification } from '../models/EmployerVerification.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hoalacviec';

async function seed() {
  try {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Không chạy dữ liệu mẫu trong production.');
    }
    await mongoose.connect(MONGO_URI);
    console.log('[Seed] Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      StudentProfile.deleteMany({}),
      EmployerProfile.deleteMany({}),
      EmployerVerification.deleteMany({}),
      Job.deleteMany({}),
      Availability.deleteMany({}),
      MicroTask.deleteMany({}),
      Blog.deleteMany({}),
      Shift.deleteMany({}),
      Application.deleteMany({}),
      Review.deleteMany({}),
    ]);
    console.log('[Seed] Cleared existing collections');

    // 1. Users
    const studentUser = await User.create({
      name: 'Nguyễn Minh Khoa',
      email: 'khoa.nguyen@student.fpt.edu.vn',
      password: '123456',
      role: 'student',
      status: 'active',
      phone: '0981234567',
    });

    const studentUser2 = await User.create({
      name: 'Trần Thị Linh',
      email: 'linh.tran@student.fpt.edu.vn',
      password: '123456',
      role: 'student',
      status: 'active',
      phone: '0977654321',
    });

    const employerUser = await User.create({
      name: 'Café Xanh Hòa Lạc',
      email: 'cafexanh@hoalacviec.vn',
      password: '123456',
      role: 'employer',
      status: 'active',
      phone: '0901231001',
    });

    const employerUser2 = await User.create({
      name: 'Bách Hóa SV Market',
      email: 'svmarket@hoalacviec.vn',
      password: '123456',
      role: 'employer',
      status: 'active',
      phone: '0912342002',
    });

    const adminUser = await User.create({
      name: 'Admin Hoa Lạc Việc',
      email: 'admin@hoalacviec.vn',
      password: '123456',
      role: 'admin',
      status: 'active',
      phone: '0999999999',
    });

    // 2. Profiles
    const sp1 = await StudentProfile.create({
      userId: studentUser._id,
      university: 'Đại học FPT Hòa Lạc',
      studentCode: 'HE163456',
      yearOfStudy: 3,
      major: 'Kỹ thuật phần mềm',
      area: 'fpt_university',
      address: 'KTX Dom A - ĐH FPT Hòa Lạc',
      location: { lat: 21.0134, lng: 105.5263 },
      bio: 'Sinh viên FPT năm 3, cần tìm việc làm thêm ca chiều tối hoặc việc vặt quanh trường.',
      skills: ['Pha chế', 'Thu ngân', 'Giao tiếp tốt', 'Xe máy riêng'],
      transport: 'xe_may',
      reputationScore: 4.8,
    });

    await StudentProfile.create({
      userId: studentUser2._id,
      university: 'ĐHQGHN Hòa Lạc',
      studentCode: 'QH2023001',
      yearOfStudy: 2,
      major: 'Kinh tế đối ngoại',
      area: 'ktx_dhqg',
      address: 'KTX ĐHQG Hòa Lạc',
      location: { lat: 21.0060, lng: 105.5230 },
      skills: ['Thu ngân', 'Bán hàng', 'Nấu ăn', 'Tiếng Anh'],
      transport: 'xe_buyt',
      reputationScore: 4.9,
    });

    const ep1 = await EmployerProfile.create({
      userId: employerUser._id,
      storeName: 'Café Xanh Hòa Lạc',
      storeType: 'Quán cà phê',
      address: 'Tầng 1, Tòa A, KĐT FPT Hòa Lạc',
      area: 'fpt_university',
      location: { lat: 21.0128, lng: 105.5255 },
      contactPhone: '0901231001',
      verified: true,
      busRoutes: ['Bus 72', 'Bus 74'],
      description: 'Quán cà phê phục vụ sinh viên và giảng viên, giờ mở cửa 7h-22h.',
      rating: 4.8,
      ratingCount: 24,
    });

    const ep2 = await EmployerProfile.create({
      userId: employerUser2._id,
      storeName: 'Bách Hóa SV Market',
      storeType: 'Cửa hàng tiện lợi',
      address: 'Đường D1, Khu Công Nghệ Cao Hòa Lạc, Thạch Thất, Hà Nội',
      area: 'fpt_university',
      location: { lat: 21.0155, lng: 105.5290 },
      locationStatus: 'confirmed',
      locationSource: 'map_pin',
      locationConfirmedAt: new Date('2026-09-19T10:00:00Z'),
      geoPoint: { type: 'Point', coordinates: [105.5290, 21.0155] },
      contactPhone: '0912342002',
      verified: true,
      busRoutes: ['Bus 72'],
      description: 'Siêu thị mini phục vụ nhu cầu sinh hoạt của sinh viên Hòa Lạc.',
      rating: 4.5,
      ratingCount: 18,
    });

    await EmployerVerification.create([
      {
        employerUserId: employerUser._id,
        storeName: 'Café Xanh Hòa Lạc',
        legalName: 'Nguyễn Văn Cường',
        taxCode: '0108991234',
        idCardNumber: '001201004567',
        businessAddress: 'Tầng 1, Tòa A, KĐT FPT Hòa Lạc',
        contactPhone: '0901231001',
        status: 'approved',
        reviewedAt: new Date(),
      },
      {
        employerUserId: employerUser2._id,
        storeName: 'Bách Hóa SV Market',
        legalName: 'Lê Thị Thu Hà',
        taxCode: '0109123456',
        idCardNumber: '001202007890',
        businessAddress: 'Đường D1, Khu Công Nghệ Cao Hòa Lạc, Thạch Thất, Hà Nội',
        contactPhone: '0912342002',
        status: 'approved',
        reviewedAt: new Date(),
      },
    ]);

    // 3. Availability for student 1
    await Availability.create({
      userId: studentUser._id,
      slots: {
        mon: ['afternoon', 'evening'],
        tue: ['afternoon'],
        wed: ['afternoon', 'evening'],
        thu: ['evening'],
        fri: ['morning', 'afternoon', 'evening'],
        sat: ['morning', 'afternoon'],
        sun: ['evening'],
      }
    });

    // 4. Jobs
    const j1 = await Job.create({
      employerId: ep1._id,
      storeName: 'Café Xanh Hòa Lạc',
      title: 'Nhân Viên Pha Chế & Quầy Bar',
      type: 'shift',
      salaryAmount: 35000,
      salaryUnit: 'hour',
      area: 'fpt_university',
      address: 'Tầng 1, Tòa A, KĐT FPT Hòa Lạc (Cách KTX FPT 400m)',
      location: { lat: 21.0128, lng: 105.5255 },
      locationStatus: 'confirmed',
      locationSource: 'map_pin',
      locationConfirmedAt: new Date('2026-09-19T10:00:00Z'),
      geoPoint: { type: 'Point', coordinates: [105.5255, 21.0128] },
      schedule: [
        { dayOfWeek: 1, startTime: '14:00', endTime: '21:00', slot: 'afternoon' },
        { dayOfWeek: 3, startTime: '14:00', endTime: '21:00', slot: 'afternoon' },
        { dayOfWeek: 5, startTime: '17:00', endTime: '22:00', slot: 'evening' },
      ],
      slots: 2,
      description: 'Pha chế đồ uống, chuẩn bị nguyên liệu và phục vụ quầy bar thân thiện. Được đào tạo tay nghề miễn phí.',
      requirements: ['Không yêu cầu kinh nghiệm', 'Thân thiện, đúng giờ', 'Ưu tiên sinh viên FPT/ĐHQG'],
      benefits: ['Uống nước miễn phí tại ca', 'Thưởng chuyên cần tháng', 'Môi trường làm việc năng động'],
      busRoutes: ['Bus 72', 'Bus 74'],
      featured: true,
      status: 'approved',
      tags: ['pha_che', 'cafe', 'fpt'],
      contactPhone: '0901231001',
    });

    const j2 = await Job.create({
      employerId: ep2._id,
      storeName: 'Bách Hóa SV Market',
      title: 'Thu Ngân & Kiểm Soát Quầy Hàng',
      type: 'shift',
      salaryAmount: 32000,
      salaryUnit: 'hour',
      area: 'fpt_university',
      address: 'Đường D1, Khu Công Nghệ Cao Hòa Lạc, Thạch Thất, Hà Nội (Gần KTX FPT)',
      location: { lat: 21.0155, lng: 105.5290 },
      locationStatus: 'confirmed',
      locationSource: 'map_pin',
      locationConfirmedAt: new Date('2026-09-19T10:00:00Z'),
      geoPoint: { type: 'Point', coordinates: [105.5215, 21.0205] },
      schedule: [
        { dayOfWeek: 2, startTime: '13:00', endTime: '18:00', slot: 'afternoon' },
        { dayOfWeek: 4, startTime: '13:00', endTime: '18:00', slot: 'afternoon' },
        { dayOfWeek: 6, startTime: '08:00', endTime: '13:00', slot: 'morning' },
      ],
      slots: 2,
      description: 'Thanh toán hoá đơn tại quầy, kiểm tra tem giá và xếp hàng hóa ngăn nắp.',
      requirements: ['Trung thực, cẩn thận', 'Sử dụng máy tính cơ bản'],
      benefits: ['Giảm giá 15% khi mua đồ', 'Hỗ trợ ăn nhẹ giữa ca'],
      busRoutes: ['Bus 72'],
      featured: true,
      status: 'approved',
      tags: ['thu_ngan', 'sieu_thi'],
      contactPhone: '0912342002',
    });

    // 8 Additional Jobs with confirmed real coordinates across Hoa Lac (Total: 10 jobs)
    const addedJobs = await Job.insertMany([
      {
        employerId: ep1._id,
        storeName: 'Trà Sữa Mixue Tân Xã',
        title: 'Nhân Viên Pha Chế Trà Sữa & Kem',
        type: 'shift',
        salaryAmount: 28000,
        salaryUnit: 'hour',
        area: 'tan_xa',
        address: 'Số 48 Thôn 3, Xã Tân Xã, Huyện Thạch Thất, Hà Nội (Gần Cổng FPT)',
        location: { lat: 21.0178, lng: 105.5222 },
        locationStatus: 'confirmed',
        locationSource: 'map_pin',
        geocodingProvider: 'vietmap',
        locationConfirmedAt: new Date('2026-09-19T10:00:00Z'),
        geoPoint: { type: 'Point', coordinates: [105.5222, 21.0178] },
        schedule: [
          { dayOfWeek: 1, startTime: '17:00', endTime: '22:30', slot: 'evening' },
          { dayOfWeek: 3, startTime: '17:00', endTime: '22:30', slot: 'evening' },
          { dayOfWeek: 5, startTime: '17:00', endTime: '22:30', slot: 'evening' },
        ],
        slots: 2,
        description: 'Pha chế trà sữa, làm kem ốc quế, đứng quầy thu ngân và vệ sinh máy pha vào cuối ca.',
        requirements: ['Nhanh nhẹn, vui vẻ', 'Làm được ca tối'],
        benefits: ['Giảm giá 30% đồ uống', 'Thưởng doanh số ngày đông khách'],
        busRoutes: ['Bus 74'],
        featured: true,
        status: 'approved',
        tags: ['tra_sua', 'pha_che', 'mixue', 'tan_xa'],
        contactPhone: '0988112233',
      },
      {
        employerId: ep1._id,
        storeName: 'Highlands Coffee FPT Campus',
        title: 'Barista / Pha Chế Espresso Sáng',
        type: 'shift',
        salaryAmount: 32000,
        salaryUnit: 'hour',
        area: 'fpt_university',
        address: 'Tòa nhà Beta, ĐH FPT Hòa Lạc, Thạch Thất, Hà Nội',
        location: { lat: 21.0135, lng: 105.5265 },
        locationStatus: 'confirmed',
        locationSource: 'map_pin',
        geocodingProvider: 'vietmap',
        locationConfirmedAt: new Date('2026-09-19T10:00:00Z'),
        geoPoint: { type: 'Point', coordinates: [105.5265, 21.0135] },
        schedule: [
          { dayOfWeek: 2, startTime: '07:00', endTime: '12:00', slot: 'morning' },
          { dayOfWeek: 4, startTime: '07:00', endTime: '12:00', slot: 'morning' },
        ],
        slots: 1,
        description: 'Vận hành máy pha cafe espresso, chuẩn bị trà sen vàng và đồ uống phục vụ cán bộ, sinh viên FPT.',
        requirements: ['Có kinh nghiệm pha chế cơ bản là lợi thế', 'Đúng giờ, chuyên nghiệp'],
        benefits: ['Hỗ trợ ăn sáng', 'Đào tạo chuẩn pha chế barista'],
        busRoutes: ['Bus 72', 'Bus 74'],
        featured: true,
        status: 'approved',
        tags: ['barista', 'cafe', 'fpt', 'highlands'],
        contactPhone: '0977223344',
      },
      {
        employerId: ep2._id,
        storeName: 'Circle K KTX ĐHQGHN',
        title: 'Nhân Viên Cửa Hàng Tiện Lợi Ca Đêm',
        type: 'shift',
        salaryAmount: 32000,
        salaryUnit: 'hour',
        area: 'ktx_dhqg',
        address: 'Khu Ký Túc Xá ĐHQGHN, Xã Thạch Hòa, Huyện Thạch Thất, Hà Nội',
        location: { lat: 21.0062, lng: 105.5235 },
        locationStatus: 'confirmed',
        locationSource: 'map_pin',
        geocodingProvider: 'vietmap',
        locationConfirmedAt: new Date('2026-09-19T10:00:00Z'),
        geoPoint: { type: 'Point', coordinates: [105.5235, 21.0062] },
        schedule: [
          { dayOfWeek: 4, startTime: '22:00', endTime: '06:00', slot: 'evening' },
          { dayOfWeek: 5, startTime: '22:00', endTime: '06:00', slot: 'evening' },
          { dayOfWeek: 6, startTime: '22:00', endTime: '06:00', slot: 'evening' },
        ],
        slots: 2,
        description: 'Bán hàng, kiểm kê hàng hóa trên kệ, hâm nóng đồ ăn nhanh cho sinh viên ca đêm.',
        requirements: ['Có sức khỏe tốt', 'Trung thực, chịu khó thức đêm'],
        benefits: ['Phụ cấp ca đêm +20%', 'Được nghỉ giữa ca 45 phút'],
        busRoutes: ['Bus 74', 'Bus 107'],
        featured: true,
        status: 'approved',
        tags: ['circle_k', 'ca_dem', 'dhqg', 'cua_hang'],
        contactPhone: '0912998877',
      },
      {
        employerId: ep1._id,
        storeName: 'Cơm Niêu Singapore Tân Xã',
        title: 'Phụ Bếp & Ra Món Giờ Cao Điểm',
        type: 'shift',
        salaryAmount: 30000,
        salaryUnit: 'hour',
        area: 'tan_xa',
        address: 'Đường Ven Hồ Tân Xã, Xã Tân Xã, Huyện Thạch Thất, Hà Nội',
        location: { lat: 21.0210, lng: 105.5218 },
        locationStatus: 'confirmed',
        locationSource: 'map_pin',
        geocodingProvider: 'vietmap',
        locationConfirmedAt: new Date('2026-09-19T10:00:00Z'),
        geoPoint: { type: 'Point', coordinates: [105.5218, 21.0210] },
        schedule: [
          { dayOfWeek: 2, startTime: '10:30', endTime: '14:00', slot: 'noon' },
          { dayOfWeek: 4, startTime: '10:30', endTime: '14:00', slot: 'noon' },
          { dayOfWeek: 6, startTime: '17:00', endTime: '21:00', slot: 'evening' },
        ],
        slots: 2,
        description: 'Sơ chế rau củ, phụ bếp chính ra niêu cơm nóng và lau dọn bàn ăn giờ trưa đông khách.',
        requirements: ['Chăm chỉ, sạch sẽ', 'Nhanh nhẹn'],
        benefits: ['Bao cơm trưa/tối tại quán', 'Thưởng chuyên cần'],
        busRoutes: ['Bus 74'],
        featured: false,
        status: 'approved',
        tags: ['phu_bep', 'com_nieu', 'tan_xa'],
        contactPhone: '0966554433',
      },
      {
        employerId: ep2._id,
        storeName: 'Lotteria Tân Xã',
        title: 'Nhân Viên Bán Hàng & Chế Biến Gà Rán',
        type: 'shift',
        salaryAmount: 29000,
        salaryUnit: 'hour',
        area: 'tan_xa',
        address: 'Trục đường chính Tân Xã (Cách Cổng Trường FPT 200m), Thạch Thất, Hà Nội',
        location: { lat: 21.0185, lng: 105.5210 },
        locationStatus: 'confirmed',
        locationSource: 'map_pin',
        geocodingProvider: 'vietmap',
        locationConfirmedAt: new Date('2026-09-19T10:00:00Z'),
        geoPoint: { type: 'Point', coordinates: [105.5210, 21.0185] },
        schedule: [
          { dayOfWeek: 1, startTime: '16:00', endTime: '21:30', slot: 'evening' },
          { dayOfWeek: 3, startTime: '16:00', endTime: '21:30', slot: 'evening' },
        ],
        slots: 3,
        description: 'Order món qua màn hình POS, đóng gói đồ ăn nhanh và chiên gà theo quy chuẩn an toàn vệ sinh.',
        requirements: ['Vui vẻ, hòa đồng', 'Đúng giờ'],
        benefits: ['Ưu đãi suất ăn Lotteria', 'Môi trường máy lạnh sạch đẹp'],
        busRoutes: ['Bus 74'],
        featured: false,
        status: 'approved',
        tags: ['lotteria', 'ga_ran', 'ban_hang', 'tan_xa'],
        contactPhone: '0944332211',
      },
      {
        employerId: ep1._id,
        storeName: 'Căng Tin Tòa Nhà F-Ville 1',
        title: 'Nhân Viên Phục Vụ Cơm Trưa Văn Phòng',
        type: 'shift',
        salaryAmount: 32000,
        salaryUnit: 'hour',
        area: 'fpt_university',
        address: 'Lô E2, Khu Công Nghệ Cao Hòa Lạc, Km29 Đại lộ Thăng Long, Hà Nội',
        location: { lat: 21.0152, lng: 105.5325 },
        locationStatus: 'confirmed',
        locationSource: 'map_pin',
        geocodingProvider: 'vietmap',
        locationConfirmedAt: new Date('2026-09-19T10:00:00Z'),
        geoPoint: { type: 'Point', coordinates: [105.5325, 21.0152] },
        schedule: [
          { dayOfWeek: 1, startTime: '11:00', endTime: '14:00', slot: 'noon' },
          { dayOfWeek: 3, startTime: '11:00', endTime: '14:00', slot: 'noon' },
          { dayOfWeek: 5, startTime: '11:00', endTime: '14:00', slot: 'noon' },
        ],
        slots: 2,
        description: 'Chia suất cơm trưa cho cán bộ nhân viên FPT Software, phát thìa đũa và hỗ trợ lau bàn sau giờ ăn.',
        requirements: ['Nhanh nhẹn, sạch sẽ', 'Phù hợp sinh viên trống slot trưa'],
        benefits: ['Ăn trưa miễn phí tại tòa nhà F-Ville', 'Tiếp xúc môi trường công nghệ cao'],
        busRoutes: ['Bus 72'],
        featured: true,
        status: 'approved',
        tags: ['fville', 'cang_tin', 'fpt_software'],
        contactPhone: '0911882299',
      },
      {
        employerId: ep2._id,
        storeName: 'Nhà Sách Tiền Phong Hòa Lạc',
        title: 'Nhân Viên Bán Hàng & Sắp Xếp Giáo Trình',
        type: 'part_time',
        salaryAmount: 27000,
        salaryUnit: 'hour',
        area: 'ktx_dhqg',
        address: 'Trung Tâm Dịch Vụ Sinh Viên, Khu KTX ĐHQGHN, Thạch Hòa, Hà Nội',
        location: { lat: 21.0055, lng: 105.5242 },
        locationStatus: 'confirmed',
        locationSource: 'map_pin',
        geocodingProvider: 'vietmap',
        locationConfirmedAt: new Date('2026-09-19T10:00:00Z'),
        geoPoint: { type: 'Point', coordinates: [105.5242, 21.0055] },
        schedule: [
          { dayOfWeek: 6, startTime: '08:30', endTime: '17:30', slot: 'morning' },
          { dayOfWeek: 7, startTime: '08:30', endTime: '17:30', slot: 'morning' },
        ],
        slots: 2,
        description: 'Tư vấn văn phòng phẩm, dán tem giá giáo trình đại học và giữ quầy thanh toán ngăn nắp.',
        requirements: ['Gọn gàng, trung thực', 'Yêu thích đọc sách'],
        benefits: ['Mua sách giảm giá 25%', 'Không gian yên tĩnh, lịch sự'],
        busRoutes: ['Bus 74', 'Bus 107'],
        featured: false,
        status: 'approved',
        tags: ['nha_sach', 'dhqg', 'van_phong_pham'],
        contactPhone: '0977119933',
      },
      {
        employerId: ep1._id,
        storeName: 'The Sunset Coffee Hồ Tân Xã',
        title: 'Nhân Viên Order & Chăm Sóc Khách',
        type: 'shift',
        salaryAmount: 30000,
        salaryUnit: 'hour',
        area: 'tan_xa',
        address: 'Bến Thuyền Hồ Tân Xã, Xã Tân Xã, Huyện Thạch Thất, Hà Nội',
        location: { lat: 21.0245, lng: 105.5208 },
        locationStatus: 'confirmed',
        locationSource: 'map_pin',
        geocodingProvider: 'vietmap',
        locationConfirmedAt: new Date('2026-09-19T10:00:00Z'),
        geoPoint: { type: 'Point', coordinates: [105.5208, 21.0245] },
        schedule: [
          { dayOfWeek: 5, startTime: '16:30', endTime: '22:00', slot: 'evening' },
          { dayOfWeek: 6, startTime: '16:30', endTime: '22:00', slot: 'evening' },
          { dayOfWeek: 7, startTime: '16:30', endTime: '22:00', slot: 'evening' },
        ],
        slots: 2,
        description: 'Đón tiếp khách ngắm hoàng hôn ven hồ, ghi order qua tablet và bưng đồ uống ra bàn ngoài trời.',
        requirements: ['Nhanh nhẹn, có nụ cười thân thiện', 'Làm được ca cuối tuần'],
        benefits: ['Thưởng tip cao vào cuối tuần', 'Được ngắm hoàng hôn hồ Tân Xã mỗi ngày'],
        busRoutes: ['Bus 74'],
        featured: true,
        status: 'approved',
        tags: ['cafe', 'sunset', 'ho_tan_xa'],
        contactPhone: '0988667788',
      },
    ]);

    // 5. Micro-tasks (Thuê việc vặt sinh viên Hòa Lạc)
    await MicroTask.create([
      {
        title: 'Nhờ đi chợ mua rau củ & đồ ăn nấu cơm trưa',
        category: 'di_cho',
        description: 'Mình bận làm đồ án kỳ này, cần bạn đi chợ Tân Xã mua ít thịt nạc, rau ngót và trứng mang lên phòng KTX Dom A.',
        reward: 40000,
        location: 'KTX Dom A - ĐH FPT Hòa Lạc',
        deadlineDate: new Date(Date.now() + 86400000 * 3),
        deadline: 'Trước 11:30 trưa nay',
        requesterId: studentUser._id,
        requesterName: 'Nguyễn Minh Khoa',
        requesterPhone: '0981234567',
        status: 'open',
      },
      {
        title: 'Cần xe ôm sinh viên chở từ FPT sang KTX ĐHQG Hòa Lạc',
        category: 'xe_om',
        description: 'Mình có xe đạp bị hỏng, cần bạn sinh viên có xe máy chở mình và balo đồ sang KTX ĐHQG.',
        reward: 35000,
        location: 'Cổng trường FPT Hòa Lạc -> KTX ĐHQG',
        deadlineDate: new Date(Date.now() + 86400000 * 3),
        deadline: '17:00 chiều nay',
        requesterId: studentUser2._id,
        requesterName: 'Trần Thị Linh',
        requesterPhone: '0977654321',
        status: 'open',
      },
      {
        title: 'Lấy hộ thùng hàng Shopee tại bốt bảo vệ cổng 1',
        category: 'lay_ship',
        description: 'Shipper giao kiện hàng to (khoảng 3kg), mình đang trên giảng đường Alpha không xuống được. Nhờ bạn lấy hộ để tại bàn lễ tân KTX Dom C.',
        reward: 25000,
        location: 'Cổng 1 ĐH FPT Hòa Lạc',
        deadlineDate: new Date(Date.now() + 86400000 * 3),
        deadline: 'Trong 1 giờ tới',
        requesterId: studentUser._id,
        requesterName: 'Nguyễn Minh Khoa',
        requesterPhone: '0981234567',
        status: 'accepted',
        assigneeId: studentUser2._id,
        assigneeName: 'Trần Thị Linh',
        assigneePhone: '0977654321',
        note: 'Đang chạy qua lấy hộ bạn đây nhé!',
      },
      {
        title: 'Nhờ bưng đồ chuyển trọ từ Tân Xã về ký túc xá',
        category: 'chuyen_do',
        description: 'Cần 1 bạn nam khỏe mạnh phụ bưng 2 thùng sách và 1 vali từ nhà trọ ngõ 12 Tân Xã lên xe ba gác.',
        reward: 80000,
        location: 'Ngõ 12 Hồ Tân Xã',
        deadlineDate: new Date(Date.now() + 86400000 * 3),
        deadline: 'Sáng mai (Thứ 7)',
        requesterId: studentUser2._id,
        requesterName: 'Trần Thị Linh',
        requesterPhone: '0977654321',
        status: 'open',
      },
      {
        title: 'Cần bạn nấu bữa tối hộ cho phòng 4 người',
        category: 'nau_an',
        description: 'Phòng mình cả 4 đứa đều ôn thi đến tối muộn, thực phẩm đã mua sẵn trong tủ lạnh, cần 1 bạn qua nấu giúp 3 món đơn giản (thịt kho, canh rau ngót, trứng rán) và cắm cơm.',
        reward: 70000,
        location: 'Phòng 302 Nhà trọ BlueHouse Tân Xã',
        deadlineDate: new Date(Date.now() + 86400000 * 3),
        deadline: '18:30 tối nay',
        requesterId: studentUser._id,
        requesterName: 'Nguyễn Minh Khoa',
        requesterPhone: '0981234567',
        status: 'open',
      },
      {
        title: 'Photo & đóng bìa mềm tập đồ án tốt nghiệp',
        category: 'khac',
        description: 'Mình gửi file PDF qua Zalo, nhờ bạn in 3 bản A4 2 mặt và đóng gáy xoắn tại quán Photo Dom B rồi mang sang sảnh tòa Gamma.',
        reward: 30000,
        location: 'Quán Photo Dom B ĐH FPT Hòa Lạc',
        deadlineDate: new Date(Date.now() + 86400000 * 3),
        deadline: 'Trước 15:00 hôm nay',
        requesterId: studentUser2._id,
        requesterName: 'Trần Thị Linh',
        requesterPhone: '0977654321',
        status: 'open',
      },
      {
        title: 'Chở người ốm đi khám tại Trạm y tế Thạch Hòa',
        category: 'xe_om',
        description: 'Bạn cùng phòng mình bị sốt siêu vi, cần bạn có xe máy và mũ bảo hiểm chở bạn ấy sang Trạm Y tế xã Thạch Hòa rồi chở về.',
        reward: 50000,
        location: 'KTX Dom F -> Trạm y tế Thạch Hòa',
        deadlineDate: new Date(Date.now() + 86400000 * 3),
        deadline: 'Càng sớm càng tốt',
        requesterId: studentUser._id,
        requesterName: 'Nguyễn Minh Khoa',
        requesterPhone: '0981234567',
        status: 'completed',
        assigneeId: studentUser2._id,
        assigneeName: 'Trần Thị Linh',
        assigneePhone: '0977654321',
      },
      {
        title: 'Nhờ vác 2 bình nước Lavie 20L lên tầng 4 Dom D',
        category: 'chuyen_do',
        description: 'Thang máy KTX đang bảo trì 30 phút, cần bạn nam giúp bưng 2 bình nước từ sảnh lễ tân lên phòng 412 Dom D.',
        reward: 30000,
        location: 'Sảnh KTX Dom D - ĐH FPT',
        deadlineDate: new Date(Date.now() + 86400000 * 3),
        deadline: 'Trong chiều nay',
        requesterId: studentUser2._id,
        requesterName: 'Trần Thị Linh',
        requesterPhone: '0977654321',
        status: 'open',
      },
      {
        title: 'Đón nhận đồ gửi theo xe buýt 74 tại bến xe FPT',
        category: 'lay_ship',
        description: 'Mẹ mình gửi túi đồ ăn quê theo phụ xe buýt 74 (biển số 29B-12345), dự kiến đến bến xe FPT lúc 16h45. Nhờ bạn ra nhận hộ.',
        reward: 35000,
        location: 'Điểm dừng xe buýt Cổng ĐH FPT Hòa Lạc',
        deadlineDate: new Date(Date.now() + 86400000 * 3),
        deadline: '16:45 hôm nay',
        requesterId: studentUser._id,
        requesterName: 'Nguyễn Minh Khoa',
        requesterPhone: '0981234567',
        status: 'open',
      },
      {
        title: 'Đi chợ Hòa Lạc mua cá chép giòn và rau lẩu',
        category: 'di_cho',
        description: 'Cần bạn quen đi chợ Hòa Lạc chọn mua 1 con cá chép giòn làm sạch sẵn, 1kg nấm kim châm và rau muống cho tiệc sinh nhật tối nay.',
        reward: 60000,
        location: 'Chợ Hòa Lạc, Km 29 Đại Lộ Thăng Long',
        deadlineDate: new Date(Date.now() + 86400000 * 3),
        deadline: 'Trước 16:30 chiều nay',
        requesterId: studentUser2._id,
        requesterName: 'Trần Thị Linh',
        requesterPhone: '0977654321',
        status: 'open',
      },
      {
        title: 'Đem xe máy đi vá xăm và thay dầu máy tại tiệm Tân Xã',
        category: 'khac',
        description: 'Xe Wave Alpha của mình bị đinh non ở bánh sau, để ở bãi xe Dom E. Cần bạn dắt/chở ra quán sửa xe Tân Xã vá và thay nhớt (tiền sửa mình thanh toán riêng).',
        reward: 45000,
        location: 'Bãi xe KTX Dom E ĐH FPT',
        deadlineDate: new Date(Date.now() + 86400000 * 3),
        deadline: 'Trước 18:00',
        requesterId: studentUser._id,
        requesterName: 'Nguyễn Minh Khoa',
        requesterPhone: '0981234567',
        status: 'open',
      },
      {
        title: 'Hỗ trợ dọn dẹp và quét dọn phòng trọ trước khi trả phòng',
        category: 'chuyen_do',
        description: 'Mình chuyển trọ sang KTX, cần 1 bạn phụ dọn rác, lau sàn và cọ nhà vệ sinh phòng 25m2.',
        reward: 90000,
        location: 'Xóm 2 Thôn 4, Tân Xã, Thạch Thất',
        deadlineDate: new Date(Date.now() + 86400000 * 3),
        deadline: 'Chủ Nhật tuần này',
        requesterId: studentUser2._id,
        requesterName: 'Trần Thị Linh',
        requesterPhone: '0977654321',
        status: 'open',
      },
      {
        title: 'Nhờ bạn chăm và cho 2 chú mèo ăn trong 2 ngày về quê',
        category: 'khac',
        description: 'Mình về quê Hải Phòng 2 ngày cuối tuần, cần bạn yêu mèo ghé phòng 1 lần/ngày lúc 19h để châm hạt, thay nước và dọn cát vệ sinh.',
        reward: 80000,
        location: 'Khu trọ Sinh Viên Xanh, Thạch Hòa',
        deadlineDate: new Date(Date.now() + 86400000 * 3),
        deadline: 'Thứ Bảy và Chủ Nhật',
        requesterId: studentUser._id,
        requesterName: 'Nguyễn Minh Khoa',
        requesterPhone: '0981234567',
        status: 'open',
      },
      {
        title: 'Ship hộp cơm trưa từ Căn tin Dom B sang Tòa nhà Beta',
        category: 'di_cho',
        description: 'Trời đang mưa to, mình đang họp nhóm tại phòng Lab 304 Beta. Nhờ bạn lấy hộp cơm sườn đã đặt sẵn ở Căn tin mang qua sảnh Beta giúp.',
        reward: 25000,
        location: 'Căn tin Dom B -> Sảnh Tòa Beta ĐH FPT',
        deadlineDate: new Date(Date.now() + 86400000 * 3),
        deadline: '12:15 trưa nay',
        requesterId: studentUser2._id,
        requesterName: 'Trần Thị Linh',
        requesterPhone: '0977654321',
        status: 'completed',
        assigneeId: studentUser._id,
        assigneeName: 'Nguyễn Minh Khoa',
        assigneePhone: '0981234567',
      }
    ]);

    // 6. Blogs
    await Blog.create([
      {
        title: 'Cẩm Nang Tìm Việc Part-time Cho Tân Sinh Viên Lên Hòa Lạc',
        slug: 'cam-nang-tim-viec-part-time-hoa-lac',
        summary: 'Khu công nghệ cao Hòa Lạc rộng lớn và có những đặc thù riêng. Cùng khám phá các khu vực tập trung nhiều việc làm thêm phù hợp với sinh viên.',
        content: `Khi mới chuyển lên Hòa Lạc học tập tại Đại học FPT, ĐHQGHN hay BKHN, nhiều bạn sinh viên mong muốn tìm kiếm một công việc làm thêm để trang trải sinh hoạt phí và tích lũy trải nghiệm sống.

### 1. Khu vực tập trung nhiều việc làm
- **Nội khu trường & KTX:** Các quán cà phê, căn tin, cửa hàng tiện lợi nội khu. Ưu điểm là gần, đi bộ được và giờ giấc thân thiện với sinh viên.
- **Khu vực Tân Xã:** Nằm sát hồ Tân Xã, tập trung rất nhiều quán trà sữa, quán ăn vặt, quán nhậu sinh viên, tiệm nét.
- **Khu CNC Hòa Lạc:** Các toà nhà văn phòng (F-Ville 1, F-Ville 2, Viettel) thường có các đơn vị dịch vụ F&B, bảo vệ, sự kiện.

### 2. Bí quyết sắp xếp thời gian
Lịch học tại FPT và ĐHQG thường chia theo slot hoặc block. Hãy ưu tiên đăng ký lịch rảnh cố định để chủ quán dễ dàng sắp ca, tránh đăng ký bừa bãi rồi nghỉ ngang ảnh hưởng tới điểm uy tín của bạn!`,
        category: 'cam_nang',
        coverImage: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&auto=format&fit=crop&q=60',
        author: { name: 'Ban Biên Tập Hoa Lạc Việc', role: 'Cố vấn sinh viên' },
        tags: ['hoa_lac', 'tan_sinh_vien', 'part_time'],
        featured: true,
      },
      {
        title: 'Cảnh Giác 4 Bẫy Lừa Đảo Việc Làm Thêm Sinh Viên Thường Gặp',
        slug: 'canh-giac-lua-dao-viec-lam-sinh-vien',
        summary: 'Các chiêu trò thu phí đồng phục, cọc tiền giữ chân, việc nhẹ lương cao online... Những dấu hiệu nhận biết để bảo vệ túi tiền của bạn.',
        content: `Rất nhiều sinh viên năm nhất bị mất tiền oan vì các hội nhóm tuyển dụng không uy tín trên mạng xã hội. Dưới đây là những dấu hiệu bạn cần hết sức cảnh giác:

1. **Bắt đóng tiền cọc, tiền đồng phục hoặc phí hồ sơ:** Mọi nhà tuyển dụng chân chính KHÔNG BAO GIỜ thu tiền của ứng viên trước khi vào làm.
2. **"Việc nhẹ lương 500k/ngày chỉ cần gõ văn bản/bấm like Shopee":** 100% là bẫy lừa đảo nạp tiền làm nhiệm vụ.
3. **Địa điểm phỏng vấn mờ ám:** Hẹn phỏng vấn tại phòng trọ kín hoặc quán nước vỉa hè thay vì tại cửa hàng/văn phòng thật.
4. **Không có thông tin xác thực:** Hãy ưu tiên tìm việc trên nền tảng **Hoa Lạc Việc** vì mọi cửa hàng đều được định vị và xác thực rõ ràng.`,
        category: 'canh_bao',
        coverImage: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&auto=format&fit=crop&q=60',
        author: { name: 'Tổ Trợ Giúp Pháp Lý Sinh Viên', role: 'Admin' },
        tags: ['canh_bao', 'an_toan', 'kinh_nghiem'],
        featured: true,
      },
      {
        title: 'Mô Hình Thuê Việc Vặt: Sinh Viên Hòa Lạc Giúp Nhau Cùng Có Lợi',
        slug: 'mo-hinh-thue-viec-vat-hoa-lac',
        summary: 'Tính năng Chợ việc vặt mới ra mắt trên Hoa Lạc Việc giúp giải quyết các nhu cầu cấp bách: đi chợ hộ, xe ôm nội khu, lấy bưu phẩm...',
        content: `Tại Hòa Lạc, khoảng cách giữa các khu KTX và chợ Tân Xã hay các toà nhà học tập khá xa. Không phải bạn sinh viên nào cũng có xe máy cá nhân.

Chợ việc vặt ra đời như một giải pháp cộng đồng:
- **Người cần:** Đang ốm, bận ôn thi, không có xe máy -> Chỉ cần đăng việc với khoản thù lao từ 20k - 50k.
- **Người làm:** Các bạn có xe máy hoặc có giờ rảnh -> Nhận việc kiếm thêm tiền ăn trưa, tiền xăng ngay lập tức.
- **Minh bạch:** Có thông tin số điện thoại, tài khoản xác thực sinh viên của trường.`,
        category: 'kinh_nghiem',
        coverImage: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&auto=format&fit=crop&q=60',
        author: { name: 'Nguyễn Minh Khoa', role: 'Sinh viên FPT K16' },
        tags: ['viec_vat', 'sinh_vien', 'cong_dong'],
        featured: false,
      },
      {
        title: 'Cẩm Nang Tuyến Xe Buýt 74, 88, 107, 72 Di Chuyển Lên Hòa Lạc',
        slug: 'cam-nang-xe-buyt-hoa-lac',
        summary: 'Tổng hợp chi tiết lộ trình, tần suất, giờ xuất bến các tuyến xe buýt công cộng kết nối trung tâm Hà Nội với Khu công nghệ cao Hòa Lạc.',
        content: `Hệ thống xe buýt công cộng tại Hòa Lạc ngày càng hoàn thiện, giúp sinh viên di chuyển tiết kiệm và thuận tiện:

- **Bus 74:** Bến xe Mỹ Đình ⇄ Xuân Khanh (dừng trực tiếp tại Cổng ĐH FPT và KTX ĐHQG). Tần suất 10 - 15 phút/chuyến. Giá vé 9.000đ.
- **Bus 107:** Kim Mã ⇄ Làng Văn Hóa Các Dân Tộc (chạy cao tốc Thăng Long, dừng tại trạm trung chuyển Hòa Lạc).
- **Bus 88:** Bến xe Mỹ Đình ⇄ Xuân Mai (qua ngã tư Hòa Lạc).
- **Bus 72:** Bến xe Yên Nghĩa ⇄ Xuân Mai (thuận tiện cho các bạn khu vực Hà Đông).

Mẹo nhỏ: Hãy làm vé tháng liên tuyến sinh viên để tiết kiệm tối đa chi phí đi lại giữa trường và nhà!`,
        category: 'cam_nang',
        coverImage: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=60',
        author: { name: 'Ban Biên Tập Hoa Lạc Việc', role: 'Cố vấn sinh viên' },
        tags: ['xe_buyt', 'bus74', 'bus107', 'hoa_lac'],
        featured: true,
      },
      {
        title: 'Bí Quyết Cân Bằng Giữa Lịch Học FPT/ĐHQG Và Đi Làm Thêm Ca Tối',
        slug: 'can-bang-hoc-va-lam-them-hoa-lac',
        summary: 'Đi làm thêm mang lại thu nhập và kinh nghiệm quý giá, nhưng điểm GPA vẫn là ưu tiên hàng đầu. Cách phân bổ thời gian thông minh.',
        content: `Rất nhiều bạn sinh viên rơi vào tình trạng quá tải, thiếu ngủ dẫn đến trượt môn khi bắt đầu đi làm thêm. Dưới đây là những nguyên tắc giúp bạn luôn giữ thế chủ động:

1. **Giới hạn số giờ làm:** Tối đa 20 - 24 giờ/tuần (khoảng 3 - 4 ca làm).
2. **Ưu tiên ca làm gần phòng trọ/KTX:** Giảm thiểu thời gian di chuyển trong đêm lạnh mùa đông Hòa Lạc.
3. **Báo trước với quản lý lịch thi trước 2 tuần:** Các chủ cửa hàng trên Hoa Lạc Việc đều cam kết hỗ trợ sinh viên đổi ca trong các tuần thi cử.
4. **Tận dụng tính năng Khớp lịch học:** Trước khi ứng tuyển bất kỳ việc nào, hãy xem % Khớp lịch để tránh tuyệt đối các ca trùng với giờ lên lớp.`,
        category: 'kinh_nghiem',
        coverImage: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=60',
        author: { name: 'Trần Thị Linh', role: 'Sinh viên ĐHQG' },
        tags: ['can_bang', 'hoc_tap', 'kinh_nghiem'],
        featured: false,
      },
      {
        title: 'Top 5 Tiêu Chí Chọn Việc Làm Part-Time Uy Tín Khu Vực Thạch Thất',
        slug: 'tieu-chi-chon-viec-lam-uy-tin-thach-that',
        summary: 'Làm thế nào để chọn được nơi làm việc minh bạch, trả lương đúng hẹn và đối xử công bằng với sinh viên?',
        content: `Để có một trải nghiệm làm thêm tích cực, hãy lưu ý 5 tiêu chí vàng sau:

1. **Cửa hàng đã được Admin xác thực:** Có huy hiệu xác minh màu xanh trên nền tảng Hoa Lạc Việc.
2. **Mức lương theo giờ rõ ràng:** Dao động từ 25.000đ - 45.000đ/giờ tùy vị trí và kỹ năng.
3. **Có lịch làm việc cố định theo tuần:** Giúp bạn chủ động sắp xếp thời gian làm bài tập lớn.
4. **Khoảng cách di chuyển hợp lý:** Bán kính dưới 3km tính từ trường học hoặc trọ.
5. **Có đánh giá tốt từ các sinh viên khóa trước:** Đọc kỹ phần nhận xét và sao đánh giá của cửa hàng trước khi nộp hồ sơ.`,
        category: 'cam_nang',
        coverImage: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&auto=format&fit=crop&q=60',
        author: { name: 'Ban Biên Tập Hoa Lạc Việc', role: 'Cố vấn tuyển dụng' },
        tags: ['uy_tin', 'tieu_chi', 'tim_viec'],
        featured: false,
      }
    ]);

    // 7. Shifts (Lịch ca làm việc)
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const dayAfterStr = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];

    await Shift.create([
      {
        jobId: j1._id,
        storeName: 'Café Xanh Hòa Lạc',
        employerId: employerUser._id,
        studentId: studentUser._id,
        studentName: 'Nguyễn Minh Khoa',
        role: 'Nhân viên pha chế',
        date: todayStr,
        startTime: '14:00',
        endTime: '21:00',
        hours: 7,
        wageRate: 35000,
        status: 'checked_in',
        attendance: {
          checkInAt: new Date(Date.now() - 3600000),
          locationVerified: true,
        }
      },
      {
        jobId: j1._id,
        storeName: 'Café Xanh Hòa Lạc',
        employerId: employerUser._id,
        studentId: studentUser._id,
        studentName: 'Nguyễn Minh Khoa',
        role: 'Nhân viên pha chế',
        date: yesterdayStr,
        startTime: '14:00',
        endTime: '21:00',
        hours: 7,
        wageRate: 35000,
        status: 'completed',
        attendance: {
          checkInAt: new Date(Date.now() - 86400000 - 3600000 * 7),
          checkOutAt: new Date(Date.now() - 86400000),
          locationVerified: true,
        }
      },
      {
        jobId: j1._id,
        storeName: 'Café Xanh Hòa Lạc',
        employerId: employerUser._id,
        studentId: studentUser._id,
        studentName: 'Nguyễn Minh Khoa',
        role: 'Nhân viên pha chế',
        date: tomorrowStr,
        startTime: '17:00',
        endTime: '22:00',
        hours: 5,
        wageRate: 35000,
        status: 'scheduled',
      },
      {
        jobId: j2._id,
        storeName: 'Bách Hóa SV Market',
        employerId: employerUser2._id,
        studentId: studentUser._id,
        studentName: 'Nguyễn Minh Khoa',
        role: 'Thu ngân quầy hàng',
        date: dayAfterStr,
        startTime: '08:00',
        endTime: '13:00',
        hours: 5,
        wageRate: 32000,
        status: 'scheduled',
      },
      {
        jobId: j2._id,
        storeName: 'Bách Hóa SV Market',
        employerId: employerUser2._id,
        studentId: studentUser2._id,
        studentName: 'Trần Thị Linh',
        role: 'Thu ngân & Soát đồ',
        date: todayStr,
        startTime: '13:00',
        endTime: '18:00',
        hours: 5,
        wageRate: 32000,
        status: 'scheduled',
      },
      {
        jobId: j2._id,
        storeName: 'Bách Hóa SV Market',
        employerId: employerUser2._id,
        studentId: studentUser2._id,
        studentName: 'Trần Thị Linh',
        role: 'Thu ngân & Soát đồ',
        date: yesterdayStr,
        startTime: '13:00',
        endTime: '18:00',
        hours: 5,
        wageRate: 32000,
        status: 'completed',
        attendance: {
          checkInAt: new Date(Date.now() - 86400000 - 3600000 * 5),
          checkOutAt: new Date(Date.now() - 86400000),
          locationVerified: true,
        }
      },
      {
        jobId: addedJobs[0]._id,
        storeName: 'Trà Sữa Mixue Tân Xã',
        employerId: employerUser._id,
        studentId: studentUser2._id,
        studentName: 'Trần Thị Linh',
        role: 'Pha chế kem & trà sữa',
        date: tomorrowStr,
        startTime: '18:00',
        endTime: '22:30',
        hours: 4.5,
        wageRate: 28000,
        status: 'scheduled',
      },
      {
        jobId: addedJobs[2]._id,
        storeName: 'Circle K Hòa Lạc',
        employerId: employerUser2._id,
        studentId: studentUser._id,
        studentName: 'Nguyễn Minh Khoa',
        role: 'Bán hàng ca đêm',
        date: dayAfterStr,
        startTime: '22:00',
        endTime: '06:00',
        hours: 8,
        wageRate: 32000,
        status: 'scheduled',
      }
    ]);

    // 8. Applications (Đơn ứng tuyển)
    await Application.create([
      {
        studentId: studentUser._id,
        studentName: 'Nguyễn Minh Khoa',
        studentPhone: '0981234567',
        studentEmail: 'khoa.nguyen@student.fpt.edu.vn',
        jobId: j1._id,
        employerId: employerUser._id,
        status: 'accepted',
        note: 'Em có thể làm các ca chiều thứ 2 và thứ 4.',
        employerNote: 'Nhận ca chiều. Đúng giờ nhé em.',
      },
      {
        studentId: studentUser._id,
        studentName: 'Nguyễn Minh Khoa',
        studentPhone: '0981234567',
        studentEmail: 'khoa.nguyen@student.fpt.edu.vn',
        jobId: j2._id,
        employerId: employerUser2._id,
        status: 'accepted',
        note: 'Em có xe máy riêng đi lại thuận tiện, có kinh nghiệm thu ngân siêu thị.',
        employerNote: 'Hồ sơ tốt, mời em đến nhận ca sáng thứ Bảy.',
      },
      {
        studentId: studentUser._id,
        studentName: 'Nguyễn Minh Khoa',
        studentPhone: '0981234567',
        studentEmail: 'khoa.nguyen@student.fpt.edu.vn',
        jobId: addedJobs[0]._id, // Mixue
        employerId: employerUser._id,
        status: 'pending',
        note: 'Em rảnh các buổi tối trong tuần từ 18h.',
      },
      {
        studentId: studentUser._id,
        studentName: 'Nguyễn Minh Khoa',
        studentPhone: '0981234567',
        studentEmail: 'khoa.nguyen@student.fpt.edu.vn',
        jobId: addedJobs[4]._id, // Lotteria
        employerId: employerUser._id,
        status: 'rejected',
        note: 'Em ứng tuyển ca sáng Chủ Nhật.',
        employerNote: 'Hiện quán đã đủ nhân sự ca sáng Chủ Nhật, cảm ơn em đã quan tâm.',
      },
      {
        studentId: studentUser2._id,
        studentName: 'Trần Thị Linh',
        studentPhone: '0977654321',
        studentEmail: 'linh.tran@student.fpt.edu.vn',
        jobId: j2._id,
        employerId: employerUser2._id,
        status: 'accepted',
        note: 'Em học KTX ĐHQG, đi xe buýt 72 rất tiện qua SV Market.',
        employerNote: 'Chào mừng em tham gia đội ngũ thu ngân.',
      },
      {
        studentId: studentUser2._id,
        studentName: 'Trần Thị Linh',
        studentPhone: '0977654321',
        studentEmail: 'linh.tran@student.fpt.edu.vn',
        jobId: addedJobs[0]._id, // Mixue
        employerId: employerUser._id,
        status: 'accepted',
        note: 'Em từng có kinh nghiệm làm trà sữa tại quán gần nhà.',
        employerNote: 'Nhận ca tối nhé em, nhớ mặc đồng phục quán cấp.',
      },
      {
        studentId: studentUser2._id,
        studentName: 'Trần Thị Linh',
        studentPhone: '0977654321',
        studentEmail: 'linh.tran@student.fpt.edu.vn',
        jobId: addedJobs[1]._id, // The Alley
        employerId: employerUser2._id,
        status: 'pending',
        note: 'Em có thể làm ca trưa hoặc ca tối cuối tuần.',
      },
      {
        studentId: studentUser2._id,
        studentName: 'Trần Thị Linh',
        studentPhone: '0977654321',
        studentEmail: 'linh.tran@student.fpt.edu.vn',
        jobId: addedJobs[3]._id, // Cơm Niêu Singapore Tân Xã
        employerId: employerUser._id,
        status: 'pending',
        note: 'Em chăm chỉ, nhanh nhẹn, có thể làm tiệc tối thứ 6, 7.',
      }
    ]);

    // 9. Reviews (Đánh giá & Uy tín)
    await Review.create([
      {
        reviewerId: employerUser._id,
        reviewerName: 'Anh Hoàng - Quản lý Café Xanh',
        reviewerRole: 'employer',
        targetId: studentUser._id,
        storeName: 'Café Xanh Hòa Lạc',
        rating: 5,
        type: 'received',
        tags: ['Đúng giờ', 'Chăm chỉ', 'Pha chế khéo tay'],
        comment: 'Bạn Khoa làm việc rất đúng giờ, pha chế nhanh nhẹn và luôn chủ động dọn dẹp quầy bar sạch sẽ trước khi giao ca.',
      },
      {
        reviewerId: employerUser2._id,
        reviewerName: 'Chị Mai - Trưởng quầy SV Market',
        reviewerRole: 'employer',
        targetId: studentUser._id,
        storeName: 'Bách Hóa SV Market',
        rating: 5,
        type: 'received',
        tags: ['Trung thực', 'Nhanh nhẹn', 'Thái độ tốt'],
        comment: 'Khoa tính tiền chuẩn xác, không bị lệch quỹ bao giờ. Rất có trách nhiệm với công việc quầy thu ngân.',
      },
      {
        reviewerId: studentUser._id,
        reviewerName: 'Nguyễn Minh Khoa',
        reviewerRole: 'student',
        targetId: employerUser._id,
        storeName: 'Café Xanh Hòa Lạc',
        rating: 5,
        type: 'given',
        tags: ['Chủ quán tâm lý', 'Trả lương đúng hẹn', 'Môi trường tốt'],
        comment: 'Chủ quán Café Xanh rất thân thiện, luôn hỗ trợ sinh viên đổi ca linh hoạt khi có lịch thi gấp. Lương tính đúng ngày mùng 5 hàng tháng.',
      },
      {
        reviewerId: studentUser._id,
        reviewerName: 'Nguyễn Minh Khoa',
        reviewerRole: 'student',
        targetId: employerUser2._id,
        storeName: 'Bách Hóa SV Market',
        rating: 5,
        type: 'given',
        tags: ['Môi trường văn minh', 'Hỗ trợ ăn nhẹ'],
        comment: 'Bách hóa SV Market quản lý chuyên nghiệp, có điều hòa mát mẻ, được giảm giá 15% khi mua đồ sinh hoạt.',
      },
      {
        reviewerId: employerUser2._id,
        reviewerName: 'Chị Mai - Trưởng quầy SV Market',
        reviewerRole: 'employer',
        targetId: studentUser2._id,
        storeName: 'Bách Hóa SV Market',
        rating: 5,
        type: 'received',
        tags: ['Dễ thương', 'Niềm nở', 'Đúng giờ'],
        comment: 'Linh giao tiếp với khách hàng rất khéo léo, khách ai cũng khen nhân viên quầy tươi cười thân thiện.',
      },
      {
        reviewerId: employerUser._id,
        reviewerName: 'Anh Hoàng - Quản lý Café Xanh',
        reviewerRole: 'employer',
        targetId: studentUser2._id,
        storeName: 'Trà Sữa Mixue Tân Xã',
        rating: 5,
        type: 'received',
        tags: ['Nhanh nhẹn', 'Sạch sẽ'],
        comment: 'Bạn học việc pha trà sữa và lấy kem ốc quế rất nhanh. Tác phong làm việc chuẩn mực.',
      },
      {
        reviewerId: studentUser2._id,
        reviewerName: 'Trần Thị Linh',
        reviewerRole: 'student',
        targetId: employerUser2._id,
        storeName: 'Bách Hóa SV Market',
        rating: 5,
        type: 'given',
        tags: ['Đồng nghiệp thân thiện', 'Lương chuẩn'],
        comment: 'Làm việc ở SV Market rất vui, các anh chị chỉ bảo tận tình từ ngày đầu tiên.',
      },
      {
        reviewerId: studentUser2._id,
        reviewerName: 'Trần Thị Linh',
        reviewerRole: 'student',
        targetId: employerUser._id,
        storeName: 'Trà Sữa Mixue Tân Xã',
        rating: 5,
        type: 'given',
        tags: ['Trà sữa ngon', 'Chủ quán tốt tính'],
        comment: 'Quán đông khách nhưng không khí làm việc luôn tràn đầy năng lượng, có trà sữa uống giữa ca.',
      }
    ]);

    console.log('[Seed] Database successfully populated with initial data!');
    process.exit(0);
  } catch (err) {
    console.error('[Seed] Error:', err);
    process.exit(1);
  }
}

seed();

