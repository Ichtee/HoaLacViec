import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, Clock, MapPin, CheckCircle, QrCode, ShieldCheck,
  AlertTriangle, Check, User, ShoppingBag, Navigation, AlertCircle,
  RefreshCw, FileText, CheckCircle2, Loader2, ArrowRight
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getShifts, checkIn, checkOut } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Modal } from '@/components/Modal.jsx';
import { Toast } from '@/components/Feedback.jsx';
import { isValidCoordinate } from '@/utils';
import { useGeolocation } from '@/hooks/useGeolocation.js';

function getShiftStatusBadge(status) {
  switch (status) {
    case 'approved':
    case 'completed':
      return { variant: 'success', label: 'Đã duyệt công 🎉' };
    case 'pending_approval':
      return { variant: 'purple', label: 'Chờ duyệt công ⏳' };
    case 'needs_review':
      return { variant: 'warning', label: 'Cần xem xét GPS ⚠️' };
    case 'checked_in':
      return { variant: 'info', label: 'Đang trong ca làm' };
    case 'disputed':
      return { variant: 'danger', label: 'Cần đối soát ⚠️' };
    case 'cancelled':
      return { variant: 'neutral', label: 'Đã hủy' };
    case 'scheduled':
    default:
      return { variant: 'neutral', label: 'Đã xếp ca' };
  }
}

const REASON_CODE_LABELS = {
  VERIFIED: 'Tọa độ thiết bị hợp lệ trong bán kính quán',
  OUTSIDE_RADIUS: 'Thiết bị nằm ngoài bán kính cho phép',
  LOW_ACCURACY: 'Sai số GPS thiết bị quá lớn (> 100m)',
  STALE_POSITION: 'Dữ liệu GPS đã cũ (> 2 phút)',
  GPS_UNAVAILABLE: 'Không nhận được tín hiệu GPS từ thiết bị',
  PERMISSION_DENIED: 'Quyền truy cập vị trí bị từ chối',
  JOB_LOCATION_UNCONFIRMED: 'Quán chưa xác nhận vị trí chính xác',
  INVALID_COORDINATES: 'Tọa độ gửi lên không hợp lệ',
  MANUAL_REQUEST: 'Yêu cầu chấm công thủ công từ học sinh',
  ACCURACY_MARGIN: 'Nằm gần ranh giới sai số của quán',
};

export default function StudentShiftsPage() {
  const { user } = useAuth();
  const { requestLocation } = useGeolocation();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modal State
  const [modalShift, setModalShift] = useState(null);
  const [gpsState, setGpsState] = useState({
    status: 'idle', // 'idle' | 'requesting' | 'success' | 'error' | 'low_accuracy'
    coords: null,
    error: null,
  });
  const [mode, setMode] = useState('gps'); // 'gps' | 'manual'
  const [manualReason, setManualReason] = useState('');

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

  // Request fresh, high-accuracy GPS specifically for attendance
  const requestFreshGps = useCallback(async () => {
    setGpsState({
      status: 'requesting',
      coords: null,
      error: null,
    });

    try {
      const pos = await requestLocation({
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
        maxAccuracy: 100,
      });

      if (!pos || !isValidCoordinate(pos.lat, pos.lng)) {
        setGpsState({
          status: 'error',
          coords: null,
          error: 'Không thể lấy tọa độ GPS từ thiết bị hoặc bạn đã từ chối quyền vị trí.',
        });
        return;
      }

      const isLowAccuracy = (pos.accuracy || 0) > 100;
      setGpsState({
        status: isLowAccuracy ? 'low_accuracy' : 'success',
        coords: {
          lat: pos.lat,
          lng: pos.lng,
          accuracy: Math.round(pos.accuracy || 0),
          timestamp: pos.timestamp || Date.now(),
        },
        error: isLowAccuracy
          ? `Độ chính xác GPS hiện tại chưa cao (sai số ±${Math.round(pos.accuracy)}m > 100m). Yêu cầu có thể được chuyển sang Cần quản lý duyệt.`
          : null,
      });
    } catch (err) {
      setGpsState({
        status: 'error',
        coords: null,
        error: err.message || 'Lỗi khi lấy vị trí GPS từ thiết bị.',
      });
    }
  }, [requestLocation]);

  function handleOpenModal(shift) {
    setModalShift(shift);
    setMode('gps');
    setManualReason('');
    requestFreshGps();
  }

  function handleCloseModal() {
    setModalShift(null);
    setGpsState({ status: 'idle', coords: null, error: null });
    setManualReason('');
    setActionLoading(false);
  }

  async function handleSubmitAttendance() {
    if (!modalShift) return;
    const isCheckIn = modalShift.status !== 'checked_in';
    const shiftId = modalShift._id || modalShift.id;

    // Build Payload
    let payload = {};
    if (mode === 'manual') {
      if (!manualReason.trim()) {
        setToast({ type: 'warning', message: 'Vui lòng nhập lý do chấm công thủ công để quản lý duyệt.' });
        return;
      }
      payload = {
        isManual: true,
        manualReason: manualReason.trim(),
      };
    } else {
      // GPS mode
      if (!gpsState.coords || !isValidCoordinate(gpsState.coords.lat, gpsState.coords.lng)) {
        setToast({ type: 'warning', message: 'Chưa có tọa độ GPS hợp lệ từ thiết bị. Vui lòng bấm Thử lại GPS hoặc chọn Chấm công thủ công.' });
        return;
      }
      payload = {
        lat: gpsState.coords.lat,
        lng: gpsState.coords.lng,
        accuracy: gpsState.coords.accuracy,
        timestamp: gpsState.coords.timestamp,
        isManual: false,
      };
    }

    try {
      setActionLoading(true);
      const res = isCheckIn
        ? await checkIn(shiftId, payload)
        : await checkOut(shiftId, payload);

      const updatedShift = res.shift || {};
      const newStatus = isCheckIn ? 'checked_in' : 'pending_approval';

      setShifts((prev) =>
        prev.map((s) =>
          (s._id === shiftId || s.id === shiftId)
            ? { ...s, ...updatedShift, status: newStatus }
            : s
        )
      );

      if (res.verified) {
        setToast({
          type: 'success',
          message: isCheckIn
            ? `✓ Điểm danh vào ca thành công! (Xác minh tự động theo tọa độ thiết bị, khoảng cách: ${Math.round(res.distanceMeters || 0)}m)`
            : `✓ Check-out ra ca thành công! (Xác minh tự động theo tọa độ thiết bị)`,
        });
      } else if (res.verificationStatus === 'needs_review' || payload.isManual) {
        setToast({
          type: 'info',
          message: `⏳ Đã gửi yêu cầu ${isCheckIn ? 'vào ca' : 'ra ca'}. Đang ở trạng thái "Cần quản lý duyệt" (${res.reasonCode || 'Yêu cầu thủ công'}).`,
        });
      } else {
        setToast({
          type: 'info',
          message: res.message || 'Yêu cầu điểm danh đã được ghi nhận.',
        });
      }

      handleCloseModal();
    } catch (err) {
      setToast({
        type: 'error',
        message: err.message || 'Lỗi khi điểm danh ca làm. Vui lòng kiểm tra lại.',
      });
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
            <Calendar className="w-6 h-6 text-green-main" /> Lịch làm việc & Điểm danh ca
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Chấm công vào và ra ca bằng tọa độ thiết bị thực tế tại quán hoặc gửi yêu cầu thủ công có lý do xác thực.
          </p>
        </div>

        <Link
          to="/student/tasks"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-cream/70 hover:bg-green-50 text-text-main hover:text-green-dark text-xs font-bold transition-all border border-green-100"
        >
          <Clock className="w-4 h-4 text-green-main" />
          <span>Xem công việc đã ứng tuyển</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Shifts List */}
      {loading ? (
        <div className="p-12 text-center text-text-muted">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-green-main mb-2" />
          <p className="text-xs">Đang tải danh sách ca làm việc...</p>
        </div>
      ) : shifts.length === 0 ? (
        <div className="bg-white rounded-3xl border border-green-50 p-12 text-center shadow-card space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-green-50 text-green-main flex items-center justify-center mx-auto text-2xl">
            📅
          </div>
          <h3 className="font-bold text-text-main text-base">Chưa có ca làm việc nào</h3>
          <p className="text-xs text-text-muted max-w-md mx-auto">
            Khi nhà tuyển dụng chấp nhận đơn ứng tuyển và phân ca làm việc, ca của bạn sẽ hiển thị tại đây để điểm danh.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {shifts.map((shift) => {
            const badge = getShiftStatusBadge(shift.status);
            const checkInAttendance = shift.attendance;
            const distance = checkInAttendance?.checkInDistanceMeters;
            const verifyStatus = checkInAttendance?.checkInVerificationStatus;
            const reasonCode = checkInAttendance?.checkInReasonCode;

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
                    <p className="text-xs text-text-muted mt-0.5">{shift.role || 'Nhân viên ca làm'}</p>
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

                    {/* Attendance Verification Audit Note */}
                    {checkInAttendance?.checkInAt && (
                      <div className="pt-2 border-t border-gray-100 text-[11px] space-y-1">
                        <div className="flex items-center gap-1.5 text-gray-700">
                          <Navigation className="w-3 h-3 text-blue-500 shrink-0" />
                          <span>
                            Vào ca:{' '}
                            <strong>{new Date(checkInAttendance.checkInAt).toLocaleTimeString('vi-VN')}</strong>
                          </span>
                        </div>

                        {verifyStatus === 'verified' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold">
                            <CheckCircle2 className="w-3 h-3" />
                            Đã xác minh tự động theo GPS ({Math.round(distance || 0)}m)
                          </span>
                        ) : verifyStatus === 'needs_review' ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-semibold">
                            <AlertCircle className="w-3 h-3" />
                            Chờ duyệt ({reasonCode ? REASON_CODE_LABELS[reasonCode] || reasonCode : 'Cần đối chiếu'})
                          </span>
                        ) : checkInAttendance.checkInManualReason ? (
                          <span className="inline-flex items-center gap-1 text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md font-semibold">
                            <FileText className="w-3 h-3" />
                            Chấm công thủ công (Chờ duyệt)
                          </span>
                        ) : null}
                      </div>
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
                    onClick={() => handleOpenModal(shift)}
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
                      ? 'Check-out ra ca'
                      : 'Check-in điểm danh'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Check-in / Check-out Attendance Modal */}
      {modalShift && (
        <Modal
          isOpen={true}
          onClose={handleCloseModal}
          title={modalShift.status === 'checked_in' ? 'Check-Out Kết Thúc Ca Làm' : 'Check-In Điểm Danh Ca Làm'}
        >
          <div className="space-y-4 text-xs">
            {/* Store & Shift Info */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-gray-200 space-y-1">
              <p className="font-bold text-sm text-text-main">{modalShift.storeName || 'Cửa hàng tuyển dụng'}</p>
              <p className="text-text-muted">
                Ca làm: <strong>{modalShift.startTime} - {modalShift.endTime}</strong> • Ngày: <strong>{modalShift.date}</strong>
              </p>
            </div>

            {/* Mode Switch Tabs: GPS vs Thủ công */}
            <div className="flex border-b border-gray-200">
              <button
                type="button"
                onClick={() => setMode('gps')}
                className={clsx(
                  'pb-2 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5',
                  mode === 'gps'
                    ? 'border-green-main text-green-dark'
                    : 'border-transparent text-text-muted hover:text-text-main'
                )}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Xác minh qua GPS thiết bị</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('manual')}
                className={clsx(
                  'pb-2 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5',
                  mode === 'manual'
                    ? 'border-green-main text-green-dark'
                    : 'border-transparent text-text-muted hover:text-text-main'
                )}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Chấm công thủ công (cần duyệt)</span>
              </button>
            </div>

            {/* Mode 1: GPS Verification */}
            {mode === 'gps' && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl border bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text-main flex items-center gap-1.5">
                      <Navigation className="w-4 h-4 text-blue-600" />
                      Tọa độ thiết bị của bạn:
                    </span>
                    <button
                      type="button"
                      onClick={requestFreshGps}
                      disabled={gpsState.status === 'requesting'}
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-bold"
                    >
                      <RefreshCw className={clsx('w-3 h-3', gpsState.status === 'requesting' && 'animate-spin')} />
                      <span>Lấy lại GPS</span>
                    </button>
                  </div>

                  {gpsState.status === 'requesting' && (
                    <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center gap-2 text-blue-700 animate-pulse">
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span>Đang nhận diện tín hiệu GPS chính xác từ thiết bị...</span>
                    </div>
                  )}

                  {(gpsState.status === 'success' || gpsState.status === 'low_accuracy') && gpsState.coords && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Đã lấy thành công tọa độ từ thiết bị</span>
                      </div>
                      <p className="font-mono text-[11px] text-emerald-800">
                        {gpsState.coords.lat.toFixed(5)}, {gpsState.coords.lng.toFixed(5)} (Sai số: ±{gpsState.coords.accuracy}m)
                      </p>
                      {gpsState.status === 'low_accuracy' && (
                        <p className="text-[10px] text-amber-700 font-semibold pt-1">
                          ⚠️ Sai số thiết bị &gt; 100m. Hệ thống sẽ ghi nhận và gửi quản lý duyệt.
                        </p>
                      )}
                    </div>
                  )}

                  {gpsState.status === 'error' && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-red-800">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>Không thể lấy tọa độ GPS</span>
                      </div>
                      <p className="text-[11px] text-red-700">{gpsState.error}</p>
                      <div className="pt-1 flex gap-2">
                        <button
                          type="button"
                          onClick={requestFreshGps}
                          className="px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-800 font-bold text-[11px] transition-colors"
                        >
                          Thử lấy GPS lại
                        </button>
                        <button
                          type="button"
                          onClick={() => setMode('manual')}
                          className="px-3 py-1.5 rounded-lg bg-white border border-red-300 text-red-800 font-bold text-[11px] transition-colors"
                        >
                          Chuyển sang Chấm công thủ công
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-text-muted italic leading-relaxed">
                  * Lưu ý: Kết quả chấm công được xác minh tự động theo tọa độ thiết bị đối chiếu với bán kính cấu hình của quán.
                </p>
              </div>
            )}

            {/* Mode 2: Manual Attendance Request */}
            {mode === 'manual' && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] space-y-1">
                  <p className="font-bold">📋 Yêu cầu chấm công thủ công</p>
                  <p>
                    Dành cho trường hợp thiết bị lỗi GPS, hết pin hoặc quán chưa có vị trí GPS chuẩn. Ca làm việc sẽ được chuyển sang trạng thái <strong>&ldquo;Chờ quản lý duyệt&rdquo;</strong>.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-text-main mb-1">
                    Lý do chấm công thủ công *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={manualReason}
                    onChange={(e) => setManualReason(e.target.value)}
                    placeholder="Ví dụ: Thiết bị lỗi GPS không bật được vị trí, em đã đến làm việc tại quán lúc 07:45..."
                    className="w-full p-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-main text-xs"
                  />
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={actionLoading}
                className="px-4 py-2.5 rounded-xl bg-gray-100 text-text-muted font-semibold hover:bg-gray-200 transition-colors"
              >
                Đóng
              </button>

              <button
                type="button"
                onClick={handleSubmitAttendance}
                disabled={
                  actionLoading ||
                  (mode === 'gps' && (!gpsState.coords || gpsState.status === 'requesting' || gpsState.status === 'error')) ||
                  (mode === 'manual' && !manualReason.trim())
                }
                className={clsx(
                  'px-4 py-2.5 rounded-xl text-white font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50',
                  modalShift.status === 'checked_in'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-green-main hover:bg-green-dark'
                )}
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {modalShift.status === 'checked_in'
                    ? (mode === 'manual' ? 'Gửi yêu cầu Ra Ca thủ công' : 'Xác nhận Check-Out Ra Ca')
                    : (mode === 'manual' ? 'Gửi yêu cầu Vào Ca thủ công' : 'Xác nhận Check-In Vào Ca')}
                </span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
