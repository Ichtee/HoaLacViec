import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Clock,
  RefreshCw,
  Loader2,
  CalendarOff,
  Plus,
  MapPin,
  DollarSign,
} from 'lucide-react';
import { clsx } from 'clsx';
import { formatShortDate } from '@/utils/statusHelpers.js';
import { useAuth } from '@/hooks/useAuth.jsx';
import {
  getShifts,
  getTimeOff,
  submitTimeOff,
  updateTimeOffStatus,
  getEmployments,
} from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Modal } from '@/components/Modal.jsx';
import { Toast } from '@/components/Feedback.jsx';
import { Tabs } from '@/components/Tabs.jsx';

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Read-only status info for employees
function getEmployeeStatusBadge(shift) {
  const scheduleStatus = shift.scheduleStatus || (shift.status === 'draft' ? 'draft' : shift.status === 'cancelled' ? 'cancelled' : 'published');
  const attendanceStatus = shift.attendanceStatus || shift.status;
  const payrollStatus = shift.payrollStatus || (shift.status === 'paid' ? 'paid' : shift.status === 'payroll_ready' ? 'ready' : 'not_ready');

  if (scheduleStatus === 'cancelled') {
    return { variant: 'gray', label: 'Đã hủy ca' };
  }
  if (payrollStatus === 'paid') {
    return { variant: 'green', label: 'Đã thanh toán lương' };
  }
  if (payrollStatus === 'ready') {
    return { variant: 'blue', label: 'Sẵn sàng tính lương' };
  }
  if (attendanceStatus === 'approved') {
    return { variant: 'green', label: 'Đã duyệt giờ công' };
  }
  if (attendanceStatus === 'completed_pending_review' || attendanceStatus === 'needs_review' || attendanceStatus === 'pending_approval') {
    return { variant: 'yellow', label: 'Chờ quản lý duyệt công' };
  }
  if (attendanceStatus === 'checked_in') {
    return { variant: 'green', label: 'Đang làm việc' };
  }
  if (attendanceStatus === 'no_show') {
    return { variant: 'red', label: 'Ghi nhận vắng mặt' };
  }
  return { variant: 'blue', label: 'Đã lên lịch' };
}

export default function StudentShiftsPage() {
  const { user } = useAuth();

  const [shifts, setShifts] = useState([]);
  const [timeOffRequests, setTimeOffRequests] = useState([]);
  const [employments, setEmployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Active Tab: 'upcoming', 'history', 'time_off'
  const [activeTab, setActiveTab] = useState('upcoming');

  // Time-Off Modal State
  const [isTimeOffModalOpen, setIsTimeOffModalOpen] = useState(false);
  const [timeOffForm, setTimeOffForm] = useState({
    startDate: '',
    endDate: '',
    reason: '',
    employerUserId: '',
  });
  const [isSubmittingTimeOff, setIsSubmittingTimeOff] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [shiftData, toData, empData] = await Promise.all([
        getShifts({ studentId: user?.id }).catch(() => []),
        getTimeOff({ employeeUserId: user?.id }).catch(() => []),
        getEmployments({ employeeUserId: user?.id, status: 'active' }).catch(() => []),
      ]);

      setShifts(Array.isArray(shiftData) ? shiftData : []);
      setTimeOffRequests(Array.isArray(toData) ? toData : []);
      setEmployments(Array.isArray(empData) ? empData : []);

      if (Array.isArray(empData) && empData.length > 0 && !timeOffForm.employerUserId) {
        setTimeOffForm((prev) => ({
          ...prev,
          employerUserId: empData[0].employerUserId?._id || empData[0].employerUserId,
        }));
      }
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: 'Không thể tải dữ liệu lịch làm việc.' });
    } finally {
      setLoading(false);
    }
  }, [user?.id, timeOffForm.employerUserId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const todayStr = getTodayString();

  // Filter shifts
  const upcomingShifts = useMemo(() => {
    return shifts.filter((s) => {
      const isCancelled = s.scheduleStatus === 'cancelled' || s.status === 'cancelled';
      if (isCancelled) return false;
      const isCheckedIn = s.attendanceStatus === 'checked_in';
      return (s.date >= todayStr && s.attendanceStatus === 'not_started') || isCheckedIn;
    }).sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : a.startTime.localeCompare(b.startTime)));
  }, [shifts, todayStr]);

  const historyShifts = useMemo(() => {
    return shifts.filter((s) => {
      const isCancelled = s.scheduleStatus === 'cancelled' || s.status === 'cancelled';
      const isCompleted = ['approved', 'completed_pending_review', 'needs_review', 'no_show'].includes(s.attendanceStatus);
      const isPast = s.date < todayStr;
      return isCancelled || isCompleted || isPast;
    }).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.startTime.localeCompare(a.startTime)));
  }, [shifts, todayStr]);

  // Metrics
  const metrics = useMemo(() => {
    const totalHours = shifts
      .filter((s) => ['approved', 'completed_pending_review'].includes(s.attendanceStatus))
      .reduce((sum, s) => sum + (s.hours || 0), 0);

    const totalEarned = shifts
      .filter((s) => s.attendanceStatus === 'approved')
      .reduce((sum, s) => sum + (s.totalPay || (s.hours || 0) * (s.wageRate || 25000)), 0);

    return {
      upcomingCount: upcomingShifts.length,
      totalHours: Math.round(totalHours * 10) / 10,
      totalEarned,
      pendingTimeOff: timeOffRequests.filter((r) => r.status === 'pending').length,
    };
  }, [shifts, upcomingShifts, timeOffRequests]);

  // Submit Time-Off Request
  const handleSubmitTimeOff = async (e) => {
    e.preventDefault();
    if (!timeOffForm.startDate || !timeOffForm.endDate || !timeOffForm.reason.trim()) {
      setToast({ type: 'warning', message: 'Vui lòng điền đầy đủ ngày bắt đầu, kết thúc và lý do.' });
      return;
    }
    if (timeOffForm.startDate > timeOffForm.endDate) {
      setToast({ type: 'warning', message: 'Ngày bắt đầu không thể sau ngày kết thúc.' });
      return;
    }

    setIsSubmittingTimeOff(true);
    try {
      await submitTimeOff(timeOffForm);
      setToast({ type: 'success', message: 'Đã gửi đơn xin nghỉ phép đến quản lý thành công!' });
      setIsTimeOffModalOpen(false);
      setTimeOffForm({
        startDate: '',
        endDate: '',
        reason: '',
        employerUserId: employments[0]?.employerUserId?._id || employments[0]?.employerUserId || '',
      });
      loadData();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể gửi đơn xin nghỉ.' });
    } finally {
      setIsSubmittingTimeOff(false);
    }
  };

  // Cancel Time-off Request
  const handleCancelTimeOff = async (requestId) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy đơn xin nghỉ phép này?')) return;
    try {
      await updateTimeOffStatus(requestId, { status: 'cancelled' });
      setToast({ type: 'success', message: 'Đã hủy đơn xin nghỉ thành công.' });
      loadData();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể hủy đơn xin nghỉ.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast notifications */}
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
            <Calendar className="w-6 h-6 text-green-main" />
            Lịch làm việc
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Theo dõi ca làm việc, thời gian làm và thông tin giờ công do nhà tuyển dụng xếp ca và ghi nhận.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsTimeOffModalOpen(true)}
            className="btn btn-outline btn-sm flex items-center gap-1.5"
          >
            <CalendarOff className="w-4 h-4 text-pink-700" />
            Xin nghỉ phép
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="btn btn-outline btn-sm flex items-center gap-1.5"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-main shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-text-main">{metrics.upcomingCount}</div>
            <div className="text-xs text-text-muted">Ca sắp tới & đang làm</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-text-main">{metrics.totalHours}h</div>
            <div className="text-xs text-text-muted">Tổng giờ công ghi nhận</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center text-yellow-600 shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-text-main">{metrics.totalEarned.toLocaleString('vi-VN')} đ</div>
            <div className="text-xs text-text-muted">Tiền công đã duyệt</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center text-pink-700 shrink-0">
            <CalendarOff className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-text-main">{metrics.pendingTimeOff}</div>
            <div className="text-xs text-text-muted">Đơn nghỉ chờ duyệt</div>
          </div>
        </div>
      </div>

      <Tabs
        ariaLabel="Lọc ca làm"
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { id: 'upcoming', label: 'Sắp tới & đang làm', icon: Calendar, count: upcomingShifts.length },
          { id: 'history', label: 'Lịch sử ca làm', icon: Clock, count: historyShifts.length },
          { id: 'time_off', label: 'Đơn xin nghỉ', icon: CalendarOff, count: timeOffRequests.length },
        ]}
      />

      {/* Tab 1: Sắp tới & Đang làm */}
      {activeTab === 'upcoming' && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-green-main mb-2" />
              <span>Đang tải danh sách ca làm...</span>
            </div>
          ) : upcomingShifts.length === 0 ? (
            <div className="card p-12 text-center text-text-muted">
              <Calendar className="w-12 h-12 mx-auto text-stone-300 mb-3" />
              <h3 className="font-semibold text-text-main text-base">Hiện không có ca làm việc sắp tới</h3>
              <p className="text-sm mt-1">Khi nhà tuyển dụng công bố ca làm mới, thông tin sẽ hiển thị tại đây.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingShifts.map((shift) => {
                const badgeInfo = getEmployeeStatusBadge(shift);
                const isCheckedIn = shift.attendanceStatus === 'checked_in';

                return (
                  <div
                    key={shift._id || shift.id}
                    className={clsx(
                      'card p-5 transition-all relative border',
                      isCheckedIn ? 'border-green-400 bg-green-50/20 shadow-md' : 'border-stone-200'
                    )}
                  >
                    {isCheckedIn && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 mb-3">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                        Đang trong giờ làm việc
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h4 className="font-bold text-text-main text-base">
                          {shift.positionTitle || shift.role || 'Nhân viên bán ca'}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-text-muted mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span>{shift.workplaceName || shift.storeName || 'Cơ sở làm việc'}</span>
                        </div>
                      </div>
                      <Badge variant={badgeInfo.variant}>{badgeInfo.label}</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 py-3 border-y border-stone-100 text-sm">
                      <div>
                        <div className="text-xs text-text-muted">Ngày làm</div>
                        <div className="font-semibold text-text-main flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3.5 h-3.5 text-green-main" />
                          {formatShortDate(shift.date)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-text-muted">Giờ làm</div>
                        <div className="font-semibold text-text-main flex items-center gap-1 mt-0.5">
                          <Clock className="w-3.5 h-3.5 text-green-main" />
                          {shift.startTime} – {shift.endTime} ({shift.hours}h)
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-text-muted">Mức lương dự tính</div>
                        <div className="font-semibold text-text-main mt-0.5">
                          {(shift.wageRate || 25000).toLocaleString('vi-VN')} đ/h
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-text-muted">Thu nhập ước tính</div>
                        <div className="font-semibold text-green-main mt-0.5">
                          {((shift.hours || 4) * (shift.wageRate || 25000)).toLocaleString('vi-VN')} đ
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-text-muted flex items-center justify-between">
                      <span>Người lao động: <strong className="text-text-main">{shift.employeeName || shift.studentName || user?.name}</strong></span>
                      <span className="italic">Chấm công do quản lý ghi nhận</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Lịch sử ca làm */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-green-main mb-2" />
              <span>Đang tải lịch sử ca làm...</span>
            </div>
          ) : historyShifts.length === 0 ? (
            <div className="card p-12 text-center text-text-muted">
              <Clock className="w-12 h-12 mx-auto text-stone-300 mb-3" />
              <h3 className="font-semibold text-text-main text-base">Chưa có lịch sử ca làm việc</h3>
              <p className="text-sm mt-1">Các ca làm đã qua, ca đã duyệt công hoặc ca đã hủy sẽ được lưu trữ tại đây.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historyShifts.map((shift) => {
                const badgeInfo = getEmployeeStatusBadge(shift);
                const isCancelled = shift.scheduleStatus === 'cancelled' || shift.status === 'cancelled';
                const workedHours = shift.workedMinutes ? Math.round((shift.workedMinutes / 60) * 100) / 100 : shift.hours;
                const earned = shift.totalPay || (workedHours * (shift.wageRate || 25000));

                return (
                  <div
                    key={shift._id || shift.id}
                    className={clsx(
                      'card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border',
                      isCancelled ? 'opacity-70 bg-stone-50 border-stone-200' : 'border-stone-200'
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text-main">
                          {shift.positionTitle || shift.role || 'Nhân viên bán ca'}
                        </span>
                        <Badge variant={badgeInfo.variant}>{badgeInfo.label}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-stone-400" />
                          {formatShortDate(shift.date)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-stone-400" />
                          {shift.startTime} – {shift.endTime}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-stone-400" />
                          {shift.workplaceName || shift.storeName || 'Cơ sở'}
                        </span>
                      </div>
                      {shift.employerNotes && (
                        <div className="text-xs text-stone-500 mt-1 italic">
                          Ghi chú quản lý: {shift.employerNotes}
                        </div>
                      )}
                      {shift.cancelReason && (
                        <div className="text-xs text-red-600 mt-1 italic">
                          Lý do hủy: {shift.cancelReason}
                        </div>
                      )}
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 shrink-0">
                      <div className="text-sm font-bold text-text-main">
                        {isCancelled ? '0 đ' : `${earned.toLocaleString('vi-VN')} đ`}
                      </div>
                      <div className="text-xs text-text-muted">
                        {isCancelled ? 'Đã hủy' : `${workedHours}h (${shift.workedMinutes || workedHours * 60} phút)`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Đơn xin nghỉ */}
      {activeTab === 'time_off' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-text-main">Danh sách đơn xin nghỉ phép</h3>
            <button
              onClick={() => setIsTimeOffModalOpen(true)}
              className="btn btn-primary btn-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Tạo đơn mới
            </button>
          </div>

          {timeOffRequests.length === 0 ? (
            <div className="card p-12 text-center text-text-muted">
              <CalendarOff className="w-12 h-12 mx-auto text-stone-300 mb-3" />
              <h3 className="font-semibold text-text-main text-base">Chưa có đơn xin nghỉ phép nào</h3>
              <p className="text-sm mt-1">Khi bạn bận lịch học hoặc việc riêng, có thể gửi đơn xin nghỉ để quản lý không xếp ca vào ngày đó.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {timeOffRequests.map((req) => {
                const statusBadge = {
                  pending: { variant: 'yellow', label: 'Chờ quản lý duyệt' },
                  approved: { variant: 'green', label: 'Đã chấp thuận' },
                  rejected: { variant: 'red', label: 'Từ chối' },
                  cancelled: { variant: 'gray', label: 'Đã hủy' },
                }[req.status] || { variant: 'gray', label: req.status };

                return (
                  <div key={req._id || req.id} className="card p-4 border border-stone-200 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text-main text-sm">
                          Nghỉ từ {new Date(req.startDate).toLocaleDateString('vi-VN')} đến {new Date(req.endDate).toLocaleDateString('vi-VN')}
                        </span>
                        <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                      </div>
                      <p className="text-sm text-text-muted">Lý do: {req.reason}</p>
                      {req.reviewNote && (
                        <p className="text-xs text-stone-500 italic">Phản hồi của quản lý: {req.reviewNote}</p>
                      )}
                      <div className="text-xs text-text-muted">
                        Ngày tạo: {new Date(req.createdAt).toLocaleDateString('vi-VN')}
                      </div>
                    </div>

                    {req.status === 'pending' && (
                      <button
                        onClick={() => handleCancelTimeOff(req._id || req.id)}
                        className="btn btn-outline btn-xs text-red-600 hover:bg-red-50 border-red-200"
                      >
                        Hủy đơn
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Tạo đơn xin nghỉ phép */}
      <Modal
        isOpen={isTimeOffModalOpen}
        onClose={() => setIsTimeOffModalOpen(false)}
        title="Tạo đơn xin nghỉ phép"
      >
        <form onSubmit={handleSubmitTimeOff} className="space-y-4">
          {employments.length > 1 && (
            <div>
              <label className="label">Chọn nơi làm việc / Quản lý</label>
              <select
                value={timeOffForm.employerUserId}
                onChange={(e) => setTimeOffForm({ ...timeOffForm, employerUserId: e.target.value })}
                className="input"
                required
              >
                {employments.map((emp) => (
                  <option key={emp._id} value={emp.employerUserId?._id || emp.employerUserId}>
                    {emp.workplace || 'Cơ sở'} — {emp.positionTitle}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Từ ngày</label>
              <input
                type="date"
                value={timeOffForm.startDate}
                min={todayStr}
                onChange={(e) => setTimeOffForm({ ...timeOffForm, startDate: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Đến ngày</label>
              <input
                type="date"
                value={timeOffForm.endDate}
                min={timeOffForm.startDate || todayStr}
                onChange={(e) => setTimeOffForm({ ...timeOffForm, endDate: e.target.value })}
                className="input"
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Lý do xin nghỉ</label>
            <textarea
              rows={3}
              value={timeOffForm.reason}
              onChange={(e) => setTimeOffForm({ ...timeOffForm, reason: e.target.value })}
              className="input resize-none"
              placeholder="VD: Bận thi kết thúc học phần, việc gia đình..."
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsTimeOffModalOpen(false)}
              className="btn btn-outline"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmittingTimeOff}
              className="btn btn-primary flex items-center gap-1.5"
            >
              {isSubmittingTimeOff && <Loader2 className="w-4 h-4 animate-spin" />}
              Gửi đơn xin nghỉ
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
