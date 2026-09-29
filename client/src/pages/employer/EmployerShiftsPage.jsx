import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar, Clock, Plus, Check,
  AlertTriangle, DollarSign, ChevronLeft, ChevronRight,
  AlertCircle, Send, Edit3, Trash2,
  CalendarOff, CheckCircle2, Sparkles
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
  approveAttendance,
  adjustShiftTime,
  resolveDispute,
  markPayrollReady,
  markPaid,
  getTimeOff,
  updateTimeOffStatus,
  getEmployerMyJobs,
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
  const assignmentStatus = shift.assignmentStatus || (shift.status === 'acknowledged' ? 'acknowledged' : 'assigned');
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
  if (attendanceStatus === 'disputed') {
    return { variant: 'red', label: 'Cần đối soát' };
  }
  if (['needs_review', 'completed_pending_review', 'pending_approval'].includes(attendanceStatus)) {
    return { variant: 'yellow', label: 'Chờ duyệt công' };
  }
  if (attendanceStatus === 'checked_in') {
    return { variant: 'blue', label: 'Đang làm việc' };
  }
  if (attendanceStatus === 'no_show') {
    return { variant: 'red', label: 'Vắng mặt' };
  }
  if (assignmentStatus === 'declined') {
    return { variant: 'red', label: 'NV từ chối' };
  }
  if (assignmentStatus === 'accepted') {
    return { variant: 'green', label: 'NV đã nhận ca' };
  }
  if (assignmentStatus === 'acknowledged') {
    return { variant: 'blue', label: 'NV đã xem lịch' };
  }
  return { variant: 'yellow', label: 'Chờ NV phản hồi' };
}

export default function EmployerShiftsPage() {
  const { user } = useAuth();

  // Tab State: 'schedule' | 'review' | 'payroll' | 'time_off'
  const [activeTab, setActiveTab] = useState('schedule');

  // Week selection
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(getTodayString()));
  const weekDates = useMemo(() => getWeekDates(currentMonday), [currentMonday]);

  // Main data states
  const [shifts, setShifts] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [employments, setEmployments] = useState([]);
  const [timeOffRequests, setTimeOffRequests] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Filters
  const [filterJobId, setFilterJobId] = useState('all');
  const [filterEmployeeId, setFilterEmployeeId] = useState('all');
  const [filterPayrollStatus, setFilterPayrollStatus] = useState('all');
  const [filterTimeOffStatus, setFilterTimeOffStatus] = useState('all');

  // Modals
  const [isAddShiftModalOpen, setIsAddShiftModalOpen] = useState(false);
  const [addShiftForm, setAddShiftForm] = useState({
    jobId: '',
    role: '',
    date: getTodayString(),
    startTime: '08:00',
    endTime: '12:00',
    wageRate: 25000,
    studentUserId: '',
    publishImmediately: false,
  });

  // Preflight Publish Modal
  const [isPreflightModalOpen, setIsPreflightModalOpen] = useState(false);
  const [preflightData, setPreflightData] = useState(null);

  // Generate From Templates Modal
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    startDate: weekDates[0],
    endDate: weekDates[6],
    jobId: '',
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

  // Timesheet Review & Adjustment Modal
  const [reviewShiftItem, setReviewShiftItem] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    approvedMinutes: 0,
    managerNote: '',
  });

  const [adjustShiftItem, setAdjustShiftItem] = useState(null);
  const [adjustForm, setAdjustForm] = useState({
    adjustedMinutes: 0,
    reason: '',
  });

  // Dispute Resolution Modal
  const [disputeResolveItem, setDisputeResolveItem] = useState(null);
  const [disputeResolveForm, setDisputeResolveForm] = useState({
    resolution: 'accepted',
    adjustedMinutes: 0,
    note: '',
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
    conflictingShiftAction: 'warn',
  });

  const loadAllData = useCallback(async () => {
    try {
      const [shiftData, myJobsData, empData, toData] = await Promise.all([
        getShifts({ employerId: user?.id, storeId: user?.id }).catch(() => []),
        getEmployerMyJobs().catch(() => []),
        getEmployments({ employerId: user?.id, status: 'active' }).catch(() => []),
        getTimeOff({ employerUserId: user?.id }).catch(() => []),
      ]);

      setShifts(Array.isArray(shiftData) ? shiftData : []);
      const jobList = Array.isArray(myJobsData) ? myJobsData : (myJobsData?.items || myJobsData?.jobs || []);
      setJobs(jobList);
      setEmployments(Array.isArray(empData) ? empData : []);
      setTimeOffRequests(Array.isArray(toData) ? toData : []);

      if (jobList.length > 0 && !addShiftForm.jobId) {
        setAddShiftForm((prev) => ({
          ...prev,
          jobId: jobList[0]._id || jobList[0].id,
          wageRate: jobList[0].salaryAmount || 25000,
        }));
      }
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: 'Không thể tải dữ liệu ca làm việc.' });
    }
  }, [user?.id, addShiftForm.jobId]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Active employees for assignment
  const activeEmployees = useMemo(() => {
    return employments.filter((e) => ['active', 'onboarding'].includes(e.status));
  }, [employments]);

  // Navigate weeks
  function handlePrevWeek() {
    const [y, m, d] = currentMonday.split('-').map(Number);
    const prev = new Date(y, m - 1, d - 7);
    const yr = prev.getFullYear();
    const mo = String(prev.getMonth() + 1).padStart(2, '0');
    const da = String(prev.getDate()).padStart(2, '0');
    setCurrentMonday(`${yr}-${mo}-${da}`);
  }

  function handleNextWeek() {
    const [y, m, d] = currentMonday.split('-').map(Number);
    const next = new Date(y, m - 1, d + 7);
    const yr = next.getFullYear();
    const mo = String(next.getMonth() + 1).padStart(2, '0');
    const da = String(next.getDate()).padStart(2, '0');
    setCurrentMonday(`${yr}-${mo}-${da}`);
  }

  function handleCurrentWeek() {
    setCurrentMonday(getMonday(getTodayString()));
  }

  // Shifts in current week
  const weekShifts = useMemo(() => {
    return shifts.filter((s) => {
      if (!weekDates.includes(s.date)) return false;
      if (filterJobId !== 'all') {
        const sJobId = s.jobId?._id || s.jobId;
        if (String(sJobId) !== String(filterJobId)) return false;
      }
      if (filterEmployeeId !== 'all') {
        const sEmpId = s.studentUserId?._id || s.studentUserId || s.studentId;
        if (String(sEmpId) !== String(filterEmployeeId)) return false;
      }
      return true;
    });
  }, [shifts, weekDates, filterJobId, filterEmployeeId]);

  // Week summary metrics
  const weekSummary = useMemo(() => {
    let total = 0;
    let published = 0;
    let draft = 0;
    let attention = 0;

    weekShifts.forEach((s) => {
      const scheduleStatus = s.scheduleStatus || (s.status === 'draft' ? 'draft' : s.status === 'cancelled' ? 'cancelled' : 'published');
      const assignmentStatus = s.assignmentStatus || (s.status === 'acknowledged' ? 'acknowledged' : 'assigned');
      const attendanceStatus = s.attendanceStatus || s.status;

      if (scheduleStatus === 'cancelled') return;
      total++;
      if (scheduleStatus === 'published') published++;
      if (scheduleStatus === 'draft') draft++;
      if (assignmentStatus === 'declined' || attendanceStatus === 'disputed' || !s.studentUserId) {
        attention++;
      }
    });

    return { total, published, draft, attention };
  }, [weekShifts]);

  // Review Queue (shifts waiting for timesheet approval or disputed)
  const reviewQueueShifts = useMemo(() => {
    return shifts.filter((s) => {
      const att = s.attendanceStatus || s.status;
      return ['completed_pending_review', 'needs_review', 'pending_approval', 'disputed'].includes(att);
    });
  }, [shifts]);

  // Payroll Queue (shifts approved and ready for payment)
  const payrollQueueShifts = useMemo(() => {
    return shifts.filter((s) => {
      const att = s.attendanceStatus || s.status;
      const pay = s.payrollStatus || (s.status === 'paid' ? 'paid' : s.status === 'payroll_ready' ? 'ready' : 'not_ready');

      if (att !== 'approved' && pay === 'not_ready') return false;

      if (filterPayrollStatus === 'ready') return pay === 'ready';
      if (filterPayrollStatus === 'paid') return pay === 'paid';
      if (filterPayrollStatus === 'not_ready') return pay === 'not_ready' && att === 'approved';
      return pay === 'ready' || pay === 'paid' || att === 'approved';
    });
  }, [shifts, filterPayrollStatus]);

  // Payroll summary metrics
  const payrollSummary = useMemo(() => {
    let readyCount = 0;
    let paidCount = 0;
    let pendingPayTotal = 0;
    let paidTotal = 0;

    shifts.forEach((s) => {
      const pay = s.payrollStatus || (s.status === 'paid' ? 'paid' : s.status === 'payroll_ready' ? 'ready' : 'not_ready');
      const hours = s.hours || 4;
      const rate = s.wageRate || 25000;
      const amount = hours * rate;

      if (pay === 'ready') {
        readyCount++;
        pendingPayTotal += amount;
      } else if (pay === 'paid') {
        paidCount++;
        paidTotal += amount;
      }
    });

    return { readyCount, paidCount, pendingPayTotal, paidTotal };
  }, [shifts]);

  // Time off requests filtered
  const filteredTimeOffRequests = useMemo(() => {
    return timeOffRequests.filter((r) => {
      if (filterTimeOffStatus === 'all') return true;
      return r.status === filterTimeOffStatus;
    });
  }, [timeOffRequests, filterTimeOffStatus]);

  // -------------------------------------------------------------
  // ACTIONS: Create Shift
  // -------------------------------------------------------------
  async function handleCreateShift(e) {
    e.preventDefault();
    try {
      setActionLoading(true);
      const selectedEmp = activeEmployees.find(
        (emp) => String(emp.employeeUserId?._id || emp.employeeUserId) === String(addShiftForm.studentUserId)
      );

      const payload = {
        jobId: addShiftForm.jobId,
        date: addShiftForm.date,
        startTime: addShiftForm.startTime,
        endTime: addShiftForm.endTime,
        wageRate: Number(addShiftForm.wageRate) || 25000,
        role: addShiftForm.role.trim() || 'Nhân viên ca làm',
        studentUserId: addShiftForm.studentUserId || undefined,
        studentName: selectedEmp?.employeeUserId?.name || undefined,
        studentPhone: selectedEmp?.employeeUserId?.phone || undefined,
        isDraft: !addShiftForm.publishImmediately,
      };

      const res = await createShift(payload);
      setShifts((prev) => [res.shift || res, ...prev]);
      setToast({ type: 'success', message: 'Tạo ca làm việc mới thành công!' });
      setIsAddShiftModalOpen(false);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi tạo ca làm việc.' });
    } finally {
      setActionLoading(false);
    }
  }

  // -------------------------------------------------------------
  // ACTIONS: Preflight & Publish Shifts
  // -------------------------------------------------------------
  async function handleOpenPreflight() {
    try {
      setActionLoading(true);
      const res = await preflightPublish({
        startDate: weekDates[0],
        endDate: weekDates[6],
      });
      setPreflightData(res);
      setIsPreflightModalOpen(true);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể kiểm tra lịch tuần trước khi công bố.' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConfirmPublish() {
    try {
      setActionLoading(true);
      const res = await publishShifts({
        startDate: weekDates[0],
        endDate: weekDates[6],
      });

      setShifts((prev) =>
        prev.map((s) => {
          if (weekDates.includes(s.date) && (s.scheduleStatus === 'draft' || s.status === 'draft')) {
            return { ...s, scheduleStatus: 'published', status: 'published' };
          }
          return s;
        })
      );

      setToast({ type: 'success', message: `Công bố thành công ${res.publishedCount || 0} ca làm việc!` });
      setIsPreflightModalOpen(false);
      setPreflightData(null);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể công bố lịch.' });
    } finally {
      setActionLoading(false);
    }
  }

  // -------------------------------------------------------------
  // ACTIONS: Generate From Templates
  // -------------------------------------------------------------
  async function handleGenerateFromTemplates(e) {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await generateFromTemplates({
        startDate: generateForm.startDate,
        endDate: generateForm.endDate,
        jobId: generateForm.jobId || undefined,
      });

      setToast({
        type: 'success',
        message: `Đã tự động tạo ${res.generatedCount || 0} ca làm việc nháp từ mẫu!`,
      });
      setIsGenerateModalOpen(false);
      const freshShifts = await getShifts({ employerId: user?.id, storeId: user?.id });
      setShifts(Array.isArray(freshShifts) ? freshShifts : []);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi tạo ca từ mẫu.' });
    } finally {
      setActionLoading(false);
    }
  }

  // -------------------------------------------------------------
  // ACTIONS: Reschedule Shift
  // -------------------------------------------------------------
  function handleOpenReschedule(shift) {
    setRescheduleShiftItem(shift);
    setRescheduleForm({
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      wageRate: shift.wageRate || 25000,
      reason: '',
    });
  }

  async function handleConfirmReschedule(e) {
    e.preventDefault();
    if (!rescheduleShiftItem) return;
    if (!rescheduleForm.reason.trim()) {
      setToast({ type: 'warning', message: 'Vui lòng cung cấp lý do điều chỉnh lịch ca đã công bố.' });
      return;
    }

    try {
      setActionLoading(true);
      const shiftId = rescheduleShiftItem._id || rescheduleShiftItem.id;
      const res = await rescheduleShift(shiftId, {
        date: rescheduleForm.date,
        startTime: rescheduleForm.startTime,
        endTime: rescheduleForm.endTime,
        wageRate: Number(rescheduleForm.wageRate),
        reason: rescheduleForm.reason.trim(),
      });

      setShifts((prev) =>
        prev.map((s) => (s._id === shiftId || s.id === shiftId ? { ...s, ...(res.shift || {}) } : s))
      );

      setToast({
        type: 'success',
        message: 'Đã dời lịch ca làm việc thành công. Bản sửa đổi mới đã được gửi tới nhân viên.',
      });
      setRescheduleShiftItem(null);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi điều chỉnh lịch ca.' });
    } finally {
      setActionLoading(false);
    }
  }

  // -------------------------------------------------------------
  // ACTIONS: Cancel Shift
  // -------------------------------------------------------------
  async function handleConfirmCancel() {
    if (!cancelShiftItem) return;
    try {
      setActionLoading(true);
      const shiftId = cancelShiftItem._id || cancelShiftItem.id;
      await cancelShift(shiftId, { reason: cancelReason.trim() || 'Quản lý hủy ca làm' });

      setShifts((prev) =>
        prev.map((s) =>
          s._id === shiftId || s.id === shiftId
            ? { ...s, scheduleStatus: 'cancelled', status: 'cancelled' }
            : s
        )
      );

      setToast({ type: 'success', message: 'Đã hủy ca làm việc.' });
      setCancelShiftItem(null);
      setCancelReason('');
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi hủy ca làm việc.' });
    } finally {
      setActionLoading(false);
    }
  }

  // -------------------------------------------------------------
  // ACTIONS: Timesheet Review & Dispute Resolution
  // -------------------------------------------------------------
  function handleOpenReview(shift) {
    setReviewShiftItem(shift);
    const plannedMinutes = (shift.hours || 4) * 60;
    setReviewForm({
      approvedMinutes: plannedMinutes,
      managerNote: '',
    });
  }

  async function handleConfirmApproveAttendance() {
    if (!reviewShiftItem) return;
    try {
      setActionLoading(true);
      const shiftId = reviewShiftItem._id || reviewShiftItem.id;
      const res = await approveAttendance(shiftId, {
        approvedMinutes: Number(reviewForm.approvedMinutes),
        managerNote: reviewForm.managerNote.trim(),
      });

      setShifts((prev) =>
        prev.map((s) =>
          s._id === shiftId || s.id === shiftId
            ? { ...s, ...(res.shift || {}), attendanceStatus: 'approved', status: 'approved' }
            : s
        )
      );

      setToast({ type: 'success', message: 'Duyệt giờ công ca làm việc thành công!' });
      setReviewShiftItem(null);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi duyệt công.' });
    } finally {
      setActionLoading(false);
    }
  }

  function handleOpenAdjust(shift) {
    setAdjustShiftItem(shift);
    const currentMins = (shift.hours || 4) * 60;
    setAdjustForm({
      adjustedMinutes: currentMins,
      reason: '',
    });
  }

  async function handleConfirmAdjust() {
    if (!adjustShiftItem) return;
    if (!adjustForm.reason.trim()) {
      setToast({ type: 'warning', message: 'Vui lòng cung cấp lý do điều chỉnh giờ công.' });
      return;
    }
    try {
      setActionLoading(true);
      const shiftId = adjustShiftItem._id || adjustShiftItem.id;
      const res = await adjustShiftTime(shiftId, {
        adjustedMinutes: Number(adjustForm.adjustedMinutes),
        reason: adjustForm.reason.trim(),
      });

      setShifts((prev) =>
        prev.map((s) => (s._id === shiftId || s.id === shiftId ? { ...s, ...(res.shift || {}) } : s))
      );

      setToast({ type: 'success', message: 'Đã điều chỉnh giờ công ca làm.' });
      setAdjustShiftItem(null);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi điều chỉnh giờ công.' });
    } finally {
      setActionLoading(false);
    }
  }

  function handleOpenDisputeResolve(shift) {
    setDisputeResolveItem(shift);
    setDisputeResolveForm({
      resolution: 'accepted',
      adjustedMinutes: (shift.hours || 4) * 60,
      note: '',
    });
  }

  async function handleConfirmDisputeResolve() {
    if (!disputeResolveItem) return;
    try {
      setActionLoading(true);
      const shiftId = disputeResolveItem._id || disputeResolveItem.id;
      const res = await resolveDispute(shiftId, {
        resolution: disputeResolveForm.resolution,
        adjustedMinutes: Number(disputeResolveForm.adjustedMinutes),
        note: disputeResolveForm.note.trim(),
      });

      setShifts((prev) =>
        prev.map((s) => (s._id === shiftId || s.id === shiftId ? { ...s, ...(res.shift || {}) } : s))
      );

      setToast({ type: 'success', message: 'Đã giải quyết yêu cầu đối soát thành công!' });
      setDisputeResolveItem(null);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi xử lý đối soát.' });
    } finally {
      setActionLoading(false);
    }
  }

  // -------------------------------------------------------------
  // ACTIONS: Payroll Mark Ready & Pay
  // -------------------------------------------------------------
  async function handleMarkPayrollReady(shiftId) {
    try {
      setActionLoading(true);
      const res = await markPayrollReady(shiftId);
      setShifts((prev) =>
        prev.map((s) =>
          s._id === shiftId || s.id === shiftId
            ? { ...s, ...(res.shift || {}), payrollStatus: 'ready', status: 'payroll_ready' }
            : s
        )
      );
      setToast({ type: 'success', message: 'Đã chuyển ca sang trạng thái Sẵn sàng trả lương!' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi chuẩn bị trả lương.' });
    } finally {
      setActionLoading(false);
    }
  }

  function handleOpenPayModal(shift) {
    setPayShiftItem(shift);
    setPayForm({
      paymentReference: '',
      note: '',
    });
  }

  async function handleConfirmPay() {
    if (!payShiftItem) return;
    try {
      setActionLoading(true);
      const shiftId = payShiftItem._id || payShiftItem.id;
      const res = await markPaid(shiftId, {
        paymentReference: payForm.paymentReference.trim(),
        note: payForm.note.trim(),
      });

      setShifts((prev) =>
        prev.map((s) =>
          s._id === shiftId || s.id === shiftId
            ? { ...s, ...(res.shift || {}), payrollStatus: 'paid', status: 'paid' }
            : s
        )
      );

      setToast({ type: 'success', message: 'Xác nhận thanh toán lương ca làm thành công!' });
      setPayShiftItem(null);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi ghi nhận thanh toán.' });
    } finally {
      setActionLoading(false);
    }
  }

  // -------------------------------------------------------------
  // ACTIONS: Time-Off Review
  // -------------------------------------------------------------
  function handleOpenTimeOffReview(req, status) {
    setTimeOffReviewItem(req);
    setTimeOffReviewForm({
      status,
      reviewNote: '',
      conflictingShiftAction: 'warn',
    });
  }

  async function handleConfirmTimeOffReview() {
    if (!timeOffReviewItem) return;
    try {
      setActionLoading(true);
      const reqId = timeOffReviewItem._id || timeOffReviewItem.id;
      await updateTimeOffStatus(reqId, {
        status: timeOffReviewForm.status,
        reviewNote: timeOffReviewForm.reviewNote.trim(),
        conflictingShiftAction: timeOffReviewForm.conflictingShiftAction,
      });

      setTimeOffRequests((prev) =>
        prev.map((r) =>
          r._id === reqId || r.id === reqId
            ? { ...r, status: timeOffReviewForm.status, reviewNote: timeOffReviewForm.reviewNote.trim() }
            : r
        )
      );

      setToast({
        type: 'success',
        message: timeOffReviewForm.status === 'approved' ? 'Đã duyệt đơn xin nghỉ.' : 'Đã từ chối đơn xin nghỉ.',
      });
      setTimeOffReviewItem(null);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi xử lý đơn nghỉ.' });
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-stone-700" />
            Quản lý lịch làm việc & Chấm công
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Lập lịch tuần, công bố ca làm, xét duyệt giờ công thực tế và quyết toán tiền ca cho nhân viên.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsGenerateModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-stone-600" />
            <span>Tạo ca từ mẫu</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddShiftModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm ca làm</span>
          </button>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-stone-200 overflow-x-auto text-xs font-semibold">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('schedule')}
            className={clsx(
              'px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap',
              activeTab === 'schedule'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            )}
          >
            <Calendar className="w-4 h-4" />
            <span>Lịch tuần & Ca làm</span>
            {weekSummary.draft > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-stone-100 text-stone-700 text-[10px] font-bold">
                {weekSummary.draft} nháp
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('review')}
            className={clsx(
              'px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap',
              activeTab === 'review'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            )}
          >
            <Clock className="w-4 h-4" />
            <span>Duyệt công (Timesheet)</span>
            {reviewQueueShifts.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                {reviewQueueShifts.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payroll')}
            className={clsx(
              'px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap',
              activeTab === 'payroll'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            )}
          >
            <DollarSign className="w-4 h-4" />
            <span>Tính lương & Quyết toán</span>
            {payrollSummary.readyCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                {payrollSummary.readyCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('time_off')}
            className={clsx(
              'px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap',
              activeTab === 'time_off'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            )}
          >
            <CalendarOff className="w-4 h-4" />
            <span>Đơn xin nghỉ</span>
            {timeOffRequests.filter((r) => r.status === 'pending').length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-red-100 text-red-800 text-[10px] font-bold">
                {timeOffRequests.filter((r) => r.status === 'pending').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* TAB 1: LỊCH TUẦN & CA LÀM */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          {/* Week Selector Toolbar */}
          <div className="bg-white p-4 rounded-xl border border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevWeek}
                className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700"
                title="Tuần trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleCurrentWeek}
                className="px-2.5 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700 font-semibold"
              >
                Tuần hiện tại
              </button>

              <button
                type="button"
                onClick={handleNextWeek}
                className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700"
                title="Tuần sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <span className="font-bold text-stone-900 text-sm ml-2">
                {weekDates[0].split('-').reverse().join('/')} – {weekDates[6].split('-').reverse().join('/')}
              </span>
            </div>

            {/* Filters & Publish Action */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filterJobId}
                onChange={(e) => setFilterJobId(e.target.value)}
                className="p-2 rounded-lg border border-stone-200 bg-white text-stone-700 text-xs focus:ring-1 focus:ring-stone-900"
              >
                <option value="all">Tất cả bài đăng / cơ sở</option>
                {jobs.map((j) => (
                  <option key={j._id || j.id} value={j._id || j.id}>
                    {j.title || j.storeName}
                  </option>
                ))}
              </select>

              <select
                value={filterEmployeeId}
                onChange={(e) => setFilterEmployeeId(e.target.value)}
                className="p-2 rounded-lg border border-stone-200 bg-white text-stone-700 text-xs focus:ring-1 focus:ring-stone-900"
              >
                <option value="all">Tất cả nhân viên</option>
                {activeEmployees.map((emp) => (
                  <option key={emp.employeeUserId?._id || emp.employeeUserId} value={emp.employeeUserId?._id || emp.employeeUserId}>
                    {emp.employeeUserId?.name || emp.positionTitle}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleOpenPreflight}
                disabled={actionLoading || weekSummary.draft === 0}
                className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-stone-200 disabled:text-stone-400 text-white font-semibold text-xs transition-colors flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Công bố lịch tuần ({weekSummary.draft} nháp)</span>
              </button>
            </div>
          </div>

          {/* Week Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-white p-3.5 rounded-xl border border-stone-200">
              <p className="text-stone-500 font-medium">Tổng ca trong tuần</p>
              <p className="text-xl font-bold text-stone-900 mt-1">{weekSummary.total}</p>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-stone-200">
              <p className="text-stone-500 font-medium">Đã công bố</p>
              <p className="text-xl font-bold text-emerald-700 mt-1">{weekSummary.published}</p>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-stone-200">
              <p className="text-stone-500 font-medium">Lịch nháp (chưa publish)</p>
              <p className="text-xl font-bold text-stone-700 mt-1">{weekSummary.draft}</p>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-stone-200">
              <p className="text-stone-500 font-medium">Cần chú ý / Chưa gán</p>
              <p className="text-xl font-bold text-amber-700 mt-1">{weekSummary.attention}</p>
            </div>
          </div>

          {/* 7-Day Week Columns / Cards View */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {weekDates.map((dateStr, idx) => {
              const dayShifts = weekShifts.filter((s) => s.date === dateStr);
              const isToday = dateStr === getTodayString();

              return (
                <div
                  key={dateStr}
                  className={clsx(
                    'bg-white rounded-xl border flex flex-col min-h-[360px] text-xs',
                    isToday ? 'border-blue-400 ring-1 ring-blue-300' : 'border-stone-200'
                  )}
                >
                  {/* Day Column Header */}
                  <div className={clsx(
                    'p-2.5 border-b flex items-center justify-between',
                    isToday ? 'bg-blue-50/70 border-blue-200' : 'bg-stone-50 border-stone-200'
                  )}>
                    <div>
                      <p className="font-bold text-stone-900">{VN_WEEKDAY_NAMES[idx]}</p>
                      <p className="text-[11px] text-stone-500">{dateStr.split('-').slice(1).reverse().join('/')}</p>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-stone-600 border border-stone-200">
                      {dayShifts.length}
                    </span>
                  </div>

                  {/* Day Shifts List */}
                  <div className="p-2 space-y-2 flex-1 overflow-y-auto">
                    {dayShifts.length === 0 ? (
                      <div className="h-full flex items-center justify-center p-4 text-center text-stone-400 text-[11px]">
                        Không có ca
                      </div>
                    ) : (
                      dayShifts.map((shift) => {
                        const statusInfo = getDisplayStatusInfo(shift);
                        const isDraft = shift.scheduleStatus === 'draft' || shift.status === 'draft';
                        const isCancelled = shift.scheduleStatus === 'cancelled' || shift.status === 'cancelled';

                        return (
                          <div
                            key={shift._id || shift.id}
                            className={clsx(
                              'p-2.5 rounded-lg border space-y-2 transition-all',
                              isDraft ? 'bg-stone-50 border-stone-200 border-dashed' :
                              isCancelled ? 'bg-stone-100 border-stone-200 opacity-60' :
                              'bg-white border-stone-200 shadow-xs'
                            )}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-stone-900 text-[11px]">
                                {shift.startTime} - {shift.endTime}
                              </span>
                              <Badge variant={statusInfo.variant} className="text-[10px] px-1 py-0.2">
                                {statusInfo.label}
                              </Badge>
                            </div>

                            <div>
                              <p className="font-semibold text-stone-800 text-[11px] truncate">
                                {shift.role || 'Nhân viên'}
                              </p>
                              <p className="text-[10px] text-stone-500 truncate">
                                {shift.storeName || 'Cửa hàng'}
                              </p>
                            </div>

                            {/* Assigned Employee */}
                            <div className="pt-1 border-t border-stone-100 flex items-center justify-between text-[11px]">
                              <span className="text-stone-700 font-medium truncate">
                                👤 {shift.studentName || 'Chưa gán SV'}
                              </span>
                              {shift.scheduleRevision > 1 && (
                                <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1 rounded">
                                  #{shift.scheduleRevision}
                                </span>
                              )}
                            </div>

                            {/* Shift Actions */}
                            {!isCancelled && (
                              <div className="pt-1.5 border-t border-stone-100 flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenReschedule(shift)}
                                  className="p-1 rounded text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                                  title="Dời / Đổi giờ ca làm"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCancelShiftItem(shift);
                                    setCancelReason('');
                                  }}
                                  className="p-1 rounded text-stone-400 hover:bg-red-50 hover:text-red-700"
                                  title="Hủy ca làm việc"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
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

      {/* TAB 2: DUYỆT CÔNG (TIMESHEET REVIEW) */}
      {activeTab === 'review' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-stone-200 flex items-center justify-between text-xs">
            <div>
              <h3 className="font-bold text-stone-900 text-sm">Hàng đợi duyệt công (Timesheet Exceptions)</h3>
              <p className="text-stone-500 mt-0.5">
                Các ca làm việc đã tan ca, có yêu cầu chấm công thủ công, sai số GPS hoặc đang khiếu nại đối soát.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded bg-stone-100 font-semibold text-stone-700">
              {reviewQueueShifts.length} ca chờ xử lý
            </span>
          </div>

          {reviewQueueShifts.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-stone-200 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-stone-400 mx-auto" />
              <p className="font-semibold text-stone-800 text-sm">Không có ca làm nào cần duyệt lại</p>
              <p className="text-xs text-stone-500">Mọi ca làm việc đều đã được kiểm tra hoặc chưa kết thúc ca.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reviewQueueShifts.map((shift) => {
                const att = shift.attendance || {};
                const isDisputed = shift.attendanceStatus === 'disputed' || shift.status === 'disputed';
                const verifyStatus = att.checkInVerificationStatus;

                return (
                  <div
                    key={shift._id || shift.id}
                    className={clsx(
                      'bg-white p-5 rounded-xl border flex flex-col justify-between space-y-4',
                      isDisputed ? 'border-red-300 ring-1 ring-red-200' : 'border-stone-200'
                    )}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-stone-700 bg-stone-100 px-2 py-0.5 rounded">
                          {shift.date}
                        </span>
                        <Badge variant={isDisputed ? 'red' : 'yellow'}>
                          {isDisputed ? 'Khiếu nại / Đối soát' : 'Chờ duyệt công'}
                        </Badge>
                      </div>

                      <div>
                        <h4 className="font-bold text-stone-900 text-sm">
                          {shift.studentName || 'Sinh viên làm ca'}
                        </h4>
                        <p className="text-xs text-stone-500">{shift.storeName} — {shift.role}</p>
                      </div>

                      <div className="p-2.5 bg-stone-50 rounded-lg text-xs space-y-1 text-stone-700 border border-stone-150">
                        <p>
                          Kế hoạch: <strong>{shift.startTime} – {shift.endTime}</strong> ({shift.hours || 4} giờ)
                        </p>
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

                        <div className="pt-1">
                          {verifyStatus === 'verified' ? (
                            <span className="text-emerald-700 font-medium">✓ Định vị GPS chuẩn ({Math.round(att.checkInDistanceMeters || 0)}m)</span>
                          ) : att.checkInManualReason ? (
                            <span className="text-stone-700">Yêu cầu thủ công: {att.checkInManualReason}</span>
                          ) : (
                            <span className="text-amber-800">Cần đối chiếu GPS</span>
                          )}
                        </div>
                      </div>

                      {shift.disputeReason && (
                        <div className="p-2.5 rounded bg-red-50 text-red-900 text-xs border border-red-200 space-y-1">
                          <p className="font-bold">Lý do đối soát từ sinh viên:</p>
                          <p>{shift.disputeReason}</p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenAdjust(shift)}
                        className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 text-xs font-semibold"
                      >
                        Chỉnh giờ
                      </button>

                      {isDisputed ? (
                        <button
                          type="button"
                          onClick={() => handleOpenDisputeResolve(shift)}
                          className="px-3.5 py-1.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 text-xs font-semibold"
                        >
                          Xử lý đối soát
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenReview(shift)}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 text-xs font-semibold flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Duyệt công</span>
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

      {/* TAB 3: TÍNH LƯƠNG & QUYẾT TOÁN */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          {/* Payroll summary metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-white p-4 rounded-xl border border-stone-200">
              <p className="text-stone-500 font-medium">Chờ thanh toán (Sẵn sàng)</p>
              <p className="text-xl font-bold text-blue-700 mt-1">
                {payrollSummary.pendingPayTotal.toLocaleString('vi-VN')}đ
              </p>
              <p className="text-[11px] text-stone-400 mt-0.5">{payrollSummary.readyCount} ca đã chốt</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-stone-200">
              <p className="text-stone-500 font-medium">Đã thanh toán hoàn tất</p>
              <p className="text-xl font-bold text-emerald-700 mt-1">
                {payrollSummary.paidTotal.toLocaleString('vi-VN')}đ
              </p>
              <p className="text-[11px] text-stone-400 mt-0.5">{payrollSummary.paidCount} ca đã thanh toán</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-stone-200 col-span-2 flex items-center justify-between">
              <div>
                <p className="text-stone-500 font-medium">Lọc danh sách thanh toán</p>
                <div className="flex gap-2 mt-2">
                  {['all', 'ready', 'paid', 'not_ready'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setFilterPayrollStatus(st)}
                      className={clsx(
                        'px-2.5 py-1 rounded text-xs font-semibold transition-colors',
                        filterPayrollStatus === st
                          ? 'bg-stone-900 text-white'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      )}
                    >
                      {st === 'all' ? 'Tất cả' : st === 'ready' ? 'Sẵn sàng trả' : st === 'paid' ? 'Đã chi trả' : 'Chờ chuẩn bị'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Payroll Table */}
          {payrollQueueShifts.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-stone-200 space-y-2">
              <DollarSign className="w-8 h-8 text-stone-400 mx-auto" />
              <p className="font-semibold text-stone-800 text-sm">Không có ca làm việc nào trong danh sách lương</p>
              <p className="text-xs text-stone-500">Các ca sau khi được duyệt công sẽ xuất hiện tại đây.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden text-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold">
                      <th className="p-3">Ngày làm</th>
                      <th className="p-3">Nhân viên</th>
                      <th className="p-3">Ca / Cơ sở</th>
                      <th className="p-3">Giờ công duyệt</th>
                      <th className="p-3">Đơn giá</th>
                      <th className="p-3">Tổng tiền</th>
                      <th className="p-3">Trạng thái</th>
                      <th className="p-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {payrollQueueShifts.map((shift) => {
                      const pay = shift.payrollStatus || (shift.status === 'paid' ? 'paid' : shift.status === 'payroll_ready' ? 'ready' : 'not_ready');
                      const hours = shift.hours || 4;
                      const rate = shift.wageRate || 25000;
                      const total = hours * rate;

                      return (
                        <tr key={shift._id || shift.id} className="hover:bg-stone-50/50">
                          <td className="p-3 font-semibold text-stone-900">{shift.date}</td>
                          <td className="p-3">
                            <p className="font-bold text-stone-800">{shift.studentName || 'Sinh viên'}</p>
                            <p className="text-[11px] text-stone-400">{shift.studentPhone}</p>
                          </td>
                          <td className="p-3">
                            <p className="text-stone-800">{shift.role}</p>
                            <p className="text-[11px] text-stone-400">{shift.storeName}</p>
                          </td>
                          <td className="p-3 font-semibold text-stone-700">{hours} giờ</td>
                          <td className="p-3 text-stone-600">{rate.toLocaleString('vi-VN')}đ/h</td>
                          <td className="p-3 font-bold text-stone-900">{total.toLocaleString('vi-VN')}đ</td>
                          <td className="p-3">
                            {pay === 'paid' ? (
                              <Badge variant="green">Đã trả lương</Badge>
                            ) : pay === 'ready' ? (
                              <Badge variant="blue">Sẵn sàng trả</Badge>
                            ) : (
                              <Badge variant="yellow">Chờ chuẩn bị</Badge>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {pay === 'not_ready' && (
                              <button
                                type="button"
                                onClick={() => handleMarkPayrollReady(shift._id || shift.id)}
                                disabled={actionLoading}
                                className="px-2.5 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold"
                              >
                                Sẵn sàng trả
                              </button>
                            )}
                            {pay === 'ready' && (
                              <button
                                type="button"
                                onClick={() => handleOpenPayModal(shift)}
                                className="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                              >
                                Chi trả
                              </button>
                            )}
                            {pay === 'paid' && (
                              <span className="text-stone-400 font-medium">Hoàn tất</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ĐƠN XIN NGHỈ (TIME OFF INBOX) */}
      {activeTab === 'time_off' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <h3 className="font-bold text-stone-900 text-sm">Hộp thư đơn xin nghỉ phép</h3>
              <p className="text-stone-500 mt-0.5">Xử lý các đơn xin nghỉ phép từ nhân viên làm việc tại quán.</p>
            </div>

            <div className="flex gap-2">
              {['all', 'pending', 'approved', 'rejected'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFilterTimeOffStatus(st)}
                  className={clsx(
                    'px-2.5 py-1 rounded text-xs font-semibold transition-colors',
                    filterTimeOffStatus === st
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  )}
                >
                  {st === 'all' ? 'Tất cả' : st === 'pending' ? 'Chờ duyệt' : st === 'approved' ? 'Đã duyệt' : 'Từ chối'}
                </button>
              ))}
            </div>
          </div>

          {filteredTimeOffRequests.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-stone-200 space-y-2">
              <CalendarOff className="w-8 h-8 text-stone-400 mx-auto" />
              <p className="font-semibold text-stone-800 text-sm">Không có đơn xin nghỉ phép nào</p>
              <p className="text-xs text-stone-500">Khi nhân viên nộp đơn xin nghỉ, đơn sẽ hiển thị tại đây.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTimeOffRequests.map((req) => {
                const sDate = new Date(req.startDate).toLocaleDateString('vi-VN');
                const eDate = new Date(req.endDate).toLocaleDateString('vi-VN');

                return (
                  <div
                    key={req._id || req.id}
                    className="bg-white p-5 rounded-xl border border-stone-200 flex flex-col justify-between space-y-4 text-xs"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-stone-900">
                          {sDate === eDate ? sDate : `${sDate} – ${eDate}`}
                        </span>
                        <Badge
                          variant={
                            req.status === 'approved' ? 'green' :
                            req.status === 'rejected' ? 'red' :
                            req.status === 'cancelled' ? 'gray' : 'yellow'
                          }
                        >
                          {req.status === 'approved' ? 'Đã duyệt' :
                           req.status === 'rejected' ? 'Bị từ chối' :
                           req.status === 'cancelled' ? 'Đã hủy' : 'Chờ duyệt'}
                        </Badge>
                      </div>

                      <div>
                        <p className="font-bold text-stone-800 text-sm">{req.employeeUserId?.name || 'Nhân viên'}</p>
                        <p className="text-stone-400 text-[11px]">{req.employeeUserId?.phone}</p>
                      </div>

                      {req.reason && (
                        <p className="p-2.5 rounded bg-stone-50 text-stone-700 border border-stone-150">
                          Lý do: {req.reason}
                        </p>
                      )}

                      {req.reviewNote && (
                        <p className="text-stone-500 italic">
                          Ghi chú duyệt: {req.reviewNote}
                        </p>
                      )}
                    </div>

                    {req.status === 'pending' && (
                      <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenTimeOffReview(req, 'rejected')}
                          className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 font-semibold"
                        >
                          Từ chối
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenTimeOffReview(req, 'approved')}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 font-semibold flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Duyệt đơn</span>
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

      {/* MODAL: Thêm ca làm việc mới */}
      {isAddShiftModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAddShiftModalOpen(false)}
          title="Thêm ca làm việc"
        >
          <form onSubmit={handleCreateShift} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-stone-800 mb-1">
                Chọn cơ sở / Bài đăng công việc *
              </label>
              <select
                value={addShiftForm.jobId}
                onChange={(e) => {
                  const jId = e.target.value;
                  const selJob = jobs.find((j) => String(j._id || j.id) === String(jId));
                  setAddShiftForm({
                    ...addShiftForm,
                    jobId: jId,
                    wageRate: selJob?.salaryAmount || addShiftForm.wageRate,
                  });
                }}
                className="w-full p-2.5 rounded-lg border border-stone-300 focus:ring-1 focus:ring-stone-900 bg-white"
              >
                {jobs.map((job) => (
                  <option key={job._id || job.id} value={job._id || job.id}>
                    {job.title} — {job.storeName || 'Cửa hàng'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-stone-800 mb-1">
                Vị trí / Vai trò trong ca *
              </label>
              <input
                type="text"
                required
                value={addShiftForm.role}
                onChange={(e) => setAddShiftForm({ ...addShiftForm, role: e.target.value })}
                placeholder="Ví dụ: Thu ngân, Phục vụ, Pha chế..."
                className="w-full p-2.5 rounded-lg border border-stone-300 focus:ring-1 focus:ring-stone-900 bg-white"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-semibold text-stone-800 mb-1">Ngày làm *</label>
                <input
                  type="date"
                  required
                  value={addShiftForm.date}
                  onChange={(e) => setAddShiftForm({ ...addShiftForm, date: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-stone-300 focus:ring-1 focus:ring-stone-900 bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-800 mb-1">Giờ bắt đầu *</label>
                <input
                  type="time"
                  required
                  value={addShiftForm.startTime}
                  onChange={(e) => setAddShiftForm({ ...addShiftForm, startTime: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-stone-300 focus:ring-1 focus:ring-stone-900 bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-800 mb-1">Giờ kết thúc *</label>
                <input
                  type="time"
                  required
                  value={addShiftForm.endTime}
                  onChange={(e) => setAddShiftForm({ ...addShiftForm, endTime: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-stone-300 focus:ring-1 focus:ring-stone-900 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-stone-800 mb-1">Lương theo giờ (VNĐ/h) *</label>
                <input
                  type="number"
                  required
                  min={10000}
                  step={1000}
                  value={addShiftForm.wageRate}
                  onChange={(e) => setAddShiftForm({ ...addShiftForm, wageRate: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-stone-300 focus:ring-1 focus:ring-stone-900 bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-800 mb-1">Gán nhân viên</label>
                <select
                  value={addShiftForm.studentUserId}
                  onChange={(e) => setAddShiftForm({ ...addShiftForm, studentUserId: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-stone-300 focus:ring-1 focus:ring-stone-900 bg-white"
                >
                  <option value="">-- Chưa gán (Để mở) --</option>
                  {activeEmployees.map((emp) => (
                    <option key={emp.employeeUserId?._id || emp.employeeUserId} value={emp.employeeUserId?._id || emp.employeeUserId}>
                      {emp.employeeUserId?.name || 'Nhân viên'} ({emp.positionTitle})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-stone-800">
                <input
                  type="checkbox"
                  checked={addShiftForm.publishImmediately}
                  onChange={(e) => setAddShiftForm({ ...addShiftForm, publishImmediately: e.target.checked })}
                  className="rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                />
                <span>Công bố ngay (Nhân viên sẽ nhận thông báo lập tức)</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsAddShiftModalOpen(false)}
                className="px-3.5 py-2 rounded-lg bg-stone-100 text-stone-700 font-semibold hover:bg-stone-200"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg bg-stone-900 text-white font-semibold hover:bg-stone-800 disabled:opacity-50"
              >
                {actionLoading ? 'Đang tạo...' : 'Tạo ca làm việc'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Preflight Publish Check */}
      {isPreflightModalOpen && preflightData && (
        <Modal
          isOpen={true}
          onClose={() => setIsPreflightModalOpen(false)}
          title="Kiểm tra tuân thủ trước khi công bố lịch"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
              <p className="font-semibold text-stone-900">
                Phạm vi công bố: {weekDates[0]} – {weekDates[6]}
              </p>
              <p className="text-stone-600 mt-1">
                Tổng số ca nháp sẽ công bố: <strong>{preflightData.shiftsToPublish} ca</strong>
              </p>
            </div>

            {/* Errors */}
            {Array.isArray(preflightData.errors) && preflightData.errors.length > 0 && (
              <div className="p-3 bg-red-50 text-red-900 rounded-lg border border-red-200 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  Xung đột bắt buộc phải sửa ({preflightData.errors.length}):
                </p>
                <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                  {preflightData.errors.map((err, i) => (
                    <li key={i}>{err.message || JSON.stringify(err)}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {Array.isArray(preflightData.warnings) && preflightData.warnings.length > 0 && (
              <div className="p-3 bg-amber-50 text-amber-900 rounded-lg border border-amber-200 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Cảnh báo tuân thủ cần lưu ý ({preflightData.warnings.length}):
                </p>
                <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                  {preflightData.warnings.map((warn, i) => (
                    <li key={i}>{warn.message || JSON.stringify(warn)}</li>
                  ))}
                </ul>
              </div>
            )}

            {preflightData.errors?.length === 0 && preflightData.warnings?.length === 0 && (
              <div className="p-3 bg-emerald-50 text-emerald-900 rounded-lg border border-emerald-200">
                <p className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  Lịch tuần hợp lệ, không có xung đột ca hoặc đơn nghỉ phép.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsPreflightModalOpen(false)}
                className="px-3.5 py-2 rounded-lg bg-stone-100 text-stone-700 font-semibold hover:bg-stone-200"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleConfirmPublish}
                disabled={actionLoading || (preflightData.errors && preflightData.errors.length > 0)}
                className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800 disabled:opacity-50"
              >
                {actionLoading ? 'Đang công bố...' : 'Xác nhận công bố lịch tuần'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: Generate From Templates */}
      {isGenerateModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsGenerateModalOpen(false)}
          title="Tạo ca làm việc nháp từ mẫu (Template)"
        >
          <form onSubmit={handleGenerateFromTemplates} className="space-y-4 text-xs">
            <p className="text-stone-600">
              Hệ thống sẽ dựa trên các mẫu ca làm định kỳ đã thiết lập để sinh tự động các ca làm việc nháp cho tuần được chọn.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-stone-800 mb-1">Từ ngày *</label>
                <input
                  type="date"
                  required
                  value={generateForm.startDate}
                  onChange={(e) => setGenerateForm({ ...generateForm, startDate: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-stone-300 bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-800 mb-1">Đến ngày *</label>
                <input
                  type="date"
                  required
                  value={generateForm.endDate}
                  onChange={(e) => setGenerateForm({ ...generateForm, endDate: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-stone-300 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-stone-800 mb-1">Cơ sở / Bài tuyển dụng (Tùy chọn)</label>
              <select
                value={generateForm.jobId}
                onChange={(e) => setGenerateForm({ ...generateForm, jobId: e.target.value })}
                className="w-full p-2.5 rounded-lg border border-stone-300 bg-white"
              >
                <option value="">Tất cả các cơ sở</option>
                {jobs.map((job) => (
                  <option key={job._id || job.id} value={job._id || job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsGenerateModalOpen(false)}
                className="px-3.5 py-2 rounded-lg bg-stone-100 text-stone-700 font-semibold hover:bg-stone-200"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg bg-stone-900 text-white font-semibold hover:bg-stone-800 disabled:opacity-50"
              >
                {actionLoading ? 'Đang tạo ca...' : 'Bắt đầu tạo ca nháp'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Reschedule Shift */}
      {rescheduleShiftItem && (
        <Modal
          isOpen={true}
          onClose={() => setRescheduleShiftItem(null)}
          title="Điều chỉnh / Dời lịch ca làm việc"
        >
          <form onSubmit={handleConfirmReschedule} className="space-y-4 text-xs">
            <p className="text-stone-600">
              Dời lịch ca làm việc ngày <strong>{rescheduleShiftItem.date}</strong> cho nhân viên <strong>{rescheduleShiftItem.studentName || 'Chưa gán'}</strong>. Khi điều chỉnh ca đã công bố, nhân viên sẽ cần xác nhận lại.
            </p>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-semibold text-stone-800 mb-1">Ngày làm mới *</label>
                <input
                  type="date"
                  required
                  value={rescheduleForm.date}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, date: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-stone-300 bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-800 mb-1">Bắt đầu *</label>
                <input
                  type="time"
                  required
                  value={rescheduleForm.startTime}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, startTime: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-stone-300 bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-800 mb-1">Kết thúc *</label>
                <input
                  type="time"
                  required
                  value={rescheduleForm.endTime}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, endTime: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-stone-300 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-stone-800 mb-1">Lý do điều chỉnh lịch *</label>
              <textarea
                rows={3}
                required
                value={rescheduleForm.reason}
                onChange={(e) => setRescheduleForm({ ...rescheduleForm, reason: e.target.value })}
                placeholder="Ví dụ: Quán đông khách đột xuất cần dời giờ sớm hơn 1 tiếng..."
                className="w-full p-2.5 rounded-lg border border-stone-300 focus:ring-1 focus:ring-stone-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setRescheduleShiftItem(null)}
                className="px-3.5 py-2 rounded-lg bg-stone-100 text-stone-700 font-semibold hover:bg-stone-200"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={actionLoading || !rescheduleForm.reason.trim()}
                className="px-4 py-2 rounded-lg bg-stone-900 text-white font-semibold hover:bg-stone-800 disabled:opacity-50"
              >
                {actionLoading ? 'Đang cập nhật...' : 'Xác nhận dời ca'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Cancel Shift */}
      {cancelShiftItem && (
        <Modal
          isOpen={true}
          onClose={() => setCancelShiftItem(null)}
          title="Xác nhận hủy ca làm việc"
        >
          <div className="space-y-4 text-xs">
            <p className="text-stone-600">
              Bạn có chắc chắn muốn hủy ca ngày <strong>{cancelShiftItem.date}</strong> ({cancelShiftItem.startTime} – {cancelShiftItem.endTime}) của nhân viên <strong>{cancelShiftItem.studentName || 'Chưa gán'}</strong>?
            </p>

            <div>
              <label className="block font-semibold text-stone-800 mb-1">Lý do hủy ca</label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ví dụ: Quán tạm đóng cửa sửa chữa, nhân sự thừa ca..."
                className="w-full p-2.5 rounded-lg border border-stone-300"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setCancelShiftItem(null)}
                className="px-3.5 py-2 rounded-lg bg-stone-100 text-stone-700 font-semibold"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg bg-red-700 text-white font-semibold hover:bg-red-800 disabled:opacity-50"
              >
                {actionLoading ? 'Đang hủy...' : 'Xác nhận hủy ca'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: Approve Timesheet Review */}
      {reviewShiftItem && (
        <Modal
          isOpen={true}
          onClose={() => setReviewShiftItem(null)}
          title="Duyệt giờ công ca làm việc"
        >
          <div className="space-y-4 text-xs">
            <p className="text-stone-600">
              Duyệt công cho <strong>{reviewShiftItem.studentName}</strong> — Ca ngày <strong>{reviewShiftItem.date}</strong> ({reviewShiftItem.startTime} - {reviewShiftItem.endTime}).
            </p>

            <div>
              <label className="block font-semibold text-stone-800 mb-1">Số phút làm việc được duyệt *</label>
              <input
                type="number"
                min={1}
                required
                value={reviewForm.approvedMinutes}
                onChange={(e) => setReviewForm({ ...reviewForm, approvedMinutes: e.target.value })}
                className="w-full p-2.5 rounded-lg border border-stone-300"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                Tương đương {(Number(reviewForm.approvedMinutes) / 60).toFixed(1)} giờ. Tiền ca tính toán: {((Number(reviewForm.approvedMinutes) / 60) * (reviewShiftItem.wageRate || 25000)).toLocaleString('vi-VN')}đ.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-stone-800 mb-1">Ghi chú của quản lý (Tùy chọn)</label>
              <textarea
                rows={2}
                value={reviewForm.managerNote}
                onChange={(e) => setReviewForm({ ...reviewForm, managerNote: e.target.value })}
                placeholder="Ghi chú xác thực..."
                className="w-full p-2.5 rounded-lg border border-stone-300"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setReviewShiftItem(null)}
                className="px-3.5 py-2 rounded-lg bg-stone-100 text-stone-700 font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmApproveAttendance}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800"
              >
                {actionLoading ? 'Đang duyệt...' : 'Xác nhận duyệt công'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: Adjust Timesheet Time */}
      {adjustShiftItem && (
        <Modal
          isOpen={true}
          onClose={() => setAdjustShiftItem(null)}
          title="Điều chỉnh số phút làm việc"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-stone-800 mb-1">Số phút làm việc thực tế *</label>
              <input
                type="number"
                min={0}
                required
                value={adjustForm.adjustedMinutes}
                onChange={(e) => setAdjustForm({ ...adjustForm, adjustedMinutes: e.target.value })}
                className="w-full p-2.5 rounded-lg border border-stone-300"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-800 mb-1">Lý do điều chỉnh *</label>
              <textarea
                rows={3}
                required
                value={adjustForm.reason}
                onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                placeholder="Ví dụ: Nhân viên làm thêm 30 phút dọn quán sau giờ ca..."
                className="w-full p-2.5 rounded-lg border border-stone-300"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setAdjustShiftItem(null)}
                className="px-3.5 py-2 rounded-lg bg-stone-100 text-stone-700 font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmAdjust}
                disabled={actionLoading || !adjustForm.reason.trim()}
                className="px-4 py-2 rounded-lg bg-stone-900 text-white font-semibold hover:bg-stone-800"
              >
                {actionLoading ? 'Đang lưu...' : 'Lưu điều chỉnh'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: Resolve Dispute */}
      {disputeResolveItem && (
        <Modal
          isOpen={true}
          onClose={() => setDisputeResolveItem(null)}
          title="Giải quyết khiếu nại đối soát công"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-red-50 text-red-900 rounded-lg border border-red-200 space-y-1">
              <p className="font-bold">Lý do đối soát từ sinh viên:</p>
              <p>{disputeResolveItem.disputeReason}</p>
            </div>

            <div>
              <label className="block font-semibold text-stone-800 mb-1">Phương án giải quyết *</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="res"
                    value="accepted"
                    checked={disputeResolveForm.resolution === 'accepted'}
                    onChange={() => setDisputeResolveForm({ ...disputeResolveForm, resolution: 'accepted' })}
                  />
                  <span>Chấp nhận yêu cầu và điều chỉnh giờ công</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="res"
                    value="rejected"
                    checked={disputeResolveForm.resolution === 'rejected'}
                    onChange={() => setDisputeResolveForm({ ...disputeResolveForm, resolution: 'rejected' })}
                  />
                  <span>Từ chối yêu cầu đối soát</span>
                </label>
              </div>
            </div>

            {disputeResolveForm.resolution === 'accepted' && (
              <div>
                <label className="block font-semibold text-stone-800 mb-1">Số phút làm việc sau điều chỉnh *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={disputeResolveForm.adjustedMinutes}
                  onChange={(e) => setDisputeResolveForm({ ...disputeResolveForm, adjustedMinutes: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-stone-300"
                />
              </div>
            )}

            <div>
              <label className="block font-semibold text-stone-800 mb-1">Phản hồi của quản lý gửi nhân viên</label>
              <textarea
                rows={2}
                value={disputeResolveForm.note}
                onChange={(e) => setDisputeResolveForm({ ...disputeResolveForm, note: e.target.value })}
                placeholder="Giải thích lý do..."
                className="w-full p-2.5 rounded-lg border border-stone-300"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setDisputeResolveItem(null)}
                className="px-3.5 py-2 rounded-lg bg-stone-100 text-stone-700 font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDisputeResolve}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg bg-stone-900 text-white font-semibold hover:bg-stone-800"
              >
                {actionLoading ? 'Đang lưu...' : 'Xác nhận giải quyết'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: Pay Shift */}
      {payShiftItem && (
        <Modal
          isOpen={true}
          onClose={() => setPayShiftItem(null)}
          title="Xác nhận thanh toán tiền ca làm"
        >
          <div className="space-y-4 text-xs">
            <p className="text-stone-600">
              Xác nhận đã thanh toán số tiền{' '}
              <strong>{((payShiftItem.hours || 4) * (payShiftItem.wageRate || 25000)).toLocaleString('vi-VN')}đ</strong>{' '}
              cho nhân viên <strong>{payShiftItem.studentName}</strong> (Ca ngày {payShiftItem.date}).
            </p>

            <div>
              <label className="block font-semibold text-stone-800 mb-1">
                Mã giao dịch / Tham chiếu chuyển khoản (Tùy chọn)
              </label>
              <input
                type="text"
                value={payForm.paymentReference}
                onChange={(e) => setPayForm({ ...payForm, paymentReference: e.target.value })}
                placeholder="Ví dụ: MB-FT240981928, Tiền mặt..."
                className="w-full p-2.5 rounded-lg border border-stone-300"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-800 mb-1">Ghi chú thanh toán</label>
              <textarea
                rows={2}
                value={payForm.note}
                onChange={(e) => setPayForm({ ...payForm, note: e.target.value })}
                placeholder="Ghi chú thêm..."
                className="w-full p-2.5 rounded-lg border border-stone-300"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setPayShiftItem(null)}
                className="px-3.5 py-2 rounded-lg bg-stone-100 text-stone-700 font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmPay}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800"
              >
                {actionLoading ? 'Đang ghi nhận...' : 'Xác nhận đã thanh toán'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: Time-off Review */}
      {timeOffReviewItem && (
        <Modal
          isOpen={true}
          onClose={() => setTimeOffReviewItem(null)}
          title={timeOffReviewForm.status === 'approved' ? 'Duyệt đơn xin nghỉ phép' : 'Từ chối đơn xin nghỉ phép'}
        >
          <div className="space-y-4 text-xs">
            <p className="text-stone-600">
              Xử lý đơn nghỉ của <strong>{timeOffReviewItem.employeeUserId?.name}</strong> từ ngày{' '}
              <strong>{new Date(timeOffReviewItem.startDate).toLocaleDateString('vi-VN')}</strong> đến{' '}
              <strong>{new Date(timeOffReviewItem.endDate).toLocaleDateString('vi-VN')}</strong>.
            </p>

            {timeOffReviewForm.status === 'approved' && (
              <div>
                <label className="block font-semibold text-stone-800 mb-1">
                  Nếu có ca làm trùng thời gian nghỉ:
                </label>
                <select
                  value={timeOffReviewForm.conflictingShiftAction}
                  onChange={(e) => setTimeOffReviewForm({ ...timeOffReviewForm, conflictingShiftAction: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-stone-300 bg-white"
                >
                  <option value="warn">Giữ ca làm và hiển thị cảnh báo để quản lý tự đổi người</option>
                  <option value="unassign">Gỡ nhân viên khỏi ca (chuyển sang ca mở/chưa gán)</option>
                  <option value="cancel">Hủy các ca làm trùng lịch này</option>
                </select>
              </div>
            )}

            <div>
              <label className="block font-semibold text-stone-800 mb-1">Ghi chú phản hồi đến nhân viên</label>
              <textarea
                rows={3}
                value={timeOffReviewForm.reviewNote}
                onChange={(e) => setTimeOffReviewForm({ ...timeOffReviewForm, reviewNote: e.target.value })}
                placeholder="Nhập ghi chú phản hồi..."
                className="w-full p-2.5 rounded-lg border border-stone-300"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setTimeOffReviewItem(null)}
                className="px-3.5 py-2 rounded-lg bg-stone-100 text-stone-700 font-semibold"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleConfirmTimeOffReview}
                disabled={actionLoading}
                className={clsx(
                  'px-4 py-2 rounded-lg text-white font-semibold',
                  timeOffReviewForm.status === 'approved'
                    ? 'bg-emerald-700 hover:bg-emerald-800'
                    : 'bg-red-700 hover:bg-red-800'
                )}
              >
                {actionLoading ? 'Đang xử lý...' : timeOffReviewForm.status === 'approved' ? 'Xác nhận duyệt' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
