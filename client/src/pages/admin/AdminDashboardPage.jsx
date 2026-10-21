import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Briefcase,
  Flag,
  Users,
  BookOpen,
} from 'lucide-react';
import { getAdminOverview } from '@/services';

import { PlatformMetrics } from '@/components/PlatformMetrics.jsx';
import { AnalyticsMetrics } from '@/components/AnalyticsMetrics.jsx';

const EMPTY_OVERVIEW = {
  users: { total: 0, employer: 0, student: 0, worker: 0, locked: 0 },
  jobs: { running: 0, pending: 0 },
  verifications: { pending: 0, queue: [] },
  reports: { pending: 0, queue: [] },
  blogs: 0,
};

const VERIFICATION_TYPES = { employer: 'Nhà tuyển dụng', student: 'Sinh viên', worker: 'Người lao động' };

export default function AdminDashboardPage() {
  const [overview, setOverview] = useState(EMPTY_OVERVIEW);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    // Một API đếm thay cho 5 API tải toàn bộ danh sách (hồ sơ kèm ảnh, tài khoản, tin, blog, báo cáo)
    getAdminOverview()
      .then((data) => { if (active) setOverview({ ...EMPTY_OVERVIEW, ...data }); })
      .catch((err) => { console.error(err); if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  const { users, jobs, verifications, reports, blogs } = overview;
  const runningJobs = jobs.running;
  const pendingJobs = jobs.pending;

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-10">
      {/* Header */}
      <div className="relative overflow-hidden bg-brand-gradient text-white p-6 sm:p-8 rounded-3xl shadow-modal ring-1 ring-white/10"><div className="absolute bottom-0 left-1/3 w-56 h-56 rounded-full bg-white/10 blur-3xl pointer-events-none" aria-hidden="true" />
        <h1 className="text-2xl sm:text-3xl font-bold">Tổng quan Quản trị Hoa Lạc Việc</h1>
        <p className="text-xs sm:text-sm text-green-200 mt-1">
          Hệ thống giám sát chất lượng tin tuyển dụng, xác thực doanh nghiệp địa phương và xử lý phản hồi.
        </p>
      </div>

      {failed && (
        <p role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
          Không tải được số liệu tổng quan. Hãy tải lại trang.
        </p>
      )}

      <PlatformMetrics />

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl ring-1 ring-green-100/70 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Hồ sơ xác thực chờ duyệt</span>
            <ShieldCheck className="w-5 h-5 text-green-dark" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{verifications.pending}</div>
          <Link to="/admin/verification" className="text-xs text-green-dark font-semibold hover:underline mt-1 block">
            Xem hồ sơ →
          </Link>
        </div>

        <div className="bg-white p-5 rounded-2xl ring-1 ring-green-100/70 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Tin bài đang chạy</span>
            <Briefcase className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{runningJobs}</div>
          <Link to="/admin/jobs" className="text-xs text-blue-600 font-semibold hover:underline mt-1 block">
            {pendingJobs > 0 ? `Duyệt ${pendingJobs} tin chờ →` : 'Kiểm duyệt tin →'}
          </Link>
        </div>

        <div className="bg-white p-5 rounded-2xl ring-1 ring-green-100/70 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Báo cáo vi phạm</span>
            <Flag className="w-5 h-5 text-red-700" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{reports.pending}</div>
          <Link to="/admin/reports" className="text-xs text-red-700 font-semibold hover:underline mt-1 block">
            Xử lý báo cáo →
          </Link>
        </div>

        <div className="bg-white p-5 rounded-2xl ring-1 ring-green-100/70 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Bài viết Blog</span>
            <BookOpen className="w-5 h-5 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{blogs}</div>
          <Link to="/admin/blogs" className="text-xs text-emerald-700 font-semibold hover:underline mt-1 block">
            Quản lý Blog →
          </Link>
        </div>

        <div className="bg-white p-5 rounded-2xl ring-1 ring-green-100/70 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Tổng tài khoản</span>
            <Users className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{users.total}</div>
          <Link to="/admin/users" className="text-xs text-purple-600 font-semibold hover:underline mt-1 block">
            Quản lý tài khoản →
          </Link>
        </div>
      </div>

      <AnalyticsMetrics />

      {/* Pending Items Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Verification queue */}
        <div className="bg-white p-6 rounded-3xl ring-1 ring-green-100/70 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-green-dark" /> Hồ sơ xác thực chờ duyệt
            </h3>
            <Link to="/admin/verification" className="text-xs text-green-dark font-semibold hover:underline">
              Tất cả
            </Link>
          </div>

          {verifications.queue.length === 0 ? (
            <p className="text-xs text-gray-500 py-4 text-center">Không có hồ sơ xác thực chờ duyệt</p>
          ) : (
            <div className="space-y-3">
              {verifications.queue.map(item => (
                <div key={item.id} className="p-3.5 rounded-2xl bg-gray-50 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">{item.title || 'Chưa có tên'}</h4>
                    <p className="text-xs text-gray-500">{VERIFICATION_TYPES[item.type] || 'Hồ sơ'}</p>
                  </div>
                  <Link
                    to="/admin/verification"
                    className="px-3 py-2 rounded-xl bg-green-dark text-white text-xs font-semibold hover:bg-green-700"
                  >
                    Xem xét
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reports Queue */}
        <div className="bg-white p-6 rounded-3xl ring-1 ring-green-100/70 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <Flag className="w-4 h-4 text-red-700" /> Phản hồi
            </h3>
            <Link to="/admin/reports" className="text-xs text-red-700 font-semibold hover:underline">
              Tất cả
            </Link>
          </div>

          {reports.queue.length === 0 ? (
            <p className="text-xs text-gray-500 py-4 text-center">Không có báo cáo vi phạm mới</p>
          ) : (
            <div className="space-y-3">
              {reports.queue.map(rep => (
                <div key={rep.id} className="p-3.5 rounded-2xl bg-gray-50 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">{rep.reason}</h4>
                    <p className="text-xs text-gray-500">Từ: {rep.reporterName} • {rep.target}</p>
                  </div>
                  <Link
                    to="/admin/reports"
                    className="px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
                  >
                    Xử lý
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
