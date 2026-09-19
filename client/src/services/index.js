/**
 * Service layer — switches between mock and API implementations
 * based on VITE_DATA_MODE env variable.
 */

import * as mock from '@/mocks/store.js';
import * as api from './api.js';

const DATA_MODE = import.meta.env.VITE_DATA_MODE || 'api';

function resolve(mockFn, apiFn) {
  if (DATA_MODE === 'mock') return mockFn;
  return apiFn || mockFn;
}

// ─── AUTH ─────────────────────────────────────────────────────────
export const login = resolve(mock.mockLogin, api.apiLogin);
export const register = resolve(mock.mockRegister, api.apiRegister);
export const getMe = resolve(() => null, api.apiGetMe);

// ─── JOBS ─────────────────────────────────────────────────────────
export const getJobs = resolve(mock.mockGetJobs, api.apiGetJobs);
export const getJob = resolve(mock.mockGetJob, api.apiGetJob);
export const createJob = resolve(mock.mockCreateJob, api.apiCreateJob);
export const resolveMapLink = resolve(api.apiResolveMapLink, api.apiResolveMapLink);
export const searchPlaces = resolve(api.apiSearchPlaces, api.apiSearchPlaces);
export const updateJob = resolve(mock.mockUpdateJob, api.apiUpdateJob);
export const deleteJob = resolve(mock.mockDeleteJob, api.apiDeleteJob);

// ─── APPLICATIONS ─────────────────────────────────────────────────
export const applyToJob = resolve(mock.mockApply, api.apiApply);
export const getApplications = resolve(mock.mockGetApplications, api.apiGetApplications);
export const updateApplication = resolve(mock.mockUpdateApplication, api.apiUpdateApplication);
export const withdrawApplication = resolve(mock.mockWithdrawApplication, api.apiWithdrawApplication);

// ─── SHIFTS ───────────────────────────────────────────────────────
export const getShifts = resolve(mock.mockGetShifts, api.apiGetShifts);
export const createShift = resolve(mock.mockCreateShift, api.apiCreateShift);
export const checkIn = resolve(mock.mockCheckIn, api.apiCheckIn);
export const checkOut = resolve(mock.mockCheckOut, api.apiCheckOut);
export const approveAttendance = resolve(mock.mockApproveAttendance, api.apiApproveAttendance);

// ─── MICRO-TASKS (CHỢ VIỆC VẶT SINH VIÊN) ─────────────────────────
export const getTasks = resolve(
  () => ([
    {
      id: 'task-1',
      title: 'Nhờ đi chợ mua rau củ & đồ ăn nấu cơm trưa',
      category: 'di_cho',
      description: 'Cần bạn đi chợ Tân Xã mua ít thịt nạc, rau ngót và trứng mang lên KTX Dom A.',
      reward: 40000,
      location: 'KTX Dom A - ĐH FPT',
      deadline: 'Trước 11:30 trưa nay',
      requesterName: 'Nguyễn Minh Khoa',
      requesterPhone: '0981234567',
      status: 'open'
    },
    {
      id: 'task-2',
      title: 'Cần xe ôm sinh viên chở từ FPT sang KTX ĐHQG Hòa Lạc',
      category: 'xe_om',
      description: 'Xe mình bị thủng lốp, cần bạn có xe máy chở mình và balo đồ sang KTX ĐHQG.',
      reward: 35000,
      location: 'Cổng trường FPT -> KTX ĐHQG',
      deadline: '17:00 chiều nay',
      requesterName: 'Trần Thị Linh',
      requesterPhone: '0977654321',
      status: 'open'
    },
    {
      id: 'task-3',
      title: 'Lấy hộ thùng hàng Shopee tại bốt bảo vệ cổng 1',
      category: 'lay_ship',
      description: 'Shipper giao kiện hàng to, mình đang bận học trên Alpha. Nhờ lấy để ở bàn lễ tân Dom C.',
      reward: 25000,
      location: 'Cổng 1 ĐH FPT Hòa Lạc',
      deadline: 'Trong 1 giờ tới',
      requesterName: 'Hoàng Anh Tuấn',
      requesterPhone: '0988776655',
      status: 'open'
    }
  ]),
  api.apiGetTasks
);
export const getTask = resolve(
  (id) => ({ id, title: 'Việc vặt' }),
  api.apiGetTask
);
export const createTask = resolve(
  (data) => ({ id: 'task-' + Date.now(), ...data, status: 'open' }),
  api.apiCreateTask
);
export const acceptTask = resolve(
  (id, payload) => ({ id, ...payload, status: 'accepted' }),
  api.apiAcceptTask
);
export const completeTask = resolve(
  (id) => ({ id, status: 'completed' }),
  api.apiCompleteTask
);
export const deleteTask = resolve(
  (id) => ({ id, deleted: true }),
  api.apiDeleteTask
);

// ─── BLOGS ────────────────────────────────────────────────────────
export const getBlogs = resolve(
  () => ([
    {
      _id: 'b1',
      title: 'Cẩm Nang Tìm Việc Part-time Cho Tân Sinh Viên Lên Hòa Lạc',
      slug: 'cam-nang-tim-viec-part-time-hoa-lac',
      summary: 'Khu công nghệ cao Hòa Lạc rộng lớn và có những đặc thù riêng. Cùng khám phá các khu vực tập trung nhiều việc làm thêm phù hợp với sinh viên.',
      category: 'cam_nang',
      coverImage: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&auto=format&fit=crop&q=60',
      author: { name: 'Ban Biên Tập Hoa Lạc Việc', role: 'Cố vấn sinh viên' },
      tags: ['hoa_lac', 'tan_sinh_vien', 'part_time'],
      views: 340,
      createdAt: '2026-09-15T08:00:00.000Z'
    },
    {
      _id: 'b2',
      title: 'Cảnh Giác 4 Bẫy Lừa Đảo Việc Làm Thêm Sinh Viên Thường Gặp',
      slug: 'canh-giac-lua-dao-viec-lam-sinh-vien',
      summary: 'Các chiêu trò thu phí đồng phục, cọc tiền giữ chân, việc nhẹ lương cao online... Những dấu hiệu nhận biết để bảo vệ túi tiền của bạn.',
      category: 'canh_bao',
      coverImage: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&auto=format&fit=crop&q=60',
      author: { name: 'Tổ Trợ Giúp Pháp Lý Sinh Viên', role: 'Admin' },
      tags: ['canh_bao', 'an_toan', 'kinh_nghiem'],
      views: 520,
      createdAt: '2026-09-16T08:00:00.000Z'
    },
    {
      _id: 'b3',
      title: 'Mô Hình Thuê Việc Vặt: Sinh Viên Hòa Lạc Giúp Nhau Cùng Có Lợi',
      slug: 'mo-hinh-thue-viec-vat-hoa-lac',
      summary: 'Tính năng Chợ việc vặt mới ra mắt trên Hoa Lạc Việc giúp giải quyết các nhu cầu cấp bách: đi chợ hộ, xe ôm nội khu, lấy bưu phẩm...',
      category: 'kinh_nghiem',
      coverImage: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&auto=format&fit=crop&q=60',
      author: { name: 'Nguyễn Minh Khoa', role: 'Sinh viên FPT K16' },
      tags: ['viec_vat', 'sinh_vien', 'cong_dong'],
      views: 180,
      createdAt: '2026-09-17T08:00:00.000Z'
    }
  ]),
  api.apiGetBlogs
);
export const getBlog = resolve(
  (slug) => ({
    blog: {
      title: 'Chi tiết bài viết blog',
      content: 'Nội dung bài viết chia sẻ kinh nghiệm việc làm sinh viên Hòa Lạc.',
      category: 'cam_nang',
      author: { name: 'Ban Biên Tập' },
      createdAt: new Date().toISOString()
    }
  }),
  api.apiGetBlog
);

// ─── PROFILES ─────────────────────────────────────────────────────
export const getStudentProfile = resolve(mock.mockGetStudentProfile, api.apiGetStudentProfile);
export const updateStudentProfile = resolve(mock.mockUpdateStudentProfile, api.apiUpdateStudentProfile);
export const getEmployerProfile = resolve(mock.mockGetEmployerProfile, api.apiGetEmployerProfile);
export const updateEmployerProfile = resolve(mock.mockUpdateEmployerProfile, api.apiUpdateEmployerProfile);

// ─── AVAILABILITY ─────────────────────────────────────────────────
export const getAvailability = resolve(mock.mockGetAvailability, api.apiGetAvailability);
export const upsertAvailability = resolve(mock.mockUpsertAvailability, api.apiUpsertAvailability);

// ─── REVIEWS ──────────────────────────────────────────────────────
export const getReviews = resolve(mock.mockGetReviews, api.apiGetReviews);
export const createReview = resolve(mock.mockCreateReview, api.apiCreateReview);

// ─── SAVED JOBS ───────────────────────────────────────────────────
function getSavedJobIds() {
  try {
    return JSON.parse(localStorage.getItem('hlv_saved_jobs') || '[]');
  } catch {
    return [];
  }
}

export const getSavedJobs = resolve(
  mock.mockGetSavedJobs,
  async () => {
    const ids = getSavedJobIds();
    if (ids.length === 0) return [];
    const all = await api.apiGetJobs();
    const list = Array.isArray(all) ? all : (all?.jobs || []);
    return list.filter(j => ids.includes(j._id || j.id));
  }
);

export const toggleSaveJob = resolve(
  mock.mockToggleSaveJob,
  async (jobId) => {
    let ids = getSavedJobIds();
    const exists = ids.includes(jobId);
    if (exists) {
      ids = ids.filter(id => id !== jobId);
    } else {
      ids.push(jobId);
    }
    localStorage.setItem('hlv_saved_jobs', JSON.stringify(ids));
    return !exists;
  }
);

export const isSavedJob = resolve(
  mock.mockIsSavedJob,
  async (jobId) => {
    const ids = getSavedJobIds();
    return ids.includes(jobId);
  }
);

// ─── ADMIN ────────────────────────────────────────────────────────
export const getVerificationRequests = resolve(mock.mockGetVerificationRequests, api.apiGetVerificationRequests);
export const reviewVerification = resolve(
  mock.mockReviewVerification,
  (id, action) => {
    const act = typeof action === 'object' ? action?.status : action;
    return (act === 'approve' || act === 'approved')
      ? api.apiApproveVerification(id)
      : Promise.resolve();
  }
);
export const getReports = resolve(mock.mockGetReports);
export const resolveReport = resolve(mock.mockResolveReport);
export const adminGetJobs = resolve(mock.mockAdminGetJobs, api.apiAdminGetJobs);
export const adminUpdateJob = resolve(mock.mockAdminUpdateJob, api.apiAdminUpdateJob);
export const getAllUsers = resolve(mock.mockGetAllUsers, api.apiGetAllUsers);

// ─── UTIL ─────────────────────────────────────────────────────────
export const dataMode = DATA_MODE;
