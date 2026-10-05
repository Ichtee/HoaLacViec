import { useState, useEffect } from 'react';
import {
  Calendar, Clock, CheckCircle, Plus, Users, Check, X,
  Navigation, AlertTriangle, ShieldCheck, DollarSign
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import {
  getShifts,
  createShift,
  approveAttendance,
  disputeShift,
  getApplications,
  getEmployments,
} from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Modal } from '@/components/Modal.jsx';
import { Toast } from '@/components/Feedback.jsx';

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getShiftBadge(status) {
  switch (status) {
    case 'approved':
    case 'completed':
    case 'payroll_ready':
    case 'paid':
      return { variant: 'success', label: 'Đã chốt công 🎉' };
    case 'pending_approval':
      return { variant: 'purple', label: 'Chờ duyệt công ⏳' };
    case 'checked_in':
      return { variant: 'warning', label: 'Đang làm việc' };
    case 'disputed':
      return { variant: 'danger', label: 'Cần đối soát ⚠️' };
    case 'cancelled':
      return { variant: 'neutral', label: 'Đã hủy' };
    case 'scheduled':
    case 'published':
    default:
      return { variant: 'info', label: 'Đã lên lịch' };
  }
}

export default function EmployerShiftsPage() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [disputeModalShift, setDisputeModalShift] = useState(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    studentUserId: '',
    studentName: '',
    role: 'Nhân viên bán ca',
    date: getTodayString(),
    startTime: '08:00',
    endTime: '12:00',
    wageRate: 25000,
  });

  useEffect(() => {
    loadData();
  }, [user]);

  async function loadData() {
    try {
      setLoading(true);
      const [shiftData, empData, appsData] = await Promise.all([
        getShifts({ storeId: user?.id, storeName: user?.name, employerId: user?.id }),
        getEmployments().catch(() => []),
        getApplications({ employerId: user?.id, storeId: user?.id }).catch(() => []),
      ]);

      setShifts(Array.isArray(shiftData) ? shiftData : []);

      // Extract unique candidates from both employments & applications
      const unique = [];
      const seen = new Set();

      if (Array.isArray(empData)) {
        empData.forEach((e) => {
          const sId = e.employeeUserId?._id || e.employeeUserId;
          const sName = e.employeeUserId?.name || e.studentName;
          if (sId && !seen.has(sId.toString())) {
            seen.add(sId.toString());
            unique.push({
              id: sId.toString(),
              employmentId: e._id?.toString(),
              name: sName || 'Nhân viên',
              role: e.positionTitle || 'Nhân viên bán ca',
              wageRate: e.wageRate || 25000,
            });
          }
        });
      }

      if (Array.isArray(appsData)) {
        appsData.forEach((a) => {
          const sId = a.studentUserId?._id || a.studentUserId || a.studentId?._id || a.studentId;
          const sName = a.studentName || a.studentUserId?.name;
          if (sId && !seen.has(sId.toString())) {
            seen.add(sId.toString());
            unique.push({
              id: sId.toString(),
              name: sName || 'Sinh viên',
              role: 'Nhân viên bán ca',
              wageRate: 25000,
            });
          }
        });
      }

      setCandidates(unique);
      if (unique.length > 0 && !formData.studentUserId) {
        setFormData((prev) => ({
          ...prev,
          studentUserId: unique[0].id,
          studentName: unique[0].name,
          role: unique[0].role || prev.role,
          wageRate: unique[0].wageRate || prev.wageRate,
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateShift(e) {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (!formData.studentUserId && !formData.studentName) {
        setToast({ type: 'error', message: 'Vui lòng chọn hoặc nhập tên sinh viên nhận ca.' });
        return;
      }

      const selectedCandidate = candidates.find((c) => c.id === formData.studentUserId);

      const payload = {
        ...formData,
        studentUserId: formData.studentUserId || undefined,
        employeeUserId: formData.studentUserId || undefined,
        employmentId: selectedCandidate?.employmentId || undefined,
        storeName: user?.name || 'Cửa hàng tuyển dụng',
        employerUserId: user?.id,
        status: 'scheduled',
      };

      const res = await createShift(payload);
      const newShift = res?.shift || res?.data || res;

      setShifts((prev) => [newShift, ...prev]);
      setToast({ type: 'success', message: 'Tạo ca làm việc và gửi thông báo cho sinh viên thành công!' });
      setIsModalOpen(false);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi tạo ca làm.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApproveShift(shiftId) {
    try {
      await approveAttendance(shiftId);
      setShifts((prev) =>
        prev.map((s) => ((s._id === shiftId || s.id === shiftId) ? { ...s, status: 'approved', attendanceStatus: 'approved' } : s))
      );
      setToast({ type: 'success', message: 'Đã xác nhận duyệt công và tiền lương cho sinh viên!' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi duyệt công.' });
    }
  }

  async function handleDisputeShift() {
    if (!disputeModalShift) return;
    try {
      await disputeShift(disputeModalShift._id || disputeModalShift.id, disputeReason);
      setShifts((prev) =>
        prev.map((s) =>
          ((s._id === disputeModalShift._id || s.id === disputeModalShift.id)
            ? { ...s, status: 'disputed', disputeReason }
            : s)
        )
      );
      setToast({ type: 'info', message: 'Đã đánh dấu ca làm cần đối soát.' });
      setDisputeModalShift(null);
      setDisputeReason('');
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi gửi đối soát.' });
    }
  }

  const inProgressCount = shifts.filter(
    (s) => s.status === 'checked_in' || s.attendanceStatus === 'checked_in'
  ).length;

  const pendingApprovalCount = shifts.filter(
    (s) => s.status === 'pending_approval' || s.attendanceStatus === 'pending_approval'
  ).length;

  const completedCount = shifts.filter(
    (s) => ['approved', 'completed', 'payroll_ready', 'paid'].includes(s.status) || s.attendanceStatus === 'approved'
  ).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main flex items-center gap-2">
            <Calendar className="w-6 h-6 text-green-dark" /> Phân công & Quản lý Ca Làm
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Xếp lịch ca làm cho sinh viên, đối chiếu tọa độ GPS check-in thực tế và phê duyệt chốt công.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-green-main text-white font-bold text-xs hover:bg-green-dark transition-all shadow-sm shrink-0 self-start sm:self-center"
        >
          <Plus className="w-4 h-4" /> Phân ca mới
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <p className="text-xs text-text-muted">Tổng ca làm</p>
          <p className="text-2xl font-bold text-text-main mt-1">{shifts.length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <p className="text-xs text-text-muted">Đang làm việc</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{inProgressCount}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <p className="text-xs text-text-muted">Chờ duyệt công</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{pendingApprovalCount}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <p className="text-xs text-text-muted">Đã hoàn tất</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{completedCount}</p>
        </div>
      </div>

      {/* Shifts List */}
      {loading ? (
        <div className="text-center py-12 text-text-muted">Đang tải danh sách ca làm...</div>
      ) : shifts.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-stone-200 shadow-card space-y-3">
          <Calendar className="w-12 h-12 text-text-muted mx-auto opacity-40" />
          <h3 className="text-base font-bold text-text-main">Chưa có ca làm nào</h3>
          <p className="text-xs text-text-muted">
            Bấm "Phân ca mới" để xếp ca làm việc cho sinh viên trúng tuyển tại quán.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {shifts.map((shift) => {
            const badge = getShiftBadge(shift.status);
            const distance = shift.attendance?.checkInDistanceMeters;
            const isVerified = shift.attendance?.checkInVerified;
            const workedMins = shift.workedMinutes || (shift.hours ? shift.hours * 60 : 240);
            const payAmount = shift.totalPay || Math.round((workedMins / 60) * (shift.wageRate || 25000));
            const studentDisplayName =
              shift.studentName ||
              shift.studentUserId?.name ||
              shift.employeeUserId?.name ||
              'Sinh viên nhận ca';

            return (
              <div
                key={shift._id || shift.id}
                className="bg-white p-6 rounded-3xl border border-stone-200 hover:border-green-300 transition-all shadow-card flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-green-dark bg-green-50 px-3 py-1 rounded-full border border-green-100">
                      📅 {shift.date}
                    </span>
                    <Badge variant={badge.variant} size="sm">
                      {badge.label}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-text-main leading-snug">
                      {studentDisplayName}
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">{shift.role || shift.positionTitle || 'Nhân viên bán ca'}</p>
                  </div>

                  <div className="space-y-1.5 text-xs text-text-muted pt-1">
                    <p className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-green-main shrink-0" />
                      <span className="font-semibold text-text-main">
                        {shift.startTime} – {shift.endTime}
                      </span>
                      <span>(~{(workedMins / 60).toFixed(1)} tiếng)</span>
                    </p>
                    <p className="flex items-center gap-1 text-green-800 font-semibold">
                      <DollarSign className="w-3.5 h-3.5 text-green-600" />
                      Tiền công: {payAmount.toLocaleString('vi-VN')} VNĐ ({Number(shift.wageRate || 25000).toLocaleString('vi-VN')}đ/h)
                    </p>

                    {/* Real GPS Info */}
                    {distance !== undefined && distance !== null ? (
                      <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-[11px] space-y-0.5">
                        <p className="flex items-center gap-1 text-gray-700">
                          <Navigation className="w-3.5 h-3.5 text-blue-500" />
                          GPS Check-in: <strong>{distance}m</strong>{' '}
                          {isVerified ? (
                            <span className="text-emerald-600 font-bold">✓ Hợp lệ tại quán</span>
                          ) : (
                            <span className="text-amber-600 font-bold">⚠️ Ngoài bán kính</span>
                          )}
                        </p>
                        {shift.attendance?.checkInAt && (
                          <p className="text-gray-500">
                            Vào ca: {new Date(shift.attendance.checkInAt).toLocaleTimeString('vi-VN')}
                          </p>
                        )}
                        {shift.attendance?.checkOutAt && (
                          <p className="text-gray-500">
                            Ra ca: {new Date(shift.attendance.checkOutAt).toLocaleTimeString('vi-VN')}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-400 italic">Chưa thực hiện check-in GPS</p>
                    )}

                    {shift.disputeReason && (
                      <p className="p-2 rounded-xl bg-red-50 text-red-700 text-[11px] border border-red-200">
                        ⚠️ Ghi chú đối soát: {shift.disputeReason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-4 border-t border-stone-100 flex items-center justify-between gap-2">
                  {shift.status === 'pending_approval' || shift.attendanceStatus === 'pending_approval' || shift.status === 'checked_in' || shift.attendanceStatus === 'checked_in' ? (
                    <div className="flex items-center gap-2 w-full">
                      <button
                        onClick={() => handleApproveShift(shift._id || shift.id)}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Duyệt chốt công
                      </button>
                      <button
                        onClick={() => { setDisputeModalShift(shift); setDisputeReason(''); }}
                        className="py-2 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-xs transition-colors"
                      >
                        Đối soát
                      </button>
                    </div>
                  ) : ['approved', 'completed', 'payroll_ready', 'paid'].includes(shift.status) || shift.attendanceStatus === 'approved' ? (
                    <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-emerald-500" /> Đã hoàn tất công ca
                    </span>
                  ) : (
                    <span className="text-xs text-text-muted">Chờ sinh viên đến ca</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Phân Ca Mới */}
      {isModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsModalOpen(false)}
          title="Phân ca làm việc mới"
        >
          <form onSubmit={handleCreateShift} className="space-y-3.5 text-xs">
            <div>
              <label className="font-bold text-text-main block mb-1">Chọn sinh viên nhận ca:</label>
              {candidates.length > 0 ? (
                <select
                  value={formData.studentUserId}
                  onChange={(e) => {
                    const sel = candidates.find((c) => c.id === e.target.value);
                    setFormData({
                      ...formData,
                      studentUserId: e.target.value,
                      studentName: sel?.name || '',
                      role: sel?.role || formData.role,
                      wageRate: sel?.wageRate || formData.wageRate,
                    });
                  }}
                  className="w-full p-2.5 rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-green-main focus:outline-none"
                  required
                >
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.role ? `(${c.role})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Nhập họ tên sinh viên"
                  value={formData.studentName}
                  onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-green-main focus:outline-none"
                  required
                />
              )}
            </div>

            <div>
              <label className="font-bold text-text-main block mb-1">Vị trí / Vai trò:</label>
              <input
                type="text"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-green-main focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="font-bold text-text-main block mb-1">Ngày làm việc:</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-green-main focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-text-main block mb-1">Giờ bắt đầu:</label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-green-main focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-text-main block mb-1">Giờ kết thúc:</label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-green-main focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-text-main block mb-1">Lương theo giờ (VNĐ/giờ):</label>
              <input
                type="number"
                step="1000"
                min="15000"
                value={formData.wageRate}
                onChange={(e) => setFormData({ ...formData, wageRate: Number(e.target.value) })}
                className="w-full p-2.5 rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-green-main focus:outline-none"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-gray-100 text-text-muted font-semibold hover:bg-gray-200"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-green-main text-white font-bold hover:bg-green-dark disabled:opacity-50 shadow-sm"
              >
                {submitting ? 'Đang tạo ca...' : 'Xác nhận phân ca'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Đối Soát Ca Làm */}
      {disputeModalShift && (
        <Modal
          isOpen={true}
          onClose={() => setDisputeModalShift(null)}
          title="Gửi phản hồi đối soát ca làm"
        >
          <div className="space-y-4 text-xs">
            <p className="text-text-main">
              Nhập lý do cần đối soát đối với ca làm của{' '}
              <strong>
                {disputeModalShift.studentName ||
                  disputeModalShift.studentUserId?.name ||
                  disputeModalShift.employeeUserId?.name ||
                  'Sinh viên'}
              </strong>{' '}
              ngày {disputeModalShift.date}:
            </p>
            <textarea
              rows={3}
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Ví dụ: Tọa độ GPS ngoài quán / Sinh viên về sớm 30 phút so với giờ chốt..."
              className="w-full p-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-400 focus:outline-none resize-none"
              required
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setDisputeModalShift(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-text-muted font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDisputeShift}
                className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700"
              >
                Gửi đối soát
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
