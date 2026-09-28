import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, Clock, CheckCircle, Plus, Users, MapPin, Check, X,
  Navigation, AlertTriangle, ShieldCheck, DollarSign, ChevronLeft,
  ChevronRight, UserPlus, UserCheck, UserX, Search, RotateCcw,
  Sparkles, Building2, Briefcase, AlertCircle, ArrowRight
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import {
  getShifts,
  createShift,
  approveAttendance,
  disputeShift,
  deleteShift,
  cancelShift,
  getApplications,
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

export function parseShiftTimes(shiftStr) {
  if (!shiftStr) return { startTime: '08:00', endTime: '12:00' };

  // Format HH:mm - HH:mm
  const matchColon = shiftStr.match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);
  if (matchColon) {
    const formatTime = (t) => t.length === 4 ? `0${t}` : t;
    return {
      startTime: formatTime(matchColon[1]),
      endTime: formatTime(matchColon[2]),
    };
  }

  // Format Hh - Hh or HhMM - HhMM
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

  // Fallbacks based on common Vietnamese shift keywords
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
    case 'approved':
    case 'completed':
      return { variant: 'success', label: 'Đã chốt công 🎉' };
    case 'pending_approval':
      return { variant: 'purple', label: 'Chờ duyệt công ⏳' };
    case 'checked_in':
      return { variant: 'warning', label: 'Đang làm việc 🟢' };
    case 'disputed':
      return { variant: 'danger', label: 'Cần đối soát ⚠️' };
    case 'cancelled':
      return { variant: 'neutral', label: 'Đã hủy' };
    case 'scheduled':
    default:
      return { variant: 'info', label: 'Đã xếp lịch' };
  }
}

export default function EmployerShiftsPage() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [shifts, setShifts] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [hiredApplications, setHiredApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // Filter states
  const [filterJobId, setFilterJobId] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'empty' | 'assigned' | 'pending' | 'completed'

  // Modals
  const [assignModalSlot, setAssignModalSlot] = useState(null);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [disputeModalShift, setDisputeModalShift] = useState(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [isAdHocModalOpen, setIsAdHocModalOpen] = useState(false);

  // Ad-hoc form state
  const [adHocForm, setAdHocForm] = useState({
    jobId: '',
    role: '',
    date: getTodayString(),
    startTime: '08:00',
    endTime: '12:00',
    wageRate: 25000,
    studentUserId: '',
  });

  useEffect(() => {
    loadData();
  }, [user]);

  async function loadData() {
    try {
      setLoading(true);
      const [shiftData, myJobsData, appsData] = await Promise.all([
        getShifts({ storeId: user?.id, storeName: user?.name, employerId: user?.id }),
        getEmployerMyJobs().catch(() => []),
        getApplications({ employerId: user?.id, storeId: user?.id, status: 'hired' }).catch(() => []),
      ]);

      setShifts(Array.isArray(shiftData) ? shiftData : []);

      const jobList = Array.isArray(myJobsData) ? myJobsData : (myJobsData?.items || myJobsData?.jobs || []);
      setJobs(jobList);

      const appsList = Array.isArray(appsData) ? appsData : [];
      setHiredApplications(appsList);

      if (jobList.length > 0 && !adHocForm.jobId) {
        setAdHocForm(prev => ({
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

  // Generate slots for the selected date
  const dailySlots = useMemo(() => {
    const activeJobs = jobs.filter(j => j.status !== 'closed');
    const shiftsForDate = shifts.filter(s => s.date === selectedDate && s.status !== 'cancelled');
    const unmatchedShifts = [...shiftsForDate];

    const slots = [];

    activeJobs.forEach(job => {
      const jId = job._id || job.id;
      const positions = Array.isArray(job.positions) && job.positions.length > 0
        ? job.positions
        : [{ title: job.title || 'Nhân viên bán ca', shift: job.shiftDetail || 'Ca làm việc', quantity: job.slots || 1 }];

      positions.forEach((pos, pIdx) => {
        const qty = Number(pos.quantity) > 0 ? Number(pos.quantity) : 1;
        const times = parseShiftTimes(pos.shift);

        for (let i = 0; i < qty; i++) {
          const slotKey = `${jId}_p${pIdx}_s${i}`;

          // Match with existing shift for this job
          const matchIndex = unmatchedShifts.findIndex(s => {
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
            // Fallback match by job ID
            const jobMatchIndex = unmatchedShifts.findIndex(s => {
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

    // Append any extra ad-hoc shifts that exist in DB for this date
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
    return dailySlots.filter(slot => {
      if (filterJobId !== 'all' && String(slot.jobId) !== String(filterJobId)) {
        return false;
      }
      if (filterStatus === 'empty') return !slot.assignedShift;
      if (filterStatus === 'assigned') return Boolean(slot.assignedShift);
      if (filterStatus === 'pending') return slot.assignedShift?.status === 'pending_approval';
      if (filterStatus === 'completed') return ['approved', 'completed'].includes(slot.assignedShift?.status);
      return true;
    });
  }, [dailySlots, filterJobId, filterStatus]);

  // Summary counts
  const totalSlotsCount = dailySlots.length;
  const assignedSlotsCount = dailySlots.filter(s => Boolean(s.assignedShift)).length;
  const emptySlotsCount = totalSlotsCount - assignedSlotsCount;
  const pendingApprovalCount = dailySlots.filter(s => s.assignedShift?.status === 'pending_approval').length;
  const isToday = selectedDate === getTodayString();

  // Hired candidates for currently selected slot
  const eligibleCandidatesForSlot = useMemo(() => {
    if (!assignModalSlot) return [];
    const query = candidateSearch.trim().toLowerCase();

    return hiredApplications.filter(app => {
      const sName = (app.studentName || app.studentId?.name || '').toLowerCase();
      const sPhone = (app.studentPhone || app.studentId?.phone || '').toLowerCase();
      if (query && !sName.includes(query) && !sPhone.includes(query)) {
        return false;
      }
      return true;
    }).sort((a, b) => {
      // Prioritize candidates who applied specifically for this job
      const aJobMatch = String(a.jobId?._id || a.jobId) === String(assignModalSlot.jobId);
      const bJobMatch = String(b.jobId?._id || b.jobId) === String(assignModalSlot.jobId);
      if (aJobMatch && !bJobMatch) return -1;
      if (!aJobMatch && bJobMatch) return 1;

      // Prioritize position title match
      const aPosMatch = a.selectedPosition && a.selectedPosition.toLowerCase().includes(assignModalSlot.role.toLowerCase());
      const bPosMatch = b.selectedPosition && b.selectedPosition.toLowerCase().includes(assignModalSlot.role.toLowerCase());
      if (aPosMatch && !bPosMatch) return -1;
      if (!aPosMatch && bPosMatch) return 1;

      return 0;
    });
  }, [hiredApplications, assignModalSlot, candidateSearch]);

  // Action: Assign candidate to slot
  async function handleAssignCandidate(candidate) {
    if (!assignModalSlot) return;
    try {
      setSubmitting(true);
      const studentId = candidate.studentId?._id || candidate.studentId || candidate.studentUserId;
      const studentName = candidate.studentName || candidate.studentId?.name || 'Sinh viên';

      // Check if candidate already has a shift on this date
      const alreadyHasShift = shifts.some(
        s => s.date === selectedDate &&
             ((s.studentUserId && String(s.studentUserId) === String(studentId)) ||
              (s.studentId && String(s.studentId) === String(studentId))) &&
             s.status !== 'cancelled'
      );

      if (alreadyHasShift) {
        const confirmed = window.confirm(`Sinh viên ${studentName} đã được xếp 1 ca làm trong ngày ${selectedDate}. Bạn có chắc chắn muốn xếp thêm ca này không?`);
        if (!confirmed) {
          setSubmitting(false);
          return;
        }
      }

      const newShift = await createShift({
        jobId: assignModalSlot.jobId,
        studentUserId: studentId,
        studentId: studentId,
        studentName: studentName,
        applicationId: candidate._id || candidate.id,
        date: selectedDate,
        startTime: assignModalSlot.startTime,
        endTime: assignModalSlot.endTime,
        role: assignModalSlot.role,
        wageRate: assignModalSlot.wageRate,
        storeName: assignModalSlot.storeName,
        status: 'scheduled',
      });

      setShifts(prev => [newShift, ...prev]);
      setToast({ type: 'success', message: `Đã phân công ${studentName} vào ca "${assignModalSlot.role}" thành công!` });
      setAssignModalSlot(null);
      setCandidateSearch('');
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi phân ca làm việc.' });
    } finally {
      setSubmitting(false);
    }
  }

  // Action: Unassign / Delete shift from slot
  async function handleUnassignShift(shift) {
    const shiftId = shift._id || shift.id;
    if (!window.confirm(`Bạn có chắc muốn hủy phân công sinh viên ${shift.studentName} để ca này trở lại trạng thái trống?`)) {
      return;
    }

    try {
      await deleteShift(shiftId);
      setShifts(prev => prev.filter(s => (s._id !== shiftId && s.id !== shiftId)));
      setToast({ type: 'success', message: 'Đã hủy phân công ca làm. Ca làm đã sẵn sàng để gán nhân viên khác.' });
    } catch (err) {
      // If cannot delete because already active, cancel it
      try {
        await cancelShift(shiftId, 'Nhà tuyển dụng thay đổi phân công ca làm');
        setShifts(prev => prev.map(s => (s._id === shiftId || s.id === shiftId) ? { ...s, status: 'cancelled' } : s));
        setToast({ type: 'success', message: 'Đã hủy ca làm việc.' });
      } catch (cancelErr) {
        setToast({ type: 'error', message: cancelErr.message || 'Không thể hủy ca làm.' });
      }
    }
  }

  // Action: Approve attendance
  async function handleApproveShift(shiftId) {
    try {
      await approveAttendance(shiftId);
      setShifts(prev =>
        prev.map(s => ((s._id === shiftId || s.id === shiftId) ? { ...s, status: 'approved' } : s))
      );
      setToast({ type: 'success', message: 'Đã xác nhận duyệt công và tiền lương cho sinh viên!' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi duyệt công.' });
    }
  }

  // Action: Dispute attendance
  async function handleDisputeShift() {
    if (!disputeModalShift) return;
    try {
      await disputeShift(disputeModalShift._id || disputeModalShift.id, disputeReason);
      setShifts(prev =>
        prev.map(s =>
          ((s._id === disputeModalShift._id || s.id === disputeModalShift.id)
            ? { ...s, status: 'disputed', disputeReason }
            : s)
        )
      );
      setToast({ type: 'info', message: 'Đã đánh dấu ca làm cần đối soát.' });
      setDisputeModalShift(null);
      setDisputeReason('');
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi gửi đối soát.' });
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
        setToast({ type: 'error', message: 'Vui lòng chọn sinh viên trúng tuyển để gán ca.' });
        return;
      }

      const selectedJob = jobs.find(j => (j._id || j.id) === adHocForm.jobId);
      const selectedApp = hiredApplications.find(a => {
        const sId = a.studentId?._id || a.studentId || a.studentUserId;
        return String(sId) === String(adHocForm.studentUserId);
      });

      const newShift = await createShift({
        jobId: adHocForm.jobId,
        studentUserId: adHocForm.studentUserId,
        studentId: adHocForm.studentUserId,
        studentName: selectedApp?.studentName || selectedApp?.studentId?.name || 'Sinh viên',
        applicationId: selectedApp?._id || selectedApp?.id || null,
        date: adHocForm.date,
        startTime: adHocForm.startTime,
        endTime: adHocForm.endTime,
        role: adHocForm.role || selectedJob?.title || 'Ca đột xuất',
        wageRate: Number(adHocForm.wageRate) || selectedJob?.salaryAmount || 25000,
        storeName: selectedJob?.storeName || 'Cửa hàng tuyển dụng',
        status: 'scheduled',
      });

      setShifts(prev => [newShift, ...prev]);
      setToast({ type: 'success', message: 'Tạo ca phát sinh và gửi thông báo thành công!' });
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

      {/* HEADER & DATE CONTROLS */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-card space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text-main flex items-center gap-2">
              <Calendar className="w-6 h-6 text-green-dark" /> Quản lý Ca Làm Việc Trong Ngày
            </h1>
            <p className="text-xs text-text-muted mt-1">
              Hệ thống tự động hiển thị các ca làm việc theo ngày. Chỉ cần bấm chọn ứng viên đã trúng tuyển để gán ca.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsAdHocModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-text-main font-bold text-xs transition-colors shrink-0 self-start md:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4 text-green-dark" /> + Thêm ca phát sinh
          </button>
        </div>

        {/* DATE NAVIGATOR BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedDate(prev => offsetDate(prev, -1))}
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
              onClick={() => setSelectedDate(prev => offsetDate(prev, 1))}
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
                onChange={e => e.target.value && setSelectedDate(e.target.value)}
                className="p-1.5 text-xs font-bold text-gray-800 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-main bg-white"
              />
            </label>
          </div>
        </div>

        {/* QUICK STATS CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 rounded-2xl bg-gray-50/80 border border-gray-100">
            <span className="text-[11px] font-semibold text-gray-500">Tổng ca trong ngày</span>
            <p className="text-lg font-black text-gray-900 mt-0.5">{totalSlotsCount} <span className="text-xs font-normal text-gray-500">ca</span></p>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100">
            <span className="text-[11px] font-semibold text-emerald-700">Đã phân công</span>
            <p className="text-lg font-black text-emerald-800 mt-0.5">{assignedSlotsCount} <span className="text-xs font-normal text-emerald-600">ca</span></p>
          </div>
          <div className={clsx(
            'p-3.5 rounded-2xl border',
            emptySlotsCount > 0 ? 'bg-amber-50/70 border-amber-200' : 'bg-gray-50/80 border-gray-100'
          )}>
            <span className={clsx('text-[11px] font-semibold', emptySlotsCount > 0 ? 'text-amber-800 font-bold' : 'text-gray-500')}>
              Còn trống (chưa gán)
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

        {/* Store filter if multiple jobs */}
        {jobs.length > 1 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-muted">Quán:</span>
            <select
              value={filterJobId}
              onChange={e => setFilterJobId(e.target.value)}
              className="p-1.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-main"
            >
              <option value="all">Tất cả việc làm ({jobs.length})</option>
              {jobs.map(j => (
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
        <div className="text-center py-16 text-text-muted">
          <Clock className="w-8 h-8 text-green-main animate-spin mx-auto mb-2 opacity-60" />
          Đang tải danh sách ca làm việc...
        </div>
      ) : dailySlots.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-card space-y-4">
          <Briefcase className="w-12 h-12 text-gray-300 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-text-main">Chưa có vị trí ca làm nào</h3>
            <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">
              Hệ thống chưa tìm thấy tin tuyển dụng đang hoạt động nào để tạo ca. Hãy đăng tin tuyển dụng hoặc bấm "Thêm ca phát sinh" để bắt đầu xếp ca.
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Link
              to="/employer/jobs/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-main text-white font-bold text-xs hover:bg-green-dark transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" /> Đăng tin tuyển dụng
            </Link>
            <button
              type="button"
              onClick={() => setIsAdHocModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition-colors"
            >
              Thêm ca phát sinh
            </button>
          </div>
        </div>
      ) : filteredSlots.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-card">
          <p className="text-xs text-gray-500 font-medium">Không có ca nào phù hợp với bộ lọc đã chọn.</p>
          <button
            type="button"
            onClick={() => { setFilterStatus('all'); setFilterJobId('all'); }}
            className="mt-3 px-3.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 transition-colors"
          >
            Đặt lại bộ lọc
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredSlots.map(slot => {
            const isAssigned = Boolean(slot.assignedShift);
            const shift = slot.assignedShift;
            const badge = isAssigned ? getShiftBadge(shift.status) : null;
            const distance = shift?.attendance?.checkInDistanceMeters;
            const isVerified = shift?.attendance?.checkInVerified;
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

                {/* MIDDLE BODY: ASSIGNED VS EMPTY */}
                {isAssigned ? (
                  <div className="space-y-2.5 p-3 rounded-2xl bg-green-50/40 border border-green-100">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-green-600 text-white font-black text-sm flex items-center justify-center shrink-0">
                          {shift.studentName ? shift.studentName.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-gray-900 leading-tight">
                            {shift.studentName}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {shift.studentUserId?.phone || shift.studentPhone || 'Sinh viên đã nhận ca'}
                          </p>
                        </div>
                      </div>

                      {shift.status === 'scheduled' && (
                        <button
                          type="button"
                          onClick={() => handleUnassignShift(shift)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                          title="Hủy phân công để ca trở lại trạng thái trống"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* GPS Details if started */}
                    {distance !== undefined && distance !== null ? (
                      <div className="p-2 rounded-xl bg-white text-[11px] space-y-0.5 border border-gray-100">
                        <p className="flex items-center gap-1 text-gray-700">
                          <Navigation className="w-3 h-3 text-blue-500" />
                          GPS Check-in: <strong>{distance}m</strong>{' '}
                          {isVerified ? (
                            <span className="text-emerald-600 font-bold">✓ Hợp lệ tại quán</span>
                          ) : (
                            <span className="text-amber-600 font-bold">⚠️ Ngoài bán kính</span>
                          )}
                        </p>
                        {shift.attendance?.checkInAt && (
                          <p className="text-gray-500">
                            Vào ca: {new Date(shift.attendance.checkInAt).toLocaleTimeString('vi-VN')}
                          </p>
                        )}
                        {shift.attendance?.checkOutAt && (
                          <p className="text-gray-500">
                            Ra ca: {new Date(shift.attendance.checkOutAt).toLocaleTimeString('vi-VN')}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-400 italic">Chưa điểm danh GPS</p>
                    )}

                    {shift.disputeReason && (
                      <p className="p-2 rounded-xl bg-red-50 text-red-700 text-[11px] border border-red-200">
                        ⚠️ Ghi chú đối soát: {shift.disputeReason}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-amber-600" /> Vị trí này đang trống
                      </p>
                      <p className="text-[11px] text-amber-700/80 mt-0.5">
                        Chưa có sinh viên nào nhận ca làm này.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAssignModalSlot(slot)}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Gán nhân viên
                    </button>
                  </div>
                )}

                {/* BOTTOM ACTIONS */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                  {isAssigned ? (
                    shift.status === 'pending_approval' || shift.status === 'checked_in' ? (
                      <div className="flex items-center gap-2 w-full">
                        <button
                          type="button"
                          onClick={() => handleApproveShift(shift._id || shift.id)}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> Duyệt chốt công ({payAmount.toLocaleString('vi-VN')} đ)
                        </button>
                        <button
                          type="button"
                          onClick={() => { setDisputeModalShift(shift); setDisputeReason(''); }}
                          className="py-2 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-xs transition-colors cursor-pointer"
                        >
                          Đối soát
                        </button>
                      </div>
                    ) : ['approved', 'completed'].includes(shift.status) ? (
                      <div className="flex items-center justify-between w-full text-xs">
                        <span className="font-semibold text-emerald-700 flex items-center gap-1">
                          <CheckCircle className="w-4 h-4 text-emerald-500" /> Đã hoàn tất công
                        </span>
                        <span className="font-black text-emerald-800">
                          {payAmount.toLocaleString('vi-VN')} VNĐ
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full text-xs text-gray-500">
                        <span>Chờ sinh viên đến ca</span>
                        <button
                          type="button"
                          onClick={() => setAssignModalSlot(slot)}
                          className="text-xs text-green-700 hover:text-green-800 font-bold hover:underline"
                        >
                          Đổi nhân viên
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center justify-between w-full text-xs">
                      <span className="text-gray-400 font-medium">Sẵn sàng để xếp ca</span>
                      <button
                        type="button"
                        onClick={() => setAssignModalSlot(slot)}
                        className="text-xs text-green-700 hover:text-green-800 font-bold hover:underline inline-flex items-center gap-1"
                      >
                        Chọn người trúng tuyển <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL GÁN NHÂN VIÊN TRÚNG TUYỂN VÀO CA */}
      {assignModalSlot && (
        <Modal
          isOpen={true}
          onClose={() => { setAssignModalSlot(null); setCandidateSearch(''); }}
          title={`Gán nhân viên vào ca: ${assignModalSlot.role}`}
        >
          <div className="space-y-4 text-xs">
            {/* Slot summary info */}
            <div className="p-3 rounded-2xl bg-green-50 border border-green-200 text-green-900 space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-green-700" /> {assignModalSlot.shiftName} ({assignModalSlot.startTime} – {assignModalSlot.endTime})
                </span>
                <span className="text-green-800">{Number(assignModalSlot.wageRate).toLocaleString('vi-VN')} đ/h</span>
              </div>
              <p className="text-[11px] text-green-800/80">
                🏢 {assignModalSlot.storeName} • 📅 Ngày: {formatDateDisplayVN(selectedDate)}
              </p>
            </div>

            {/* Candidate Search Box */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                value={candidateSearch}
                onChange={e => setCandidateSearch(e.target.value)}
                placeholder="Tìm ứng viên theo tên hoặc số điện thoại..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-main text-xs font-semibold text-gray-900"
              />
            </div>

            {/* Candidate list */}
            <div>
              <p className="font-bold text-gray-700 mb-2">
                Danh sách nhân viên đã trúng tuyển ({eligibleCandidatesForSlot.length}):
              </p>

              {eligibleCandidatesForSlot.length === 0 ? (
                <div className="p-6 text-center rounded-2xl border border-gray-100 bg-gray-50 space-y-2">
                  <Users className="w-8 h-8 text-gray-300 mx-auto" />
                  <p className="font-bold text-gray-700">Chưa có ứng viên trúng tuyển phù hợp</p>
                  <p className="text-[11px] text-gray-500 max-w-xs mx-auto">
                    Vui lòng duyệt trạng thái "Trúng tuyển" (Hired) cho sinh viên tại mục Quản lý Ứng tuyển trước khi xếp ca.
                  </p>
                  <Link
                    to="/employer/applications"
                    className="inline-block mt-2 px-3 py-1.5 rounded-xl bg-green-main text-white font-bold text-xs hover:bg-green-dark"
                  >
                    Xem danh sách ứng tuyển
                  </Link>
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {eligibleCandidatesForSlot.map(app => {
                    const studentId = app.studentId?._id || app.studentId || app.studentUserId;
                    const studentName = app.studentName || app.studentId?.name || 'Sinh viên';
                    const studentPhone = app.studentPhone || app.studentId?.phone || '';

                    // Check if applied specifically for this position or shift
                    const isPrefMatch = (app.selectedPosition && app.selectedPosition.toLowerCase().includes(assignModalSlot.role.toLowerCase())) ||
                                        (app.selectedShift && app.selectedShift.toLowerCase().includes(assignModalSlot.startTime));

                    // Check if already has a shift on this date
                    const alreadyHasShift = shifts.some(
                      s => s.date === selectedDate &&
                           ((s.studentUserId && String(s.studentUserId) === String(studentId)) ||
                            (s.studentId && String(s.studentId) === String(studentId))) &&
                           s.status !== 'cancelled'
                    );

                    return (
                      <div
                        key={app._id || app.id}
                        className="p-3 rounded-2xl border border-gray-200 hover:border-green-300 bg-white hover:bg-green-50/20 transition-all flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-green-100 text-green-800 font-black text-sm flex items-center justify-center shrink-0">
                            {studentName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-gray-900 text-xs">{studentName}</span>
                              {isPrefMatch && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black">
                                  <Sparkles className="w-2.5 h-2.5" /> Đúng nguyện vọng
                                </span>
                              )}
                              {alreadyHasShift && (
                                <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                                  Đã có ca hôm nay
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              📞 {studentPhone || 'Chưa cập nhật SĐT'} • {app.selectedPosition ? `Ứng tuyển: ${app.selectedPosition}` : 'Ứng viên trúng tuyển'}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleAssignCandidate(app)}
                          className="px-3 py-1.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
                        >
                          {submitting ? 'Đang gán...' : 'Gán vào ca'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => { setAssignModalSlot(null); setCandidateSearch(''); }}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL THÊM CA PHÁT SINH (AD-HOC SHIFT) */}
      {isAdHocModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAdHocModalOpen(false)}
          title="Tạo ca làm việc phát sinh"
        >
          <form onSubmit={handleCreateAdHocShift} className="space-y-3.5 text-xs">
            <div>
              <label className="font-bold text-gray-800 block mb-1">Chọn công việc / Cửa hàng *</label>
              <select
                value={adHocForm.jobId}
                onChange={e => {
                  const sJob = jobs.find(j => (j._id || j.id) === e.target.value);
                  setAdHocForm({
                    ...adHocForm,
                    jobId: e.target.value,
                    wageRate: sJob?.salaryAmount || 25000,
                  });
                }}
                className="w-full p-2.5 rounded-xl border border-gray-200 bg-white font-semibold text-gray-900 focus:ring-2 focus:ring-green-main focus:outline-none"
                required
              >
                {jobs.map(j => (
                  <option key={j._id || j.id} value={j._id || j.id}>
                    {j.title} ({j.storeName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-gray-800 block mb-1">Tên vị trí / Vai trò *</label>
              <input
                type="text"
                placeholder="Ví dụ: Phụ bếp tăng cường, Thu ngân ca tối..."
                value={adHocForm.role}
                onChange={e => setAdHocForm({ ...adHocForm, role: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-main focus:outline-none font-semibold text-gray-900"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="font-bold text-gray-800 block mb-1">Ngày làm việc *</label>
                <input
                  type="date"
                  value={adHocForm.date}
                  onChange={e => setAdHocForm({ ...adHocForm, date: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-gray-200 font-semibold focus:ring-2 focus:ring-green-main focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-gray-800 block mb-1">Giờ bắt đầu *</label>
                <input
                  type="time"
                  value={adHocForm.startTime}
                  onChange={e => setAdHocForm({ ...adHocForm, startTime: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-gray-200 font-semibold focus:ring-2 focus:ring-green-main focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-gray-800 block mb-1">Giờ kết thúc *</label>
                <input
                  type="time"
                  value={adHocForm.endTime}
                  onChange={e => setAdHocForm({ ...adHocForm, endTime: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-gray-200 font-semibold focus:ring-2 focus:ring-green-main focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-gray-800 block mb-1">Mức lương (VNĐ/giờ) *</label>
              <input
                type="number"
                step="1000"
                min="15000"
                value={adHocForm.wageRate}
                onChange={e => setAdHocForm({ ...adHocForm, wageRate: Number(e.target.value) })}
                className="w-full p-2.5 rounded-xl border border-gray-200 font-semibold focus:ring-2 focus:ring-green-main focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="font-bold text-gray-800 block mb-1">Chọn sinh viên trúng tuyển nhận ca *</label>
              {hiredApplications.length > 0 ? (
                <select
                  value={adHocForm.studentUserId}
                  onChange={e => setAdHocForm({ ...adHocForm, studentUserId: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-gray-200 bg-white font-semibold text-gray-900 focus:ring-2 focus:ring-green-main focus:outline-none"
                  required
                >
                  <option value="">-- Chọn sinh viên --</option>
                  {hiredApplications.map(app => {
                    const sId = app.studentId?._id || app.studentId || app.studentUserId;
                    return (
                      <option key={app._id || app.id} value={sId}>
                        {app.studentName} ({app.studentPhone || 'SĐT: N/A'})
                      </option>
                    );
                  })}
                </select>
              ) : (
                <p className="text-red-500 font-medium">Chưa có sinh viên trúng tuyển nào trong hệ thống.</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsAdHocModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-green-main text-white font-bold hover:bg-green-dark disabled:opacity-50 shadow-xs transition-colors"
              >
                {submitting ? 'Đang tạo ca...' : 'Xác nhận tạo ca'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL ĐỐI SOÁT CA LÀM */}
      {disputeModalShift && (
        <Modal
          isOpen={true}
          onClose={() => setDisputeModalShift(null)}
          title="Gửi phản hồi đối soát ca làm"
        >
          <div className="space-y-4 text-xs">
            <p className="text-text-main">
              Nhập lý do cần đối soát đối với ca làm của{' '}
              <strong>{disputeModalShift.studentName}</strong> ngày {disputeModalShift.date}:
            </p>
            <textarea
              rows={3}
              value={disputeReason}
              onChange={e => setDisputeReason(e.target.value)}
              placeholder="Ví dụ: Tọa độ GPS ngoài quán / Sinh viên về sớm 30 phút so với giờ chốt..."
              className="w-full p-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-400 focus:outline-none resize-none font-semibold text-gray-900"
              required
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setDisputeModalShift(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-text-muted font-semibold hover:bg-gray-200"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDisputeShift}
                className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors"
              >
                Gửi đối soát
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
