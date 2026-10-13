import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Briefcase,
  Flag,
  Users,
  BookOpen,
  Store,
  GraduationCap,
  HardHat,
  UserCog,
} from 'lucide-react';
import { getVerificationRequests, getReports, adminGetJobs, getAllUsers, getBlogs } from '@/services';

import { PlatformMetrics } from '@/components/PlatformMetrics.jsx';

const VERIFICATION_TYPES = { employer: 'Nhà tuyển dụng', student: 'Sinh viên', worker: 'Người lao động' };

function verificationTitle(v) {
  return v.verificationType === 'employer' ? (v.storeName || v.user?.name) : (v.user?.name || v.studentCode);
}

export default function AdminDashboardPage() {
  const [verifications, setVerifications] = useState([]);
  const [reports, setReports] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [users, setUsers] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [failed, setFailed] = useState([]);

  useEffect(() => {
    let active = true;
    // allSettled: một API lỗi chỉ làm mất thẻ của nó, không làm 0 cả bảng
    const sources = [
      ['hồ sơ xác thực', getVerificationRequests(), (v) => setVerifications(Array.isArray(v) ? v : [])],
      ['báo cáo', getReports({ status: 'pending', limit: 100 }), (v) => setReports(Array.isArray(v) ? v : [])],
      ['tin tuyển dụng', adminGetJobs(), (v) => setJobs(v?.jobs || [])],
      ['tài khoản', getAllUsers(), (v) => setUsers(Array.isArray(v) ? v : [])],
      ['blog', getBlogs({ limit: 100 }), (v) => setBlogs(Array.isArray(v) ? v : [])],
    ];
    Promise.allSettled(sources.map(([, p]) => p)).then((results) => {
      if (!active) return;
      const bad = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') sources[i][2](r.value);
        else { console.error(sources[i][0], r.reason); bad.push(sources[i][0]); }
      });
      setFailed(bad);
    });
    return () => { active = false; };
  }, []);

  const pendingVerifications = verifications.filter(v => v.status === 'pending');
  const pendingReports = reports.filter(r => r.status === 'pending');
  const countRole = (role) => users.filter(u => u.role === role).length;
  const accountStats = [
    { key: 'employer', label: 'Nhà tuyển dụng', icon: Store, tone: 'text-green-dark bg-green-50', count: countRole('employer') },
    { key: 'student', label: 'Sinh viên', icon: GraduationCap, tone: 'text-blue-700 bg-blue-50', count: countRole('student') },
    { key: 'worker', label: 'Lao động tự do', icon: HardHat, tone: 'text-amber-700 bg-amber-50', count: countRole('worker') + countRole('freelancer') },
  ];
  const otherAccounts = users.length - accountStats.reduce((sum, a) => sum + a.count, 0);
  const lockedAccounts = users.filter(u => u.status === 'locked').length;
  const runningJobs = jobs.filter(j => j.status === 'approved').length;
  const pendingJobs = jobs.filter(j => j.status === 'pending').length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-10">
      {/* Header */}
      <div className="relative overflow-hidden bg-brand-gradient text-white p-6 sm:p-8 rounded-3xl shadow-modal ring-1 ring-white/10"><div className="absolute bottom-0 left-1/3 w-56 h-56 rounded-full bg-white/10 blur-3xl pointer-events-none" aria-hidden="true" />
        <h1 className="text-2xl sm:text-3xl font-bold">Tổng quan Quản trị Hoa Lạc Việc</h1>
        <p className="text-xs sm:text-sm text-green-200 mt-1">
          Hệ thống giám sát chất lượng tin tuyển dụng, xác thực doanh nghiệp địa phương và xử lý tranh chấp.
        </p>
      </div>

      {failed.length > 0 && (
        <p role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
          Không tải được: {failed.join(', ')}. Các số liệu tương ứng bên dưới có thể chưa đúng, hãy tải lại trang.
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
          <div className="text-2xl font-bold text-gray-900 mt-2">{pendingVerifications.length}</div>
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
          <div className="text-2xl font-bold text-gray-900 mt-2">{pendingReports.length}</div>
          <Link to="/admin/reports" className="text-xs text-red-700 font-semibold hover:underline mt-1 block">
            Xử lý báo cáo →
          </Link>
        </div>

        <div className="bg-white p-5 rounded-2xl ring-1 ring-green-100/70 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Bài viết Blog</span>
            <BookOpen className="w-5 h-5 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{blogs.length}</div>
          <Link to="/admin/blogs" className="text-xs text-emerald-700 font-semibold hover:underline mt-1 block">
            Quản lý Blog →
          </Link>
        </div>

        <div className="bg-white p-5 rounded-2xl ring-1 ring-green-100/70 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Tổng tài khoản</span>
            <Users className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{users.length}</div>
          <Link to="/admin/users" className="text-xs text-purple-600 font-semibold hover:underline mt-1 block">
            Quản lý tài khoản →
          </Link>
        </div>
      </div>

      {/* Thống kê tài khoản theo vai trò */}
      <section className="space-y-3" aria-labelledby="account-stats-title">
        <div className="flex items-center justify-between">
          <h2 id="account-stats-title" className="text-lg font-bold text-text-main flex items-center gap-2">
            <Users className="w-5 h-5 text-green-dark" /> Thống kê tài khoản
          </h2>
          <Link to="/admin/users" className="text-xs text-green-dark font-semibold hover:underline">Quản lý tài khoản →</Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {accountStats.map(({ key, label, icon: Icon, tone, count }) => (
            <div key={key} className="bg-white p-4 rounded-2xl ring-1 ring-green-100/70 shadow-card flex items-center gap-3">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone}`}><Icon className="w-5 h-5" aria-hidden="true" /></span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-500 truncate">{label}</p>
                <p className="text-2xl font-bold text-gray-900">{count}</p>
              </div>
            </div>
          ))}
          <div className="bg-white p-4 rounded-2xl ring-1 ring-green-100/70 shadow-card flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-purple-700 bg-purple-50"><UserCog className="w-5 h-5" aria-hidden="true" /></span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-500 truncate">Quản trị / chờ phân vai</p>
              <p className="text-2xl font-bold text-gray-900">{otherAccounts}</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-text-muted">
          Tổng {users.length} tài khoản{lockedAccounts > 0 ? `, trong đó ${lockedAccounts} đang bị khóa` : ''}.
        </p>
      </section>

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

          {pendingVerifications.length === 0 ? (
            <p className="text-xs text-gray-500 py-4 text-center">Không có hồ sơ xác thực chờ duyệt</p>
          ) : (
            <div className="space-y-3">
              {pendingVerifications.slice(0, 3).map(item => (
                <div key={item.id} className="p-3.5 rounded-2xl bg-gray-50 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">{verificationTitle(item) || 'Chưa có tên'}</h4>
                    <p className="text-xs text-gray-500">{VERIFICATION_TYPES[item.verificationType] || 'Hồ sơ'}</p>
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
              <Flag className="w-4 h-4 text-red-700" /> Phản hồi & Báo cáo tranh chấp
            </h3>
            <Link to="/admin/reports" className="text-xs text-red-700 font-semibold hover:underline">
              Tất cả
            </Link>
          </div>

          {pendingReports.length === 0 ? (
            <p className="text-xs text-gray-500 py-4 text-center">Không có báo cáo vi phạm mới</p>
          ) : (
            <div className="space-y-3">
              {pendingReports.slice(0, 3).map(rep => (
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
