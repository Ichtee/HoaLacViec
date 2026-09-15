import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard, ShieldCheck, Briefcase, Flag, Users, Clock, AlertTriangle, CheckCircle
} from 'lucide-react';
import { getVerificationRequests, getReports, adminGetJobs, getAllUsers } from '@/services';
import { Badge } from '@/components/Badge.jsx';

export default function AdminDashboardPage() {
  const [verifications, setVerifications] = useState([]);
  const [reports, setReports] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAdminData() {
      try {
        setLoading(true);
        const [verRes, repRes, jobsRes, usersRes] = await Promise.all([
          getVerificationRequests(),
          getReports(),
          adminGetJobs(),
          getAllUsers()
        ]);
        setVerifications(verRes || []);
        setReports(repRes || []);
        setJobs(jobsRes?.jobs || []);
        setUsers(usersRes || []);
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
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-10">
      {/* Header */}
      <div className="bg-green-dark text-white p-6 sm:p-8 rounded-3xl shadow-card">
        <h1 className="text-2xl sm:text-3xl font-bold">Tổng quan Quản trị Hoa Lạc Việc 🛡️</h1>
        <p className="text-xs sm:text-sm text-green-200 mt-1">
          Hệ thống giám sát chất lượng tin tuyển dụng, xác thực doanh nghiệp địa phương và xử lý tranh chấp.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Doanh nghiệp chờ duyệt</span>
            <ShieldCheck className="w-5 h-5 text-green-dark" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{pendingVerifications.length}</div>
          <Link to="/admin/verification" className="text-xs text-green-dark font-semibold hover:underline mt-1 block">
            Xem hồ sơ GPKD →
          </Link>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Tin bài đang chạy</span>
            <Briefcase className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{jobs.length}</div>
          <Link to="/admin/jobs" className="text-xs text-blue-600 font-semibold hover:underline mt-1 block">
            Kiểm duyệt tin →
          </Link>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Báo cáo vi phạm</span>
            <Flag className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{pendingReports.length}</div>
          <Link to="/admin/reports" className="text-xs text-red-500 font-semibold hover:underline mt-1 block">
            Xử lý báo cáo →
          </Link>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
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

      {/* Pending Items Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Verification queue */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-green-dark" /> Doanh nghiệp gửi yêu cầu xác thực huy hiệu
            </h3>
            <Link to="/admin/verification" className="text-xs text-green-dark font-semibold hover:underline">
              Tất cả
            </Link>
          </div>

          {pendingVerifications.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">Không có yêu cầu chờ duyệt</p>
          ) : (
            <div className="space-y-3">
              {pendingVerifications.slice(0, 3).map(item => (
                <div key={item.id} className="p-3.5 rounded-2xl bg-gray-50 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">{item.storeName}</h4>
                    <p className="text-[11px] text-gray-500">Mã GPKD: {item.businessLicense || 'GPKD-9988'}</p>
                  </div>
                  <Link
                    to="/admin/verification"
                    className="px-3 py-1.5 rounded-xl bg-green-dark text-white text-[11px] font-semibold hover:bg-green-700"
                  >
                    Duyệt GPKD
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reports Queue */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <Flag className="w-4 h-4 text-red-500" /> Phản hồi & Báo cáo tranh chấp
            </h3>
            <Link to="/admin/reports" className="text-xs text-red-500 font-semibold hover:underline">
              Tất cả
            </Link>
          </div>

          {pendingReports.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">Không có báo cáo vi phạm mới</p>
          ) : (
            <div className="space-y-3">
              {pendingReports.slice(0, 3).map(rep => (
                <div key={rep.id} className="p-3.5 rounded-2xl bg-gray-50 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">{rep.reason}</h4>
                    <p className="text-[11px] text-gray-500">Từ: {rep.reporterName} • {rep.target}</p>
                  </div>
                  <Link
                    to="/admin/reports"
                    className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-[11px] font-semibold hover:bg-red-700"
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
