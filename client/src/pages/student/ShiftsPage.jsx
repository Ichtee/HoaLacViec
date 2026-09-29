import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar, Clock, CheckCircle, Navigation, AlertCircle,
  RefreshCw, FileText, CheckCircle2, Loader2,
  AlertTriangle, Check, CalendarOff, Plus
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import {
  getShifts,
  checkIn,
  checkOut,
  acknowledgeShift,
  acceptShift,
  declineShift,
  disputeShift,
  getTimeOff,
  submitTimeOff,
  updateTimeOffStatus,
  getEmployments,
} from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Modal } from '@/components/Modal.jsx';
import { Toast } from '@/components/Feedback.jsx';
import { isValidCoordinate } from '@/utils';
import { useGeolocation } from '@/hooks/useGeolocation.js';

// Status badge mapping for student view
function getDisplayStatusInfo(shift) {
  const scheduleStatus = shift.scheduleStatus || (shift.status === 'draft' ? 'draft' : shift.status === 'cancelled' ? 'cancelled' : 'published');
  const assignmentStatus = shift.assignmentStatus || (shift.status === 'acknowledged' ? 'acknowledged' : 'assigned');
  const attendanceStatus = shift.attendanceStatus || shift.status;
  const payrollStatus = shift.payrollStatus || (shift.status === 'paid' ? 'paid' : shift.status === 'payroll_ready' ? 'ready' : 'not_ready');

  if (scheduleStatus === 'cancelled') {
    return { variant: 'gray', label: 'Đã hủy lịch' };
  }
  if (payrollStatus === 'paid') {
    return { variant: 'green', label: 'Đã thanh toán lương' };
  }
  if (payrollStatus === 'ready') {
    return { variant: 'blue', label: 'Sẵn sàng tính lương' };
  }
  if (attendanceStatus === 'approved') {
    return { variant: 'green', label: 'Đã duyệt công' };
  }
  if (attendanceStatus === 'disputed') {
    return { variant: 'red', label: 'Đang đối soát công' };
  }
  if (attendanceStatus === 'needs_review' || attendanceStatus === 'completed_pending_review' || attendanceStatus === 'pending_approval') {
    return { variant: 'yellow', label: 'Chờ quản lý duyệt' };
  }
  if (attendanceStatus === 'checked_in') {
    return { variant: 'blue', label: 'Đang làm việc' };
  }
  if (attendanceStatus === 'no_show') {
    return { variant: 'red', label: 'Vắng mặt' };
  }
  if (assignmentStatus === 'declined') {
    return { variant: 'red', label: 'Đã báo bận / từ chối' };
  }
  if (assignmentStatus === 'accepted') {
    return { variant: 'green', label: 'Đã nhận ca' };
  }
  if (assignmentStatus === 'acknowledged') {
    return { variant: 'blue', label: 'Đã xem lịch' };
  }
  return { variant: 'yellow', label: 'Chờ bạn phản hồi' };
}

// Check-in window calculation: from -30 mins to +60 mins of shift start time
function evaluateCheckInWindow(shift) {
  if (!shift || !shift.date || !shift.startTime) {
    return { canCheckIn: false, label: 'Chưa có thông tin giờ', status: 'unknown' };
  }

  try {
    const [year, month, day] = shift.date.split('-').map(Number);
    const [startH, startM] = shift.startTime.split(':').map(Number);
    const shiftStart = new Date(year, month - 1, day, startH, startM, 0);

    const windowStart = new Date(shiftStart.getTime() - 30 * 60 * 1000);
    const windowEnd = new Date(shiftStart.getTime() + 60 * 60 * 1000);
    const now = new Date();

    const formatTime = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    if (now < windowStart) {
      return {
        canCheckIn: false,
        status: 'too_early',
        label: `Mở điểm danh lúc ${formatTime(windowStart)} (trước 30 phút)`,
        windowStartStr: formatTime(windowStart),
      };
    }
    if (now > windowEnd) {
      return {
        canCheckIn: true,
        isLate: true,
        status: 'late',
        label: 'Đã qua khung giờ điểm danh chuẩn, cần gửi yêu cầu thủ công có lý do',
      };
    }
    return {
      canCheckIn: true,
      status: 'open',
      label: 'Đang trong cửa sổ điểm danh',
    };
  } catch {
    return { canCheckIn: false, status: 'error', label: 'Lỗi định dạng giờ' };
  }
}

export default function StudentShiftsPage() {
  const { user } = useAuth();
  const { requestLocation } = useGeolocation();

  const [shifts, setShifts] = useState([]);
  const [timeOffRequests, setTimeOffRequests] = useState([]);
  const [employments, setEmployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Tab State: 'active_upcoming' | 'action_required' | 'in_review' | 'history' | 'time_off'
  const [activeTab, setActiveTab] = useState('active_upcoming');

  // Modals
  const [modalShift, setModalShift] = useState(null);
  const [declineModalShift, setDeclineModalShift] = useState(null);
  const [declineReason, setDeclineReason] = useState('');
  const [disputeModalShift, setDisputeModalShift] = useState(null);
  const [disputeReason, setDisputeReason] = useState('');

  // Time-off Modal
  const [isTimeOffModalOpen, setIsTimeOffModalOpen] = useState(false);
  const [timeOffForm, setTimeOffForm] = useState({
    employmentId: '',
    startDate: '',
    endDate: '',
    reason: '',
  });

  // GPS Attendance State
  const [gpsState, setGpsState] = useState({
    status: 'idle',
    coords: null,
    error: null,
  });
  const [attendanceMode, setAttendanceMode] = useState('gps');
  const [manualReason, setManualReason] = useState('');

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [shiftsData, timeOffData, empData] = await Promise.all([
        getShifts({ studentId: user?.id }).catch(() => []),
        getTimeOff({ employeeUserId: user?.id }).catch(() => []),
        getEmployments({ studentId: user?.id, status: 'active' }).catch(() => []),
      ]);

      setShifts(Array.isArray(shiftsData) ? shiftsData : []);
      setTimeOffRequests(Array.isArray(timeOffData) ? timeOffData : []);
      setEmployments(Array.isArray(empData) ? empData : []);
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: 'Không thể tải dữ liệu ca làm.' });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

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

  function handleOpenAttendanceModal(shift) {
    setModalShift(shift);
    setAttendanceMode('gps');
    setManualReason('');
    requestFreshGps();
  }

  function handleCloseAttendanceModal() {
    setModalShift(null);
    setGpsState({ status: 'idle', coords: null, error: null });
    setManualReason('');
    setActionLoading(false);
  }

  // Submit Attendance (Check-in or Check-out)
  async function handleSubmitAttendance() {
    if (!modalShift) return;
    const isCheckIn = modalShift.attendanceStatus !== 'checked_in' && modalShift.status !== 'checked_in';
    const shiftId = modalShift._id || modalShift.id;

    let payload = {};
    if (attendanceMode === 'manual') {
      if (!manualReason.trim()) {
        setToast({ type: 'warning', message: 'Vui lòng nhập lý do chấm công thủ công để quản lý duyệt.' });
        return;
      }
      payload = {
        isManual: true,
        manualReason: manualReason.trim(),
      };
    } else {
      if (!gpsState.coords || !isValidCoordinate(gpsState.coords.lat, gpsState.coords.lng)) {
        setToast({ type: 'warning', message: 'Chưa có tọa độ GPS hợp lệ từ thiết bị. Vui lòng bấm Lấy lại GPS hoặc chọn Chấm công thủ công.' });
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
      const newAttendanceStatus = isCheckIn ? 'checked_in' : 'completed_pending_review';

      setShifts((prev) =>
        prev.map((s) =>
          (s._id === shiftId || s.id === shiftId)
            ? { ...s, ...updatedShift, attendanceStatus: newAttendanceStatus, status: isCheckIn ? 'checked_in' : 'pending_approval' }
            : s
        )
      );

      if (res.verified) {
        setToast({
          type: 'success',
          message: isCheckIn
            ? `Điểm danh vào ca thành công! (Khoảng cách GPS: ${Math.round(res.distanceMeters || 0)}m)`
            : 'Check-out ra ca thành công! Ca làm đã được ghi nhận.',
        });
      } else {
        setToast({
          type: 'info',
          message: isCheckIn
            ? `Đã gửi yêu cầu vào ca. Yêu cầu đang ở trạng thái Cần quản lý duyệt (${res.reasonCode || 'Thủ công'}).`
            : `Đã gửi yêu cầu ra ca. Ca làm chờ quản lý duyệt công.`,
        });
      }

      handleCloseAttendanceModal();
    } catch (err) {
      setToast({
        type: 'error',
        message: err.message || 'Lỗi khi điểm danh ca làm việc. Vui lòng thử lại.',
      });
    } finally {
      setActionLoading(false);
    }
  }

  // Actions for Shift Response
  async function handleAccept(shiftId) {
    try {
      setActionLoading(true);
      const res = await acceptShift(shiftId);
      setShifts((prev) =>
        prev.map((s) => (s._id === shiftId || s.id === shiftId)
          ? { ...s, ...(res.shift || {}), assignmentStatus: 'accepted' }
          : s
        )
      );
      setToast({ type: 'success', message: 'Bạn đã xác nhận nhận ca làm việc thành công!' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể nhận ca.' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeclineSubmit() {
    if (!declineModalShift) return;
    if (!declineReason.trim()) {
      setToast({ type: 'warning', message: 'Vui lòng cung cấp lý do báo bận/từ chối ca.' });
      return;
    }
    const shiftId = declineModalShift._id || declineModalShift.id;
    try {
      setActionLoading(true);
      const res = await declineShift(shiftId, { reason: declineReason.trim() });
      setShifts((prev) =>
        prev.map((s) => (s._id === shiftId || s.id === shiftId)
          ? { ...s, ...(res.shift || {}), assignmentStatus: 'declined' }
          : s
        )
      );
      setToast({ type: 'info', message: 'Đã gửi phản hồi từ chối ca đến quản lý.' });
      setDeclineModalShift(null);
      setDeclineReason('');
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể gửi phản hồi từ chối ca.' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAcknowledge(shiftId) {
    try {
      setActionLoading(true);
      await acknowledgeShift(shiftId);
      setShifts((prev) =>
        prev.map((s) => (s._id === shiftId || s.id === shiftId)
          ? { ...s, assignmentStatus: 'acknowledged' }
          : s
        )
      );
      setToast({ type: 'success', message: 'Đã xác nhận xem thông tin lịch làm việc.' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi xác nhận xem lịch.' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDisputeSubmit() {
    if (!disputeModalShift) return;
    if (!disputeReason.trim()) {
      setToast({ type: 'warning', message: 'Vui lòng nhập lý do đối soát/khiếu nại giờ công.' });
      return;
    }
    const shiftId = disputeModalShift._id || disputeModalShift.id;
    try {
      setActionLoading(true);
      const res = await disputeShift(shiftId, { disputeReason: disputeReason.trim() });
      setShifts((prev) =>
        prev.map((s) => (s._id === shiftId || s.id === shiftId)
          ? { ...s, ...(res.shift || {}), attendanceStatus: 'disputed', disputeReason: disputeReason.trim() }
          : s
        )
      );
      setToast({ type: 'info', message: 'Đã gửi yêu cầu đối soát công đến quản lý cửa hàng.' });
      setDisputeModalShift(null);
      setDisputeReason('');
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể gửi yêu cầu đối soát.' });
    } finally {
      setActionLoading(false);
    }
  }

  // Time off submission
  async function handleSubmitTimeOff(e) {
    e.preventDefault();
    if (!timeOffForm.startDate || !timeOffForm.endDate) {
      setToast({ type: 'warning', message: 'Vui lòng chọn ngày bắt đầu và kết thúc nghỉ.' });
      return;
    }
    if (new Date(timeOffForm.startDate) > new Date(timeOffForm.endDate)) {
      setToast({ type: 'warning', message: 'Ngày bắt đầu không được sau ngày kết thúc.' });
      return;
    }

    try {
      setActionLoading(true);
      const payload = {
        startDate: timeOffForm.startDate,
        endDate: timeOffForm.endDate,
        reason: timeOffForm.reason.trim(),
      };
      if (timeOffForm.employmentId) {
        payload.employmentId = timeOffForm.employmentId;
      } else if (employments.length > 0) {
        payload.employmentId = employments[0]._id || employments[0].id;
      }

      await submitTimeOff(payload);
      setToast({ type: 'success', message: 'Đã gửi đơn xin nghỉ phép thành công!' });
      setIsTimeOffModalOpen(false);
      setTimeOffForm({ employmentId: '', startDate: '', endDate: '', reason: '' });
      const updated = await getTimeOff({ employeeUserId: user?.id });
      setTimeOffRequests(Array.isArray(updated) ? updated : []);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi nộp đơn xin nghỉ.' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancelTimeOff(requestId) {
    if (!confirm('Bạn có chắc chắn muốn hủy đơn xin nghỉ phép này không?')) return;
    try {
      setActionLoading(true);
      await updateTimeOffStatus(requestId, { status: 'cancelled' });
      setTimeOffRequests((prev) =>
        prev.map((r) => (r._id === requestId || r.id === requestId ? { ...r, status: 'cancelled' } : r))
      );
      setToast({ type: 'success', message: 'Đã hủy đơn xin nghỉ phép.' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể hủy đơn nghỉ phép.' });
    } finally {
      setActionLoading(false);
    }
  }

  // Filter shifts for tabs
  const { actionRequiredShifts, activeShifts, upcomingShifts, inReviewShifts, historyShifts } = useMemo(() => {
    const actionRequired = [];
    const active = [];
    const upcoming = [];
    const inReview = [];
    const history = [];

    shifts.forEach((s) => {
      const scheduleStatus = s.scheduleStatus || (s.status === 'draft' ? 'draft' : s.status === 'cancelled' ? 'cancelled' : 'published');
      const assignmentStatus = s.assignmentStatus || (s.status === 'acknowledged' ? 'acknowledged' : 'assigned');
      const attendanceStatus = s.attendanceStatus || s.status;
      const payrollStatus = s.payrollStatus || (s.status === 'paid' ? 'paid' : s.status === 'payroll_ready' ? 'ready' : 'not_ready');

      if (scheduleStatus === 'cancelled' || payrollStatus === 'paid' || attendanceStatus === 'approved') {
        history.push(s);
        return;
      }

      if (attendanceStatus === 'checked_in') {
        active.push(s);
        return;
      }

      if (['completed_pending_review', 'needs_review', 'disputed', 'pending_approval'].includes(attendanceStatus)) {
        inReview.push(s);
        return;
      }

      if (scheduleStatus === 'published' && assignmentStatus !== 'accepted' && assignmentStatus !== 'declined') {
        actionRequired.push(s);
        return;
      }

      if (scheduleStatus === 'published' && assignmentStatus === 'accepted') {
        upcoming.push(s);
        return;
      }

      if (assignmentStatus === 'declined') {
        history.push(s);
      } else {
        upcoming.push(s);
      }
    });

    upcoming.sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
    history.sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`));

    return {
      actionRequiredShifts: actionRequired,
      activeShifts: active,
      upcomingShifts: upcoming,
      inReviewShifts: inReview,
      historyShifts: history,
    };
  }, [shifts]);

  // Next actionable shift for hero banner
  const nextActionableShift = useMemo(() => {
    if (activeShifts.length > 0) return { type: 'active', shift: activeShifts[0] };
    if (actionRequiredShifts.length > 0) return { type: 'action_required', shift: actionRequiredShifts[0] };
    if (upcomingShifts.length > 0) return { type: 'upcoming', shift: upcomingShifts[0] };
    return null;
  }, [activeShifts, actionRequiredShifts, upcomingShifts]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-stone-700" />
            Lịch làm việc & Điểm danh
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Xác nhận ca làm, điểm danh bằng định vị GPS thiết bị tại quán và quản lý lịch nghỉ phép.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsTimeOffModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold transition-colors"
          >
            <CalendarOff className="w-3.5 h-3.5 text-stone-600" />
            <span>Nộp đơn xin nghỉ</span>
          </button>
        </div>
      </div>

      {/* Hero Banner: Next Actionable Shift */}
      {nextActionableShift && (
        <div className={clsx(
          'p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all',
          nextActionableShift.type === 'active'
            ? 'bg-blue-50/70 border-blue-200'
            : nextActionableShift.type === 'action_required'
            ? 'bg-amber-50/70 border-amber-200'
            : 'bg-stone-50 border-stone-200'
        )}>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={clsx(
                'text-[11px] font-bold px-2 py-0.5 rounded tracking-wide uppercase',
                nextActionableShift.type === 'active' ? 'bg-blue-100 text-blue-800' :
                nextActionableShift.type === 'action_required' ? 'bg-amber-100 text-amber-800' :
                'bg-stone-200 text-stone-700'
              )}>
                {nextActionableShift.type === 'active' ? 'Đang trong ca làm' :
                 nextActionableShift.type === 'action_required' ? 'Cần bạn phản hồi' : 'Ca làm tiếp theo'}
              </span>
              <span className="text-xs font-semibold text-stone-600">
                {nextActionableShift.shift.date} • {nextActionableShift.shift.startTime} - {nextActionableShift.shift.endTime}
              </span>
            </div>

            <h3 className="font-bold text-stone-900 text-sm">
              {nextActionableShift.shift.storeName || 'Cửa hàng'} — {nextActionableShift.shift.role || 'Nhân viên ca làm'}
            </h3>

            {nextActionableShift.type === 'upcoming' && (
              <p className="text-xs text-stone-500">
                {evaluateCheckInWindow(nextActionableShift.shift).label}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {nextActionableShift.type === 'active' ? (
              <button
                type="button"
                onClick={() => handleOpenAttendanceModal(nextActionableShift.shift)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Check-out ra ca</span>
              </button>
            ) : nextActionableShift.type === 'action_required' ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAccept(nextActionableShift.shift._id || nextActionableShift.shift.id)}
                  disabled={actionLoading}
                  className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition-colors flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Nhận ca</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeclineModalShift(nextActionableShift.shift)}
                  className="px-3 py-2 rounded-lg bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 font-semibold text-xs transition-colors"
                >
                  Báo bận
                </button>
              </div>
            ) : (
              (() => {
                const windowCheck = evaluateCheckInWindow(nextActionableShift.shift);
                return (
                  <button
                    type="button"
                    onClick={() => handleOpenAttendanceModal(nextActionableShift.shift)}
                    disabled={!windowCheck.canCheckIn}
                    className={clsx(
                      'px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5',
                      windowCheck.canCheckIn
                        ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                        : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                    )}
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>{windowCheck.canCheckIn ? 'Check-in vào ca' : 'Chưa đến giờ check-in'}</span>
                  </button>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-stone-200 overflow-x-auto text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('active_upcoming')}
          className={clsx(
            'px-3.5 py-2.5 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap',
            activeTab === 'active_upcoming'
              ? 'border-stone-900 text-stone-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          )}
        >
          <span>Sắp tới & Đang diễn ra</span>
          {(activeShifts.length + upcomingShifts.length) > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-stone-100 text-stone-700 text-[10px] font-bold">
              {activeShifts.length + upcomingShifts.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('action_required')}
          className={clsx(
            'px-3.5 py-2.5 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap',
            activeTab === 'action_required'
              ? 'border-stone-900 text-stone-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          )}
        >
          <span>Cần phản hồi</span>
          {actionRequiredShifts.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
              {actionRequiredShifts.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('in_review')}
          className={clsx(
            'px-3.5 py-2.5 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap',
            activeTab === 'in_review'
              ? 'border-stone-900 text-stone-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          )}
        >
          <span>Chờ duyệt & Đối soát</span>
          {inReviewShifts.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
              {inReviewShifts.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={clsx(
            'px-3.5 py-2.5 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap',
            activeTab === 'history'
              ? 'border-stone-900 text-stone-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          )}
        >
          <span>Lịch sử ca làm</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('time_off')}
          className={clsx(
            'px-3.5 py-2.5 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap',
            activeTab === 'time_off'
              ? 'border-stone-900 text-stone-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          )}
        >
          <span>Đơn xin nghỉ</span>
          {timeOffRequests.filter((r) => r.status === 'pending').length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-stone-200 text-stone-700 text-[10px] font-bold">
              {timeOffRequests.filter((r) => r.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {/* Main Tab Content */}
      {loading ? (
        <div className="p-12 text-center text-stone-500">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-stone-700 mb-2" />
          <p className="text-xs">Đang tải dữ liệu ca làm việc...</p>
        </div>
      ) : (
        <div>
          {/* TAB 1: SẮP TỚI & ĐANG DIỄN RA */}
          {activeTab === 'active_upcoming' && (
            <div className="space-y-4">
              {activeShifts.length === 0 && upcomingShifts.length === 0 ? (
                <div className="p-10 text-center bg-white rounded-xl border border-stone-200 space-y-2">
                  <Calendar className="w-8 h-8 text-stone-400 mx-auto" />
                  <p className="font-semibold text-stone-800 text-sm">Hiện chưa có ca làm việc nào sắp tới</p>
                  <p className="text-xs text-stone-500 max-w-sm mx-auto">
                    Khi quản lý xếp ca mới và công bố lịch, bạn sẽ nhận được thông báo tại tab Cần phản hồi.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeShifts.map((shift) => (
                    <ShiftCardItem
                      key={shift._id || shift.id}
                      shift={shift}
                      onOpenAttendance={() => handleOpenAttendanceModal(shift)}
                    />
                  ))}

                  {upcomingShifts.map((shift) => (
                    <ShiftCardItem
                      key={shift._id || shift.id}
                      shift={shift}
                      onOpenAttendance={() => handleOpenAttendanceModal(shift)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CẦN PHẢN HỒI */}
          {activeTab === 'action_required' && (
            <div className="space-y-4">
              {actionRequiredShifts.length === 0 ? (
                <div className="p-10 text-center bg-white rounded-xl border border-stone-200 space-y-2">
                  <CheckCircle className="w-8 h-8 text-stone-400 mx-auto" />
                  <p className="font-semibold text-stone-800 text-sm">Không có ca làm nào cần phản hồi</p>
                  <p className="text-xs text-stone-500">Tất cả các ca làm đã được bạn phản hồi đầy đủ.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {actionRequiredShifts.map((shift) => {
                    const statusInfo = getDisplayStatusInfo(shift);
                    return (
                      <div
                        key={shift._id || shift.id}
                        className="bg-white p-5 rounded-xl border border-stone-200 flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-stone-700 bg-stone-100 px-2.5 py-1 rounded">
                              {shift.date}
                            </span>
                            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                          </div>

                          <div>
                            <h3 className="font-bold text-stone-900 text-sm">
                              {shift.storeName || 'Cửa hàng tuyển dụng'}
                            </h3>
                            <p className="text-xs text-stone-500 mt-0.5">{shift.role || 'Nhân viên ca làm'}</p>
                          </div>

                          <div className="space-y-1 text-xs text-stone-600">
                            <p className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                              <span className="font-semibold">{shift.startTime} – {shift.endTime}</span>
                              <span className="text-stone-400">({shift.hours || 4} giờ)</span>
                            </p>
                            <p className="text-stone-700 font-medium">
                              Lương dự kiến: {((shift.wageRate || 25000) * (shift.hours || 4)).toLocaleString('vi-VN')}đ ({Number(shift.wageRate || 25000).toLocaleString('vi-VN')}đ/h)
                            </p>
                          </div>

                          {shift.scheduleRevision > 1 && (
                            <p className="p-2 rounded bg-amber-50 text-amber-800 text-[11px] border border-amber-200">
                              Lịch ca đã được quản lý điều chỉnh lại (Bản sửa đổi #{shift.scheduleRevision}). Vui lòng xác nhận lại.
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handleAcknowledge(shift._id || shift.id)}
                            disabled={actionLoading}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-100 transition-colors"
                          >
                            Đã xem
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setDeclineModalShift(shift)}
                              disabled={actionLoading}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
                            >
                              Báo bận
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAccept(shift._id || shift.id)}
                              disabled={actionLoading}
                              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition-colors flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Nhận ca</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CHỜ DUYỆT & ĐỐI SOÁT */}
          {activeTab === 'in_review' && (
            <div className="space-y-4">
              {inReviewShifts.length === 0 ? (
                <div className="p-10 text-center bg-white rounded-xl border border-stone-200 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-stone-400 mx-auto" />
                  <p className="font-semibold text-stone-800 text-sm">Không có ca làm nào chờ duyệt hoặc đối soát</p>
                  <p className="text-xs text-stone-500">Các ca làm sau khi ra ca và cần xem xét sẽ xuất hiện ở đây.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {inReviewShifts.map((shift) => {
                    const statusInfo = getDisplayStatusInfo(shift);
                    const att = shift.attendance || {};
                    return (
                      <div
                        key={shift._id || shift.id}
                        className="bg-white p-5 rounded-xl border border-stone-200 flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-stone-700 bg-stone-100 px-2.5 py-1 rounded">
                              {shift.date}
                            </span>
                            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                          </div>

                          <div>
                            <h3 className="font-bold text-stone-900 text-sm">
                              {shift.storeName || 'Cửa hàng'} — {shift.role || 'Nhân viên'}
                            </h3>
                            <p className="text-xs text-stone-500">
                              Kế hoạch: {shift.startTime} – {shift.endTime} ({shift.hours || 4} giờ)
                            </p>
                          </div>

                          {/* Attendance audit detail */}
                          <div className="p-2.5 bg-stone-50 rounded-lg text-xs space-y-1 text-stone-700 border border-stone-150">
                            {att.checkInAt && (
                              <p>
                                Vào ca: <strong>{new Date(att.checkInAt).toLocaleTimeString('vi-VN')}</strong>
                              </p>
                            )}
                            {att.checkOutAt && (
                              <p>
                                Ra ca: <strong>{new Date(att.checkOutAt).toLocaleTimeString('vi-VN')}</strong>
                              </p>
                            )}
                            {att.checkInVerificationStatus === 'verified' ? (
                              <p className="text-emerald-700 font-medium">✓ Định vị GPS chuẩn ({Math.round(att.checkInDistanceMeters || 0)}m)</p>
                            ) : att.checkInManualReason ? (
                              <p className="text-stone-600">Yêu cầu thủ công: {att.checkInManualReason}</p>
                            ) : null}
                          </div>

                          {shift.disputeReason && (
                            <div className="p-2.5 rounded bg-red-50 text-red-800 text-xs border border-red-200 space-y-1">
                              <p className="font-bold flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                                Lý do đối soát của bạn:
                              </p>
                              <p>{shift.disputeReason}</p>
                            </div>
                          )}

                          {shift.disputeResolution?.resolution && (
                            <div className="p-2.5 rounded bg-blue-50 text-blue-900 text-xs border border-blue-200 space-y-1">
                              <p className="font-bold">Kết quả xử lý từ quản lý:</p>
                              <p>{shift.disputeResolution.resolution === 'accepted' ? 'Đã chấp nhận điều chỉnh' : 'Đã giữ nguyên kết quả'}</p>
                              {shift.disputeResolution.note && <p className="italic">Ghi chú: {shift.disputeResolution.note}</p>}
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                          {!shift.disputeReason && shift.attendanceStatus !== 'disputed' && (
                            <button
                              type="button"
                              onClick={() => {
                                setDisputeModalShift(shift);
                                setDisputeReason('');
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-50 transition-colors"
                            >
                              Báo đối soát công
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: LỊCH SỬ CA LÀM */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {historyShifts.length === 0 ? (
                <div className="p-10 text-center bg-white rounded-xl border border-stone-200 space-y-2">
                  <Calendar className="w-8 h-8 text-stone-400 mx-auto" />
                  <p className="font-semibold text-stone-800 text-sm">Chưa có lịch sử ca làm hoàn thành</p>
                  <p className="text-xs text-stone-500">Các ca làm đã duyệt công hoặc thanh toán sẽ được lưu tại đây.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {historyShifts.map((shift) => {
                    const statusInfo = getDisplayStatusInfo(shift);
                    return (
                      <div
                        key={shift._id || shift.id}
                        className="bg-white p-5 rounded-xl border border-stone-200 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-stone-700 bg-stone-100 px-2.5 py-1 rounded">
                            {shift.date}
                          </span>
                          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        </div>

                        <div>
                          <h3 className="font-bold text-stone-900 text-sm">
                            {shift.storeName || 'Cửa hàng'} — {shift.role || 'Nhân viên'}
                          </h3>
                          <p className="text-xs text-stone-500">
                            Giờ làm: {shift.startTime} – {shift.endTime} ({shift.hours || 4} giờ)
                          </p>
                        </div>

                        <div className="text-xs text-stone-600 pt-1 border-t border-stone-100 flex items-center justify-between">
                          <span>Tiền ca:</span>
                          <span className="font-semibold text-stone-900">
                            {((shift.wageRate || 25000) * (shift.hours || 4)).toLocaleString('vi-VN')}đ
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: ĐƠN XIN NGHỈ PHÉP */}
          {activeTab === 'time_off' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-stone-900 text-sm">Đơn xin nghỉ phép của bạn</h3>
                  <p className="text-xs text-stone-500">Theo dõi trạng thái các đơn xin nghỉ đã nộp đến quản lý.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTimeOffModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nộp đơn mới</span>
                </button>
              </div>

              {timeOffRequests.length === 0 ? (
                <div className="p-10 text-center bg-white rounded-xl border border-stone-200 space-y-2">
                  <CalendarOff className="w-8 h-8 text-stone-400 mx-auto" />
                  <p className="font-semibold text-stone-800 text-sm">Bạn chưa có đơn xin nghỉ nào</p>
                  <p className="text-xs text-stone-500">Bấm &ldquo;Nộp đơn mới&rdquo; khi bạn cần xin nghỉ các ngày bận.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {timeOffRequests.map((req) => {
                    const sDate = new Date(req.startDate).toLocaleDateString('vi-VN');
                    const eDate = new Date(req.endDate).toLocaleDateString('vi-VN');
                    const statusBadge =
                      req.status === 'approved' ? { variant: 'green', label: 'Đã duyệt' } :
                      req.status === 'rejected' ? { variant: 'red', label: 'Bị từ chối' } :
                      req.status === 'cancelled' ? { variant: 'gray', label: 'Đã hủy' } :
                      { variant: 'yellow', label: 'Đang chờ duyệt' };

                    return (
                      <div
                        key={req._id || req.id}
                        className="bg-white p-5 rounded-xl border border-stone-200 flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-stone-700 bg-stone-100 px-2 py-0.5 rounded">
                              {sDate === eDate ? sDate : `${sDate} – ${eDate}`}
                            </span>
                            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                          </div>

                          <div>
                            <p className="text-xs text-stone-500">Cửa hàng:</p>
                            <p className="font-bold text-stone-900 text-sm">
                              {req.employerUserId?.storeName || req.employmentId?.workplace || 'Cửa hàng tuyển dụng'}
                            </p>
                          </div>

                          {req.reason && (
                            <p className="text-xs text-stone-600 bg-stone-50 p-2.5 rounded border border-stone-150">
                              Lý do: {req.reason}
                            </p>
                          )}

                          {req.reviewNote && (
                            <p className="text-xs text-stone-600 italic">
                              Phản hồi của quản lý: {req.reviewNote}
                            </p>
                          )}
                        </div>

                        {req.status === 'pending' && (
                          <div className="pt-2 border-t border-stone-100 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleCancelTimeOff(req._id || req.id)}
                              disabled={actionLoading}
                              className="px-3 py-1 rounded text-xs font-semibold text-stone-500 hover:text-red-700 hover:bg-stone-50 transition-colors"
                            >
                              Hủy đơn
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL: Báo bận / Từ chối ca */}
      {declineModalShift && (
        <Modal
          isOpen={true}
          onClose={() => {
            setDeclineModalShift(null);
            setDeclineReason('');
          }}
          title="Báo bận / Từ chối ca làm việc"
        >
          <div className="space-y-4 text-xs">
            <p className="text-stone-600 leading-relaxed">
              Bạn đang báo không thể tham gia ca làm ngày <strong>{declineModalShift.date}</strong> ({declineModalShift.startTime} – {declineModalShift.endTime}) tại <strong>{declineModalShift.storeName}</strong>. Vui lòng nêu rõ lý do để quản lý bố trí nhân sự thay thế.
            </p>

            <div>
              <label className="block font-semibold text-stone-800 mb-1">
                Lý do báo bận *
              </label>
              <textarea
                rows={3}
                required
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Ví dụ: Em có lịch thi học phần đột xuất của trường trùng khung giờ này..."
                className="w-full p-2.5 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setDeclineModalShift(null)}
                className="px-3.5 py-2 rounded-lg bg-stone-100 text-stone-700 font-semibold hover:bg-stone-200"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeclineSubmit}
                disabled={actionLoading || !declineReason.trim()}
                className="px-3.5 py-2 rounded-lg bg-red-700 text-white font-semibold hover:bg-red-800 disabled:opacity-50"
              >
                {actionLoading ? 'Đang gửi...' : 'Xác nhận từ chối ca'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: Đối soát công */}
      {disputeModalShift && (
        <Modal
          isOpen={true}
          onClose={() => {
            setDisputeModalShift(null);
            setDisputeReason('');
          }}
          title="Báo đối soát giờ công"
        >
          <div className="space-y-4 text-xs">
            <p className="text-stone-600 leading-relaxed">
              Nếu thời gian làm việc hoặc tiền ca chưa đúng với thực tế bạn đã làm, hãy nêu rõ thông tin đối soát để quản lý xem xét và điều chỉnh.
            </p>

            <div>
              <label className="block font-semibold text-stone-800 mb-1">
                Chi tiết đối soát *
              </label>
              <textarea
                rows={3}
                required
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Ví dụ: Em đã làm bù thêm 30 phút dọn quán đến 12:30 theo yêu cầu của quản lý..."
                className="w-full p-2.5 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setDisputeModalShift(null)}
                className="px-3.5 py-2 rounded-lg bg-stone-100 text-stone-700 font-semibold hover:bg-stone-200"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleDisputeSubmit}
                disabled={actionLoading || !disputeReason.trim()}
                className="px-3.5 py-2 rounded-lg bg-stone-900 text-white font-semibold hover:bg-stone-800 disabled:opacity-50"
              >
                {actionLoading ? 'Đang gửi...' : 'Gửi yêu cầu đối soát'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: Nộp đơn xin nghỉ phép */}
      {isTimeOffModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsTimeOffModalOpen(false)}
          title="Nộp đơn xin nghỉ phép"
        >
          <form onSubmit={handleSubmitTimeOff} className="space-y-4 text-xs">
            {employments.length > 1 && (
              <div>
                <label className="block font-semibold text-stone-800 mb-1">
                  Chọn nơi làm việc *
                </label>
                <select
                  value={timeOffForm.employmentId}
                  onChange={(e) => setTimeOffForm({ ...timeOffForm, employmentId: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900 text-xs bg-white"
                >
                  {employments.map((emp) => (
                    <option key={emp._id || emp.id} value={emp._id || emp.id}>
                      {emp.workplace || emp.positionTitle || 'Cơ sở tuyển dụng'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-stone-800 mb-1">
                  Từ ngày *
                </label>
                <input
                  type="date"
                  required
                  value={timeOffForm.startDate}
                  onChange={(e) => setTimeOffForm({ ...timeOffForm, startDate: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900 text-xs bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-800 mb-1">
                  Đến ngày *
                </label>
                <input
                  type="date"
                  required
                  value={timeOffForm.endDate}
                  onChange={(e) => setTimeOffForm({ ...timeOffForm, endDate: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900 text-xs bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-stone-800 mb-1">
                Lý do xin nghỉ
              </label>
              <textarea
                rows={3}
                value={timeOffForm.reason}
                onChange={(e) => setTimeOffForm({ ...timeOffForm, reason: e.target.value })}
                placeholder="Ví dụ: Về quê có việc gia đình, trùng lịch thi học phần..."
                className="w-full p-2.5 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsTimeOffModalOpen(false)}
                className="px-3.5 py-2 rounded-lg bg-stone-100 text-stone-700 font-semibold hover:bg-stone-200"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-3.5 py-2 rounded-lg bg-stone-900 text-white font-semibold hover:bg-stone-800 disabled:opacity-50"
              >
                {actionLoading ? 'Đang gửi...' : 'Nộp đơn nghỉ phép'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Điểm danh ca (GPS / Thủ công) */}
      {modalShift && (
        <Modal
          isOpen={true}
          onClose={handleCloseAttendanceModal}
          title={modalShift.attendanceStatus === 'checked_in' || modalShift.status === 'checked_in' ? 'Check-Out Ra Ca' : 'Check-In Vào Ca Làm'}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 space-y-1">
              <p className="font-bold text-stone-900 text-sm">{modalShift.storeName || 'Cửa hàng tuyển dụng'}</p>
              <p className="text-stone-600">
                Ca làm: <strong>{modalShift.startTime} - {modalShift.endTime}</strong> • Ngày: <strong>{modalShift.date}</strong>
              </p>
            </div>

            {/* Mode switch */}
            <div className="flex border-b border-stone-200">
              <button
                type="button"
                onClick={() => setAttendanceMode('gps')}
                className={clsx(
                  'pb-2 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5',
                  attendanceMode === 'gps'
                    ? 'border-stone-900 text-stone-900'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                )}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Xác thực GPS thiết bị</span>
              </button>

              <button
                type="button"
                onClick={() => setAttendanceMode('manual')}
                className={clsx(
                  'pb-2 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5',
                  attendanceMode === 'manual'
                    ? 'border-stone-900 text-stone-900'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                )}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Chấm công thủ công (Cần duyệt)</span>
              </button>
            </div>

            {/* GPS Mode */}
            {attendanceMode === 'gps' && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-lg border border-stone-200 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                      <Navigation className="w-3.5 h-3.5 text-blue-600" />
                      Tọa độ thực tế từ thiết bị:
                    </span>
                    <button
                      type="button"
                      onClick={requestFreshGps}
                      disabled={gpsState.status === 'requesting'}
                      className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:text-blue-900 font-semibold"
                    >
                      <RefreshCw className={clsx('w-3 h-3', gpsState.status === 'requesting' && 'animate-spin')} />
                      <span>Lấy lại GPS</span>
                    </button>
                  </div>

                  {gpsState.status === 'requesting' && (
                    <div className="p-2.5 rounded bg-blue-50 text-blue-800 flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                      <span>Đang nhận diện vị trí GPS có độ chính xác cao...</span>
                    </div>
                  )}

                  {(gpsState.status === 'success' || gpsState.status === 'low_accuracy') && gpsState.coords && (
                    <div className="p-2.5 rounded bg-emerald-50 text-emerald-900 space-y-1">
                      <p className="font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        Đã ghi nhận tọa độ thiết bị
                      </p>
                      <p className="font-mono text-[11px] text-emerald-800">
                        {gpsState.coords.lat.toFixed(5)}, {gpsState.coords.lng.toFixed(5)} (Sai số: ±{gpsState.coords.accuracy}m)
                      </p>
                      {gpsState.status === 'low_accuracy' && (
                        <p className="text-[11px] text-amber-800 font-medium">
                          Sai số GPS &gt; 100m. Yêu cầu sẽ được chuyển sang Cần quản lý duyệt.
                        </p>
                      )}
                    </div>
                  )}

                  {gpsState.status === 'error' && (
                    <div className="p-2.5 rounded bg-red-50 text-red-900 space-y-2">
                      <p className="font-semibold flex items-center gap-1 text-red-800">
                        <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                        Không thể lấy tọa độ GPS
                      </p>
                      <p className="text-[11px] text-red-700">{gpsState.error}</p>
                      <div className="pt-1 flex gap-2">
                        <button
                          type="button"
                          onClick={requestFreshGps}
                          className="px-2.5 py-1 rounded bg-red-100 hover:bg-red-200 text-red-900 font-semibold text-[11px]"
                        >
                          Thử lại GPS
                        </button>
                        <button
                          type="button"
                          onClick={() => setAttendanceMode('manual')}
                          className="px-2.5 py-1 rounded bg-white border border-red-300 text-red-900 font-semibold text-[11px]"
                        >
                          Chuyển sang chấm công thủ công
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-stone-500 italic">
                  Hệ thống tự động đối chiếu tọa độ GPS thực tế của thiết bị với vị trí quán để xác nhận điểm danh.
                </p>
              </div>
            )}

            {/* Manual Mode */}
            {attendanceMode === 'manual' && (
              <div className="space-y-3">
                <div className="p-2.5 rounded bg-amber-50 text-amber-900 border border-amber-200 space-y-1">
                  <p className="font-semibold">Chấm công thủ công</p>
                  <p className="text-[11px]">
                    Dành cho trường hợp thiết bị lỗi GPS hoặc hết pin. Ca làm sẽ được chuyển sang trạng thái <strong>Chờ quản lý duyệt</strong>.
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-stone-800 mb-1">
                    Lý do chấm công thủ công *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={manualReason}
                    onChange={(e) => setManualReason(e.target.value)}
                    placeholder="Ví dụ: Thiết bị lỗi GPS không bật được vị trí, em đã đến làm việc tại quán lúc 07:45..."
                    className="w-full p-2.5 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900 text-xs"
                  />
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={handleCloseAttendanceModal}
                disabled={actionLoading}
                className="px-3.5 py-2 rounded-lg bg-stone-100 text-stone-700 font-semibold hover:bg-stone-200"
              >
                Đóng
              </button>

              <button
                type="button"
                onClick={handleSubmitAttendance}
                disabled={
                  actionLoading ||
                  (attendanceMode === 'gps' && (!gpsState.coords || gpsState.status === 'requesting' || gpsState.status === 'error')) ||
                  (attendanceMode === 'manual' && !manualReason.trim())
                }
                className={clsx(
                  'px-4 py-2 rounded-lg text-white font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50',
                  modalShift.attendanceStatus === 'checked_in' || modalShift.status === 'checked_in'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-emerald-700 hover:bg-emerald-800'
                )}
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {modalShift.attendanceStatus === 'checked_in' || modalShift.status === 'checked_in'
                    ? (attendanceMode === 'manual' ? 'Gửi yêu cầu Ra Ca' : 'Xác nhận Check-Out Ra Ca')
                    : (attendanceMode === 'manual' ? 'Gửi yêu cầu Vào Ca' : 'Xác nhận Check-In Vào Ca')}
                </span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Subcomponent: Shift Card Item for Upcoming & Active
function ShiftCardItem({ shift, onOpenAttendance }) {
  const statusInfo = getDisplayStatusInfo(shift);
  const isActive = shift.attendanceStatus === 'checked_in' || shift.status === 'checked_in';
  const windowCheck = evaluateCheckInWindow(shift);

  return (
    <div className={clsx(
      'bg-white p-5 rounded-xl border flex flex-col justify-between space-y-4 transition-all',
      isActive ? 'border-blue-300 ring-1 ring-blue-300' : 'border-stone-200'
    )}>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-stone-700 bg-stone-100 px-2.5 py-1 rounded">
            {shift.date}
          </span>
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
        </div>

        <div>
          <h3 className="font-bold text-stone-900 text-sm">
            {shift.storeName || 'Cửa hàng tuyển dụng'}
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">{shift.role || 'Nhân viên ca làm'}</p>
        </div>

        <div className="space-y-1 text-xs text-stone-600">
          <p className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <span className="font-semibold text-stone-800">{shift.startTime} – {shift.endTime}</span>
            <span className="text-stone-400">({shift.hours || 4} giờ)</span>
          </p>
          <p className="text-stone-700 font-medium">
            Tiền ca: {((shift.wageRate || 25000) * (shift.hours || 4)).toLocaleString('vi-VN')}đ ({Number(shift.wageRate || 25000).toLocaleString('vi-VN')}đ/h)
          </p>
        </div>

        {!isActive && (
          <p className="text-[11px] text-stone-500 pt-1">
            {windowCheck.label}
          </p>
        )}
      </div>

      <div className="pt-3 border-t border-stone-100 flex items-center justify-end">
        {isActive ? (
          <button
            type="button"
            onClick={onOpenAttendance}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Check-out ra ca</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenAttendance}
            disabled={!windowCheck.canCheckIn}
            className={clsx(
              'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5',
              windowCheck.canCheckIn
                ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                : 'bg-stone-100 text-stone-400 cursor-not-allowed'
            )}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>{windowCheck.canCheckIn ? 'Check-in điểm danh' : 'Chưa đến giờ'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
