import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, Clock, CheckCircle, Bookmark, AlertCircle,
  MapPin, DollarSign, Briefcase, ChevronRight, ShieldCheck
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getShifts, getApplications, getSavedJobs, getJobs } from '@/services';
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
          getJobs({ limit: 4, sort: 'newest' })
        ]);
        setShifts(allShifts || []);
        setApplications(allApps || []);
        setSavedJobs(allSaved || []);
        setRecommendedJobs(Array.isArray(allJobs) ? allJobs : (allJobs?.jobs || []));
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    }
    if (user?.id) loadData();
  }, [user]);

  const upcomingShifts = shifts.filter(s => s.status === 'scheduled' || s.status === 'published' || s.status === 'acknowledged');
  const pendingApps = applications.filter(a => a.status === 'pending' || a.status === 'submitted' || a.status === 'screening');
  const acceptedApps = applications.filter(a => a.status === 'approved' || a.status === 'accepted' || a.status === 'hired');
  const estimatedEarnings = shifts
    .filter(s => s.status !== 'cancelled' && s.status !== 'absent')
    .reduce((sum, s) => sum + (s.totalPay || ((s.hours || 4) * (s.wageRate || 25000))), 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Editorial Header */}
      <div className="bg-white rounded-xl p-5 sm:p-6 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-text-main tracking-tight">
              Xin chào, {user?.name || 'Bạn'}
            </h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-green-50 text-green-800 border border-green-200">
              <ShieldCheck className="w-3 h-3 text-green-600" />
              {user?.role === 'worker' || user?.role === 'freelancer' ? 'Lao động tự do' : 'Sinh viên'}
            </span>
          </div>
          <p className="text-xs text-text-muted">
            Hôm nay bạn có <strong className="text-text-main font-semibold">{upcomingShifts.length} ca làm việc</strong> trong lịch và {pendingApps.length} đơn ứng tuyển đang chờ phản hồi.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link to="/student/jobs" className="btn-primary btn btn-sm">
            <Briefcase className="w-3.5 h-3.5" /> Tìm việc làm
          </Link>
          <Link to="/student/shifts" className="btn-outline btn btn-sm">
            <Calendar className="w-3.5 h-3.5" /> Xem lịch ca
          </Link>
        </div>
      </div>

      {/* Metrics Row - Clean, minimal */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <span className="text-xs font-medium text-text-muted">Ca sắp tới</span>
          <div className="text-xl font-bold text-text-main mt-1">{upcomingShifts.length}</div>
          <p className="text-[11px] text-text-light mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3 text-gray-400" /> Lịch làm trong tuần
          </p>
        </div>

        <div className="card p-4">
          <span className="text-xs font-medium text-text-muted">Đơn đã nộp</span>
          <div className="text-xl font-bold text-text-main mt-1">{applications.length}</div>
          <p className="text-[11px] text-text-light mt-1">
            {acceptedApps.length} đã nhận • {pendingApps.length} chờ duyệt
          </p>
        </div>

        <div className="card p-4">
          <span className="text-xs font-medium text-text-muted">Việc đã lưu</span>
          <div className="text-xl font-bold text-text-main mt-1">{savedJobs.length}</div>
          <Link to="/student/saved" className="text-[11px] text-green-dark hover:underline mt-1 block font-medium">
            Xem danh sách →
          </Link>
        </div>

        <div className="card p-4">
          <span className="text-xs font-medium text-text-muted">Ước tính thu nhập</span>
          <div className="text-xl font-bold text-text-main mt-1">
            {estimatedEarnings.toLocaleString('vi-VN')} đ
          </div>
          <p className="text-[11px] text-text-light mt-1">Dự kiến từ các ca</p>
        </div>
      </div>

      {/* Main Content Grid: Upcoming Shifts & Active Applications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols */}
        <div className="lg:col-span-2 space-y-5">
          {/* Upcoming Shifts */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h2 className="text-sm font-bold text-text-main flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-gray-500" /> Ca làm sắp diễn ra
              </h2>
              <Link to="/student/shifts" className="text-xs font-semibold text-green-dark hover:underline flex items-center gap-1">
                Tất cả <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {upcomingShifts.length === 0 ? (
              <div className="text-center py-6 bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-1 opacity-60" />
                <p className="text-xs font-medium text-text-main">Chưa có ca làm nào sắp tới</p>
                <p className="text-[11px] text-text-muted mt-0.5">Ứng tuyển công việc để nhận phân ca</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingShifts.slice(0, 3).map((shift) => (
                  <div
                    key={shift.id || shift._id}
                    className="p-3 rounded-lg bg-gray-50/60 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-text-main text-xs sm:text-sm">{shift.storeName || 'Cửa hàng'}</span>
                        <Badge variant="success">Đã phân công</Badge>
                      </div>
                      <p className="text-xs text-text-muted mt-1 flex items-center gap-2">
                        <span>{shift.date}</span>
                        <span>•</span>
                        <span>{shift.startTime} - {shift.endTime}</span>
                        {shift.role && <span>• {shift.role}</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <Link
                        to="/student/shifts"
                        className="px-2.5 py-1.5 rounded-md bg-green-main text-white text-xs font-medium hover:bg-green-dark transition-colors inline-flex items-center gap-1"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Điểm danh
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Applications Status */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h2 className="text-sm font-bold text-text-main flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-gray-500" /> Tiến độ ứng tuyển gần đây
              </h2>
              <Link to="/student/applications" className="text-xs font-semibold text-green-dark hover:underline flex items-center gap-1">
                Quản lý <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {applications.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-5">Chưa có đơn ứng tuyển nào</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {applications.slice(0, 4).map((app) => (
                  <div key={app.id || app._id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-text-main truncate">{app.jobTitle || app.title}</h4>
                      <p className="text-[11px] text-text-muted mt-0.5">{app.storeName} • {app.appliedAt}</p>
                    </div>
                    <Badge
                      variant={
                        app.status === 'approved' || app.status === 'accepted' || app.status === 'hired'
                          ? 'success'
                          : app.status === 'rejected'
                          ? 'danger'
                          : 'warning'
                      }
                    >
                      {app.status === 'approved' || app.status === 'accepted' || app.status === 'hired'
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
        <div className="space-y-5">
          {/* Profile Match Status */}
          <div className="card p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Lịch rảnh & Hồ sơ</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Cập nhật khung giờ rảnh và khu vực trọ để hệ thống đối chiếu chính xác các ca làm việc gần bạn.
            </p>
            <Link
              to="/student/profile"
              className="w-full py-2 px-3 rounded-lg bg-gray-100 text-text-main hover:bg-gray-200 font-medium text-xs text-center block transition-colors"
            >
              Cập nhật lịch rảnh →
            </Link>
          </div>

          {/* Quick Recommended Jobs */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-gray-100">
              <h3 className="text-xs font-bold text-text-main">Việc làm mới gợi ý</h3>
              <Link to="/student/jobs" className="text-xs text-green-dark hover:underline font-medium">Tất cả</Link>
            </div>

            <div className="space-y-2.5">
              {recommendedJobs.slice(0, 3).map((job) => (
                <div key={job.id || job._id} className="p-2.5 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-semibold text-text-main line-clamp-1">{job.title}</h4>
                    <span className="text-xs font-bold text-green-dark shrink-0">{job.salaryAmount ? `${Number(job.salaryAmount).toLocaleString('vi-VN')}đ` : ''}</span>
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5">{job.storeName || 'Cửa hàng'}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">{job.type === 'shift' ? 'Theo ca' : 'Part-time'}</span>
                    <Link to={`/jobs/${job.id || job._id}`} className="font-medium text-green-dark hover:underline">
                      Chi tiết →
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
