import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, Briefcase, Flag, Users, BookOpen
} from 'lucide-react';
import { getVerificationRequests, getReports, adminGetJobs, getAllUsers, getBlogs } from '@/services';
import { Badge } from '@/components/Badge.jsx';

export default function AdminDashboardPage() {
  const [verifications, setVerifications] = useState([]);
  const [reports, setReports] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [users, setUsers] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAdminData() {
      try {
        setLoading(true);
        const [verRes, repRes, jobsRes, usersRes, blogsRes] = await Promise.all([
          getVerificationRequests(),
          getReports(),
          adminGetJobs(),
          getAllUsers(),
          getBlogs({ limit: 100 }),
        ]);
        setVerifications(verRes || []);
        setReports(repRes || []);
        setJobs(jobsRes?.jobs || []);
        setUsers(usersRes || []);
        setBlogs(Array.isArray(blogsRes) ? blogsRes : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadAdminData();
  }, []);

  const pendingVerifications = verifications.filter(v => v.status === 'pending');
  const pendingReports = reports.filter(r => r.status === 'pending');

  return (
    <div className="space-y-5 max-w-6xl mx-auto animate-fade-in pb-10">
      {/* Header */}
      <div className="bg-white rounded-xl p-5 sm:p-6 border border-gray-200">
        <h1 className="text-lg sm:text-xl font-bold text-text-main tracking-tight">
          Tổng quan Quản trị Hệ thống
        </h1>
        <p className="text-xs text-text-muted mt-1">
          Giám sát tin tuyển dụng địa phương, xác thực giấy phép cơ sở và xử lý các báo cáo vi phạm.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Chờ xác thực</span>
            <ShieldCheck className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-xl font-bold text-text-main mt-1">{pendingVerifications.length}</div>
          <Link to="/admin/verification" className="text-[11px] text-green-dark font-medium hover:underline mt-1 block">
            Xem hồ sơ →
          </Link>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Tin đang chạy</span>
            <Briefcase className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-xl font-bold text-text-main mt-1">{jobs.length}</div>
          <Link to="/admin/jobs" className="text-[11px] text-green-dark font-medium hover:underline mt-1 block">
            Kiểm duyệt →
          </Link>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Báo cáo vi phạm</span>
            <Flag className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-xl font-bold text-text-main mt-1">{pendingReports.length}</div>
          <Link to="/admin/reports" className="text-[11px] text-red-600 font-medium hover:underline mt-1 block">
            Xử lý báo cáo →
          </Link>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Bài viết Blog</span>
            <BookOpen className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-xl font-bold text-text-main mt-1">{blogs.length}</div>
          <Link to="/admin/blogs" className="text-[11px] text-green-dark font-medium hover:underline mt-1 block">
            Quản lý bài →
          </Link>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Tổng tài khoản</span>
            <Users className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-xl font-bold text-text-main mt-1">{users.length}</div>
          <Link to="/admin/users" className="text-[11px] text-green-dark font-medium hover:underline mt-1 block">
            Quản lý tài khoản →
          </Link>
        </div>
      </div>

      {/* Pending Items Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Verification queue */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <h3 className="font-bold text-text-main text-xs sm:text-sm flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-gray-500" /> Yêu cầu xác thực cơ sở
            </h3>
            <Link to="/admin/verification" className="text-xs text-green-dark font-medium hover:underline">
              Tất cả
            </Link>
          </div>

          {pendingVerifications.length === 0 ? (
            <p className="text-xs text-text-muted py-6 text-center">Không có yêu cầu chờ duyệt</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {pendingVerifications.slice(0, 4).map(item => (
                <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-semibold text-text-main">{item.storeName}</h4>
                    <p className="text-[11px] text-text-muted">GPKD: {item.businessLicense || 'GPKD'}</p>
                  </div>
                  <Link
                    to="/admin/verification"
                    className="px-2.5 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-text-main text-xs font-medium transition-colors"
                  >
                    Xem xét
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Reports */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <h3 className="font-bold text-text-main text-xs sm:text-sm flex items-center gap-1.5">
              <Flag className="w-4 h-4 text-gray-500" /> Báo cáo cần xử lý
            </h3>
            <Link to="/admin/reports" className="text-xs text-red-600 font-medium hover:underline">
              Tất cả
            </Link>
          </div>

          {pendingReports.length === 0 ? (
            <p className="text-xs text-text-muted py-6 text-center">Không có báo cáo vi phạm mới</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {pendingReports.slice(0, 4).map(rep => (
                <div key={rep.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-text-main truncate">{rep.target || 'Tin tuyển dụng'}</h4>
                    <p className="text-[11px] text-red-600 truncate">{rep.reason || 'Nghi ngờ gian lận'}</p>
                  </div>
                  <Link
                    to="/admin/reports"
                    className="px-2.5 py-1 rounded-md bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium transition-colors shrink-0"
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
