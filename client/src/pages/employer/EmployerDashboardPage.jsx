import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase, Users, Calendar, Clock, Plus, ChevronRight, ShieldCheck, UserCheck
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getJobs, getApplications, getShifts, getEmployments } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { formatVND } from '@/utils';

export default function EmployerDashboardPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [employments, setEmployments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        const [jobsRes, appsRes, shiftsRes, empRes] = await Promise.all([
          getJobs({ storeName: user?.name, employerId: user?.id }),
          getApplications({ storeId: user?.id, storeName: user?.name, employerId: user?.id }),
          getShifts({ storeId: user?.id, storeName: user?.name, employerId: user?.id }),
          getEmployments({ employerId: user?.id, status: 'active' }).catch(() => []),
        ]);
        setJobs(jobsRes?.jobs || jobsRes || []);
        setApplications(appsRes || []);
        setShifts(shiftsRes || []);
        setEmployments(empRes || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (user) loadDashboard();
  }, [user]);

  const pendingApps = applications.filter(a => a.status === 'pending' || a.status === 'submitted' || a.status === 'screening');
  const activeJobs = jobs.filter(j => j.status === 'active' || j.status === 'approved' || !j.status);

  return (
    <div className="space-y-5 max-w-6xl mx-auto animate-fade-in pb-10">
      {/* Editorial Header */}
      <div className="bg-white rounded-xl p-5 sm:p-6 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-text-main tracking-tight">
              Quản lý tuyển dụng — {user?.name || 'Cửa hàng'}
            </h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-green-50 text-green-800 border border-green-200">
              <ShieldCheck className="w-3 h-3 text-green-600" /> Cửa hàng xác minh
            </span>
          </div>
          <p className="text-xs text-text-muted">
            Bạn có <strong className="text-text-main font-semibold">{pendingApps.length} đơn ứng tuyển</strong> đang chờ xét duyệt và {employments.length} nhân viên đang hoạt động.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/employer/jobs"
            className="btn-primary btn btn-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Đăng tin tuyển dụng
          </Link>
          <Link
            to="/employer/shifts"
            className="btn-outline btn btn-sm"
          >
            <Calendar className="w-3.5 h-3.5" /> Quản lý ca làm
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <span className="text-xs font-medium text-text-muted">Tin đang tuyển</span>
          <div className="text-xl font-bold text-text-main mt-1">{activeJobs.length}</div>
          <p className="text-[11px] text-text-light mt-1">Tin tuyển hoạt động</p>
        </div>

        <div className="card p-4">
          <span className="text-xs font-medium text-text-muted">Ứng viên chờ duyệt</span>
          <div className="text-xl font-bold text-text-main mt-1">{pendingApps.length}</div>
          <Link to="/employer/applications" className="text-[11px] text-green-dark font-medium hover:underline mt-1 block">
            Duyệt hồ sơ ngay →
          </Link>
        </div>

        <div className="card p-4">
          <span className="text-xs font-medium text-text-muted">Ca làm hôm nay</span>
          <div className="text-xl font-bold text-text-main mt-1">{shifts.length}</div>
          <Link to="/employer/shifts" className="text-[11px] text-green-dark font-medium hover:underline mt-1 block">
            Xem lịch & điểm danh →
          </Link>
        </div>

        <div className="card p-4">
          <span className="text-xs font-medium text-text-muted">Nhân viên chính thức</span>
          <div className="text-xl font-bold text-text-main mt-1">{employments.length}</div>
          <Link to="/employer/employees" className="text-[11px] text-green-dark font-medium hover:underline mt-1 block">
            Danh sách nhân viên →
          </Link>
        </div>
      </div>

      {/* Applications Pending Approval Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Pending Apps Table */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h2 className="text-sm font-bold text-text-main flex items-center gap-1.5">
                <Users className="w-4 h-4 text-gray-500" /> Ứng viên mới nộp đơn
              </h2>
              <Link to="/employer/applications" className="text-xs font-semibold text-green-dark hover:underline flex items-center gap-1">
                Xem tất cả ({applications.length}) <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {applications.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-6">Chưa có ứng viên nộp đơn</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {applications.slice(0, 5).map((app) => (
                  <div key={app._id || app.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-text-main truncate">{app.studentName || 'Ứng viên'}</h4>
                      <p className="text-[11px] text-text-muted mt-0.5 truncate">
                        Ứng tuyển: <strong>{app.jobTitle || app.title}</strong> • {app.appliedAt}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={app.status === 'pending' || app.status === 'submitted' ? 'warning' : 'success'}>
                        {app.status === 'pending' || app.status === 'submitted' ? 'Chờ duyệt' : 'Đã xét'}
                      </Badge>
                      <Link
                        to="/employer/applications"
                        className="px-2.5 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-xs font-medium text-text-main transition-colors"
                      >
                        Xem
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Active Jobs Summary */}
        <div className="space-y-5">
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-xs font-bold text-text-main">Tin đăng gần đây</h3>
              <Link to="/employer/jobs" className="text-xs text-green-dark font-medium hover:underline">Quản lý tin</Link>
            </div>

            <div className="space-y-2">
              {jobs.slice(0, 5).map((job) => (
                <div key={job._id || job.id} className="p-2.5 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                  <h4 className="text-xs font-semibold text-text-main line-clamp-1">{job.title}</h4>
                  <p className="text-[11px] text-green-dark font-medium mt-0.5">
                    {job.salaryAmount ? `${formatVND(job.salaryAmount)}/giờ` : (job.salaryText || '25.000đ/giờ')}
                  </p>
                  <p className="text-[10px] text-text-muted mt-0.5 truncate">
                    {job.address || 'Hòa Lạc, Thạch Thất'}
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
