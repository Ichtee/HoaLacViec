import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, Clock, MapPin, CheckCircle, ArrowLeftRight, QrCode, ShieldCheck,
  AlertTriangle, Check, User
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getShifts, checkIn, checkOut, createSwapRequest } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Modal } from '@/components/Modal.jsx';
import { Toast } from '@/components/Feedback.jsx';

export default function StudentShiftsPage() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedShift, setSelectedShift] = useState(null);
  const [checkInModalShift, setCheckInModalShift] = useState(null);
  const [swapModalShift, setSwapModalShift] = useState(null);
  const [swapReason, setSwapReason] = useState('');
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
      setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, status: 'checked_in', checkInTime: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) } : s));
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
      setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, status: 'completed', checkOutTime: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) } : s));
      setToast({ type: 'success', message: 'Điểm danh ra ca (Check-out) thành công! Số giờ làm đã ghi nhận vào sổ đối soát.' });
      setCheckInModalShift(null);
    } catch (err) {
      setToast({ type: 'error', message: 'Lỗi khi check-out.' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCreateSwap() {
    if (!swapModalShift) return;
    try {
      setActionLoading(true);
      await createSwapRequest({
        shiftId: swapModalShift.id,
        reason: swapReason,
        studentId: user.id,
        studentName: user.name
      });
      setShifts(prev => prev.map(s => s.id === swapModalShift.id ? { ...s, isSwapping: true } : s));
      setToast({ type: 'success', message: 'Đã đăng ca làm lên Sàn Đổi Ca thành công!' });
      setSwapModalShift(null);
      setSwapReason('');
    } catch (err) {
      setToast({ type: 'error', message: 'Lỗi khi tạo yêu cầu đổi ca.' });
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
            Theo dõi danh sách ca làm được phân công, thực hiện check-in GPS hoặc đăng bài đổi ca.
          </p>
        </div>

        <Link
          to="/student/swap"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-cream hover:bg-green-50 text-green-dark text-xs font-semibold border border-green-100 transition-colors self-start sm:self-center"
        >
          <ArrowLeftRight className="w-4 h-4 text-green-main" /> Chợ đổi ca sinh viên →
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
              key={shift.id}
              className={clsx(
                'bg-white p-6 rounded-3xl border transition-all shadow-card flex flex-col justify-between space-y-4',
                shift.status === 'checked_in'
                  ? 'border-green-main ring-2 ring-green-main/10'
                  : 'border-green-50 hover:border-green-200'
              )}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
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
                      ? 'Đã hoàn thành'
                      : shift.status === 'checked_in'
                      ? 'Đang làm ca (Checked-in)'
                      : 'Lịch sắp tới'}
                  </Badge>

                  {shift.isSwapping && (
                    <span className="text-[11px] font-semibold text-yellow-700 bg-yellow-50 px-2.5 py-0.5 rounded-full">
                      🔄 Đang rao đổi ca
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-bold text-text-main">{shift.storeName || 'Store Hòa Lạc'}</h3>
                <p className="text-xs font-semibold text-green-dark mt-0.5">{shift.role || 'Nhân viên bán ca'}</p>

                <div className="mt-4 space-y-2 text-xs text-text-muted">
                  <p className="flex items-center gap-2 font-medium text-text-main">
                    📅 Ngày làm: <span className="font-bold">{shift.date}</span>
                  </p>
                  <p className="flex items-center gap-2 font-medium text-text-main">
                    ⏰ Khung ca: <span className="font-bold text-green-dark">{shift.startTime} - {shift.endTime}</span> ({shift.hours} giờ)
                  </p>
                  <p className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" /> {shift.location || 'Thôn 3, Tân Xã, Thạch Thất'}
                  </p>
                  <p className="flex items-center gap-1 text-green-700 font-semibold">
                    💰 Tiền ca: {(shift.wageRate || 25000) * (shift.hours || 4)}đ ({shift.wageRate || 25000}đ/h)
                  </p>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-green-50 flex flex-wrap items-center justify-between gap-2">
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
                    : 'Check-in điểm danh'}
                </button>

                {shift.status === 'scheduled' && !shift.isSwapping && (
                  <button
                    onClick={() => setSwapModalShift(shift)}
                    className="px-3.5 py-2.5 rounded-xl bg-pink-50 text-pink-main hover:bg-pink-100 text-xs font-semibold transition-colors flex items-center gap-1"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" /> Rao đổi ca
                  </button>
                )}
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
            <div className="p-4 rounded-2xl bg-green-50 border border-green-100 text-center space-y-2">
              <ShieldCheck className="w-10 h-10 text-green-main mx-auto" />
              <h4 className="text-sm font-bold text-green-dark">Xác thực GPS & QR Code cửa hàng</h4>
              <p className="text-text-muted">
                Hệ thống xác nhận vị trí của bạn đang tại: <br />
                <strong className="text-text-main">{checkInModalShift.location || 'Thôn 3, Tân Xã (Bán kính 50m)'}</strong>
              </p>
            </div>

            <div className="space-y-1.5 p-3 rounded-xl bg-gray-50">
              <p>📍 Khoảng cách tới cửa hàng: <strong className="text-green-700">12 mét (Hợp lệ)</strong></p>
              <p>🕒 Giờ hiện tại: <strong className="text-text-main">{new Date().toLocaleTimeString('vi-VN')}</strong></p>
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
                  onClick={() => handleCheckOut(checkInModalShift.id)}
                  disabled={actionLoading}
                  className="px-4 py-2.5 rounded-xl bg-yellow-500 text-white font-semibold hover:bg-yellow-600 disabled:opacity-50"
                >
                  {actionLoading ? 'Đang ghi nhận...' : 'Xác nhận Check-Out'}
                </button>
              ) : (
                <button
                  onClick={() => handleCheckIn(checkInModalShift.id)}
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

      {/* Swap Request Modal */}
      {swapModalShift && (
        <Modal
          isOpen={true}
          onClose={() => setSwapModalShift(null)}
          title="Đăng ca lên Sàn Đổi Ca"
        >
          <div className="space-y-4 text-xs">
            <p className="text-text-muted">
              Đăng ca ngày <strong className="text-text-main">{swapModalShift.date} ({swapModalShift.startTime} - {swapModalShift.endTime})</strong> lên chợ để bạn học sinh viên khác đăng ký làm thay.
            </p>

            <div>
              <label className="block font-bold text-text-main mb-1">Lý do cần đổi ca:</label>
              <textarea
                rows={3}
                value={swapReason}
                onChange={e => setSwapReason(e.target.value)}
                placeholder="Ví dụ: Trùng lịch thi môn PRF192 tại giảng đường Alpha..."
                className="w-full p-3 rounded-xl border border-green-100 focus:outline-none focus:ring-2 focus:ring-green-main resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSwapModalShift(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-text-muted font-semibold"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateSwap}
                disabled={actionLoading || !swapReason.trim()}
                className="px-4 py-2 rounded-xl bg-pink-main text-white font-semibold hover:bg-pink-dark disabled:opacity-50"
              >
                {actionLoading ? 'Đang đăng bài...' : 'Đăng lên Sàn Đổi Ca'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
