import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, Clock, CheckCircle, Bookmark, AlertCircle, ArrowRight,
  MapPin, DollarSign, Star, Briefcase, ChevronRight, User, ShieldCheck
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getShifts, getApplications, getSavedJobs, getJobs } from '@/services';
import { JobCard } from '@/components/JobCard.jsx';
import { Badge } from '@/components/Badge.jsx';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [applications, setApplications] = useState([]);
  const [savedJobs, setSavedJobs] = useState([]);
  const [recommendedJobs, setRecommendedJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [allShifts, allApps, allSaved, allJobs] = await Promise.all([
          getShifts(),
          getApplications({ studentId: user?.id }),
          getSavedJobs(),
          getJobs({ limit: 4 })
        ]);
        setShifts(allShifts || []);
        setApplications(allApps || []);
        setSavedJobs(allSaved || []);
        setRecommendedJobs(allJobs?.jobs || []);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    }
    if (user?.id) loadData();
  }, [user]);

  const upcomingShifts = shifts.filter(s => s.status === 'scheduled');
  const pendingApps = applications.filter(a => a.status === 'pending');
  const acceptedApps = applications.filter(a => a.status === 'approved' || a.status === 'accepted');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-green-main to-green-dark rounded-3xl p-6 sm:p-8 text-white shadow-soft relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5" /> Sinh viên đã xác thực Hòa Lạc
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Xin chào, {user?.name || 'Bạn'}! 👋
          </h1>
          <p className="mt-2 text-green-50 text-sm sm:text-base leading-relaxed">
            Hôm nay bạn có <span className="font-semibold text-white underline decoration-pink-300 underline-offset-4">{upcomingShifts.length} ca làm việc</span> sắp tới và {pendingApps.length} đơn ứng tuyển đang chờ duyệt.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              to="/student/jobs"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-green-dark font-semibold text-sm hover:bg-green-50 transition-all shadow-sm"
            >
              <Briefcase className="w-4 h-4" /> Tìm việc gần đây
            </Link>
            <Link
              to="/student/shifts"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 text-white font-medium text-sm hover:bg-white/25 transition-all backdrop-blur-md"
            >
              <Calendar className="w-4 h-4" /> Xem lịch ca
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white rounded-2xl p-5 border border-green-50 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Ca sắp tới</span>
            <div className="w-9 h-9 rounded-xl bg-green-50 text-green-main flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-text-main">{upcomingShifts.length}</div>
            <p className="text-xs text-green-dark mt-1 flex items-center gap-1 font-medium">
              <Clock className="w-3 h-3" /> Trong 7 ngày tới
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-green-50 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Đơn đã nộp</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-text-main">{applications.length}</div>
            <p className="text-xs text-text-muted mt-1">
              <span className="text-green-600 font-semibold">{acceptedApps.length} đã nhận</span> • {pendingApps.length} chờ
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-green-50 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Việc đã lưu</span>
            <div className="w-9 h-9 rounded-xl bg-pink-50 text-pink-main flex items-center justify-center">
              <Bookmark className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-text-main">{savedJobs.length}</div>
            <Link to="/student/saved" className="text-xs text-pink-main hover:underline mt-1 block font-medium">
              Xem danh sách →
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-green-50 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Ước tính thu nhập</span>
            <div className="w-9 h-9 rounded-xl bg-yellow-50 text-yellow-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-text-main">1.850.000đ</div>
            <p className="text-xs text-text-muted mt-1">Tháng này (dự kiến)</p>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Next Shift & Application Quick View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Next Shifts & Active Applications */}
        <div className="lg:col-span-2 space-y-6">
          {/* Next Shift Box */}
          <div className="bg-white rounded-3xl p-6 border border-green-50 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                <Clock className="w-5 h-5 text-green-main" /> Ca làm sắp diễn ra
              </h2>
              <Link to="/student/shifts" className="text-xs font-semibold text-green-main hover:underline flex items-center gap-1">
                Xem tất cả <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {upcomingShifts.length === 0 ? (
              <div className="text-center py-8 bg-cream/50 rounded-2xl border border-dashed border-green-100">
                <Calendar className="w-10 h-10 text-text-muted mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium text-text-main">Bạn chưa có ca làm nào trong lịch</p>
                <p className="text-xs text-text-muted mt-1">Ứng tuyển công việc để nhận ca phân công</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingShifts.slice(0, 2).map((shift) => (
                  <div
                    key={shift.id}
                    className="p-4 rounded-2xl bg-cream/60 border border-green-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-green-main transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-text-main text-base">{shift.storeName || ' Highland Coffee Tân Xã'}</span>
                        <Badge variant="success" size="sm">Đã phân công</Badge>
                      </div>
                      <p className="text-xs text-text-muted mt-1 flex items-center gap-2">
                        <span>📅 {shift.date}</span>
                        <span>⏰ {shift.startTime} - {shift.endTime}</span>
                      </p>
                      <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-red-400" /> {shift.location || 'Thôn 3, Tân Xã, Thạch Thất'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Link
                        to="/student/shifts"
                        className="px-3.5 py-2 rounded-xl bg-green-main text-white text-xs font-semibold hover:bg-green-dark transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Điểm danh (Check-in)
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Applications Status */}
          <div className="bg-white rounded-3xl p-6 border border-green-50 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-green-main" /> Tiến độ ứng tuyển gần đây
              </h2>
              <Link to="/student/applications" className="text-xs font-semibold text-green-main hover:underline flex items-center gap-1">
                Quản lý ứng tuyển <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {applications.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-6">Chưa có đơn ứng tuyển nào</p>
            ) : (
              <div className="divide-y divide-green-50">
                {applications.slice(0, 4).map((app) => (
                  <div key={app.id} className="py-3.5 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-text-main">{app.jobTitle || app.title}</h4>
                      <p className="text-xs text-text-muted mt-0.5">{app.storeName} • {app.appliedAt}</p>
                    </div>
                    <Badge
                      variant={
                        app.status === 'approved' || app.status === 'accepted'
                          ? 'success'
                          : app.status === 'rejected'
                          ? 'danger'
                          : 'warning'
                      }
                      size="sm"
                    >
                      {app.status === 'approved' || app.status === 'accepted'
                        ? 'Đã nhận việc'
                        : app.status === 'rejected'
                        ? 'Đã từ chối'
                        : 'Đang chờ duyệt'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Quick Match Profile & Recommended Jobs */}
        <div className="space-y-6">
          {/* Profile Match Status */}
          <div className="bg-white rounded-3xl p-6 border border-green-50 shadow-card">
            <h3 className="text-base font-bold text-text-main mb-2">Độ hoàn thiện hồ sơ</h3>
            <div className="w-full bg-green-50 h-3 rounded-full overflow-hidden mb-3">
              <div className="bg-green-main h-full rounded-full transition-all duration-500" style={{ width: '85%' }} />
            </div>
            <div className="flex items-center justify-between text-xs text-text-muted mb-4">
              <span>85% Hoàn thành</span>
              <span className="text-green-main font-semibold">+Matching cao hơn</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed mb-4">
              Cập nhật khung giờ rảnh và vị trí ký túc xá để thuật toán gợi ý công việc sát nơi ở nhất.
            </p>
            <Link
              to="/student/profile"
              className="w-full py-2.5 px-4 rounded-xl bg-green-50 text-green-dark font-semibold text-xs text-center block hover:bg-green-100 transition-colors"
            >
              Chỉnh sửa hồ sơ rảnh ca →
            </Link>
          </div>

          {/* Quick Recommended Jobs */}
          <div className="bg-white rounded-3xl p-6 border border-green-50 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-text-main">Gợi ý cho bạn</h3>
              <Link to="/student/jobs" className="text-xs text-green-main hover:underline">Tất cả</Link>
            </div>

            <div className="space-y-4">
              {recommendedJobs.slice(0, 2).map((job) => (
                <div key={job.id} className="p-3.5 rounded-2xl bg-cream/40 border border-green-50 hover:bg-cream/80 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold text-text-main line-clamp-1">{job.title}</h4>
                    <span className="text-xs font-bold text-green-dark shrink-0">{job.salaryText}</span>
                  </div>
                  <p className="text-xs text-text-muted mt-1">{job.storeName} • {job.distanceText}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <Badge variant="outline" size="sm">{job.jobType}</Badge>
                    <Link to={`/jobs/${job.id}`} className="text-xs font-semibold text-green-main hover:underline">
                      Xem chi tiết →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
