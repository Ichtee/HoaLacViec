import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, CheckCircle, Phone, MessageCircle, Calendar,
  Building2, Briefcase, Search, UserCheck, UserX,
  Sparkles, ExternalLink, ArrowRight, ShieldCheck, Mail, Clock
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getApplications, updateApplication, getEmployerMyJobs } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Modal } from '@/components/Modal.jsx';
import { Toast } from '@/components/Feedback.jsx';

export default function EmployerEmployeesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterJobId, setFilterJobId] = useState('all');
  const [toast, setToast] = useState(null);

  // Offboarding / Status change modal
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [offboardReason, setOffboardReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  async function loadData() {
    try {
      setLoading(true);
      const [appsData, myJobsData] = await Promise.all([
        getApplications({
          storeId: user?.id,
          storeName: user?.name,
          employerId: user?.id,
        }),
        getEmployerMyJobs().catch(() => []),
      ]);

      setApplications(Array.isArray(appsData) ? appsData : []);
      const jobList = Array.isArray(myJobsData) ? myJobsData : (myJobsData?.items || myJobsData?.jobs || []);
      setJobs(jobList);
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: 'Không thể tải danh sách nhân viên.' });
    } finally {
      setLoading(false);
    }
  }

  // Filter employees: status is 'hired', 'accepted', or 'approved'
  const employees = useMemo(() => {
    return applications.filter(a => ['hired', 'accepted', 'approved'].includes(a.status));
  }, [applications]);

  // Candidates count (not yet hired)
  const candidatesCount = useMemo(() => {
    return applications.filter(a => !['hired', 'accepted', 'approved'].includes(a.status)).length;
  }, [applications]);

  // Filtered employees by search and job
  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return employees.filter(emp => {
      if (filterJobId !== 'all') {
        const jId = emp.jobId?._id || emp.jobId;
        if (String(jId) !== String(filterJobId)) return false;
      }
      if (q) {
        const name = (emp.studentName || emp.studentId?.name || '').toLowerCase();
        const phone = (emp.studentPhone || emp.studentId?.phone || '').toLowerCase();
        const role = (emp.selectedPosition || emp.jobTitle || '').toLowerCase();
        return name.includes(q) || phone.includes(q) || role.includes(q);
      }
      return true;
    });
  }, [employees, searchQuery, filterJobId]);

  // Offboard employee (change status away from hired)
  async function handleOffboard() {
    if (!selectedEmployee) return;
    const empId = selectedEmployee._id || selectedEmployee.id;

    try {
      setSubmitting(true);
      await updateApplication(empId, {
        status: 'rejected',
        internalNote: offboardReason || 'Đã kết thúc hợp tác / nhân viên nghỉ việc',
      });

      setApplications(prev =>
        prev.map(a => ((a._id || a.id) === empId ? { ...a, status: 'rejected' } : a))
      );

      setToast({
        type: 'info',
        message: `Đã cập nhật trạng thái kết thúc hợp tác đối với nhân viên ${selectedEmployee.studentName}.`,
      });
      setSelectedEmployee(null);
      setOffboardReason('');
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi cập nhật trạng thái nhân viên.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-12">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* TOP PRIMARY TABS: ỨNG VIÊN vs NHÂN VIÊN */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
        <Link
          to="/employer/applications"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all text-gray-500 hover:text-gray-900 hover:bg-gray-100"
        >
          <Users className="w-4 h-4" />
          <span>Ứng viên tuyển dụng</span>
          <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 text-[10px] font-black">
            {candidatesCount}
          </span>
        </Link>

        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold bg-pink-main text-white shadow-sm">
          <UserCheck className="w-4 h-4" />
          <span>Nhân viên chính thức</span>
          <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-black">
            {employees.length}
          </span>
        </div>
      </div>

      {/* HEADER & SUMMARY */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-green-dark" /> Danh sách Nhân viên Quán
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Ứng viên sau khi được duyệt trúng tuyển sẽ hiển thị tại đây. Bạn có thể xếp ca, liên hệ trực tiếp hoặc quản lý nhân sự.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/employer/shifts"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-green-main hover:bg-green-dark text-white font-bold text-xs shadow-xs transition-colors"
          >
            <Calendar className="w-4 h-4" /> Đến lịch phân ca
          </Link>
        </div>
      </div>

      {/* SEARCH & FILTERS BAR */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-card flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên nhân viên, số điện thoại, vị trí..."
            className="w-full pl-9 pr-4 py-2 rounded-2xl border border-gray-200 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-main"
          />
        </div>

        {jobs.length > 1 && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-500 font-medium">Quán:</span>
            <select
              value={filterJobId}
              onChange={e => setFilterJobId(e.target.value)}
              className="p-2 rounded-2xl border border-gray-200 bg-white text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-main"
            >
              <option value="all">Tất cả bài đăng ({jobs.length})</option>
              {jobs.map(j => (
                <option key={j._id || j.id} value={j._id || j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* EMPLOYEES GRID */}
      {loading ? (
        <div className="text-center py-16 text-text-muted">Đang tải danh sách nhân viên...</div>
      ) : employees.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-card space-y-4">
          <UserCheck className="w-12 h-12 text-gray-300 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-text-main">Chưa có nhân viên chính thức nào</h3>
            <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">
              Khi bạn duyệt trúng tuyển cho ứng viên tại mục <strong>"Ứng viên tuyển dụng"</strong>, sinh viên sẽ tự động trở thành nhân viên và hiển thị tại đây.
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/employer/applications"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-green-main text-white font-bold text-xs hover:bg-green-dark transition-colors shadow-xs"
            >
              <Users className="w-4 h-4" /> Xem hồ sơ ứng viên để xét duyệt
            </Link>
          </div>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-card">
          <p className="text-xs text-gray-500 font-medium">Không tìm thấy nhân viên nào phù hợp với từ khóa tìm kiếm.</p>
          <button
            type="button"
            onClick={() => { setSearchQuery(''); setFilterJobId('all'); }}
            className="mt-3 px-3.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 transition-colors"
          >
            Xóa tìm kiếm
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredEmployees.map(emp => {
            const joinedDate = emp.updatedAt ? new Date(emp.updatedAt).toLocaleDateString('vi-VN') : 'Gần đây';

            return (
              <div
                key={emp._id || emp.id}
                className="bg-white p-5 sm:p-6 rounded-3xl border border-green-100 shadow-card hover:border-green-300 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Top: Avatar, Name, Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-green-600 to-emerald-500 text-white font-black text-lg flex items-center justify-center shadow-xs shrink-0">
                        {emp.studentName ? emp.studentName.charAt(0).toUpperCase() : 'S'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-base text-gray-900 leading-tight">
                            {emp.studentName}
                          </h3>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200">
                            <CheckCircle className="w-3 h-3 text-emerald-500" /> Nhân viên chính thức
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-gray-400" />
                          <span>{emp.storeName || emp.jobTitle || 'Cửa hàng'}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Position & Shift Tag */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="inline-flex items-center gap-1 font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-xl text-xs">
                      🎯 Vị trí: {emp.selectedPosition || emp.jobTitle || 'Nhân viên bán ca'}
                    </span>
                    {emp.selectedShift && (
                      <span className="inline-flex items-center gap-1 font-semibold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-xl text-xs">
                        <Clock className="w-3 h-3 text-green-dark" /> {emp.selectedShift}
                      </span>
                    )}
                  </div>

                  {/* Contact Info */}
                  <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 text-xs space-y-1">
                    <p className="text-gray-700 flex items-center gap-1.5 font-medium">
                      <Phone className="w-3.5 h-3.5 text-green-dark" />
                      <span>SĐT: <strong>{emp.studentPhone || 'Chưa cập nhật'}</strong></span>
                    </p>
                    {emp.studentEmail && (
                      <p className="text-gray-600 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        <span>Email: {emp.studentEmail}</span>
                      </p>
                    )}
                    <p className="text-[11px] text-gray-400 pt-0.5">
                      Ngày trúng tuyển: {joinedDate}
                    </p>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {emp.studentPhone && (
                      <>
                        <a
                          href={`tel:${emp.studentPhone}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" /> Gọi
                        </a>
                        <a
                          href={`https://zalo.me/${emp.studentPhone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> Zalo
                        </a>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedEmployee(emp)}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Kết thúc việc
                    </button>
                    <Link
                      to="/employer/shifts"
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-green-main hover:bg-green-dark text-white font-bold text-xs shadow-xs transition-colors"
                    >
                      <Calendar className="w-3.5 h-3.5" /> Xếp ca làm
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* OFFBOARD / END CONTRACT MODAL */}
      {selectedEmployee && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedEmployee(null)}
          title={`Kết thúc hợp tác: ${selectedEmployee.studentName}`}
        >
          <div className="space-y-4 text-xs">
            <p className="text-gray-700">
              Bạn có chắc chắn muốn chuyển trạng thái đối với nhân viên <strong>{selectedEmployee.studentName}</strong> không? Sau khi kết thúc hợp tác, sinh viên này sẽ không còn trong danh sách nhân viên chính thức của quán.
            </p>

            <div>
              <label className="font-bold text-gray-800 block mb-1">Lý do kết thúc / Ghi chú nội bộ:</label>
              <textarea
                rows={3}
                value={offboardReason}
                onChange={e => setOffboardReason(e.target.value)}
                placeholder="Ví dụ: Sinh viên hoàn thành kỳ thực tập / Hết thời gian gắn bó / Đổi kế hoạch..."
                className="w-full p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-400 font-medium text-gray-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setSelectedEmployee(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleOffboard}
                className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Đang xử lý...' : 'Xác nhận kết thúc'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
