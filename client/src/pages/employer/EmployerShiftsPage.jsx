
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar, Clock, Plus, Check,
  AlertTriangle, DollarSign, ChevronLeft, ChevronRight,
  Send, Edit3, Trash2,
  CalendarOff, CheckCircle2, Sparkles, Play, StopCircle, UserX
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import {
  getShifts,
  createShift,
  publishShifts,
  preflightPublish,
  generateFromTemplates,
  rescheduleShift,
  cancelShift,
  recordAttendanceStart,
  recordAttendanceEnd,
  recordAttendanceNoShow,
  approveAttendance,
  adjustShiftTime,
  markPayrollReady,
  markPaid,
  getTimeOff,
  updateTimeOffStatus,
  getEmployments,
  getShiftTemplates,
  createShiftTemplate,
  deleteShiftTemplate,
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

function getMonday(dateStr) {
  const [y, m, d] = (dateStr || getTodayString()).split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const day = target.getDay();
  const diff = target.getDate() - day + (day === 0 ? -6 : 1);
  target.setDate(diff);
  const yr = target.getFullYear();
  const mo = String(target.getMonth() + 1).padStart(2, '0');
  const da = String(target.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${da}`;
}

function getWeekDates(mondayStr) {
  const dates = [];
  const [y, m, d] = mondayStr.split('-').map(Number);
  for (let i = 0; i < 7; i++) {
    const curr = new Date(y, m - 1, d + i);
    const yr = curr.getFullYear();
    const mo = String(curr.getMonth() + 1).padStart(2, '0');
    const da = String(curr.getDate()).padStart(2, '0');
    dates.push(`${yr}-${mo}-${da}`);
  }
  return dates;
}

const VN_WEEKDAY_NAMES = [
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
  'Chủ Nhật',
];

function getDisplayStatusInfo(shift) {
  const scheduleStatus = shift.scheduleStatus || (shift.status === 'draft' ? 'draft' : shift.status === 'cancelled' ? 'cancelled' : 'published');
  const attendanceStatus = shift.attendanceStatus || shift.status;
  const payrollStatus = shift.payrollStatus || (shift.status === 'paid' ? 'paid' : shift.status === 'payroll_ready' ? 'ready' : 'not_ready');

  if (scheduleStatus === 'cancelled') {
    return { variant: 'gray', label: 'Đã hủy ca' };
  }
  if (scheduleStatus === 'draft') {
    return { variant: 'gray', label: 'Lịch nháp' };
  }
  if (payrollStatus === 'paid') {
    return { variant: 'green', label: 'Đã thanh toán' };
  }
  if (payrollStatus === 'ready') {
    return { variant: 'blue', label: 'Sẵn sàng trả lương' };
  }
  if (attendanceStatus === 'approved') {
    return { variant: 'green', label: 'Đã duyệt công' };
  }
  if (['needs_review', 'completed_pending_review', 'pending_approval'].includes(attendanceStatus)) {
    return { variant: 'yellow', label: 'Chờ duyệt công' };
  }
  if (attendanceStatus === 'checked_in') {
    return { variant: 'green', label: 'Đang làm việc' };
  }
  if (attendanceStatus === 'no_show') {
    return { variant: 'red', label: 'Vắng mặt' };
  }
  return { variant: 'blue', label: 'Chưa vào ca' };
}

export default function EmployerShiftsPage() {
  const { user } = useAuth();

  const [shifts, setShifts] = useState([]);
  const [employments, setEmployments] = useState([]);
  const [timeOffRequests, setTimeOffRequests] = useState([]);
  const [shiftTemplates, setShiftTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Active Tab: 'schedule', 'review', 'payroll', 'time_off', 'templates'
  const [activeTab, setActiveTab] = useState('schedule');

  // Week navigation
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(getTodayString()));
  const weekDates = useMemo(() => getWeekDates(currentMonday), [currentMonday]);

  // Filters (Decoupled from Job!)
  const [filterEmployeeId, setFilterEmployeeId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Add Shift Modal
  const [isAddShiftOpen, setIsAddShiftOpen] = useState(false);
  const [addShiftForm, setAddShiftForm] = useState({
    employmentId: '',
    date: getTodayString(),
    startTime: '08:00',
    endTime: '12:00',
    role: '',
    wageRate: 25000,
    isDraft: false,
  });

  // Preflight Publish Modal
  const [isPreflightModalOpen, setIsPreflightModalOpen] = useState(false);
  const [preflightData, setPreflightData] = useState(null);

  // Generate From Templates Modal
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    startDate: weekDates[0],
    endDate: weekDates[6],
  });

  // Template Manager Modal
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [newTemplateForm, setNewTemplateForm] = useState({
    positionTitle: '',
    dayOfWeek: 1,
    startTime: '08:00',
    endTime: '12:00',
    requiredHeadcount: 1,
    wageOverride: 25000,
    workplace: '',
  });

  // Reschedule Modal
  const [rescheduleShiftItem, setRescheduleShiftItem] = useState(null);
  const [rescheduleForm, setRescheduleForm] = useState({
    date: '',
    startTime: '',
    endTime: '',
    wageRate: 25000,
    reason: '',
  });

  // Cancel Shift Modal
  const [cancelShiftItem, setCancelShiftItem] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  // Attendance Record Start Modal (Vào ca / Có mặt)
  const [startAttendanceItem, setStartAttendanceItem] = useState(null);
  const [startAttendanceForm, setStartAttendanceForm] = useState({
    actualTime: '',
    note: '',
  });

  // Attendance Record End Modal (Tan ca / Kết thúc ca)
  const [endAttendanceItem, setEndAttendanceItem] = useState(null);
  const [endAttendanceForm, setEndAttendanceForm] = useState({
    actualTime: '',
    note: '',
  });

  // Attendance Record No-Show Modal (Vắng mặt)
  const [noShowItem, setNoShowItem] = useState(null);
  const [noShowReason, setNoShowReason] = useState('Không phép');


  const [adjustShiftItem, setAdjustShiftItem] = useState(null);
  const [adjustForm, setAdjustForm] = useState({
    adjustedMinutes: 0,
    reason: '',
  });

  // Payroll Payment Modal
  const [payShiftItem, setPayShiftItem] = useState(null);
  const [payForm, setPayForm] = useState({
    paymentReference: '',
    note: '',
  });

  // Time-off Review Modal
  const [timeOffReviewItem, setTimeOffReviewItem] = useState(null);
  const [timeOffReviewForm, setTimeOffReviewForm] = useState({
    status: 'approved',
    reviewNote: '',
  });

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [shiftData, empData, toData, tmplData] = await Promise.all([
        getShifts({ employerId: user?.id }).catch(() => []),
        getEmployments({ employerId: user?.id, status: 'active' }).catch(() => []),
        getTimeOff({ employerUserId: user?.id }).catch(() => []),
        getShiftTemplates({ employerId: user?.id }).catch(() => []),
      ]);

      setShifts(Array.isArray(shiftData) ? shiftData : []);
      const activeEmps = Array.isArray(empData) ? empData : [];
      setEmployments(activeEmps);
      setTimeOffRequests(Array.isArray(toData) ? toData : []);
      setShiftTemplates(Array.isArray(tmplData) ? tmplData : []);

      if (activeEmps.length > 0 && !addShiftForm.employmentId) {
        setAddShiftForm((prev) => ({
          ...prev,
          employmentId: activeEmps[0]._id,
          role: activeEmps[0].positionTitle || 'Nhân viên bán ca',
          wageRate: activeEmps[0].wageRate || 25000,
        }));
      }
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: 'Không thể tải dữ liệu ca làm việc.' });
    } finally {
      setLoading(false);
    }
  }, [user?.id, addShiftForm.employmentId]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Handle employment selection in add shift modal
  const handleEmploymentSelect = (empId) => {
    const selected = employments.find((e) => String(e._id) === String(empId));
    if (selected) {
      setAddShiftForm((prev) => ({
        ...prev,
        employmentId: empId,
        role: selected.positionTitle || 'Nhân viên bán ca',
        wageRate: selected.wageRate || 25000,
      }));
    } else {
      setAddShiftForm((prev) => ({ ...prev, employmentId: empId }));
    }
  };

  // Filtered shifts for weekly schedule
  const filteredShifts = useMemo(() => {
    return shifts.filter((s) => {
      if (filterEmployeeId) {
        const empMatch =
          String(s.employeeUserId?._id || s.employeeUserId || s.studentUserId?._id || s.studentUserId) === String(filterEmployeeId);
        if (!empMatch) return false;
      }
      if (filterStatus) {
        if (filterStatus === 'draft') return s.scheduleStatus === 'draft';
        if (filterStatus === 'cancelled') return s.scheduleStatus === 'cancelled' || s.status === 'cancelled';
        if (filterStatus === 'paid') return s.payrollStatus === 'paid';
        if (filterStatus === 'ready') return s.payrollStatus === 'ready';
        if (filterStatus === 'approved') return s.attendanceStatus === 'approved';
        if (filterStatus === 'checked_in') return s.attendanceStatus === 'checked_in';
        if (filterStatus === 'no_show') return s.attendanceStatus === 'no_show';
        if (filterStatus === 'review') return ['completed_pending_review', 'needs_review'].includes(s.attendanceStatus);
        if (filterStatus === 'not_started') return s.attendanceStatus === 'not_started' && s.scheduleStatus === 'published';
      }
      return true;
    });
  }, [shifts, filterEmployeeId, filterStatus]);

  // Shifts grouped by day in current week
  const weekShiftBuckets = useMemo(() => {
    const buckets = {};
    for (const d of weekDates) {
      buckets[d] = [];
    }
    for (const s of filteredShifts) {
      if (buckets[s.date]) {
        buckets[s.date].push(s);
      }
    }
    // Sort shifts inside each day by startTime
    for (const d of weekDates) {
      buckets[d].sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return buckets;
  }, [filteredShifts, weekDates]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const weekShifts = filteredShifts.filter((s) => weekDates.includes(s.date));
    const activeShiftsCount = weekShifts.filter((s) => s.attendanceStatus === 'checked_in').length;
    const pendingReviewCount = shifts.filter((s) => ['completed_pending_review', 'needs_review'].includes(s.attendanceStatus)).length;
    const readyPayrollCount = shifts.filter((s) => s.payrollStatus === 'ready').length;
    const pendingTimeOffCount = timeOffRequests.filter((r) => r.status === 'pending').length;
    const draftCount = shifts.filter((s) => s.scheduleStatus === 'draft').length;

    return {
      weekTotal: weekShifts.length,
      activeNow: activeShiftsCount,
      pendingReview: pendingReviewCount,
      readyPayroll: readyPayrollCount,
      pendingTimeOff: pendingTimeOffCount,
      draftCount,
    };
  }, [filteredShifts, shifts, weekDates, timeOffRequests]);

  // Actions: Add Shift
  const handleCreateShift = async (e) => {
    e.preventDefault();
    if (!addShiftForm.employmentId || !addShiftForm.date || !addShiftForm.startTime || !addShiftForm.endTime) {
      setToast({ type: 'warning', message: 'Vui lòng chọn nhân viên và nhập đầy đủ thời gian ca làm.' });
      return;
    }

    try {
      await createShift(addShiftForm);
      setToast({ type: 'success', message: addShiftForm.isDraft ? 'Đã tạo ca làm nháp thành công!' : 'Đã công bố ca làm việc mới!' });
      setIsAddShiftOpen(false);
      loadAllData();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể tạo ca làm việc.' });
    }
  };

  // Actions: Preflight Publish
  const handlePreflightPublish = async () => {
    try {
      const data = await preflightPublish({
        startDate: weekDates[0],
        endDate: weekDates[6],
      });
      setPreflightData(data);
      setIsPreflightModalOpen(true);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi kiểm tra lịch tuần.' });
    }
  };

  const handleConfirmPublish = async () => {
    try {
      const draftIds = (preflightData?.shifts || []).map((s) => s.shiftId);
      await publishShifts({ shiftIds: draftIds });
      setToast({ type: 'success', message: `Đã công bố toàn bộ lịch tuần thành công!` });
      setIsPreflightModalOpen(false);
      loadAllData();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể công bố ca làm.' });
    }
  };

  // Actions: Generate from templates
  const handleGenerateFromTemplates = async () => {
    try {
      const res = await generateFromTemplates(generateForm);
      setToast({ type: 'success', message: res.message || `Đã sinh ${res.generatedCount || 0} ca nháp từ mẫu!` });
      setIsGenerateModalOpen(false);
      loadAllData();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể sinh ca từ mẫu.' });
    }
  };

  // Actions: Create Shift Template
  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    try {
      await createShiftTemplate(newTemplateForm);
      setToast({ type: 'success', message: 'Đã tạo mẫu ca làm định kỳ thành công!' });
      setNewTemplateForm({
        positionTitle: '',
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '12:00',
        requiredHeadcount: 1,
        wageOverride: 25000,
        workplace: '',
      });
      loadAllData();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể tạo mẫu ca.' });
    }
  };

  const handleDeleteTemplate = async (tmplId) => {
    if (!window.confirm('Bạn có chắc muốn xóa mẫu ca này?')) return;
    try {
      await deleteShiftTemplate(tmplId);
      setToast({ type: 'success', message: 'Đã xóa mẫu ca.' });
      loadAllData();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể xóa mẫu ca.' });
    }
  };

  // Actions: Record Start (Có mặt)
  const handleRecordStart = async (e) => {
    e.preventDefault();
    if (!startAttendanceItem) return;
    try {
      await recordAttendanceStart(startAttendanceItem._id || startAttendanceItem.id, startAttendanceForm);
      setToast({ type: 'success', message: 'Đã ghi nhận nhân viên vào ca làm việc thành công!' });
      setStartAttendanceItem(null);
      loadAllData();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể ghi nhận vào ca.' });
    }
  };

  // Actions: Record End (Tan ca)
  const handleRecordEnd = async (e) => {
    e.preventDefault();
    if (!endAttendanceItem) return;
    try {
      await recordAttendanceEnd(endAttendanceItem._id || endAttendanceItem.id, endAttendanceForm);
      setToast({ type: 'success', message: 'Đã ghi nhận nhân viên hoàn thành ca làm!' });
      setEndAttendanceItem(null);
      loadAllData();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể ghi nhận kết thúc ca.' });
    }
  };

  // Actions: Record No-Show (Vắng mặt)
  const handleRecordNoShow = async (e) => {
    e.preventDefault();
    if (!noShowItem) return;
    try {
      await recordAttendanceNoShow(noShowItem._id || noShowItem.id, { reason: noShowReason });
      setToast({ type: 'success', message: 'Đã ghi nhận nhân viên vắng mặt.' });
      setNoShowItem(null);
      loadAllData();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể ghi nhận vắng mặt.' });
    }
  };

  // Actions: Reschedule
  const handleReschedule = async (e) => {
    e.preventDefault();
    if (!rescheduleShiftItem) return;
    try {
      await rescheduleShift(rescheduleShiftItem._id || rescheduleShiftItem.id, rescheduleForm);
      setToast({ type: 'success', message: 'Đã đổi lịch ca làm thành công!' });
      setRescheduleShiftItem(null);
      loadAllData();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể đổi lịch ca làm.' });
    }
  };

  // Actions: Cancel Shift
  const handleCancelShift = async (e) => {
    e.preventDefault();
    if (!cancelShiftItem) return;
    try {
      await cancelShift(cancelShiftItem._id || cancelShiftItem.id, { reason: cancelReason });
      setToast({ type: 'success', message: 'Đã hủy ca làm việc.' });
      setCancelShiftItem(null);
      loadAllData();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể hủy ca làm.' });
    }
  };

  // Actions: Approve Attendance
  const handleApproveAttendance = async (shift) => {
    try {
      const minutes = shift.workedMinutes || (shift.hours || 4) * 60;
      await approveAttendance(shift._id || shift.id, { approvedMinutes: minutes });
      setToast({ type: 'success', message: 'Đã duyệt công làm việc thành công!' });
      setReviewShiftItem(null);
      loadAllData();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể duyệt công.' });
    }
  };

  // Actions: Adjust Time
  const handleAdjustTime = async (e) => {
    e.preventDefault();
    if (!adjustShiftItem || !adjustForm.reason.trim()) {
      setToast({ type: 'warning', message: 'Vui lòng nhập lý do điều chỉnh giờ công.' });
      return;
    }
    try {
      await adjustShiftTime(adjustShiftItem._id || adjustShiftItem.id, adjustForm);
      setToast({ type: 'success', message: 'Đã điều chỉnh giờ công thành công!' });
      setAdjustShiftItem(null);
      loadAllData();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể điều chỉnh giờ công.' });
    }
  };

  // Actions: Mark Payroll Ready
  const handleMarkPayrollReady = async (shiftId) => {
    try {
      await markPayrollReady(shiftId);
      setToast({ type: 'success', message: 'Đã chuyển ca sang sẵn sàng trả lương.' });
      loadAllData();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể cập nhật trạng thái tính lương.' });
    }
  };

  // Actions: Mark Paid
  const handleMarkPaid = async (e) => {
    e.preventDefault();
    if (!payShiftItem) return;
    try {
      await markPaid(payShiftItem._id || payShiftItem.id, payForm);
      setToast({ type: 'success', message: 'Đã xác nhận hoàn tất thanh toán lương!' });
      setPayShiftItem(null);
      loadAllData();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể xác nhận trả lương.' });
    }
  };

  // Actions: Review Time-Off
  const handleReviewTimeOff = async (e) => {
    e.preventDefault();
    if (!timeOffReviewItem) return;
    try {
      await updateTimeOffStatus(timeOffReviewItem._id || timeOffReviewItem.id, timeOffReviewForm);
      setToast({ type: 'success', message: 'Đã xử lý đơn xin nghỉ phép thành công!' });
      setTimeOffReviewItem(null);
      loadAllData();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể xử lý đơn xin nghỉ.' });
    }
  };

  // Week navigation helpers
  const handlePrevWeek = () => {
    const [y, m, d] = currentMonday.split('-').map(Number);
    const prev = new Date(y, m - 1, d - 7);
    const yr = prev.getFullYear();
    const mo = String(prev.getMonth() + 1).padStart(2, '0');
    const da = String(prev.getDate()).padStart(2, '0');
    setCurrentMonday(`${yr}-${mo}-${da}`);
  };

  const handleNextWeek = () => {
    const [y, m, d] = currentMonday.split('-').map(Number);
    const next = new Date(y, m - 1, d + 7);
    const yr = next.getFullYear();
    const mo = String(next.getMonth() + 1).padStart(2, '0');
    const da = String(next.getDate()).padStart(2, '0');
    setCurrentMonday(`${yr}-${mo}-${da}`);
  };

  const handleThisWeek = () => {
    setCurrentMonday(getMonday(getTodayString()));
  };

  return (
    <div className="space-y-6">
      {/* Toast notification */}
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      {/* Header & Main CTAs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
            <Calendar className="w-6 h-6 text-green-main" />
            Quản lý lịch làm & Chấm công
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Xếp ca trực tiếp cho nhân viên đang làm việc, chấm công và kiểm duyệt giờ làm việc.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsAddShiftOpen(true)}
            className="btn btn-primary btn-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Thêm ca làm
          </button>
          <button
            onClick={handlePreflightPublish}
            className="btn btn-outline btn-sm flex items-center gap-1.5"
          >
            <Send className="w-4 h-4 text-green-main" />
            Công bố lịch tuần
          </button>
          <button
            onClick={() => setIsGenerateModalOpen(true)}
            className="btn btn-outline btn-sm flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-pink-main" />
            Tạo ca từ mẫu
          </button>
          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="btn btn-outline btn-sm flex items-center gap-1.5"
          >
            <Clock className="w-4 h-4 text-stone-500" />
            Mẫu định kỳ
          </button>
        </div>
      </div>

      {/* Quick Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="card p-3 flex flex-col">
          <span className="text-xs text-text-muted">Tổng ca trong tuần</span>
          <span className="text-xl font-bold text-text-main mt-0.5">{metrics.weekTotal}</span>
        </div>
        <div className="card p-3 flex flex-col">
          <span className="text-xs text-text-muted">Đang làm việc</span>
          <span className="text-xl font-bold text-green-main mt-0.5">{metrics.activeNow}</span>
        </div>
        <div className="card p-3 flex flex-col">
          <span className="text-xs text-text-muted">Chờ duyệt công</span>
          <span className="text-xl font-bold text-yellow-600 mt-0.5">{metrics.pendingReview}</span>
        </div>
        <div className="card p-3 flex flex-col">
          <span className="text-xs text-text-muted">Sẵn sàng trả lương</span>
          <span className="text-xl font-bold text-blue-600 mt-0.5">{metrics.readyPayroll}</span>
        </div>
        <div className="card p-3 flex flex-col">
          <span className="text-xs text-text-muted">Đơn nghỉ chờ duyệt</span>
          <span className="text-xl font-bold text-pink-main mt-0.5">{metrics.pendingTimeOff}</span>
        </div>
        <div className="card p-3 flex flex-col">
          <span className="text-xs text-text-muted">Ca nháp chưa công bố</span>
          <span className="text-xl font-bold text-stone-500 mt-0.5">{metrics.draftCount}</span>
        </div>
      </div>

      {/* Top Tabs */}
      <div className="flex border-b border-stone-200">
        <button
          onClick={() => setActiveTab('schedule')}
          className={clsx(
            'px-5 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2',
            activeTab === 'schedule'
              ? 'border-green-main text-green-main'
              : 'border-transparent text-text-muted hover:text-text-main'
          )}
        >
          <Calendar className="w-4 h-4" />
          Lịch tuần & Ca làm
        </button>

        <button
          onClick={() => setActiveTab('review')}
          className={clsx(
            'px-5 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2',
            activeTab === 'review'
              ? 'border-green-main text-green-main'
              : 'border-transparent text-text-muted hover:text-text-main'
          )}
        >
          <Clock className="w-4 h-4" />
          Duyệt công ({metrics.pendingReview})
        </button>

        <button
          onClick={() => setActiveTab('payroll')}
          className={clsx(
            'px-5 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2',
            activeTab === 'payroll'
              ? 'border-green-main text-green-main'
              : 'border-transparent text-text-muted hover:text-text-main'
          )}
        >
          <DollarSign className="w-4 h-4" />
          Tính lương ({metrics.readyPayroll})
        </button>

        <button
          onClick={() => setActiveTab('time_off')}
          className={clsx(
            'px-5 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2',
            activeTab === 'time_off'
              ? 'border-green-main text-green-main'
              : 'border-transparent text-text-muted hover:text-text-main'
          )}
        >
          <CalendarOff className="w-4 h-4" />
          Đơn xin nghỉ ({metrics.pendingTimeOff})
        </button>
      </div>

      {/* Tab 1: Lịch tuần & Xếp ca */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          {/* Controls: Week nav & Filters */}
          <div className="card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Week navigation */}
            <div className="flex items-center gap-2">
              <button onClick={handlePrevWeek} className="btn btn-outline btn-xs p-1.5" title="Tuần trước">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={handleThisWeek} className="btn btn-outline btn-xs">
                Tuần hiện tại
              </button>
              <button onClick={handleNextWeek} className="btn btn-outline btn-xs p-1.5" title="Tuần kế tiếp">
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-text-main ml-2">
                {weekDates[0]} – {weekDates[6]}
              </span>
            </div>

            {/* Filters (Employee + Status - NO JOB SELECTOR) */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterEmployeeId}
                onChange={(e) => setFilterEmployeeId(e.target.value)}
                className="input text-xs py-1.5 h-9"
              >
                <option value="">Tất cả nhân viên ({employments.length})</option>
                {employments.map((emp) => (
                  <option key={emp._id} value={emp.employeeUserId?._id || emp.employeeUserId}>
                    {emp.employeeUserId?.name || 'Nhân viên'} ({emp.positionTitle})
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input text-xs py-1.5 h-9"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="not_started">Chưa vào ca</option>
                <option value="checked_in">Đang làm việc</option>
                <option value="review">Chờ duyệt công</option>
                <option value="approved">Đã duyệt công</option>
                <option value="ready">Sẵn sàng trả lương</option>
                <option value="paid">Đã thanh toán</option>
                <option value="no_show">Vắng mặt</option>
                <option value="draft">Lịch nháp</option>
                <option value="cancelled">Đã hủy ca</option>
              </select>
            </div>
          </div>

          {/* Weekday Columns View */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
            {weekDates.map((dateStr, idx) => {
              const dayShifts = weekShiftBuckets[dateStr] || [];
              const isToday = dateStr === getTodayString();

              return (
                <div
                  key={dateStr}
                  className={clsx(
                    'card p-3 flex flex-col min-h-[400px] border',
                    isToday ? 'border-green-400 bg-green-50/10' : 'border-stone-200'
                  )}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-stone-200 mb-2">
                    <div>
                      <div className={clsx('text-xs font-bold', isToday ? 'text-green-700' : 'text-text-main')}>
                        {VN_WEEKDAY_NAMES[idx]}
                      </div>
                      <div className="text-[11px] text-text-muted">{dateStr.slice(5)}</div>
                    </div>
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-600">
                      {dayShifts.length}
                    </span>
                  </div>

                  {/* Shift Cards */}
                  <div className="space-y-2 flex-1 overflow-y-auto">
                    {dayShifts.length === 0 ? (
                      <div className="h-28 flex items-center justify-center text-[11px] text-stone-400 italic">
                        Không có ca
                      </div>
                    ) : (
                      dayShifts.map((shift) => {
                        const badgeInfo = getDisplayStatusInfo(shift);
                        const isDraft = shift.scheduleStatus === 'draft';
                        const isCancelled = shift.scheduleStatus === 'cancelled' || shift.status === 'cancelled';
                        const isCheckedIn = shift.attendanceStatus === 'checked_in';
                        const isPendingReview = ['completed_pending_review', 'needs_review'].includes(shift.attendanceStatus);
                        const isApproved = shift.attendanceStatus === 'approved';
                        const isReady = shift.payrollStatus === 'ready';

                        return (
                          <div
                            key={shift._id || shift.id}
                            className={clsx(
                              'p-2.5 rounded-xl border text-xs space-y-1.5 transition-all shadow-xs',
                              isCheckedIn
                                ? 'border-green-400 bg-green-50/40 ring-1 ring-green-300'
                                : isDraft
                                  ? 'border-dashed border-stone-300 bg-stone-50/60'
                                  : isCancelled
                                    ? 'border-stone-200 bg-stone-50 opacity-60'
                                    : 'border-stone-200 bg-white'
                            )}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span className="font-bold text-text-main truncate" title={shift.employeeName || shift.studentName}>
                                {shift.employeeName || shift.studentName || 'Nhân viên'}
                              </span>
                              <Badge variant={badgeInfo.variant} className="text-[10px] px-1.5 py-0 shrink-0">
                                {badgeInfo.label}
                              </Badge>
                            </div>

                            <div className="text-[11px] text-text-muted flex items-center gap-1 font-medium">
                              <Clock className="w-3 h-3 text-stone-400 shrink-0" />
                              <span>{shift.startTime} – {shift.endTime}</span>
                            </div>

                            <div className="text-[11px] text-stone-500 truncate" title={shift.positionTitle || shift.role}>
                              {shift.positionTitle || shift.role || 'Nhân viên bán ca'}
                            </div>

                            {/* Attendance status details */}
                            {shift.attendance?.checkInAt && (
                              <div className="text-[10px] text-stone-500">
                                Vào ca: {new Date(shift.attendance.checkInAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}

                            {/* Employer Actions Toolbar */}
                            {!isCancelled && (
                              <div className="pt-1.5 border-t border-stone-100 flex flex-wrap items-center gap-1">
                                {/* If not started: Start or No-show */}
                                {shift.attendanceStatus === 'not_started' && !isDraft && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setStartAttendanceItem(shift);
                                        setStartAttendanceForm({ actualTime: '', note: '' });
                                      }}
                                      className="btn btn-outline btn-xs px-1.5 py-0.5 text-[10px] text-green-700 hover:bg-green-50 flex items-center gap-0.5"
                                      title="Ghi nhận nhân viên có mặt vào ca"
                                    >
                                      <Play className="w-2.5 h-2.5" /> Có mặt
                                    </button>
                                    <button
                                      onClick={() => {
                                        setNoShowItem(shift);
                                        setNoShowReason('Không phép');
                                      }}
                                      className="btn btn-outline btn-xs px-1.5 py-0.5 text-[10px] text-red-600 hover:bg-red-50 flex items-center gap-0.5"
                                      title="Báo vắng mặt"
                                    >
                                      <UserX className="w-2.5 h-2.5" /> Vắng
                                    </button>
                                  </>
                                )}

                                {/* If checked in: Record end */}
                                {isCheckedIn && (
                                  <button
                                    onClick={() => {
                                      setEndAttendanceItem(shift);
                                      setEndAttendanceForm({ actualTime: '', note: '' });
                                    }}
                                    className="btn btn-primary btn-xs px-1.5 py-0.5 text-[10px] flex items-center gap-0.5"
                                    title="Ghi nhận nhân viên kết thúc ca"
                                  >
                                    <StopCircle className="w-2.5 h-2.5" /> Tan ca
                                  </button>
                                )}

                                {/* If completed pending review: Approve */}
                                {isPendingReview && (
                                  <button
                                    onClick={() => handleApproveAttendance(shift)}
                                    className="btn btn-primary btn-xs px-1.5 py-0.5 text-[10px] flex items-center gap-0.5 bg-yellow-600 hover:bg-yellow-700"
                                    title="Duyệt công"
                                  >
                                    <Check className="w-2.5 h-2.5" /> Duyệt
                                  </button>
                                )}

                                {/* If approved and not ready: Mark payroll ready */}
                                {isApproved && shift.payrollStatus === 'not_ready' && (
                                  <button
                                    onClick={() => handleMarkPayrollReady(shift._id || shift.id)}
                                    className="btn btn-outline btn-xs px-1.5 py-0.5 text-[10px] text-blue-600 hover:bg-blue-50"
                                    title="Chuyển sang sẵn sàng trả lương"
                                  >
                                    Lương
                                  </button>
                                )}

                                {/* If ready: Pay */}
                                {isReady && (
                                  <button
                                    onClick={() => {
                                      setPayShiftItem(shift);
                                      setPayForm({ paymentReference: '', note: '' });
                                    }}
                                    className="btn btn-primary btn-xs px-1.5 py-0.5 text-[10px] bg-green-700"
                                  >
                                    Trả lương
                                  </button>
                                )}

                                {/* Reschedule / Adjust */}
                                {shift.attendanceStatus === 'not_started' && !isDraft && (
                                  <button
                                    onClick={() => {
                                      setRescheduleShiftItem(shift);
                                      setRescheduleForm({
                                        date: shift.date,
                                        startTime: shift.startTime,
                                        endTime: shift.endTime,
                                        wageRate: shift.wageRate || 25000,
                                        reason: '',
                                      });
                                    }}
                                    className="btn btn-outline btn-xs p-1 text-stone-500"
                                    title="Đổi lịch ca"
                                  >
                                    <Edit3 className="w-2.5 h-2.5" />
                                  </button>
                                )}

                                {/* Cancel */}
                                {!isCancelled && shift.attendanceStatus === 'not_started' && (
                                  <button
                                    onClick={() => {
                                      setCancelShiftItem(shift);
                                      setCancelReason('');
                                    }}
                                    className="btn btn-outline btn-xs p-1 text-red-500 hover:bg-red-50"
                                    title="Hủy ca"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Duyệt công (Timesheet Review Queue) */}
      {activeTab === 'review' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-text-main">Hàng đợi duyệt giờ công</h3>
              <p className="text-xs text-text-muted mt-0.5">
                Các ca làm đã kết thúc hoặc vắng mặt cần nhà tuyển dụng xác nhận số giờ làm thực tế và tính công.
              </p>
            </div>
          </div>

          {shifts.filter((s) => ['completed_pending_review', 'needs_review', 'no_show'].includes(s.attendanceStatus)).length === 0 ? (
            <div className="card p-12 text-center text-text-muted">
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-3" />
              <h3 className="font-semibold text-text-main text-base">Tất cả ca làm đã được duyệt công</h3>
              <p className="text-sm mt-1">Khi nhân viên tan ca hoặc kết thúc ca, ca làm sẽ xuất hiện tại đây để duyệt.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {shifts
                .filter((s) => ['completed_pending_review', 'needs_review', 'no_show'].includes(s.attendanceStatus))
                .map((shift) => {
                  const badgeInfo = getDisplayStatusInfo(shift);
                  const checkInTime = shift.attendance?.checkInAt ? new Date(shift.attendance.checkInAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Chưa ghi';
                  const checkOutTime = shift.attendance?.checkOutAt ? new Date(shift.attendance.checkOutAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Chưa ghi';

                  return (
                    <div key={shift._id || shift.id} className="card p-4 border border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-text-main text-sm">
                            {shift.employeeName || shift.studentName} — {shift.positionTitle || shift.role}
                          </span>
                          <Badge variant={badgeInfo.variant}>{badgeInfo.label}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
                          <span>Ngày: <strong>{shift.date}</strong></span>
                          <span>•</span>
                          <span>Ca: {shift.startTime} – {shift.endTime}</span>
                          <span>•</span>
                          <span>Vào ca: {checkInTime}</span>
                          <span>•</span>
                          <span>Tan ca: {checkOutTime}</span>
                          <span>•</span>
                          <span>Thời gian tính: <strong>{shift.workedMinutes || (shift.hours || 4) * 60} phút ({shift.hours}h)</strong></span>
                          <span>•</span>
                          <span>Lương: <strong>{((shift.totalPay || (shift.hours || 4) * (shift.wageRate || 25000))).toLocaleString('vi-VN')} đ</strong></span>
                        </div>
                        {shift.employerNotes && (
                          <div className="text-xs text-stone-500 italic mt-0.5">
                            Ghi chú: {shift.employerNotes}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setAdjustShiftItem(shift);
                            setAdjustForm({
                              adjustedMinutes: shift.workedMinutes || (shift.hours || 4) * 60,
                              reason: '',
                            });
                          }}
                          className="btn btn-outline btn-sm text-xs"
                        >
                          Sửa giờ
                        </button>
                        <button
                          onClick={() => handleApproveAttendance(shift)}
                          className="btn btn-primary btn-sm text-xs flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Duyệt công
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Tính lương & Chi trả (Payroll) */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-text-main">Quản lý tính lương & Thanh toán</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Theo dõi các ca đã duyệt công, chuyển sang sẵn sàng chi trả và ghi nhận giao dịch thanh toán.
            </p>
          </div>

          <div className="space-y-3">
            {shifts
              .filter((s) => ['approved', 'payroll_ready', 'paid'].includes(s.status) || s.payrollStatus !== 'not_ready' || s.attendanceStatus === 'approved')
              .map((shift) => {
                const badgeInfo = getDisplayStatusInfo(shift);
                const isPaid = shift.payrollStatus === 'paid';
                const isReady = shift.payrollStatus === 'ready';

                return (
                  <div key={shift._id || shift.id} className="card p-4 border border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text-main text-sm">
                          {shift.employeeName || shift.studentName} — {shift.positionTitle || shift.role}
                        </span>
                        <Badge variant={badgeInfo.variant}>{badgeInfo.label}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
                        <span>Ngày làm: {shift.date}</span>
                        <span>•</span>
                        <span>Giờ công: {shift.hours}h ({shift.workedMinutes} phút)</span>
                        <span>•</span>
                        <span>Mức lương: {(shift.wageRate || 25000).toLocaleString('vi-VN')} đ/h</span>
                        <span>•</span>
                        <span>Tổng tiền: <strong className="text-green-main">{(shift.totalPay || 0).toLocaleString('vi-VN')} đ</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!isPaid && !isReady && (
                        <button
                          onClick={() => handleMarkPayrollReady(shift._id || shift.id)}
                          className="btn btn-outline btn-sm text-xs text-blue-600"
                        >
                          Sẵn sàng chi trả
                        </button>
                      )}
                      {isReady && (
                        <button
                          onClick={() => {
                            setPayShiftItem(shift);
                            setPayForm({ paymentReference: '', note: '' });
                          }}
                          className="btn btn-primary btn-sm text-xs bg-green-700"
                        >
                          Xác nhận thanh toán
                        </button>
                      )}
                      {isPaid && (
                        <span className="text-xs font-semibold text-green-700 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          Đã thanh toán
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Tab 4: Đơn xin nghỉ phép (Time Off Inbox) */}
      {activeTab === 'time_off' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-text-main">Hộp thư đơn xin nghỉ phép</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Phê duyệt hoặc từ chối các yêu cầu xin nghỉ phép từ nhân viên.
            </p>
          </div>

          {timeOffRequests.length === 0 ? (
            <div className="card p-12 text-center text-text-muted">
              <CalendarOff className="w-12 h-12 mx-auto text-stone-300 mb-3" />
              <h3 className="font-semibold text-text-main text-base">Không có đơn xin nghỉ phép nào</h3>
              <p className="text-sm mt-1">Khi nhân viên gửi đơn xin nghỉ, bạn sẽ nhận được thông báo tại đây.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {timeOffRequests.map((req) => {
                const statusBadge = {
                  pending: { variant: 'yellow', label: 'Chờ duyệt' },
                  approved: { variant: 'green', label: 'Đã duyệt' },
                  rejected: { variant: 'red', label: 'Từ chối' },
                  cancelled: { variant: 'gray', label: 'Đã hủy' },
                }[req.status] || { variant: 'gray', label: req.status };

                return (
                  <div key={req._id || req.id} className="card p-4 border border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text-main text-sm">
                          {req.employeeUserId?.name || 'Nhân viên'} — Nghỉ từ {new Date(req.startDate).toLocaleDateString('vi-VN')} đến {new Date(req.endDate).toLocaleDateString('vi-VN')}
                        </span>
                        <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                      </div>
                      <p className="text-sm text-text-muted">Lý do: {req.reason}</p>
                      {req.reviewNote && (
                        <p className="text-xs text-stone-500 italic">Phản hồi: {req.reviewNote}</p>
                      )}
                    </div>

                    {req.status === 'pending' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setTimeOffReviewItem(req);
                            setTimeOffReviewForm({ status: 'rejected', reviewNote: '' });
                          }}
                          className="btn btn-outline btn-sm text-red-600 text-xs"
                        >
                          Từ chối
                        </button>
                        <button
                          onClick={() => {
                            setTimeOffReviewItem(req);
                            setTimeOffReviewForm({ status: 'approved', reviewNote: '' });
                          }}
                          className="btn btn-primary btn-sm text-xs"
                        >
                          Chấp thuận
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

      {/* Modal: Thêm ca làm (Xếp ca từ Employment - NO JOB SELECTOR) */}
      <Modal
        isOpen={isAddShiftOpen}
        onClose={() => setIsAddShiftOpen(false)}
        title="Thêm ca làm việc cho nhân viên"
      >
        <form onSubmit={handleCreateShift} className="space-y-4">
          <div>
            <label className="label">Chọn nhân viên đang làm việc *</label>
            {employments.length === 0 ? (
              <div className="p-3 bg-yellow-50 text-yellow-800 text-xs rounded-xl border border-yellow-200">
                Chưa có nhân viên nào đang ở trạng thái làm việc (active). Vui lòng tuyển ứng viên thành nhân viên trước khi xếp ca.
              </div>
            ) : (
              <select
                value={addShiftForm.employmentId}
                onChange={(e) => handleEmploymentSelect(e.target.value)}
                className="input"
                required
              >
                {employments.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.employeeUserId?.name || 'Nhân viên'} — {emp.positionTitle} ({emp.workplace || 'Cơ sở'})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Ngày làm việc *</label>
              <input
                type="date"
                value={addShiftForm.date}
                onChange={(e) => setAddShiftForm({ ...addShiftForm, date: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Giờ bắt đầu *</label>
              <input
                type="time"
                value={addShiftForm.startTime}
                onChange={(e) => setAddShiftForm({ ...addShiftForm, startTime: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Giờ kết thúc *</label>
              <input
                type="time"
                value={addShiftForm.endTime}
                onChange={(e) => setAddShiftForm({ ...addShiftForm, endTime: e.target.value })}
                className="input"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Vị trí / Vai trò</label>
              <input
                type="text"
                value={addShiftForm.role}
                onChange={(e) => setAddShiftForm({ ...addShiftForm, role: e.target.value })}
                className="input"
                placeholder="VD: Thu ngân, Phục vụ, Pha chế..."
              />
            </div>
            <div>
              <label className="label">Mức lương (VNĐ/giờ)</label>
              <input
                type="number"
                value={addShiftForm.wageRate}
                onChange={(e) => setAddShiftForm({ ...addShiftForm, wageRate: Number(e.target.value) })}
                className="input"
                min="0"
                step="1000"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isDraftCheck"
              checked={addShiftForm.isDraft}
              onChange={(e) => setAddShiftForm({ ...addShiftForm, isDraft: e.target.checked })}
              className="checkbox"
            />
            <label htmlFor="isDraftCheck" className="text-sm font-medium text-text-main cursor-pointer">
              Lưu ca ở trạng thái nháp (Chưa công bố cho nhân viên xem)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setIsAddShiftOpen(false)}
              className="btn btn-outline"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={employments.length === 0}
              className="btn btn-primary"
            >
              {addShiftForm.isDraft ? 'Lưu ca nháp' : 'Công bố ca làm'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Ghi nhận vào ca (Có mặt) */}
      <Modal
        isOpen={Boolean(startAttendanceItem)}
        onClose={() => setStartAttendanceItem(null)}
        title="Ghi nhận nhân viên có mặt vào ca"
      >
        <form onSubmit={handleRecordStart} className="space-y-4">
          <p className="text-sm text-text-muted">
            Xác nhận nhân viên <strong className="text-text-main">{startAttendanceItem?.employeeName || startAttendanceItem?.studentName}</strong> đã có mặt vào ca ngày <strong>{startAttendanceItem?.date}</strong> ({startAttendanceItem?.startTime} – {startAttendanceItem?.endTime}).
          </p>

          <div>
            <label className="label">Thời điểm vào ca thực tế (để trống để lấy thời gian hiện tại)</label>
            <input
              type="datetime-local"
              value={startAttendanceForm.actualTime}
              onChange={(e) => setStartAttendanceForm({ ...startAttendanceForm, actualTime: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="label">Ghi chú quản lý (nếu có)</label>
            <input
              type="text"
              value={startAttendanceForm.note}
              onChange={(e) => setStartAttendanceForm({ ...startAttendanceForm, note: e.target.value })}
              className="input"
              placeholder="VD: Điểm danh đúng giờ, có mặt sớm..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setStartAttendanceItem(null)} className="btn btn-outline">
              Hủy
            </button>
            <button type="submit" className="btn btn-primary flex items-center gap-1.5">
              <Play className="w-4 h-4" />
              Xác nhận có mặt
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Ghi nhận kết thúc ca (Tan ca) */}
      <Modal
        isOpen={Boolean(endAttendanceItem)}
        onClose={() => setEndAttendanceItem(null)}
        title="Ghi nhận nhân viên tan ca làm việc"
      >
        <form onSubmit={handleRecordEnd} className="space-y-4">
          <p className="text-sm text-text-muted">
            Xác nhận nhân viên <strong className="text-text-main">{endAttendanceItem?.employeeName || endAttendanceItem?.studentName}</strong> kết thúc ca làm ngày <strong>{endAttendanceItem?.date}</strong>. Hệ thống sẽ tự động tính số phút làm việc và tiền công tương ứng.
          </p>

          <div>
            <label className="label">Thời điểm tan ca thực tế (để trống để lấy thời gian hiện tại)</label>
            <input
              type="datetime-local"
              value={endAttendanceForm.actualTime}
              onChange={(e) => setEndAttendanceForm({ ...endAttendanceForm, actualTime: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="label">Ghi chú tan ca</label>
            <input
              type="text"
              value={endAttendanceForm.note}
              onChange={(e) => setEndAttendanceForm({ ...endAttendanceForm, note: e.target.value })}
              className="input"
              placeholder="VD: Bàn giao ca đầy đủ, tăng ca 15 phút..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEndAttendanceItem(null)} className="btn btn-outline">
              Hủy
            </button>
            <button type="submit" className="btn btn-primary flex items-center gap-1.5">
              <StopCircle className="w-4 h-4" />
              Xác nhận tan ca
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Ghi nhận vắng mặt */}
      <Modal
        isOpen={Boolean(noShowItem)}
        onClose={() => setNoShowItem(null)}
        title="Đánh dấu nhân viên vắng mặt (No-Show)"
      >
        <form onSubmit={handleRecordNoShow} className="space-y-4">
          <p className="text-sm text-text-muted">
            Đánh dấu vắng mặt cho nhân viên <strong className="text-text-main">{noShowItem?.employeeName || noShowItem?.studentName}</strong> vào ca ngày <strong>{noShowItem?.date}</strong> ({noShowItem?.startTime} – {noShowItem?.endTime}).
          </p>

          <div>
            <label className="label">Lý do vắng mặt *</label>
            <select
              value={noShowReason}
              onChange={(e) => setNoShowReason(e.target.value)}
              className="input"
            >
              <option value="Không phép">Vắng mặt không phép</option>
              <option value="Báo bận đột xuất">Báo bận đột xuất sát giờ</option>
              <option value="Ốm đau / Việc gia đình">Ốm đau / Việc gia đình đột xuất</option>
              <option value="Khác">Lý do khác</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setNoShowItem(null)} className="btn btn-outline">
              Hủy
            </button>
            <button type="submit" className="btn btn-primary bg-red-600 hover:bg-red-700">
              Xác nhận vắng mặt
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Điều chỉnh giờ công */}
      <Modal
        isOpen={Boolean(adjustShiftItem)}
        onClose={() => setAdjustShiftItem(null)}
        title="Điều chỉnh giờ công làm việc"
      >
        <form onSubmit={handleAdjustTime} className="space-y-4">
          <div>
            <label className="label">Thời gian làm việc đã ghi nhận (phút)</label>
            <input
              type="number"
              value={adjustForm.adjustedMinutes}
              onChange={(e) => setAdjustForm({ ...adjustForm, adjustedMinutes: Number(e.target.value) })}
              className="input"
              min="0"
              step="5"
              required
            />
            <p className="text-xs text-text-muted mt-1">
              Tương đương {(adjustForm.adjustedMinutes / 60).toFixed(2)} giờ (~{Math.round((adjustForm.adjustedMinutes / 60) * (adjustShiftItem?.wageRate || 25000)).toLocaleString('vi-VN')} đ).
            </p>
          </div>

          <div>
            <label className="label">Lý do điều chỉnh *</label>
            <textarea
              rows={2}
              value={adjustForm.reason}
              onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
              className="input resize-none"
              placeholder="VD: Nhân viên tăng ca thêm 30 phút, bù giờ trừ nghỉ giữa giờ..."
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setAdjustShiftItem(null)} className="btn btn-outline">
              Hủy
            </button>
            <button type="submit" className="btn btn-primary">
              Lưu điều chỉnh
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Đổi lịch ca làm */}
      <Modal
        isOpen={Boolean(rescheduleShiftItem)}
        onClose={() => setRescheduleShiftItem(null)}
        title="Đổi lịch ca làm việc"
      >
        <form onSubmit={handleReschedule} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Ngày làm mới</label>
              <input
                type="date"
                value={rescheduleForm.date}
                onChange={(e) => setRescheduleForm({ ...rescheduleForm, date: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Giờ bắt đầu</label>
              <input
                type="time"
                value={rescheduleForm.startTime}
                onChange={(e) => setRescheduleForm({ ...rescheduleForm, startTime: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Giờ kết thúc</label>
              <input
                type="time"
                value={rescheduleForm.endTime}
                onChange={(e) => setRescheduleForm({ ...rescheduleForm, endTime: e.target.value })}
                className="input"
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Lý do đổi lịch</label>
            <input
              type="text"
              value={rescheduleForm.reason}
              onChange={(e) => setRescheduleForm({ ...rescheduleForm, reason: e.target.value })}
              className="input"
              placeholder="VD: Đổi ca theo thỏa thuận, thay đổi kế hoạch cửa hàng..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setRescheduleShiftItem(null)} className="btn btn-outline">
              Hủy
            </button>
            <button type="submit" className="btn btn-primary">
              Cập nhật lịch mới
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Hủy ca */}
      <Modal
        isOpen={Boolean(cancelShiftItem)}
        onClose={() => setCancelShiftItem(null)}
        title="Hủy ca làm việc"
      >
        <form onSubmit={handleCancelShift} className="space-y-4">
          <p className="text-sm text-text-muted">
            Bạn có chắc chắn muốn hủy ca làm ngày <strong>{cancelShiftItem?.date}</strong> ({cancelShiftItem?.startTime} – {cancelShiftItem?.endTime}) của <strong>{cancelShiftItem?.employeeName || cancelShiftItem?.studentName}</strong>?
          </p>

          <div>
            <label className="label">Lý do hủy ca</label>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="input"
              placeholder="VD: Cửa hàng sửa chữa, giảm tải khách..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCancelShiftItem(null)} className="btn btn-outline">
              Đóng
            </button>
            <button type="submit" className="btn btn-primary bg-red-600 hover:bg-red-700">
              Xác nhận hủy ca
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Chi trả lương */}
      <Modal
        isOpen={Boolean(payShiftItem)}
        onClose={() => setPayShiftItem(null)}
        title="Xác nhận chi trả tiền lương ca làm"
      >
        <form onSubmit={handleMarkPaid} className="space-y-4">
          <p className="text-sm text-text-muted">
            Xác nhận đã thanh toán tiền lương cho nhân viên <strong className="text-text-main">{payShiftItem?.employeeName || payShiftItem?.studentName}</strong>: <strong className="text-green-main">{(payShiftItem?.totalPay || 0).toLocaleString('vi-VN')} đ</strong>.
          </p>

          <div>
            <label className="label">Mã giao dịch / Phương thức thanh toán</label>
            <input
              type="text"
              value={payForm.paymentReference}
              onChange={(e) => setPayForm({ ...payForm, paymentReference: e.target.value })}
              className="input"
              placeholder="VD: Chuyển khoản Vietcombank #12345, Tiền mặt..."
            />
          </div>

          <div>
            <label className="label">Ghi chú</label>
            <input
              type="text"
              value={payForm.note}
              onChange={(e) => setPayForm({ ...payForm, note: e.target.value })}
              className="input"
              placeholder="Ghi chú chi trả..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setPayShiftItem(null)} className="btn btn-outline">
              Hủy
            </button>
            <button type="submit" className="btn btn-primary bg-green-700">
              Hoàn tất thanh toán
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Xử lý đơn xin nghỉ */}
      <Modal
        isOpen={Boolean(timeOffReviewItem)}
        onClose={() => setTimeOffReviewItem(null)}
        title="Xử lý đơn xin nghỉ phép"
      >
        <form onSubmit={handleReviewTimeOff} className="space-y-4">
          <p className="text-sm text-text-muted">
            Đơn xin nghỉ từ <strong>{new Date(timeOffReviewItem?.startDate || 0).toLocaleDateString('vi-VN')}</strong> đến <strong>{new Date(timeOffReviewItem?.endDate || 0).toLocaleDateString('vi-VN')}</strong> của <strong>{timeOffReviewItem?.employeeUserId?.name}</strong>.
          </p>

          <div>
            <label className="label">Quyết định</label>
            <select
              value={timeOffReviewForm.status}
              onChange={(e) => setTimeOffReviewForm({ ...timeOffReviewForm, status: e.target.value })}
              className="input"
            >
              <option value="approved">Chấp thuận đơn xin nghỉ</option>
              <option value="rejected">Từ chối đơn xin nghỉ</option>
            </select>
          </div>

          <div>
            <label className="label">Ghi chú phản hồi nhân viên</label>
            <textarea
              rows={2}
              value={timeOffReviewForm.reviewNote}
              onChange={(e) => setTimeOffReviewForm({ ...timeOffReviewForm, reviewNote: e.target.value })}
              className="input resize-none"
              placeholder="Nhập phản hồi cho nhân viên..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setTimeOffReviewItem(null)} className="btn btn-outline">
              Hủy
            </button>
            <button type="submit" className="btn btn-primary">
              Xác nhận xử lý
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Preflight Publish Check */}
      <Modal
        isOpen={isPreflightModalOpen}
        onClose={() => setIsPreflightModalOpen(false)}
        title="Kiểm tra & Công bố lịch tuần"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Công bố toàn bộ ca làm việc từ <strong>{weekDates[0]}</strong> đến <strong>{weekDates[6]}</strong>. Sau khi công bố, nhân viên sẽ thấy lịch làm trên giao diện của mình.
          </p>

          <div className="card p-3 bg-stone-50 border border-stone-200 text-xs space-y-1">
            <div>Tổng số ca nháp sẽ công bố: <strong>{preflightData?.totalDrafts || 0} ca</strong></div>
            <div>Nhân viên bị ảnh hưởng: <strong>{preflightData?.affectedEmployeesCount || 0} người</strong></div>
          </div>

          {preflightData?.warnings?.length > 0 && (
            <div className="p-3 bg-yellow-50 text-yellow-800 text-xs rounded-xl border border-yellow-200 space-y-1">
              <div className="font-bold flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> Cảnh báo tuân thủ lịch làm:
              </div>
              <ul className="list-disc list-inside space-y-0.5">
                {preflightData.warnings.map((w, i) => (
                  <li key={i}>{w.message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsPreflightModalOpen(false)} className="btn btn-outline">
              Hủy
            </button>
            <button
              onClick={handleConfirmPublish}
              disabled={!preflightData?.totalDrafts}
              className="btn btn-primary flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              Xác nhận công bố ({preflightData?.totalDrafts || 0} ca)
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Sinh ca từ mẫu (Generate From Templates) */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        title="Sinh ca làm việc tự động từ mẫu định kỳ"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Hệ thống sẽ đối chiếu các mẫu ca định kỳ đang kích hoạt theo thứ trong tuần và tự động tạo ca làm việc nháp cho khoảng thời gian được chọn.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Từ ngày</label>
              <input
                type="date"
                value={generateForm.startDate}
                onChange={(e) => setGenerateForm({ ...generateForm, startDate: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Đến ngày</label>
              <input
                type="date"
                value={generateForm.endDate}
                onChange={(e) => setGenerateForm({ ...generateForm, endDate: e.target.value })}
                className="input"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsGenerateModalOpen(false)} className="btn btn-outline">
              Hủy
            </button>
            <button onClick={handleGenerateFromTemplates} className="btn btn-primary flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              Tạo ca nháp từ mẫu
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Quản lý mẫu ca định kỳ */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title="Quản lý mẫu ca làm việc định kỳ"
      >
        <div className="space-y-5">
          <form onSubmit={handleCreateTemplate} className="space-y-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
            <h4 className="text-xs font-bold text-text-main uppercase tracking-wide">Tạo mẫu ca định kỳ mới</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="label text-[11px]">Vị trí công việc *</label>
                <input
                  type="text"
                  value={newTemplateForm.positionTitle}
                  onChange={(e) => setNewTemplateForm({ ...newTemplateForm, positionTitle: e.target.value })}
                  className="input text-xs h-9"
                  placeholder="VD: Phục vụ sáng, Thu ngân tối..."
                  required
                />
              </div>

              <div>
                <label className="label text-[11px]">Thứ trong tuần *</label>
                <select
                  value={newTemplateForm.dayOfWeek}
                  onChange={(e) => setNewTemplateForm({ ...newTemplateForm, dayOfWeek: Number(e.target.value) })}
                  className="input text-xs h-9"
                >
                  <option value={1}>Thứ Hai</option>
                  <option value={2}>Thứ Ba</option>
                  <option value={3}>Thứ Tư</option>
                  <option value={4}>Thứ Năm</option>
                  <option value={5}>Thứ Sáu</option>
                  <option value={6}>Thứ Bảy</option>
                  <option value={0}>Chủ Nhật</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label text-[11px]">Giờ bắt đầu</label>
                <input
                  type="time"
                  value={newTemplateForm.startTime}
                  onChange={(e) => setNewTemplateForm({ ...newTemplateForm, startTime: e.target.value })}
                  className="input text-xs h-9"
                  required
                />
              </div>
              <div>
                <label className="label text-[11px]">Giờ kết thúc</label>
                <input
                  type="time"
                  value={newTemplateForm.endTime}
                  onChange={(e) => setNewTemplateForm({ ...newTemplateForm, endTime: e.target.value })}
                  className="input text-xs h-9"
                  required
                />
              </div>
              <div>
                <label className="label text-[11px]">Lương (đ/h)</label>
                <input
                  type="number"
                  value={newTemplateForm.wageOverride}
                  onChange={(e) => setNewTemplateForm({ ...newTemplateForm, wageOverride: Number(e.target.value) })}
                  className="input text-xs h-9"
                  step="1000"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button type="submit" className="btn btn-primary btn-xs flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Thêm mẫu ca
              </button>
            </div>
          </form>

          {/* List of existing templates */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-text-main">Mẫu ca hiện có ({shiftTemplates.length})</h4>
            {shiftTemplates.length === 0 ? (
              <p className="text-xs text-stone-400 italic">Chưa có mẫu ca định kỳ nào.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {shiftTemplates.map((t) => (
                  <div key={t._id || t.id} className="p-2.5 rounded-lg border border-stone-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-text-main">{t.positionTitle}</span>
                      <span className="text-stone-400 mx-1.5">•</span>
                      <span className="text-green-700 font-semibold">{VN_WEEKDAY_NAMES[t.dayOfWeek === 0 ? 6 : t.dayOfWeek - 1]}</span>
                      <span className="text-stone-400 mx-1.5">•</span>
                      <span>{t.startTime} – {t.endTime}</span>
                      {t.wageOverride && <span className="ml-1.5 text-stone-500">({t.wageOverride.toLocaleString('vi-VN')} đ/h)</span>}
                    </div>
                    <button
                      onClick={() => handleDeleteTemplate(t._id || t.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
