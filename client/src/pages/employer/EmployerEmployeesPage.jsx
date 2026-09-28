import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  UserCheck, Phone, MessageCircle, Calendar,
  Search, Trash2, Mail, Clock, AlertTriangle
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getApplications, updateApplication, deleteApplication } from '@/services';
import { Modal } from '@/components/Modal.jsx';
import { Toast } from '@/components/Feedback.jsx';

export default function EmployerEmployeesPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState(null);

  // Delete / Offboard employee modal state
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  async function loadData() {
    try {
      setLoading(true);
      const appsData = await getApplications({
        storeId: user?.id,
        storeName: user?.name,
        employerId: user?.id,
      });
      setApplications(Array.isArray(appsData) ? appsData : []);
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

  // Filtered employees by search
  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(emp => {
      const name = (emp.studentName || emp.studentId?.name || '').toLowerCase();
      const phone = (emp.studentPhone || emp.studentId?.phone || '').toLowerCase();
      const role = (emp.selectedPosition || emp.jobTitle || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || role.includes(q);
    });
  }, [employees, searchQuery]);

  // Delete employee handler
  async function handleDeleteEmployee() {
    if (!employeeToDelete) return;
    const empId = employeeToDelete._id || employeeToDelete.id;

    try {
      setSubmitting(true);
      // Try hard delete first, fallback to status update if needed
      try {
        await deleteApplication(empId);
      } catch {
        await updateApplication(empId, {
          status: 'rejected',
          internalNote: 'Đã xóa khỏi danh sách nhân viên',
        });
      }

      setApplications(prev => prev.filter(a => (a._id || a.id) !== empId));
      setToast({
        type: 'success',
        message: `Đã xóa nhân viên ${employeeToDelete.studentName} khỏi danh sách quán thành công.`,
      });
      setEmployeeToDelete(null);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi xóa nhân viên.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-12">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* HEADER & SUMMARY */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-text-main flex items-center gap-2">
              <UserCheck className="w-6 h-6 text-green-dark" /> Danh sách Nhân viên
            </h1>
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-extrabold text-xs border border-emerald-200">
              {employees.length} nhân viên
            </span>
          </div>
          <p className="text-xs text-text-muted mt-1.5">
            Tất cả ứng viên đã được nhận việc tại quán. Bạn có thể xem danh sách, liên hệ trực tiếp, xếp ca làm hoặc xóa nhân viên khi nghỉ việc.
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

      {/* SEARCH BAR (Bỏ lọc theo bài đăng vì đã là nhân viên của quán) */}
      <div className="bg-white p-3.5 rounded-3xl border border-gray-100 shadow-card flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên nhân viên, số điện thoại, vị trí phụ trách..."
            className="w-full pl-9 pr-4 py-2 rounded-2xl border border-gray-200 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-main"
          />
        </div>
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-600 transition-colors"
          >
            Xóa tìm kiếm
          </button>
        )}
      </div>

      {/* EMPLOYEES LIST / GRID */}
      {loading ? (
        <div className="text-center py-16 text-text-muted">Đang tải danh sách nhân viên...</div>
      ) : employees.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-card space-y-4">
          <UserCheck className="w-12 h-12 text-gray-300 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-text-main">Chưa có nhân viên nào</h3>
            <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">
              Khi bạn duyệt trúng tuyển cho ứng viên ở trang <strong>"Ứng viên"</strong>, nhân viên sẽ tự động xuất hiện tại đây.
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/employer/applications"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-green-main text-white font-bold text-xs hover:bg-green-dark transition-colors shadow-xs"
            >
              Xem danh sách ứng viên để xét duyệt
            </Link>
          </div>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-card">
          <p className="text-xs text-gray-500 font-medium">Không tìm thấy nhân viên nào phù hợp với từ khóa "{searchQuery}".</p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="mt-3 px-3.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 transition-colors"
          >
            Xem tất cả nhân viên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredEmployees.map(emp => {
            const joinedDate = emp.updatedAt ? new Date(emp.updatedAt).toLocaleDateString('vi-VN') : 'Gần đây';

            return (
              <div
                key={emp._id || emp.id}
                className="bg-white p-5 sm:p-6 rounded-3xl border border-gray-100 hover:border-green-200 shadow-card transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3.5">
                  {/* Top: Avatar, Name, Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-green-600 to-emerald-500 text-white font-black text-lg flex items-center justify-center shadow-xs shrink-0">
                        {emp.studentName ? emp.studentName.charAt(0).toUpperCase() : 'N'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-base text-gray-900 leading-tight">
                            {emp.studentName}
                          </h3>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200">
                            Nhân viên chính thức
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Ngày nhận việc: <strong className="text-gray-600">{joinedDate}</strong>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Position & Shift Tag */}
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <span className="inline-flex items-center gap-1 font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-xl text-xs">
                      🎯 Vị trí: {emp.selectedPosition || emp.jobTitle || 'Nhân viên'}
                    </span>
                    {emp.selectedShift && (
                      <span className="inline-flex items-center gap-1 font-semibold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-xl text-xs">
                        <Clock className="w-3 h-3 text-green-dark" /> {emp.selectedShift}
                      </span>
                    )}
                  </div>

                  {/* Contact Info */}
                  <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 text-xs space-y-1.5">
                    <p className="text-gray-700 flex items-center gap-2 font-medium">
                      <Phone className="w-3.5 h-3.5 text-green-dark shrink-0" />
                      <span>SĐT: <strong className="text-gray-900">{emp.studentPhone || 'Chưa cập nhật'}</strong></span>
                    </p>
                    {emp.studentEmail && (
                      <p className="text-gray-600 flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span>Email: {emp.studentEmail}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                  {/* Contact buttons */}
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

                  {/* Management actions: Xếp ca & Xóa nhân viên */}
                  <div className="flex items-center gap-2">
                    <Link
                      to="/employer/shifts"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-green-main hover:bg-green-dark text-white font-bold text-xs shadow-xs transition-colors"
                    >
                      <Calendar className="w-3.5 h-3.5" /> Xếp ca
                    </Link>
                    <button
                      type="button"
                      onClick={() => setEmployeeToDelete(emp)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-red-200 text-xs font-bold text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Xóa nhân viên
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CONFIRM DELETE EMPLOYEE MODAL */}
      {employeeToDelete && (
        <Modal
          isOpen={true}
          onClose={() => setEmployeeToDelete(null)}
          title="Xác nhận xóa nhân viên"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-900 text-sm">
                  Bạn có chắc chắn muốn xóa nhân viên này khỏi quán?
                </p>
                <p className="text-red-700 mt-1">
                  Nhân viên <strong>{employeeToDelete.studentName}</strong> (Vị trí: {employeeToDelete.selectedPosition || 'Nhân viên'}) sẽ bị gỡ khỏi danh sách nhân viên chính thức của quán.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEmployeeToDelete(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDeleteEmployee}
                className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {submitting ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
