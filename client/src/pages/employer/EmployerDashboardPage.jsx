import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Briefcase, Users, Calendar, ArrowLeftRight, CheckCircle, Clock,
  Plus, ChevronRight, ShieldCheck, DollarSign, Star
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getJobs, getApplications, getShifts } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { formatVND } from '@/utils';

export default function EmployerDashboardPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        const [jobsRes, appsRes, shiftsRes] = await Promise.all([
          getJobs({ storeName: user?.name, employerId: user?.id }),
          getApplications({ storeId: user?.id, storeName: user?.name, employerId: user?.id }),
          getShifts({ storeId: user?.id, storeName: user?.name, employerId: user?.id }),
        ]);
        setJobs(jobsRes?.jobs || jobsRes || []);
        setApplications(appsRes || []);
        setShifts(shiftsRes || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (user) loadDashboard();
  }, [user]);

  const pendingApps = applications.filter(a => a.status === 'pending');
  const activeJobs = jobs.filter(j => j.status === 'active' || j.status === 'approved' || !j.status);

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-10">
      {/* Banner */}
      <div className="bg-gradient-to-r from-pink-main via-pink-dark to-purple-700 rounded-3xl p-6 sm:p-8 text-white shadow-soft relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold mb-3">
              <ShieldCheck className="w-3.5 h-3.5" /> Nhà tuyển dụng đã xác minh
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Quản lý tuyển dụng — {user?.name || 'Cửa hàng'} 🏪
            </h1>
            <p className="mt-1 text-pink-100 text-xs sm:text-sm">
              Bạn có <span className="font-bold underline underline-offset-4">{pendingApps.length} đơn ứng tuyển mới</span> từ sinh viên FPT/ĐHQG đang chờ duyệt.
            </p>
          </div>

          <Link
            to="/employer/jobs"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-pink-dark font-bold text-xs hover:bg-pink-50 transition-all shadow-md shrink-0 self-start sm:self-center"
          >
            <Plus className="w-4 h-4" /> Đăng tin tuyển ca mới
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white rounded-2xl p-5 border border-green-50 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Tin đang tuyển</span>
            <div className="w-9 h-9 rounded-xl bg-pink-50 text-pink-main flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-text-main">{activeJobs.length}</div>
            <p className="text-xs text-text-muted mt-1">Tin tuyển dụng hoạt động</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-green-50 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Ứng viên chờ duyệt</span>
            <div className="w-9 h-9 rounded-xl bg-yellow-50 text-yellow-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-text-main">{pendingApps.length}</div>
            <Link to="/employer/applications" className="text-xs text-pink-main font-semibold hover:underline mt-1 block">
              Duyệt hồ sơ ngay →
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-green-50 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Ca làm trong ngày</span>
            <div className="w-9 h-9 rounded-xl bg-green-50 text-green-main flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-text-main">{shifts.length}</div>
            <p className="text-xs text-text-muted mt-1">Đã phân công</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-green-50 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Quản lý nhân viên ca</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-text-main">{shifts.length}</div>
            <Link to="/employer/shifts" className="text-xs text-purple-600 font-semibold hover:underline mt-1 block">
              Xem lịch ca & điểm danh →
            </Link>
          </div>
        </div>
      </div>

      {/* Applications Pending Approval Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Pending Apps Table */}
          <div className="bg-white rounded-3xl p-6 border border-green-50 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                <Users className="w-5 h-5 text-pink-main" /> Ứng viên mới nộp đơn
              </h2>
              <Link to="/employer/applications" className="text-xs font-semibold text-pink-main hover:underline flex items-center gap-1">
                Xem tất cả ứng viên <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {applications.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-8">Chưa có ứng viên nộp đơn</p>
            ) : (
              <div className="divide-y divide-green-50">
                {applications.slice(0, 4).map((app) => (
                  <div key={app._id || app.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-text-main">{app.studentName || 'Sinh viên FPT'}</h4>
                      <p className="text-xs text-text-muted mt-0.5">
                        Ứng tuyển: <strong>{app.jobTitle || app.title}</strong> • {app.appliedAt}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={app.status === 'pending' ? 'warning' : 'success'} size="sm">
                        {app.status === 'pending' ? 'Chờ duyệt' : 'Đã duyệt'}
                      </Badge>
                      <Link
                        to="/employer/applications"
                        className="px-3 py-1.5 rounded-xl bg-pink-50 text-pink-main text-xs font-semibold hover:bg-pink-100"
                      >
                        Duyệt
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Active Jobs Summary */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-green-50 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-text-main">Tin đăng gần đây</h3>
              <Link to="/employer/jobs" className="text-xs text-pink-main font-semibold hover:underline">Quản lý tin</Link>
            </div>

            <div className="space-y-3">
              {jobs.slice(0, 5).map((job) => (
                <div key={job._id || job.id} className="p-3.5 rounded-2xl bg-cream/50 border border-green-50">
                  <h4 className="text-xs font-bold text-text-main line-clamp-1">{job.title}</h4>
                  <p className="text-[11px] text-green-dark font-medium mt-1">
                    {job.salaryAmount ? `${formatVND(job.salaryAmount)}/${job.salaryUnit === 'hour' ? 'giờ' : 'ca'}` : (job.salaryText || '25.000đ/giờ')}
                  </p>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    📍 {job.address || (typeof job.location === 'string' ? job.location : 'Hòa Lạc, Thạch Thất')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
