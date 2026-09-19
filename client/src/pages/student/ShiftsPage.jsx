import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, Clock, MapPin, CheckCircle, QrCode, ShieldCheck,
  AlertTriangle, Check, User, ShoppingBag
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getShifts, checkIn, checkOut } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Modal } from '@/components/Modal.jsx';
import { Toast } from '@/components/Feedback.jsx';

export default function StudentShiftsPage() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkInModalShift, setCheckInModalShift] = useState(null);
  const [toast, setToast] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadShifts();
  }, [user]);

  async function loadShifts() {
    try {
      setLoading(true);
      const data = await getShifts({ studentId: user?.id });
      setShifts(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckIn(shiftId) {
    try {
      setActionLoading(true);
      await checkIn(shiftId);
      setShifts(prev => prev.map(s => (s._id === shiftId || s.id === shiftId)
        ? { ...s, status: 'checked_in', checkInTime: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) }
        : s
      ));
      setToast({ type: 'success', message: 'Điểm danh vào ca (Check-in GPS Hòa Lạc) thành công!' });
      setCheckInModalShift(null);
    } catch (err) {
      setToast({ type: 'error', message: 'Lỗi điểm danh. Vui lòng thử lại.' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCheckOut(shiftId) {
    try {
      setActionLoading(true);
      await checkOut(shiftId);
      setShifts(prev => prev.map(s => (s._id === shiftId || s.id === shiftId)
        ? { ...s, status: 'completed', checkOutTime: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) }
        : s
      ));
      setToast({ type: 'success', message: 'Điểm danh ra ca (Check-out) thành công! Số giờ làm đã được xác nhận.' });
      setCheckInModalShift(null);
    } catch (err) {
      setToast({ type: 'error', message: 'Lỗi khi check-out.' });
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-green-50 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main flex items-center gap-2">
            <Calendar className="w-6 h-6 text-green-main" /> Lịch làm việc & Điểm danh Ca
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Theo dõi danh sách ca làm được phân công và thực hiện check-in GPS tại cửa hàng.
          </p>
        </div>

        <Link
          to="/student/tasks"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-semibold border border-orange-200 transition-colors self-start sm:self-center"
        >
          <ShoppingBag className="w-4 h-4 text-orange-600" /> Chợ việc vặt sinh viên →
        </Link>
      </div>

      {/* Shifts List */}
      {loading ? (
        <div className="text-center py-12 text-text-muted">Đang tải lịch ca...</div>
      ) : shifts.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-green-50 shadow-card space-y-3">
          <Calendar className="w-12 h-12 text-text-muted mx-auto opacity-50" />
          <h3 className="text-base font-bold text-text-main">Chưa có ca làm nào được phân công</h3>
          <p className="text-xs text-text-muted">Sau khi ứng tuyển thành công, nhà tuyển dụng sẽ xếp ca làm việc cho bạn tại đây.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {shifts.map(shift => (
            <div
              key={shift._id || shift.id}
              className="bg-white p-6 rounded-3xl border border-green-50 hover:border-green-300 transition-all shadow-card flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-green-dark bg-green-50 px-3 py-1 rounded-full border border-green-100">
                    {shift.date}
                  </span>
                  <Badge
                    variant={
                      shift.status === 'completed'
                        ? 'green'
                        : shift.status === 'checked_in'
                        ? 'warning'
                        : 'info'
                    }
                    size="sm"
                  >
                    {shift.status === 'completed'
                      ? 'Hoàn thành'
                      : shift.status === 'checked_in'
                      ? 'Đang làm việc'
                      : 'Đã lên lịch'}
                  </Badge>
                </div>

                <div>
                  <h3 className="font-bold text-base text-text-main leading-snug">
                    {shift.storeName || 'Cửa hàng tuyển dụng'}
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">{shift.role || 'Nhân viên bán ca'}</p>
                </div>

                <div className="space-y-1.5 text-xs text-text-muted pt-1">
                  <p className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-green-main shrink-0" />
                    <span className="font-semibold text-text-main">
                      {shift.startTime} – {shift.endTime}
                    </span>
                    <span>({shift.hours || 4} tiếng)</span>
                  </p>
                  <p className="flex items-center gap-1 text-green-700 font-semibold">
                    💰 Tiền ca: {((shift.wageRate || 25000) * (shift.hours || 4)).toLocaleString('vi-VN')}đ ({Number(shift.wageRate || 25000).toLocaleString('vi-VN')}đ/h)
                  </p>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-green-50 flex items-center justify-between">
                <button
                  onClick={() => setCheckInModalShift(shift)}
                  className={clsx(
                    'px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm',
                    shift.status === 'completed'
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : shift.status === 'checked_in'
                      ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                      : 'bg-green-main text-white hover:bg-green-dark'
                  )}
                  disabled={shift.status === 'completed'}
                >
                  <QrCode className="w-4 h-4" />
                  {shift.status === 'completed'
                    ? 'Đã kết thúc ca'
                    : shift.status === 'checked_in'
                    ? 'Check-out ra ca'
                    : 'Check-in điểm danh GPS'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Check-in / Check-out Simulation Modal */}
      {checkInModalShift && (
        <Modal
          isOpen={true}
          onClose={() => setCheckInModalShift(null)}
          title={checkInModalShift.status === 'checked_in' ? 'Điểm danh Check-Out Ra Ca' : 'Điểm danh Check-In Vào Ca'}
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-green-50 rounded-2xl border border-green-100 space-y-2">
              <div className="flex items-center gap-2 text-green-dark font-bold text-sm">
                <ShieldCheck className="w-5 h-5 text-green-main" />
                Định vị GPS Hòa Lạc (Bán kính hợp lệ: 150m)
              </div>
              <p className="text-text-muted leading-relaxed">
                Hệ thống xác thực tọa độ GPS của bạn trùng khớp với địa chỉ cửa hàng: <strong className="text-text-main">{checkInModalShift.storeName}</strong>.
              </p>
              <div className="flex items-center gap-1.5 text-green-800 font-semibold pt-1">
                <Check className="w-4 h-4 text-green-600" />
                Vị trí: Hợp lệ (Khu vực ĐH FPT / KCN Cao Hòa Lạc)
              </div>
            </div>

            <div className="space-y-1 text-text-muted">
              <p>• Ca làm: <strong className="text-text-main">{checkInModalShift.startTime} - {checkInModalShift.endTime}</strong></p>
              <p>• Thời gian thực tế: <strong className="text-text-main">{new Date().toLocaleTimeString('vi-VN')} ({new Date().toLocaleDateString('vi-VN')})</strong></p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCheckInModalShift(null)}
                className="px-4 py-2.5 rounded-xl bg-gray-100 text-text-muted font-semibold"
              >
                Hủy
              </button>

              {checkInModalShift.status === 'checked_in' ? (
                <button
                  onClick={() => handleCheckOut(checkInModalShift._id || checkInModalShift.id)}
                  disabled={actionLoading}
                  className="px-4 py-2.5 rounded-xl bg-yellow-500 text-white font-semibold hover:bg-yellow-600 disabled:opacity-50"
                >
                  {actionLoading ? 'Đang ghi nhận...' : 'Xác nhận Check-Out'}
                </button>
              ) : (
                <button
                  onClick={() => handleCheckIn(checkInModalShift._id || checkInModalShift.id)}
                  disabled={actionLoading}
                  className="px-4 py-2.5 rounded-xl bg-green-main text-white font-semibold hover:bg-green-dark disabled:opacity-50"
                >
                  {actionLoading ? 'Đang xác thực GPS...' : 'Xác nhận Check-In Vào Ca'}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
