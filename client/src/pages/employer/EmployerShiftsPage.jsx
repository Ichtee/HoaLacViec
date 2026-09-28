import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, Clock, CheckCircle, Plus, Users, MapPin, Check, X,
  Navigation, AlertTriangle, ShieldCheck, DollarSign, ChevronLeft,
  ChevronRight, UserPlus, UserCheck, UserX, Search, RotateCcw,
  Sparkles, Building2, Briefcase, AlertCircle, ArrowRight, Send, Edit3, Trash2
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

function getDayOfWeek(dateStr) {
  if (!dateStr) return 0;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
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

function parseShiftTimes(shiftStr) {
  if (!shiftStr) return { startTime: '08:00', endTime: '12:00' };

  const matchColon = shiftStr.match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);
  if (matchColon) {
    const formatTime = (t) => (t.length === 4 ? `0${t}` : t);
    return {
      startTime: formatTime(matchColon[1]),
      endTime: formatTime(matchColon[2]),
    };
  }

  const matchH = shiftStr.match(/(\d{1,2})h(?:(\d{2}))?\s*[-–—]\s*(\d{1,2})h(?:(\d{2}))?/i);
  if (matchH) {
    const sh = matchH[1].padStart(2, '0');
    const sm = matchH[2] || '00';
    const eh = matchH[3].padStart(2, '0');
    const em = matchH[4] || '00';
    return {
      startTime: `${sh}:${sm}`,
      endTime: `${eh}:${em}`,
    };
  }

  const lower = shiftStr.toLowerCase();
  if (lower.includes('sáng')) return { startTime: '07:00', endTime: '12:00' };
  if (lower.includes('chiều')) return { startTime: '12:00', endTime: '17:00' };
  if (lower.includes('tối')) return { startTime: '17:00', endTime: '22:00' };
  if (lower.includes('đêm')) return { startTime: '22:00', endTime: '06:00' };
  if (lower.includes('full')) return { startTime: '08:00', endTime: '17:00' };

  return { startTime: '08:00', endTime: '12:00' };
}

function getShiftBadge(status) {
  switch (status) {
    case 'paid':
      return { variant: 'success', label: 'Đã chi trả lương 💵' };
    case 'payroll_ready':
      return { variant: 'purple', label: 'Sẵn sàng tính lương 💰' };
    case 'approved':
    case 'completed':
      return { variant: 'success', label: 'Đã duyệt công ✅' };
    case 'completed_pending_review':
    case 'pending_approval':
      return { variant: 'purple', label: 'Chờ duyệt công ⏳' };
    case 'checked_in':
      return { variant: 'warning', label: 'Đang làm việc ⏱️' };
    case 'acknowledged':
      return { variant: 'info', label: 'SV đã xác nhận lịch 🤝' };
    case 'published':
      return { variant: 'info', label: 'Đã công bố lịch 📢' };
    case 'draft':
      return { variant: 'neutral', label: 'Lịch nháp 📝' };
    case 'disputed':
      return { variant: 'danger', label: 'Cần đối soát ⚠️' };
    case 'cancelled':
      return { variant: 'neutral', label: 'Đã hủy' };
    case 'scheduled':
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
  const [filterStatus, setFilterStatus] = useState('all');

  // Modals
  const [assignModalSlot, setAssignModalSlot] = useState(null);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [disputeModalShift, setDisputeModalShift] = useState(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [isAdHocModalOpen, setIsAdHocModalOpen] = useState(false);

  // Adjust time modal
  const [adjustModalShift, setAdjustModalShift] = useState(null);
  const [adjustedMinutes, setAdjustedMinutes] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');

  // Cancel shift modal
  const [cancelModalShift, setCancelModalShift] = useState(null);
  const [cancelReasonText, setCancelReasonText] = useState('');

  // Ad-hoc form state
  const [adHocForm, setAdHocForm] = useState({
    jobId: '',
    role: '',
    date: getTodayString(),
    startTime: '08:00',
    endTime: '12:00',
    wageRate: 25000,
    studentUserId: '',
    isDraft: false,
  });

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

      if (jobList.length > 0 && !adHocForm.jobId) {
        setAdHocForm((prev) => ({
          ...prev,
          jobId: jobList[0]._id || jobList[0].id,
          wageRate: jobList[0].salaryAmount || 25000,
        }));
      }
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

  // Draft shifts count for selected date
  const draftShiftsForDate = useMemo(() => {
    return shifts.filter((s) => s.date === selectedDate && s.status === 'draft');
  }, [shifts, selectedDate]);

  // Generate slots for the selected date
  const dailySlots = useMemo(() => {
    // Current weekday of selected date: 0=Sun, 1=Mon, ..., 6=Sat
    const currentWeekday = getDayOfWeek(selectedDate);
    const shiftsForDate = shifts.filter((s) => s.date === selectedDate && s.status !== 'cancelled');
    const unmatchedShifts = [...shiftsForDate];
    const slots = [];

    // Jobs keep their shift requirements even if filled
    jobs.forEach((job) => {
      const jId = job._id || job.id;

      // Filter schedule for current weekday if schedule is configured
      let hasWeekdayMatch = true;
      if (Array.isArray(job.schedule) && job.schedule.length > 0) {
        // schedule.dayOfWeek can be 1=Mon..7=Sun or 0=Sun..6=Sat
        const mappedDays = job.schedule.map((sc) => sc.dayOfWeek % 7);
        hasWeekdayMatch = mappedDays.includes(currentWeekday);
      }

      if (!hasWeekdayMatch) return;

      const positions = Array.isArray(job.positions) && job.positions.length > 0
        ? job.positions
        : [{ title: job.title || 'Nhân viên bán ca', shift: job.shiftDetail || 'Ca làm việc', quantity: job.slots || 1 }];

      positions.forEach((pos, pIdx) => {
        const qty = Number(pos.quantity) > 0 ? Number(pos.quantity) : 1;
        const times = parseShiftTimes(pos.shift);

        for (let i = 0; i < qty; i++) {
          const slotKey = `${jId}_p${pIdx}_s${i}`;

          const matchIndex = unmatchedShifts.findIndex((s) => {
            const sJobId = s.jobId?._id || s.jobId;
            if (String(sJobId) !== String(jId)) return false;
            const roleMatch = s.role && pos.title && s.role.trim().toLowerCase() === pos.title.trim().toLowerCase();
            const timeMatch = s.startTime === times.startTime && s.endTime === times.endTime;
            return roleMatch || timeMatch;
          });

          let assignedShift = null;
          if (matchIndex !== -1) {
            assignedShift = unmatchedShifts[matchIndex];
            unmatchedShifts.splice(matchIndex, 1);
          } else {
            const jobMatchIndex = unmatchedShifts.findIndex((s) => {
              const sJobId = s.jobId?._id || s.jobId;
              return String(sJobId) === String(jId);
            });
            if (jobMatchIndex !== -1) {
              assignedShift = unmatchedShifts[jobMatchIndex];
              unmatchedShifts.splice(jobMatchIndex, 1);
            }
          }

          slots.push({
            id: slotKey,
            jobId: jId,
            jobTitle: job.title,
            storeName: job.storeName || job.title || 'Cửa hàng',
            role: pos.title,
            shiftName: pos.shift,
            quantity: qty,
            slotNumber: i + 1,
            wageRate: job.salaryAmount || 25000,
            startTime: times.startTime,
            endTime: times.endTime,
            assignedShift,
            isAdHoc: false,
          });
        }
      });
    });

    // Append extra shifts in DB
    unmatchedShifts.forEach((s) => {
      slots.push({
        id: `extra_${s._id || s.id}`,
        jobId: s.jobId?._id || s.jobId,
        jobTitle: s.jobId?.title || s.storeName || 'Ca phát sinh',
        storeName: s.storeName || 'Cửa hàng',
        role: s.role || 'Nhân viên bán ca',
        shiftName: `${s.startTime} - ${s.endTime}`,
        quantity: 1,
        slotNumber: 1,
        wageRate: s.wageRate || 25000,
        startTime: s.startTime,
        endTime: s.endTime,
        assignedShift: s,
        isAdHoc: true,
      });
    });

    return slots;
  }, [jobs, shifts, selectedDate]);

  // Filtered slots
  const filteredSlots = useMemo(() => {
    return dailySlots.filter((slot) => {
      if (filterJobId !== 'all') {
        if (String(slot.jobId) !== String(filterJobId)) return false;
      }

      if (filterStatus === 'empty') return !slot.assignedShift;
      if (filterStatus === 'assigned') return Boolean(slot.assignedShift);
      if (filterStatus === 'pending') {
        const s = slot.assignedShift?.status;
        return s === 'completed_pending_review' || s === 'pending_approval';
      }
      if (filterStatus === 'draft') return slot.assignedShift?.status === 'draft';
      if (filterStatus === 'approved') return ['approved', 'payroll_ready', 'paid'].includes(slot.assignedShift?.status);

      return true;
    });
  }, [dailySlots, filterJobId, filterStatus]);

  // Stats
  const totalSlotsCount = dailySlots.length;
  const assignedSlotsCount = dailySlots.filter((s) => Boolean(s.assignedShift)).length;
  const emptySlotsCount = totalSlotsCount - assignedSlotsCount;
  const pendingApprovalCount = dailySlots.filter((s) => {
    const st = s.assignedShift?.status;
    return st === 'completed_pending_review' || st === 'pending_approval';
  }).length;

  const isToday = selectedDate === getTodayString();

  // Action: Assign active employee to slot
  async function handleAssignEmployee(employee) {
    if (!assignModalSlot) return;

    try {
      setSubmitting(true);
      const sId = employee.employeeUserId?._id || employee.employeeUserId || employee.id;
      const sName = employee.studentName || employee.employeeUserId?.name || 'Nhân viên';

      const newShift = await createShift({
        jobId: assignModalSlot.jobId,
        studentUserId: sId,
        studentName: sName,
        date: selectedDate,
        startTime: assignModalSlot.startTime,
        endTime: assignModalSlot.endTime,
        role: assignModalSlot.role,
        wageRate: assignModalSlot.wageRate,
        storeName: assignModalSlot.storeName,
        isDraft: false, // Published immediately
      });

      setShifts((prev) => [newShift.shift || newShift, ...prev]);
      setToast({
        type: 'success',
        message: `Đã phân công ${sName} vào ca ${assignModalSlot.startTime} - ${assignModalSlot.endTime} thành công!`,
      });
      setAssignModalSlot(null);
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
      const res = await approveAttendance(shiftId);
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
      await cancelShift(shiftId, cancelReasonText);
      setShifts((prev) =>
        prev.map((s) => ((s._id === shiftId || s.id === shiftId) ? { ...s, status: 'cancelled' } : s))
      );
      setToast({ type: 'info', message: 'Đã hủy ca làm việc.' });
      setCancelModalShift(null);
      setCancelReasonText('');
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi hủy ca.' });
    } finally {
      setSubmitting(false);
    }
  }

  // Action: Adjust worked minutes
  async function handleSaveAdjustTime() {
    if (!adjustModalShift) return;
    const shiftId = adjustModalShift._id || adjustModalShift.id;
    try {
      setSubmitting(true);
      const res = await adjustShiftTime(shiftId, {
        workedMinutes: Number(adjustedMinutes),
        reason: adjustReason,
      });
      setShifts((prev) =>
        prev.map((s) => ((s._id === shiftId || s.id === shiftId) ? res.shift : s))
      );
      setToast({ type: 'success', message: 'Đã cập nhật điều chỉnh giờ làm việc thành công.' });
      setAdjustModalShift(null);
      setAdjustReason('');
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi điều chỉnh công.' });
    } finally {
      setSubmitting(false);
    }
  }

  // Action: Create ad-hoc shift
  async function handleCreateAdHocShift(e) {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (!adHocForm.jobId) {
        setToast({ type: 'error', message: 'Vui lòng chọn việc làm / quán.' });
        return;
      }
      if (!adHocForm.studentUserId) {
        setToast({ type: 'error', message: 'Vui lòng chọn nhân viên chính thức để phân ca.' });
        return;
      }

      const selectedJob = jobs.find((j) => (j._id || j.id) === adHocForm.jobId);
      const selectedEmp = employments.find((emp) => {
        const sId = emp.employeeUserId?._id || emp.employeeUserId || emp.id;
        return String(sId) === String(adHocForm.studentUserId);
      });

      const newShift = await createShift({
        jobId: adHocForm.jobId,
        studentUserId: adHocForm.studentUserId,
        studentName: selectedEmp?.studentName || selectedEmp?.employeeUserId?.name || 'Nhân viên',
        date: adHocForm.date,
        startTime: adHocForm.startTime,
        endTime: adHocForm.endTime,
        role: adHocForm.role || selectedJob?.title || 'Ca phát sinh',
        wageRate: Number(adHocForm.wageRate) || selectedJob?.salaryAmount || 25000,
        storeName: selectedJob?.storeName || 'Cửa hàng tuyển dụng',
        isDraft: adHocForm.isDraft,
      });

      setShifts((prev) => [newShift.shift || newShift, ...prev]);
      setToast({
        type: 'success',
        message: adHocForm.isDraft ? 'Đã lưu ca nháp thành công!' : 'Tạo ca phát sinh và công bố lịch thành công!',
      });
      setIsAdHocModalOpen(false);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi tạo ca phát sinh.' });
    } finally {
      setSubmitting(false);
    }
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
              Phân ca cho nhân viên chính thức, kiểm tra xung đột trùng lịch, lập lịch nháp và duyệt công chi trả lương.
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
                <Send className="w-4 h-4" /> Công bố {draftShiftsForDate.length} ca nháp
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsAdHocModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-green-main hover:bg-green-dark text-white font-bold text-xs shadow-xs transition-colors shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> + Thêm ca phát sinh
            </button>
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
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-gray-500" /> Về hôm nay
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-text-muted font-medium flex items-center gap-1.5">
              <span>Chọn ngày:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="p-1.5 text-xs font-bold text-gray-800 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-main bg-white"
              />
            </label>
          </div>
        </div>

        {/* QUICK STATS CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 rounded-2xl bg-gray-50/80 border border-gray-100">
            <span className="text-[11px] font-semibold text-gray-500">Tổng ca ngày</span>
            <p className="text-lg font-black text-gray-900 mt-0.5">{totalSlotsCount} <span className="text-xs font-normal text-gray-500">ca</span></p>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100">
            <span className="text-[11px] font-semibold text-emerald-700">Đã gán nhân viên</span>
            <p className="text-lg font-black text-emerald-800 mt-0.5">{assignedSlotsCount} <span className="text-xs font-normal text-emerald-600">ca</span></p>
          </div>
          <div className={clsx(
            'p-3.5 rounded-2xl border',
            emptySlotsCount > 0 ? 'bg-amber-50/70 border-amber-200' : 'bg-gray-50/80 border-gray-100'
          )}>
            <span className={clsx('text-[11px] font-semibold', emptySlotsCount > 0 ? 'text-amber-800 font-bold' : 'text-gray-500')}>
              Còn trống
            </span>
            <p className={clsx('text-lg font-black mt-0.5', emptySlotsCount > 0 ? 'text-amber-900' : 'text-gray-900')}>
              {emptySlotsCount} <span className="text-xs font-normal text-gray-500">ca</span>
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-purple-50/60 border border-purple-100">
            <span className="text-[11px] font-semibold text-purple-700">Chờ duyệt công</span>
            <p className="text-lg font-black text-purple-900 mt-0.5">{pendingApprovalCount} <span className="text-xs font-normal text-purple-600">ca</span></p>
          </div>
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={clsx(
              'px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer',
              filterStatus === 'all' ? 'bg-green-main text-white shadow-xs' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            )}
          >
            Tất cả ({totalSlotsCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('empty')}
            className={clsx(
              'px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer',
              filterStatus === 'empty' ? 'bg-amber-500 text-white shadow-xs' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            )}
          >
            Chưa phân công ({emptySlotsCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('assigned')}
            className={clsx(
              'px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer',
              filterStatus === 'assigned' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            )}
          >
            Đã có nhân viên ({assignedSlotsCount})
          </button>
          {pendingApprovalCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterStatus('pending')}
              className={clsx(
                'px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer animate-pulse',
                filterStatus === 'pending' ? 'bg-purple-600 text-white shadow-xs' : 'bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100'
              )}
            >
              Chờ duyệt công ({pendingApprovalCount})
            </button>
          )}
        </div>

        {jobs.length > 1 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-muted">Quán:</span>
            <select
              value={filterJobId}
              onChange={(e) => setFilterJobId(e.target.value)}
              className="p-1.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-main"
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

      {/* SHIFTS GRID */}
      {loading ? (
        <div className="text-center py-16 text-text-muted">Đang tải danh sách ca làm việc...</div>
      ) : dailySlots.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-card space-y-4">
          <Briefcase className="w-12 h-12 text-gray-300 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-text-main">Chưa có vị trí ca làm nào cho ngày này</h3>
            <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">
              Không có mẫu ca nào khớp với thứ trong tuần này. Bạn có thể bấm "Thêm ca phát sinh" để xếp ca ngay.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsAdHocModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-main text-white font-bold text-xs hover:bg-green-dark transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" /> Thêm ca phát sinh
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredSlots.map((slot) => {
            const isAssigned = Boolean(slot.assignedShift);
            const shift = slot.assignedShift;
            const badge = isAssigned ? getShiftBadge(shift.status) : null;
            const workedMins = shift?.workedMinutes || (shift?.hours ? shift.hours * 60 : 240);
            const payAmount = shift?.totalPay || Math.round((workedMins / 60) * (slot.wageRate || 25000));

            return (
              <div
                key={slot.id}
                className={clsx(
                  'p-5 rounded-3xl border transition-all flex flex-col justify-between space-y-4 shadow-card',
                  isAssigned
                    ? 'bg-white border-green-100 hover:border-green-300'
                    : 'bg-white border-dashed border-amber-300 hover:border-amber-400 bg-amber-50/20'
                )}
              >
                {/* TOP HEADER */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-green-dark bg-green-50 px-2.5 py-1 rounded-xl border border-green-200 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-green-600" />
                      {slot.startTime} – {slot.endTime}
                    </span>

                    {isAssigned ? (
                      <Badge variant={badge.variant} size="sm">
                        {badge.label}
                      </Badge>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                        Chưa phân công
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-text-main flex items-center gap-2">
                      <span>{slot.role}</span>
                      {slot.quantity > 1 && (
                        <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                          Vị trí #{slot.slotNumber}/{slot.quantity}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1 font-medium">
                      <Building2 className="w-3.5 h-3.5 text-gray-400" /> {slot.storeName}
                      <span className="text-gray-300">•</span>
                      <span className="text-green-700 font-semibold">{Number(slot.wageRate).toLocaleString('vi-VN')} đ/h</span>
                    </p>
                  </div>
                </div>

                {/* MIDDLE BODY */}
                {isAssigned ? (
                  <div className="space-y-2.5 p-3 rounded-2xl bg-green-50/40 border border-green-100">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-green-600 text-white font-black text-sm flex items-center justify-center shrink-0">
                          {shift.studentName ? shift.studentName.charAt(0).toUpperCase() : 'N'}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-gray-900 leading-tight">
                            {shift.studentName}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Tiền lương ca: <strong className="text-green-700">{payAmount.toLocaleString('vi-VN')} VNĐ</strong> ({workedMins} phút)
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-white/70 border border-amber-200/60 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-gray-800">Chưa có nhân viên nhận ca</p>
                      <p className="text-[11px] text-gray-500">
                        {activeEmployees.length} nhân viên chính thức sẵn sàng nhận ca
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAssignModalSlot(slot)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-green-main hover:bg-green-dark text-white font-bold text-xs shadow-xs transition-colors shrink-0 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Gán nhân viên
                    </button>
                  </div>
                )}

                {/* BOTTOM ACTIONS */}
                {isAssigned && (
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setAdjustModalShift(shift);
                          setAdjustedMinutes(workedMins);
                          setAdjustReason('');
                        }}
                        className="px-2.5 py-1 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5 inline mr-1" /> Chỉnh công
                      </button>

                      {['published', 'draft', 'acknowledged'].includes(shift.status) && (
                        <button
                          type="button"
                          onClick={() => setCancelModalShift(shift)}
                          className="px-2 py-1 rounded-xl text-red-600 hover:bg-red-50 font-bold text-xs transition-colors"
                        >
                          Hủy ca
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Lifecycle CTA */}
                      {['completed_pending_review', 'pending_approval'].includes(shift.status) && (
                        <button
                          type="button"
                          onClick={() => handleApprove(shift)}
                          disabled={submitting}
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-green-main hover:bg-green-dark text-white font-bold text-xs shadow-xs transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Duyệt công
                        </button>
                      )}

                      {shift.status === 'approved' && (
                        <button
                          type="button"
                          onClick={() => handleMarkPayrollReady(shift)}
                          disabled={submitting}
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-colors"
                        >
                          <DollarSign className="w-3.5 h-3.5" /> Sẵn sàng trả lương
                        </button>
                      )}

                      {shift.status === 'payroll_ready' && (
                        <button
                          type="button"
                          onClick={() => handleMarkPaid(shift)}
                          disabled={submitting}
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" /> Đã trả lương
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ASSIGN EMPLOYEE MODAL */}
      {assignModalSlot && (
        <Modal
          isOpen={true}
          onClose={() => { setAssignModalSlot(null); setCandidateSearch(''); }}
          title={`Phân ca: ${assignModalSlot.role} (${assignModalSlot.startTime} - ${assignModalSlot.endTime})`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-green-50/70 border border-green-200 rounded-2xl">
              <p className="font-bold text-green-950">
                Ca ngày: {formatDateDisplayVN(selectedDate)}
              </p>
              <p className="text-green-800 text-[11px] mt-0.5">
                Vị trí: <strong>{assignModalSlot.role}</strong> tại {assignModalSlot.storeName}
              </p>
            </div>

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
                <p className="text-gray-500 text-center py-4">Quán chưa có nhân viên chính thức nào.</p>
              ) : (
                activeEmployees
                  .filter((emp) => {
                    const q = candidateSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      (emp.studentName || '').toLowerCase().includes(q) ||
                      (emp.studentPhone || '').includes(q)
                    );
                  })
                  .map((emp) => (
                    <div
                      key={emp._id || emp.id}
                      className="p-3 rounded-2xl border border-gray-100 hover:border-green-300 hover:bg-green-50/30 transition-all flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-green-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                          {emp.studentName ? emp.studentName.charAt(0).toUpperCase() : 'N'}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{emp.studentName}</p>
                          <p className="text-[11px] text-gray-500">
                            SĐT: {emp.studentPhone || 'Chưa có'} • {emp.positionTitle}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleAssignEmployee(emp)}
                        className="px-3 py-1.5 rounded-xl bg-green-main hover:bg-green-dark text-white font-bold text-xs transition-colors shadow-xs shrink-0 cursor-pointer"
                      >
                        Gán vào ca
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ADJUST TIME MODAL */}
      {adjustModalShift && (
        <Modal
          isOpen={true}
          onClose={() => setAdjustModalShift(null)}
          title={`Điều chỉnh công: ${adjustModalShift.studentName}`}
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-gray-800 block mb-1">Số phút làm việc thực tế *</label>
              <input
                type="number"
                value={adjustedMinutes}
                onChange={(e) => setAdjustedMinutes(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-gray-200 font-bold text-sm"
              />
            </div>

            <div>
              <label className="font-bold text-gray-800 block mb-1">Lý do điều chỉnh (bắt buộc audit) *</label>
              <textarea
                rows={2}
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Ví dụ: Sinh viên tăng ca 30 phút dọn quán / trừ 15 phút đến trễ..."
                className="w-full p-2.5 rounded-xl border border-gray-200"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setAdjustModalShift(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={submitting || !adjustReason.trim()}
                onClick={handleSaveAdjustTime}
                className="px-4 py-2 rounded-xl bg-green-main hover:bg-green-dark text-white font-bold disabled:opacity-50"
              >
                {submitting ? 'Đang lưu...' : 'Lưu điều chỉnh'}
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
            <p className="text-gray-700">
              Bạn có chắc chắn muốn hủy ca làm ngày <strong>{cancelModalShift.date} ({cancelModalShift.startTime} - {cancelModalShift.endTime})</strong> của nhân viên <strong>{cancelModalShift.studentName}</strong> không?
            </p>
            <div>
              <label className="font-bold text-gray-800 block mb-1">Lý do hủy ca:</label>
              <textarea
                rows={2}
                value={cancelReasonText}
                onChange={(e) => setCancelReasonText(e.target.value)}
                placeholder="Nhập lý do hủy ca làm..."
                className="w-full p-2 rounded-xl border border-gray-200"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setCancelModalShift(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmCancelShift}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                Xác nhận hủy ca
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* AD-HOC MODAL */}
      {isAdHocModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAdHocModalOpen(false)}
          title="Tạo ca làm phát sinh"
        >
          <form onSubmit={handleCreateAdHocShift} className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-gray-800 block mb-1">Chọn công việc / Cơ sở *</label>
              <select
                value={adHocForm.jobId}
                onChange={(e) => setAdHocForm((prev) => ({ ...prev, jobId: e.target.value }))}
                className="w-full p-2.5 rounded-xl border border-gray-200 bg-white font-semibold"
              >
                {jobs.map((j) => (
                  <option key={j._id || j.id} value={j._id || j.id}>
                    {j.title} ({j.storeName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-gray-800 block mb-1">Chọn nhân viên chính thức *</label>
              <select
                value={adHocForm.studentUserId}
                onChange={(e) => setAdHocForm((prev) => ({ ...prev, studentUserId: e.target.value }))}
                className="w-full p-2.5 rounded-xl border border-gray-200 bg-white font-semibold"
              >
                <option value="">-- Chọn nhân viên nhận ca --</option>
                {activeEmployees.map((emp) => (
                  <option
                    key={emp._id || emp.id}
                    value={emp.employeeUserId?._id || emp.employeeUserId || emp.id}
                  >
                    {emp.studentName} ({emp.positionTitle}) - SĐT: {emp.studentPhone}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-gray-800 block mb-1">Ngày ca làm *</label>
                <input
                  type="date"
                  value={adHocForm.date}
                  onChange={(e) => setAdHocForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="w-full p-2 rounded-xl border border-gray-200 font-semibold"
                />
              </div>
              <div>
                <label className="font-bold text-gray-800 block mb-1">Tên vị trí / ca</label>
                <input
                  type="text"
                  value={adHocForm.role}
                  onChange={(e) => setAdHocForm((prev) => ({ ...prev, role: e.target.value }))}
                  placeholder="Ví dụ: Phục vụ tăng cường"
                  className="w-full p-2 rounded-xl border border-gray-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-gray-800 block mb-1">Giờ bắt đầu *</label>
                <input
                  type="time"
                  value={adHocForm.startTime}
                  onChange={(e) => setAdHocForm((prev) => ({ ...prev, startTime: e.target.value }))}
                  className="w-full p-2 rounded-xl border border-gray-200 font-semibold"
                />
              </div>
              <div>
                <label className="font-bold text-gray-800 block mb-1">Giờ kết thúc *</label>
                <input
                  type="time"
                  value={adHocForm.endTime}
                  onChange={(e) => setAdHocForm((prev) => ({ ...prev, endTime: e.target.value }))}
                  className="w-full p-2 rounded-xl border border-gray-200 font-semibold"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={adHocForm.isDraft}
                  onChange={(e) => setAdHocForm((prev) => ({ ...prev, isDraft: e.target.checked }))}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500 w-4 h-4"
                />
                <span>Lưu ở trạng thái nháp (chưa thông báo cho nhân viên ngay)</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsAdHocModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleCreateAdHocShift}
                className="px-4 py-2 rounded-xl bg-green-main hover:bg-green-dark text-white font-bold disabled:opacity-50 shadow-xs"
              >
                {submitting ? 'Đang tạo...' : 'Tạo ca làm việc'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
