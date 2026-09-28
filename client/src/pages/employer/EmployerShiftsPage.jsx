import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, Clock, CheckCircle, Plus, Users, MapPin, Check, X,
  AlertTriangle, ShieldCheck, DollarSign, ChevronLeft, ChevronRight,
  UserPlus, UserCheck, UserX, Search, RotateCcw, Sparkles, Building2,
  Briefcase, AlertCircle, ArrowRight, Send, Edit3, Trash2, Sun, Sunrise, Sunset, Moon, Phone
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import {
  getShifts,
  createShift,
  publishShifts,
  approveAttendance,
  markPayrollReady,
  markPaid,
  adjustShiftTime,
  disputeShift,
  cancelShift,
  getEmployments,
  getEmployerMyJobs,
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

function formatDateDisplayVN(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const weekdays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const weekday = weekdays[dateObj.getDay()];
  return `${weekday}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

function offsetDate(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  dateObj.setDate(dateObj.getDate() + days);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateWorkedMinutes(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let startTotal = sh * 60 + sm;
  let endTotal = eh * 60 + em;
  if (endTotal <= startTotal) {
    endTotal += 24 * 60; // Overnight shift
  }
  return Math.max(0, endTotal - startTotal);
}

function calculatePayAmount(wageRate, minutes) {
  const rate = Number(wageRate) || 25000;
  const hours = minutes / 60;
  return Math.round(rate * hours);
}

function getShiftPeriod(startTime) {
  if (!startTime) return 'morning';
  const hour = parseInt(startTime.split(':')[0], 10);
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  return 'evening';
}

function getShiftStatusMeta(status) {
  switch (status) {
    case 'draft':
      return { variant: 'default', label: 'Bản nháp' };
    case 'published':
      return { variant: 'info', label: 'Đã công bố' };
    case 'acknowledged':
      return { variant: 'success', label: 'Đã xác nhận' };
    case 'checked_in':
      return { variant: 'success', label: 'Đang làm việc' };
    case 'checked_out':
      return { variant: 'warning', label: 'Đã tan ca' };
    case 'completed_pending_review':
    case 'pending_approval':
      return { variant: 'warning', label: 'Chờ duyệt công' };
    case 'approved':
      return { variant: 'success', label: 'Đã duyệt công' };
    case 'payroll_ready':
      return { variant: 'info', label: 'Sẵn sàng trả lương' };
    case 'paid':
      return { variant: 'success', label: 'Đã trả lương' };
    case 'disputed':
      return { variant: 'danger', label: 'Đang khiếu nại' };
    case 'cancelled':
      return { variant: 'danger', label: 'Đã hủy' };
    case 'no_show':
      return { variant: 'danger', label: 'Vắng mặt' };
    default:
      return { variant: 'info', label: 'Đã xếp ca' };
  }
}

export default function EmployerShiftsPage() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [shifts, setShifts] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [employments, setEmployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // Filter states
  const [filterJobId, setFilterJobId] = useState('all');

  // Modal assign employee to shift
  const [assignShiftModal, setAssignShiftModal] = useState(null);
  const [candidateSearch, setCandidateSearch] = useState('');

  // Adjust time modal
  const [adjustModalShift, setAdjustModalShift] = useState(null);
  const [adjustedMinutes, setAdjustedMinutes] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');

  // Cancel shift modal
  const [cancelModalShift, setCancelModalShift] = useState(null);
  const [cancelReasonText, setCancelReasonText] = useState('');

  // Dispute modal
  const [disputeModalShift, setDisputeModalShift] = useState(null);
  const [disputeReason, setDisputeReason] = useState('');

  useEffect(() => {
    loadData();
  }, [user]);

  async function loadData() {
    try {
      setLoading(true);
      const [shiftData, myJobsData, empData] = await Promise.all([
        getShifts({ storeId: user?.id, storeName: user?.name, employerId: user?.id }),
        getEmployerMyJobs().catch(() => []),
        getEmployments({ employerId: user?.id, status: 'active' }).catch(() => []),
      ]);

      setShifts(Array.isArray(shiftData) ? shiftData : []);

      const jobList = Array.isArray(myJobsData) ? myJobsData : (myJobsData?.items || myJobsData?.jobs || []);
      setJobs(jobList);

      const empList = Array.isArray(empData) ? empData : [];
      setEmployments(empList);
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: 'Không thể tải dữ liệu ca làm việc.' });
    } finally {
      setLoading(false);
    }
  }

  // Active employees eligible for shift assignment
  const activeEmployees = useMemo(() => {
    return employments.filter((e) => ['active', 'onboarding'].includes(e.status));
  }, [employments]);

  // Active shifts for selected date
  const shiftsForDate = useMemo(() => {
    return shifts.filter((s) => {
      if (s.date !== selectedDate || s.status === 'cancelled') return false;
      if (filterJobId !== 'all') {
        const sJobId = s.jobId?._id || s.jobId;
        if (String(sJobId) !== String(filterJobId)) return false;
      }
      return true;
    });
  }, [shifts, selectedDate, filterJobId]);

  // Draft shifts count for selected date
  const draftShiftsForDate = useMemo(() => {
    return shiftsForDate.filter((s) => s.status === 'draft');
  }, [shiftsForDate]);

  // Pending approval count
  const pendingApprovalCount = useMemo(() => {
    return shiftsForDate.filter((s) => ['completed_pending_review', 'pending_approval'].includes(s.status)).length;
  }, [shiftsForDate]);

  // Group shifts into 3 shifts: Morning, Afternoon, Evening
  const morningShifts = useMemo(() => {
    return shiftsForDate.filter((s) => getShiftPeriod(s.startTime) === 'morning');
  }, [shiftsForDate]);

  const afternoonShifts = useMemo(() => {
    return shiftsForDate.filter((s) => getShiftPeriod(s.startTime) === 'afternoon');
  }, [shiftsForDate]);

  const eveningShifts = useMemo(() => {
    return shiftsForDate.filter((s) => getShiftPeriod(s.startTime) === 'evening');
  }, [shiftsForDate]);

  const isToday = selectedDate === getTodayString();

  // Action: Open Assign Modal for Period
  function handleOpenAssignModal(period) {
    let defaultStart = '07:00';
    let defaultEnd = '12:00';
    let periodTitle = 'Ca Sáng';

    if (period === 'afternoon') {
      defaultStart = '12:00';
      defaultEnd = '17:00';
      periodTitle = 'Ca Chiều';
    } else if (period === 'evening') {
      defaultStart = '17:00';
      defaultEnd = '22:00';
      periodTitle = 'Ca Tối';
    }

    const defaultJob = jobs[0];
    const defaultRole = defaultJob?.positions?.[0]?.title || defaultJob?.title || 'Nhân viên';
    const defaultWage = defaultJob?.salaryAmount || 25000;

    setAssignShiftModal({
      period,
      periodTitle,
      startTime: defaultStart,
      endTime: defaultEnd,
      jobId: defaultJob?._id || defaultJob?.id || '',
      role: defaultRole,
      wageRate: defaultWage,
      studentUserId: '',
      isDraft: false,
    });
    setCandidateSearch('');
  }

  // Action: Confirm Assign Employee
  async function handleConfirmAssign(employee) {
    if (!assignShiftModal) return;

    try {
      setSubmitting(true);
      const sId = employee.employeeUserId?._id || employee.employeeUserId || employee.id;
      const sName = employee.studentName || employee.employeeUserId?.name || 'Nhân viên';

      const selectedJob = jobs.find((j) => (j._id || j.id) === assignShiftModal.jobId) || jobs[0];

      const newShift = await createShift({
        jobId: assignShiftModal.jobId || selectedJob?._id || selectedJob?.id,
        studentUserId: sId,
        studentName: sName,
        date: selectedDate,
        startTime: assignShiftModal.startTime,
        endTime: assignShiftModal.endTime,
        role: assignShiftModal.role || employee.positionTitle || 'Nhân viên',
        wageRate: Number(assignShiftModal.wageRate) || selectedJob?.salaryAmount || 25000,
        storeName: selectedJob?.storeName || 'Cửa hàng',
        isDraft: assignShiftModal.isDraft,
      });

      setShifts((prev) => [newShift.shift || newShift, ...prev]);
      setToast({
        type: 'success',
        message: `Đã phân công ${sName} vào ${assignShiftModal.periodTitle} (${assignShiftModal.startTime} - ${assignShiftModal.endTime}) thành công!`,
      });
      setAssignShiftModal(null);
      setCandidateSearch('');
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi phân ca cho nhân viên.' });
    } finally {
      setSubmitting(false);
    }
  }

  // Action: Publish all draft shifts for today
  async function handlePublishDrafts() {
    if (draftShiftsForDate.length === 0) return;
    try {
      setSubmitting(true);
      const shiftIds = draftShiftsForDate.map((s) => s._id || s.id);
      const res = await publishShifts(shiftIds);

      setShifts((prev) =>
        prev.map((s) => (shiftIds.includes(s._id || s.id) ? { ...s, status: 'published' } : s))
      );

      setToast({
        type: 'success',
        message: `🎉 Đã công bố ${res.publishedCount} ca làm việc! Nhân viên đã nhận được thông báo để xác nhận lịch.`,
      });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi công bố lịch.' });
    } finally {
      setSubmitting(false);
    }
  }

  // Action: Approve attendance
  async function handleApprove(shift) {
    const shiftId = shift._id || shift.id;
    try {
      setSubmitting(true);
      await approveAttendance(shiftId);
      setShifts((prev) =>
        prev.map((s) => ((s._id === shiftId || s.id === shiftId) ? { ...s, status: 'approved' } : s))
      );
      setToast({
        type: 'success',
        message: `Đã xác nhận duyệt công thành công cho ca ngày ${shift.date} (${shift.studentName})!`,
      });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi duyệt công.' });
    } finally {
      setSubmitting(false);
    }
  }

  // Action: Mark Payroll Ready
  async function handleMarkPayrollReady(shift) {
    const shiftId = shift._id || shift.id;
    try {
      setSubmitting(true);
      await markPayrollReady(shiftId);
      setShifts((prev) =>
        prev.map((s) => ((s._id === shiftId || s.id === shiftId) ? { ...s, status: 'payroll_ready' } : s))
      );
      setToast({ type: 'success', message: 'Đã chuyển ca sang trạng thái sẵn sàng tính lương.' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi xử lý bảng lương.' });
    } finally {
      setSubmitting(false);
    }
  }

  // Action: Mark Paid
  async function handleMarkPaid(shift) {
    const shiftId = shift._id || shift.id;
    try {
      setSubmitting(true);
      await markPaid(shiftId);
      setShifts((prev) =>
        prev.map((s) => ((s._id === shiftId || s.id === shiftId) ? { ...s, status: 'paid' } : s))
      );
      setToast({ type: 'success', message: 'Đã xác nhận hoàn tất chi trả tiền lương cho ca làm.' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi đánh dấu chi trả.' });
    } finally {
      setSubmitting(false);
    }
  }

  // Action: Cancel shift
  async function handleConfirmCancelShift() {
    if (!cancelModalShift) return;
    const shiftId = cancelModalShift._id || cancelModalShift.id;
    try {
      setSubmitting(true);
      await cancelShift(shiftId, cancelReasonText || 'Quản lý hủy ca làm việc');
      setShifts((prev) =>
        prev.map((s) =>
          (s._id === shiftId || s.id === shiftId)
            ? { ...s, status: 'cancelled', cancelReason: cancelReasonText }
            : s
        )
      );
      setToast({ type: 'success', message: 'Đã hủy ca làm việc thành công.' });
      setCancelModalShift(null);
      setCancelReasonText('');
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi hủy ca làm việc.' });
    } finally {
      setSubmitting(false);
    }
  }

  // Action: Adjust time
  async function handleConfirmAdjustTime() {
    if (!adjustModalShift) return;
    const shiftId = adjustModalShift._id || adjustModalShift.id;
    try {
      setSubmitting(true);
      const res = await adjustShiftTime(shiftId, Number(adjustedMinutes), adjustReason);
      setShifts((prev) =>
        prev.map((s) => ((s._id === shiftId || s.id === shiftId) ? { ...s, ...res.shift } : s))
      );
      setToast({ type: 'success', message: 'Đã điều chỉnh giờ công làm việc thành công!' });
      setAdjustModalShift(null);
      setAdjustReason('');
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi điều chỉnh giờ công.' });
    } finally {
      setSubmitting(false);
    }
  }

  // Sub-component: Render Shift Card
  function renderShiftCard(shift) {
    const sId = shift._id || shift.id;
    const meta = getShiftStatusMeta(shift.status);
    const workedMins = shift.actualMinutesWorked || calculateWorkedMinutes(shift.startTime, shift.endTime);
    const payAmount = calculatePayAmount(shift.wageRate, workedMins);

    return (
      <div
        key={sId}
        className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs hover:shadow-md transition-all space-y-3"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
              {shift.studentName ? shift.studentName.charAt(0).toUpperCase() : 'N'}
            </div>
            <div>
              <h4 className="font-bold text-sm text-gray-900 leading-tight">
                {shift.studentName || 'Nhân viên'}
              </h4>
              <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1 font-medium">
                <Briefcase className="w-3 h-3 text-gray-400" />
                <span className="font-semibold text-gray-700">{shift.role || 'Nhân viên'}</span>
                {shift.storeName && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span className="text-gray-500">{shift.storeName}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>

        {/* TIME & SALARY INFO */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/80 border border-gray-100 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-gray-800">
            <Clock className="w-3.5 h-3.5 text-gray-500" />
            <span>{shift.startTime} - {shift.endTime}</span>
            <span className="text-gray-400 font-normal">({workedMins} phút)</span>
          </div>

          <div className="text-right">
            <span className="text-green-700 font-bold">{payAmount.toLocaleString('vi-VN')} đ</span>
            <span className="text-[11px] text-gray-500 block">({Number(shift.wageRate || 25000).toLocaleString('vi-VN')} đ/h)</span>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setAdjustModalShift(shift);
                setAdjustedMinutes(workedMins);
                setAdjustReason('');
              }}
              className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-[11px] transition-colors"
              title="Chỉnh sửa giờ công thực tế"
            >
              <Edit3 className="w-3 h-3 inline mr-1" /> Chỉnh công
            </button>

            {['published', 'draft', 'acknowledged'].includes(shift.status) && (
              <button
                type="button"
                onClick={() => setCancelModalShift(shift)}
                className="px-2 py-1 rounded-lg text-red-600 hover:bg-red-50 font-bold text-[11px] transition-colors"
                title="Hủy ca làm này"
              >
                <Trash2 className="w-3 h-3 inline mr-1" /> Hủy ca
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {shift.status === 'draft' && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    setSubmitting(true);
                    await publishShifts([sId]);
                    setShifts((prev) =>
                      prev.map((s) => (s._id === sId || s.id === sId ? { ...s, status: 'published' } : s))
                    );
                    setToast({ type: 'success', message: 'Đã công bố ca làm việc!' });
                  } catch (err) {
                    setToast({ type: 'error', message: err.message || 'Lỗi khi công bố ca.' });
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-colors"
              >
                <Send className="w-3 h-3" /> Công bố ca
              </button>
            )}

            {['completed_pending_review', 'pending_approval'].includes(shift.status) && (
              <button
                type="button"
                onClick={() => handleApprove(shift)}
                disabled={submitting}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-green-main hover:bg-green-dark text-white font-bold text-xs shadow-xs transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Duyệt công
              </button>
            )}

            {shift.status === 'approved' && (
              <button
                type="button"
                onClick={() => handleMarkPayrollReady(shift)}
                disabled={submitting}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-colors"
              >
                <DollarSign className="w-3.5 h-3.5" /> Sẵn sàng trả lương
              </button>
            )}

            {shift.status === 'payroll_ready' && (
              <button
                type="button"
                onClick={() => handleMarkPaid(shift)}
                disabled={submitting}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
              >
                <Check className="w-3.5 h-3.5" /> Đã trả lương
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-12">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* HEADER & CONTROLS */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-card space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text-main flex items-center gap-2">
              <Calendar className="w-6 h-6 text-green-dark" /> Quản lý Ca Làm & Xếp Lịch
            </h1>
            <p className="text-xs text-text-muted mt-1">
              Phân ca Sáng - Chiều - Tối cho nhân viên chính thức, tự động kiểm tra trùng lịch và duyệt công chi trả lương.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
            {draftShiftsForDate.length > 0 && (
              <button
                type="button"
                onClick={handlePublishDrafts}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" /> Công bố {draftShiftsForDate.length} ca nháp trong ngày
              </button>
            )}

            {jobs.length > 1 && (
              <div className="flex items-center gap-1.5">
                <select
                  value={filterJobId}
                  onChange={(e) => setFilterJobId(e.target.value)}
                  className="p-2 rounded-2xl border border-gray-200 bg-white text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-main"
                >
                  <option value="all">Tất cả việc làm ({jobs.length})</option>
                  {jobs.map((j) => (
                    <option key={j._id || j.id} value={j._id || j.id}>
                      {j.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* DATE NAVIGATOR BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedDate((prev) => offsetDate(prev, -1))}
              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors"
              title="Ngày hôm trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-green-50 border border-green-200 text-green-900 font-bold text-xs sm:text-sm">
              <Calendar className="w-4 h-4 text-green-main" />
              <span>{formatDateDisplayVN(selectedDate)}</span>
              {isToday && (
                <span className="px-1.5 py-0.5 rounded-md bg-green-600 text-white text-[10px] font-black uppercase tracking-wider">
                  Hôm nay
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedDate((prev) => offsetDate(prev, 1))}
              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors"
              title="Ngày tiếp theo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {!isToday && (
              <button
                type="button"
                onClick={() => setSelectedDate(getTodayString())}
                className="px-2.5 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-600 transition-colors"
              >
                Về hôm nay
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="p-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-main"
            />
          </div>
        </div>

        {/* QUICK STATS FOR 3 SHIFTS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/60">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800">
              <Sunrise className="w-3.5 h-3.5 text-amber-600" /> Ca Sáng
            </div>
            <p className="text-xl font-black text-amber-950 mt-1">
              {morningShifts.length} <span className="text-xs font-normal text-amber-700">nhân viên</span>
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-sky-50/60 border border-sky-200/60">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-800">
              <Sun className="w-3.5 h-3.5 text-sky-600" /> Ca Chiều
            </div>
            <p className="text-xl font-black text-sky-950 mt-1">
              {afternoonShifts.length} <span className="text-xs font-normal text-sky-700">nhân viên</span>
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200/60">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-800">
              <Moon className="w-3.5 h-3.5 text-indigo-600" /> Ca Tối
            </div>
            <p className="text-xl font-black text-indigo-950 mt-1">
              {eveningShifts.length} <span className="text-xs font-normal text-indigo-700">nhân viên</span>
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-purple-50/60 border border-purple-200/60">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-800">
              <CheckCircle className="w-3.5 h-3.5 text-purple-600" /> Chờ duyệt công
            </div>
            <p className="text-xl font-black text-purple-950 mt-1">
              {pendingApprovalCount} <span className="text-xs font-normal text-purple-700">ca</span>
            </p>
          </div>
        </div>
      </div>

      {/* 3 SHIFT SECTIONS: MORNING, AFTERNOON, EVENING */}
      {loading ? (
        <div className="text-center py-16 text-text-muted">Đang tải danh sách ca làm việc...</div>
      ) : (
        <div className="space-y-6">
          {/* SECTION 1: CA SÁNG */}
          <div className="bg-white rounded-3xl border border-amber-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Sunrise className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    Ca Sáng
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold text-xs border border-amber-200">
                      07:00 - 12:00
                    </span>
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Hiện có <strong className="text-amber-900 font-bold">{morningShifts.length}</strong> nhân viên làm việc ca sáng
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleOpenAssignModal('morning')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
              >
                <UserPlus className="w-4 h-4" /> + Gán nhân viên vào Ca Sáng
              </button>
            </div>

            {morningShifts.length === 0 ? (
              <div className="p-6 rounded-2xl bg-amber-50/30 border border-dashed border-amber-200 text-center space-y-2">
                <p className="text-xs font-semibold text-amber-900">Chưa có nhân viên nào trong ca sáng</p>
                <p className="text-[11px] text-gray-500">Bấm nút trên để chọn nhân viên trúng tuyển vào ca làm này.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {morningShifts.map((s) => renderShiftCard(s))}
              </div>
            )}
          </div>

          {/* SECTION 2: CA CHIỀU */}
          <div className="bg-white rounded-3xl border border-sky-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sky-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                  <Sun className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    Ca Chiều
                    <span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-800 font-bold text-xs border border-sky-200">
                      12:00 - 17:00
                    </span>
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Hiện có <strong className="text-sky-900 font-bold">{afternoonShifts.length}</strong> nhân viên làm việc ca chiều
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleOpenAssignModal('afternoon')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
              >
                <UserPlus className="w-4 h-4" /> + Gán nhân viên vào Ca Chiều
              </button>
            </div>

            {afternoonShifts.length === 0 ? (
              <div className="p-6 rounded-2xl bg-sky-50/30 border border-dashed border-sky-200 text-center space-y-2">
                <p className="text-xs font-semibold text-sky-900">Chưa có nhân viên nào trong ca chiều</p>
                <p className="text-[11px] text-gray-500">Bấm nút trên để chọn nhân viên trúng tuyển vào ca làm này.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {afternoonShifts.map((s) => renderShiftCard(s))}
              </div>
            )}
          </div>

          {/* SECTION 3: CA TỐI */}
          <div className="bg-white rounded-3xl border border-indigo-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <Moon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    Ca Tối
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 font-bold text-xs border border-indigo-200">
                      17:00 - 22:00
                    </span>
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Hiện có <strong className="text-indigo-900 font-bold">{eveningShifts.length}</strong> nhân viên làm việc ca tối
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleOpenAssignModal('evening')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
              >
                <UserPlus className="w-4 h-4" /> + Gán nhân viên vào Ca Tối
              </button>
            </div>

            {eveningShifts.length === 0 ? (
              <div className="p-6 rounded-2xl bg-indigo-50/30 border border-dashed border-indigo-200 text-center space-y-2">
                <p className="text-xs font-semibold text-indigo-900">Chưa có nhân viên nào trong ca tối</p>
                <p className="text-[11px] text-gray-500">Bấm nút trên để chọn nhân viên trúng tuyển vào ca làm này.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {eveningShifts.map((s) => renderShiftCard(s))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ASSIGN EMPLOYEE MODAL */}
      {assignShiftModal && (
        <Modal
          isOpen={true}
          onClose={() => { setAssignShiftModal(null); setCandidateSearch(''); }}
          title={`Gán nhân viên vào ${assignShiftModal.periodTitle}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-green-50/80 border border-green-200 rounded-2xl space-y-1">
              <p className="font-bold text-green-950 text-sm">
                Ngày làm: {formatDateDisplayVN(selectedDate)}
              </p>
              <p className="text-green-800 text-xs">
                Chọn nhân viên chính thức để phân công vào <strong>{assignShiftModal.periodTitle}</strong>.
              </p>
            </div>

            {/* TIME SETTINGS */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-200">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Giờ bắt đầu</label>
                <input
                  type="time"
                  value={assignShiftModal.startTime}
                  onChange={(e) => setAssignShiftModal((prev) => ({ ...prev, startTime: e.target.value }))}
                  className="w-full p-2 rounded-xl border border-gray-200 font-semibold bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Giờ kết thúc</label>
                <input
                  type="time"
                  value={assignShiftModal.endTime}
                  onChange={(e) => setAssignShiftModal((prev) => ({ ...prev, endTime: e.target.value }))}
                  className="w-full p-2 rounded-xl border border-gray-200 font-semibold bg-white"
                />
              </div>
            </div>

            {/* JOB & ROLE & WAGE SETTINGS */}
            <div className="space-y-3">
              {jobs.length > 1 && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Việc làm / Cửa hàng</label>
                  <select
                    value={assignShiftModal.jobId}
                    onChange={(e) => {
                      const jId = e.target.value;
                      const selectedJob = jobs.find((j) => (j._id || j.id) === jId);
                      setAssignShiftModal((prev) => ({
                        ...prev,
                        jobId: jId,
                        wageRate: selectedJob?.salaryAmount || prev.wageRate,
                        role: selectedJob?.positions?.[0]?.title || selectedJob?.title || prev.role,
                      }));
                    }}
                    className="w-full p-2 rounded-xl border border-gray-200 font-semibold bg-white"
                  >
                    {jobs.map((j) => (
                      <option key={j._id || j.id} value={j._id || j.id}>
                        {j.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Vị trí / Chức danh</label>
                  <input
                    type="text"
                    value={assignShiftModal.role}
                    onChange={(e) => setAssignShiftModal((prev) => ({ ...prev, role: e.target.value }))}
                    placeholder="Thu ngân, Pha chế..."
                    className="w-full p-2 rounded-xl border border-gray-200 font-semibold bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Lương (đ/giờ)</label>
                  <input
                    type="number"
                    value={assignShiftModal.wageRate}
                    onChange={(e) => setAssignShiftModal((prev) => ({ ...prev, wageRate: e.target.value }))}
                    className="w-full p-2 rounded-xl border border-gray-200 font-semibold bg-white"
                  />
                </div>
              </div>

              {/* DRAFT VS PUBLISH */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="draftModeCheck"
                  checked={assignShiftModal.isDraft}
                  onChange={(e) => setAssignShiftModal((prev) => ({ ...prev, isDraft: e.target.checked }))}
                  className="rounded text-green-main focus:ring-green-main"
                />
                <label htmlFor="draftModeCheck" className="text-xs text-gray-700 font-medium cursor-pointer">
                  Lưu nháp (chưa công bố cho nhân viên)
                </label>
              </div>
            </div>

            {/* EMPLOYEE SEARCH & LIST */}
            <div className="pt-2 border-t border-gray-100 space-y-2">
              <label className="block text-xs font-bold text-gray-800">
                Chọn nhân viên từ danh sách đã trúng tuyển:
              </label>

              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  placeholder="Tìm nhân viên theo tên, SĐT..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 font-semibold"
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {activeEmployees.length === 0 ? (
                  <p className="text-gray-500 text-center py-6">
                    Quán chưa có nhân viên chính thức nào. Hãy duyệt ứng viên thành nhân viên trước.
                  </p>
                ) : (
                  activeEmployees
                    .filter((emp) => {
                      const q = candidateSearch.trim().toLowerCase();
                      if (!q) return true;
                      const name = (emp.studentName || emp.employeeUserId?.name || '').toLowerCase();
                      const phone = (emp.employeeUserId?.phone || '').toLowerCase();
                      const role = (emp.positionTitle || '').toLowerCase();
                      return name.includes(q) || phone.includes(q) || role.includes(q);
                    })
                    .map((emp) => {
                      const empId = emp._id || emp.id;
                      const name = emp.studentName || emp.employeeUserId?.name || 'Nhân viên';
                      const phone = emp.employeeUserId?.phone || 'Chưa cập nhật SĐT';
                      const pos = emp.positionTitle || 'Nhân viên';

                      // Check if already has a shift on this date
                      const hasShiftToday = shifts.some((s) => {
                        const sStudentId = s.studentUserId?._id || s.studentUserId;
                        const targetId = emp.employeeUserId?._id || emp.employeeUserId || emp.id;
                        return String(sStudentId) === String(targetId) && s.date === selectedDate && s.status !== 'cancelled';
                      });

                      return (
                        <div
                          key={empId}
                          className="p-3 rounded-2xl border border-gray-100 hover:border-green-300 hover:bg-green-50/30 transition-all flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-green-100 text-green-800 font-black text-xs flex items-center justify-center shrink-0">
                              {name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 leading-tight flex items-center gap-1.5">
                                {name}
                                {hasShiftToday && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                                    Đã có ca hôm nay
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2">
                                <span>{pos}</span>
                                <span>•</span>
                                <span className="flex items-center gap-0.5">
                                  <Phone className="w-3 h-3 text-gray-400" /> {phone}
                                </span>
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleConfirmAssign(emp)}
                            disabled={submitting}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-green-main hover:bg-green-dark text-white font-bold text-xs shadow-xs transition-colors shrink-0 cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" /> Gán vào ca
                          </button>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setAssignShiftModal(null)}
                className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 font-bold text-xs transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ADJUST TIME MODAL */}
      {adjustModalShift && (
        <Modal
          isOpen={true}
          onClose={() => setAdjustModalShift(null)}
          title="Điều chỉnh số phút làm việc thực tế"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200">
              <p className="font-bold text-amber-900">
                Nhân viên: {adjustModalShift.studentName} ({adjustModalShift.role})
              </p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Ca: {adjustModalShift.startTime} - {adjustModalShift.endTime} (Ngày {adjustModalShift.date})
              </p>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Số phút thực tế làm việc
              </label>
              <input
                type="number"
                min="0"
                max="1440"
                value={adjustedMinutes}
                onChange={(e) => setAdjustedMinutes(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-gray-200 font-bold text-sm"
              />
              <p className="text-[11px] text-text-muted mt-1">
                Tương đương: <strong>{(Number(adjustedMinutes) / 60).toFixed(2)} giờ</strong> •
                Tổng tiền: <strong>{calculatePayAmount(adjustModalShift.wageRate, Number(adjustedMinutes)).toLocaleString('vi-VN')} VNĐ</strong>
              </p>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Lý do điều chỉnh (bắt buộc để lưu audit log)
              </label>
              <textarea
                rows={2}
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Ví dụ: Đi muộn 15 phút, làm thêm giờ theo yêu cầu cửa hàng..."
                className="w-full p-2.5 rounded-xl border border-gray-200"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAdjustModalShift(null)}
                className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 font-bold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmAdjustTime}
                disabled={submitting || !adjustReason.trim()}
                className="px-4 py-2 rounded-xl bg-green-main hover:bg-green-dark text-white font-bold shadow-xs transition-colors disabled:opacity-50"
              >
                Lưu điều chỉnh
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* CANCEL SHIFT MODAL */}
      {cancelModalShift && (
        <Modal
          isOpen={true}
          onClose={() => setCancelModalShift(null)}
          title="Xác nhận hủy ca làm việc"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-red-50 rounded-2xl border border-red-200 text-red-900">
              <p className="font-bold">
                Bạn sắp hủy ca làm của {cancelModalShift.studentName}
              </p>
              <p className="text-[11px] mt-0.5">
                Ngày: {cancelModalShift.date} ({cancelModalShift.startTime} - {cancelModalShift.endTime})
              </p>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Lý do hủy ca (thông báo đến nhân viên)
              </label>
              <textarea
                rows={3}
                value={cancelReasonText}
                onChange={(e) => setCancelReasonText(e.target.value)}
                placeholder="Ví dụ: Quán nghỉ sửa chữa điện, thừa nhân sự ca này..."
                className="w-full p-2.5 rounded-xl border border-gray-200"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalShift(null)}
                className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 font-bold"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelShift}
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-xs transition-colors"
              >
                Xác nhận hủy ca
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
