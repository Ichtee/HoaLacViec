import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, Clock, MapPin, CheckCircle, QrCode, ShieldCheck,
  AlertTriangle, Check, User, ShoppingBag, Navigation, AlertCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getShifts, checkIn, checkOut } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Modal } from '@/components/Modal.jsx';
import { Toast } from '@/components/Feedback.jsx';

function getGPSLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      return resolve({ error: 'Trình duyệt không hỗ trợ định vị GPS.' });
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy || 0),
        });
      },
      (err) => {
        let msg = 'Không thể lấy tọa độ GPS hiện tại.';
        if (err.code === 1) {
          msg = 'Vui lòng cho phép truy cập vị trí trong cài đặt trình duyệt để điểm danh tại quán.';
        } else if (err.code === 2) {
          msg = 'Không tìm thấy tín hiệu định vị vị trí.';
        } else if (err.code === 3) {
          msg = 'Quá thời gian lấy tọa độ vị trí.';
        }
        resolve({ error: msg });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

function getShiftStatusBadge(status) {
  switch (status) {
    case 'approved':
    case 'completed':
      return { variant: 'success', label: 'Đã duyệt công 🎉' };
    case 'pending_approval':
      return { variant: 'purple', label: 'Chờ duyệt công ⏳' };
    case 'checked_in':
      return { variant: 'warning', label: 'Đang trong ca làm' };
    case 'disputed':
      return { variant: 'danger', label: 'Cần đối soát ⚠️' };
    case 'cancelled':
      return { variant: 'neutral', label: 'Đã hủy' };
    case 'scheduled':
    default:
      return { variant: 'info', label: 'Đã xếp ca' };
  }
}

export default function StudentShiftsPage() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalShift, setModalShift] = useState(null);
  const [gpsStatus, setGpsStatus] = useState(null);
  const [toast, setToast] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadShifts();
  }, [user]);

  async function loadShifts() {
    try {
      setLoading(true);
      const data = await getShifts({ studentId: user?.id });
      setShifts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckIn(shiftId) {
    try {
      setActionLoading(true);
      setGpsStatus('Đang xác định tọa độ GPS...');
      const coords = await getGPSLocation();

      if (coords.error) {
        setGpsStatus(coords.error);
        setToast({ type: 'warning', message: coords.error });
      } else {
        setGpsStatus(`Tọa độ: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} (±${coords.accuracy}m)`);
      }

      const res = await checkIn(shiftId, {
        lat: coords.lat,
        lng: coords.lng,
        accuracy: coords.accuracy,
      });

      setShifts((prev) =>
        prev.map((s) =>
          (s._id === shiftId || s.id === shiftId)
            ? { ...s, ...(res.shift || {}), status: 'checked_in' }
            : s
        )
      );

      const distanceMsg = res.distanceMeters !== null
        ? ` (Khoảng cách tới quán: ${res.distanceMeters}m)`
        : '';

      setToast({
        type: res.verified ? 'success' : 'info',
        message: res.message || `Điểm danh vào ca thành công!${distanceMsg}`,
      });
      setModalShift(null);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi điểm danh. Vui lòng thử lại.' });
    } finally {
      setActionLoading(false);
      setGpsStatus(null);
    }
  }

  async function handleCheckOut(shiftId) {
    try {
      setActionLoading(true);
      setGpsStatus('Đang lấy tọa độ kết thúc ca...');
      const coords = await getGPSLocation();

      const res = await checkOut(shiftId, {
        lat: coords.lat,
        lng: coords.lng,
        accuracy: coords.accuracy,
      });

      setShifts((prev) =>
        prev.map((s) =>
          (s._id === shiftId || s.id === shiftId)
            ? { ...s, ...(res.shift || {}), status: 'pending_approval' }
            : s
        )
      );

      setToast({
        type: 'success',
        message: res.message || 'Check-out ra ca thành công! Đã gửi yêu cầu duyệt công.',
      });
      setModalShift(null);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi check-out.' });
    } finally {
      setActionLoading(false);
      setGpsStatus(null);
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-green-50 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main flex items-center gap-2">
            <Calendar className="w-6 h-6 text-green-main" /> Lịch làm việc & Điểm danh GPS
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Chấm công vào ca bằng GPS thực tế tại cơ sở Hòa Lạc, theo dõi số giờ làm và tiền công.
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
          {shifts.map((shift) => {
            const badge = getShiftStatusBadge(shift.status);
            const checkInInfo = shift.attendance?.checkInAt;
            const distance = shift.attendance?.checkInDistanceMeters;

            return (
              <div
                key={shift._id || shift.id}
                className="bg-white p-6 rounded-3xl border border-green-50 hover:border-green-300 transition-all shadow-card flex flex-col justify-between space-y-4"
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

                    {/* GPS verification note */}
                    {distance !== undefined && distance !== null && (
                      <p className="flex items-center gap-1 text-[11px] text-gray-500 pt-1">
                        <Navigation className="w-3 h-3 text-blue-500" />
                        Khoảng cách GPS check-in: <strong className="text-text-main">{distance}m</strong>{' '}
                        {shift.attendance?.checkInVerified ? (
                          <span className="text-emerald-600 font-semibold">(Hợp lệ tại quán)</span>
                        ) : (
                          <span className="text-amber-600 font-semibold">(Ngoài bán kính tiêu chuẩn)</span>
                        )}
                      </p>
                    )}

                    {shift.disputeReason && (
                      <p className="p-2 rounded-xl bg-red-50 text-red-700 text-[11px] border border-red-200">
                        ⚠️ <strong>Đối soát:</strong> {shift.disputeReason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-4 border-t border-green-50 flex items-center justify-between">
                  <button
                    onClick={() => setModalShift(shift)}
                    className={clsx(
                      'px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm',
                      shift.status === 'approved' || shift.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-700 cursor-default'
                        : shift.status === 'pending_approval'
                        ? 'bg-purple-100 text-purple-700 cursor-default'
                        : shift.status === 'checked_in'
                        ? 'bg-amber-500 text-white hover:bg-amber-600'
                        : 'bg-green-main text-white hover:bg-green-dark'
                    )}
                    disabled={
                      shift.status === 'approved' ||
                      shift.status === 'completed' ||
                      shift.status === 'pending_approval'
                    }
                  >
                    <QrCode className="w-4 h-4" />
                    {shift.status === 'approved' || shift.status === 'completed'
                      ? 'Đã duyệt công'
                      : shift.status === 'pending_approval'
                      ? 'Đang chờ quản lý duyệt'
                      : shift.status === 'checked_in'
                      ? 'Check-out kết thúc ca'
                      : 'Check-in điểm danh GPS'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Check-in / Check-out GPS Modal */}
      {modalShift && (
        <Modal
          isOpen={true}
          onClose={() => { setModalShift(null); setGpsStatus(null); }}
          title={modalShift.status === 'checked_in' ? 'Check-Out Kết Thúc Ca Làm' : 'Check-In Điểm Danh GPS'}
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-green-50 rounded-2xl border border-green-100 space-y-2">
              <div className="flex items-center gap-2 text-green-dark font-bold text-sm">
                <Navigation className="w-5 h-5 text-green-main animate-pulse" />
                Định vị GPS Hòa Lạc thực tế
              </div>
              <p className="text-text-muted leading-relaxed">
                Hệ thống sẽ lấy tọa độ GPS từ thiết bị của bạn để đối chiếu với địa chỉ quán:{' '}
                <strong className="text-text-main">{modalShift.storeName}</strong> (Bán kính hợp lệ: 350m).
              </p>
              {gpsStatus && (
                <div className="p-2 rounded-xl bg-white border border-green-200 text-text-main font-medium">
                  📡 {gpsStatus}
                </div>
              )}
            </div>

            <div className="space-y-1 text-text-muted">
              <p>• Ca làm việc: <strong className="text-text-main">{modalShift.startTime} - {modalShift.endTime}</strong> (Ngày: {modalShift.date})</p>
              <p>• Thời gian hiện tại: <strong className="text-text-main">{new Date().toLocaleTimeString('vi-VN')}</strong></p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-green-50">
              <button
                type="button"
                onClick={() => { setModalShift(null); setGpsStatus(null); }}
                className="px-4 py-2.5 rounded-xl bg-gray-100 text-text-muted font-semibold hover:bg-gray-200"
              >
                Hủy
              </button>

              {modalShift.status === 'checked_in' ? (
                <button
                  type="button"
                  onClick={() => handleCheckOut(modalShift._id || modalShift.id)}
                  disabled={actionLoading}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 disabled:opacity-50 shadow-sm"
                >
                  {actionLoading ? 'Đang xác thực GPS & Tính công...' : 'Xác nhận Check-Out Ra Ca'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleCheckIn(modalShift._id || modalShift.id)}
                  disabled={actionLoading}
                  className="px-4 py-2.5 rounded-xl bg-green-main text-white font-bold hover:bg-green-dark disabled:opacity-50 shadow-sm"
                >
                  {actionLoading ? 'Đang lấy tọa độ GPS...' : 'Xác nhận Check-In Vào Ca'}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
