import { useState, useEffect } from 'react';
import {
  Calendar, Clock, CheckCircle, Plus, Users, QrCode, MapPin, Check, X
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getShifts, createShift, approveAttendance } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Modal } from '@/components/Modal.jsx';
import { Toast } from '@/components/Feedback.jsx';

export default function EmployerShiftsPage() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    studentName: 'Nguyễn Văn A',
    role: 'Nhân viên bán ca',
    date: '2026-09-18',
    startTime: '07:00',
    endTime: '12:00',
    hours: 5,
    wageRate: 25000
  });

  useEffect(() => {
    loadShifts();
  }, [user]);

  async function loadShifts() {
    try {
      setLoading(true);
      const data = await getShifts({ storeId: user?.id, storeName: user?.name, employerId: user?.id });
      setShifts(data || []);
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
      const newShift = await createShift({
        ...formData,
        storeName: user?.name || 'Cửa hàng',
        storeId: user?.id,
        employerId: user?.id,
        status: 'scheduled'
      });
      setShifts(prev => [newShift, ...prev]);
      setToast({ type: 'success', message: 'Tạo ca làm việc và phân công thành công!' });
      setIsModalOpen(false);
    } catch (err) {
      setToast({ type: 'error', message: 'Lỗi khi tạo ca làm.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApproveShift(shiftId) {
    await approveAttendance(shiftId);
    setShifts(prev => prev.map(s => (s._id === shiftId || s.id === shiftId) ? { ...s, status: 'completed' } : s));
    setToast({ type: 'success', message: 'Đã xác nhận hoàn thành công cho sinh viên!' });
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-green-50 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main flex items-center gap-2">
            <Calendar className="w-6 h-6 text-pink-main" /> Phân công & Quản lý Ca Làm
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Lên lịch ca làm việc cho nhân viên sinh viên, kiểm tra điểm danh GPS và chốt giờ công.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-pink-main text-white font-bold text-xs hover:bg-pink-dark transition-all shadow-sm shrink-0 self-start sm:self-center"
        >
          <Plus className="w-4 h-4" /> Phân ca mới
        </button>
      </div>

      {/* Shifts List */}
      {loading ? (
        <div className="text-center py-12 text-text-muted">Đang tải danh sách ca...</div>
      ) : shifts.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-green-50 shadow-card space-y-3">
          <Calendar className="w-12 h-12 text-text-muted mx-auto opacity-50" />
          <h3 className="text-base font-bold text-text-main">Chưa có ca làm nào được xếp</h3>
          <p className="text-xs text-text-muted">Bấm "Phân ca mới" để xếp ca làm việc cho nhân viên sinh viên trúng tuyển.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {shifts.map(shift => (
            <div
              key={shift._id || shift.id}
              className="bg-white p-6 rounded-3xl border border-green-50 shadow-card space-y-4 hover:border-pink-200 transition-all"
            >
              <div className="flex items-center justify-between">
                <Badge
                  variant={
                    shift.status === 'completed'
                      ? 'success'
                      : shift.status === 'checked_in'
                      ? 'primary'
                      : 'warning'
                  }
                  size="sm"
                >
                  {shift.status === 'completed'
                    ? 'Đã duyệt công'
                    : shift.status === 'checked_in'
                    ? 'Đang trong ca (Checked In)'
                    : 'Chưa làm'}
                </Badge>
                <span className="text-xs font-bold text-green-dark">
                  {(shift.wageRate || 25000) * (shift.hours || 4)}đ ({shift.hours}h)
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-text-main">{shift.studentName || 'Sinh viên làm ca'}</h3>
                <p className="text-xs text-text-muted mt-0.5">Vị trí: {shift.role || 'Bán ca'}</p>
              </div>

              <div className="p-3 rounded-2xl bg-cream/60 space-y-1 text-xs text-text-muted">
                <p>📅 Ngày làm: <strong className="text-text-main">{shift.date}</strong></p>
                <p>⏰ Khung ca: <strong className="text-text-main">{shift.startTime} - {shift.endTime}</strong></p>
                {shift.checkInTime && <p>📍 Giờ check-in: <strong className="text-green-700">{shift.checkInTime}</strong></p>}
              </div>

              {shift.status !== 'completed' && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => handleApproveShift(shift._id || shift.id)}
                    className="px-4 py-2 rounded-xl bg-green-main text-white text-xs font-semibold hover:bg-green-dark transition-all"
                  >
                    Xác nhận duyệt công ca làm
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Add Shift */}
      {isModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsModalOpen(false)}
          title="Xếp ca làm việc mới"
        >
          <form onSubmit={handleCreateShift} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-text-main mb-1">Tên nhân viên sinh viên *</label>
              <input
                type="text"
                required
                value={formData.studentName}
                onChange={e => setFormData({ ...formData, studentName: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-green-100 focus:outline-none focus:ring-2 focus:ring-pink-main"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-text-main mb-1">Ngày làm</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-green-100 focus:outline-none focus:ring-2 focus:ring-pink-main"
                />
              </div>

              <div>
                <label className="block font-bold text-text-main mb-1">Đơn giá lương (đ/h)</label>
                <input
                  type="number"
                  required
                  value={formData.wageRate}
                  onChange={e => setFormData({ ...formData, wageRate: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-xl border border-green-100 focus:outline-none focus:ring-2 focus:ring-pink-main"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-text-main mb-1">Giờ bắt đầu</label>
                <input
                  type="text"
                  value={formData.startTime}
                  onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-green-100 focus:outline-none focus:ring-2 focus:ring-pink-main"
                />
              </div>

              <div>
                <label className="block font-bold text-text-main mb-1">Giờ kết thúc</label>
                <input
                  type="text"
                  value={formData.endTime}
                  onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-green-100 focus:outline-none focus:ring-2 focus:ring-pink-main"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-text-muted font-semibold"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-pink-main text-white font-semibold hover:bg-pink-dark disabled:opacity-50"
              >
                {submitting ? 'Đang lưu...' : 'Xếp ca'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
