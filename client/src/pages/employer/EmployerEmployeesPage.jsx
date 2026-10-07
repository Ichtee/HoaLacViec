import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  UserCheck, Phone, MessageCircle, Calendar,
  Search, Mail, AlertTriangle, UserX, CheckCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getEmployments, terminateEmployment } from '@/services';
import { Modal } from '@/components/Modal.jsx';
import { Toast } from '@/components/Feedback.jsx';

export default function EmployerEmployeesPage() {
  const { user } = useAuth();
  const [employments, setEmployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState(null);

  // Terminate employee modal state
  const [terminatingEmp, setTerminatingEmp] = useState(null);
  const [terminationReason, setTerminationReason] = useState('resigned');
  const [terminationNote, setTerminationNote] = useState('');
  const [cancelFutureShifts, setCancelFutureShifts] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadEmployments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getEmployments({
        employerId: user?.id,
      });
      setEmployments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: 'Không thể tải danh sách nhân viên.' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadEmployments();
  }, [loadEmployments]);


  // Active employees
  const activeEmployees = useMemo(() => {
    return employments.filter(e => e.status !== 'terminated');
  }, [employments]);

  // Search filter
  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activeEmployees;
    return activeEmployees.filter(emp => {
      const name = (emp.studentName || '').toLowerCase();
      const phone = (emp.studentPhone || '').toLowerCase();
      const pos = (emp.positionTitle || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || pos.includes(q);
    });
  }, [activeEmployees, searchQuery]);

  // Handle soft termination
  async function handleConfirmTerminate() {
    if (!terminatingEmp) return;
    const empId = terminatingEmp._id || terminatingEmp.id;

    try {
      setSubmitting(true);
      const result = await terminateEmployment(empId, {
        reasonCode: terminationReason,
        note: terminationNote,
        futureShiftAction: cancelFutureShifts ? 'cancel' : 'keep',
      });

      setEmployments(prev => prev.map(e => (e._id || e.id) === empId ? { ...e, status: 'terminated' } : e));
      setToast({
        type: 'success',
        message: `Đã hoàn tất kết thúc hợp tác đối với nhân viên ${terminatingEmp.studentName}. ${result.cancelledShiftsCount > 0 ? `Đã tự động hủy ${result.cancelledShiftsCount} ca tương lai.` : ''}`,
      });
      setTerminatingEmp(null);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi kết thúc hợp tác với nhân viên.' });
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
              {activeEmployees.length} nhân viên đang làm việc
            </span>
          </div>
          <p className="text-xs text-text-muted mt-1.5">
            Danh sách nhân viên chính thức từ các ứng viên đã chấp nhận Offer. Bạn có thể xếp ca, liên hệ trực tiếp hoặc cập nhật trạng thái làm việc.
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

      {/* SEARCH BAR */}
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

      {/* EMPLOYEES GRID */}
      {loading ? (
        <div className="text-center py-16 text-text-muted">Đang tải danh sách nhân viên...</div>
      ) : activeEmployees.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-card space-y-4">
          <UserCheck className="w-12 h-12 text-gray-300 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-text-main">Chưa có nhân viên nào</h3>
            <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">
              Khi ứng viên chấp nhận <strong>Đề nghị nhận việc (Offer)</strong>, hồ sơ nhân viên sẽ tự động được tạo và hiển thị tại đây.
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/employer/applications"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-green-main text-white font-bold text-xs hover:bg-green-dark transition-colors shadow-xs"
            >
              Xem danh sách ứng viên để gửi Offer
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
            const startDateFormatted = emp.startDate ? new Date(emp.startDate).toLocaleDateString('vi-VN') : 'Gần đây';

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
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            {emp.status === 'onboarding' ? 'Đang thử việc' : 'Nhân viên chính thức'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Ngày bắt đầu: <strong className="text-gray-600">{startDateFormatted}</strong> • {emp.workplace}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Position & Wage */}
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <span className="inline-flex items-center gap-1 font-bold text-green-dark bg-green-50 border border-green-200 px-2.5 py-1 rounded-xl text-xs">
                      🎯 {emp.positionTitle}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl text-xs">
                      💰 {(emp.wageRate || 25000).toLocaleString('vi-VN')}đ/{emp.wageUnit === 'hour' ? 'giờ' : emp.wageUnit}
                    </span>
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

                  {/* Actions: Xếp ca & Kết thúc làm việc */}
                  <div className="flex items-center gap-2">
                    <Link
                      to="/employer/shifts"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-green-main hover:bg-green-dark text-white font-bold text-xs shadow-xs transition-colors"
                    >
                      <Calendar className="w-3.5 h-3.5" /> Xếp ca
                    </Link>
                    <button
                      type="button"
                      onClick={() => setTerminatingEmp(emp)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-red-200 text-xs font-bold text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
                    >
                      <UserX className="w-3.5 h-3.5" /> Kết thúc làm việc
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TERMINATE EMPLOYMENT MODAL */}
      {terminatingEmp && (
        <Modal
          isOpen={true}
          onClose={() => setTerminatingEmp(null)}
          title={`Kết thúc hợp tác: ${terminatingEmp.studentName}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900 text-sm">
                  Xác nhận kết thúc làm việc với nhân viên
                </p>
                <p className="text-amber-800 mt-1">
                  Nhân viên <strong>{terminatingEmp.studentName}</strong> ({terminatingEmp.positionTitle}) sẽ được chuyển sang trạng thái kết thúc hợp tác (nghỉ việc). Toàn bộ lịch sử ca làm và bảng công trước đây vẫn được lưu trữ bảo toàn.
                </p>
              </div>
            </div>

            <div>
              <label className="font-bold text-gray-800 block mb-1">Lý do kết thúc *</label>
              <select
                value={terminationReason}
                onChange={e => setTerminationReason(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-gray-200 bg-white font-semibold"
              >
                <option value="resigned">Nhân viên xin nghỉ việc theo nguyện vọng</option>
                <option value="contract_ended">Hết thời hạn hợp đồng / hoàn thành kỳ làm việc</option>
                <option value="dismissed">Cho thôi việc / không đạt yêu cầu</option>
                <option value="other">Lý do khác</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-gray-800 block mb-1">Ghi chú chi tiết:</label>
              <textarea
                rows={2}
                value={terminationNote}
                onChange={e => setTerminationNote(e.target.value)}
                placeholder="Nhập ghi chú chi tiết bàn giao công việc..."
                className="w-full p-2.5 rounded-xl border border-gray-200"
              />
            </div>

            <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={cancelFutureShifts}
                  onChange={e => setCancelFutureShifts(e.target.checked)}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500 w-4 h-4"
                />
                <span>Tự động hủy các ca làm trong tương lai của nhân viên này</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setTerminatingEmp(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmTerminate}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold disabled:opacity-50 transition-colors shadow-xs"
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
