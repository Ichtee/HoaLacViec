import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, CheckCircle, XCircle, Clock, Eye, Calendar, Sparkles, MapPin,
  Building2, MessageSquare, ShieldCheck, Phone, MessageCircle, FileText,
  UserCheck, AlertCircle, ArrowRight, Send, Check, Undo2
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import {
  getApplications,
  updateApplication,
  sendOffer,
  rescindOffer,
} from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Modal } from '@/components/Modal.jsx';
import { Toast } from '@/components/Feedback.jsx';

const PIPELINE_TABS = [
  { id: 'all', label: 'Tất cả ứng viên' },
  { id: 'submitted', label: 'Mới nộp' },
  { id: 'screening', label: 'Sàng lọc hồ sơ' },
  { id: 'interview', label: 'Phỏng vấn' },
  { id: 'offer_sent', label: 'Đã gửi Offer' },
  { id: 'offer_accepted', label: 'Đồng ý Offer' },
  { id: 'rejected', label: 'Từ chối / Hủy' },
];

function getStatusBadge(status) {
  switch (status) {
    case 'hired':
      return { variant: 'success', label: 'Đã tuyển dụng 🎉' };
    case 'offer_accepted':
      return { variant: 'success', label: 'Đồng ý Offer 🤝' };
    case 'offer_sent':
      return { variant: 'purple', label: 'Đã gửi Offer 📨' };
    case 'interview':
      return { variant: 'purple', label: 'Hẹn phỏng vấn 📅' };
    case 'shortlisted':
      return { variant: 'info', label: 'Lọt vòng sơ loại' };
    case 'screening':
    case 'reviewing':
      return { variant: 'info', label: 'Đang sàng lọc' };
    case 'offer_declined':
      return { variant: 'danger', label: 'Từ chối Offer' };
    case 'offer_expired':
      return { variant: 'neutral', label: 'Offer hết hạn' };
    case 'offer_rescinded':
      return { variant: 'neutral', label: 'Đã thu hồi Offer' };
    case 'rejected':
      return { variant: 'danger', label: 'Chưa phù hợp' };
    case 'withdrawn':
      return { variant: 'neutral', label: 'Đã rút đơn' };
    case 'submitted':
    case 'pending':
    default:
      return { variant: 'warning', label: 'Mới nộp hồ sơ' };
  }
}

export default function EmployerApplicationsPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedApp, setSelectedApp] = useState(null);
  const [candidateFeedback, setCandidateFeedback] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // Structured Interview Modal State
  const [interviewModalOpen, setInterviewModalOpen] = useState(false);
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewTime, setInterviewTime] = useState('');
  const [interviewLocation, setInterviewLocation] = useState('');
  const [interviewNote, setInterviewNote] = useState('');

  // Structured Offer Modal State
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [offerPosition, setOfferPosition] = useState('');
  const [offerWage, setOfferWage] = useState('');
  const [offerWageUnit, setOfferWageUnit] = useState('hour');
  const [offerSchedule, setOfferSchedule] = useState('');
  const [offerStartDate, setOfferStartDate] = useState('');
  const [offerExpiryDays, setOfferExpiryDays] = useState('3');
  const [offerNote, setOfferNote] = useState('');

  useEffect(() => {
    loadApps();
  }, [user]);

  async function loadApps() {
    try {
      setLoading(true);
      const data = await getApplications({
        storeId: user?.id,
        storeName: user?.name,
        employerId: user?.id,
      });
      setApplications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Active candidates list
  const candidates = useMemo(() => {
    return applications.filter((a) => a.status !== 'hired');
  }, [applications]);

  function openDetailModal(app) {
    setSelectedApp(app);
    setCandidateFeedback(app.candidateFeedback || '');
    setInternalNote(app.internalNote || '');
  }

  function openInterviewModal(app) {
    setSelectedApp(app);
    const existing = app.interviewSchedule || {};
    setInterviewDate(existing.date || '');
    setInterviewTime(existing.time || '');
    setInterviewLocation(existing.location || app.jobId?.address || 'Tại quán');
    setInterviewNote(existing.note || '');
    setInterviewModalOpen(true);
  }

  function openOfferModal(app) {
    setSelectedApp(app);
    setOfferPosition(app.selectedPosition || app.jobTitle || 'Nhân viên bán ca');
    setOfferWage(app.jobId?.salaryAmount || 25000);
    setOfferWageUnit(app.jobId?.salaryUnit || 'hour');
    setOfferSchedule(app.selectedShift || 'Theo ca làm việc');
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setOfferStartDate(tomorrow);
    setOfferExpiryDays('3');
    setOfferNote('Chào bạn, quán rất ấn tượng với hồ sơ của bạn và mong muốn mời bạn gia nhập đội ngũ.');
    setOfferModalOpen(true);
  }

  // Handle standard status update
  async function handleStatusChange(targetStatus) {
    if (!selectedApp) return;
    const appId = selectedApp._id || selectedApp.id;

    try {
      setSubmitting(true);
      const updated = await updateApplication(appId, {
        status: targetStatus,
        candidateFeedback,
        internalNote,
      });

      setApplications((prev) =>
        prev.map((a) => ((a._id || a.id) === appId ? { ...a, ...updated, status: targetStatus, candidateFeedback, internalNote } : a))
      );

      setToast({
        type: 'success',
        message: `Đã chuyển trạng thái ứng viên thành "${getStatusBadge(targetStatus).label}".`,
      });
      setSelectedApp(null);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi cập nhật trạng thái đơn.' });
    } finally {
      setSubmitting(false);
    }
  }

  // Submit interview schedule
  async function handleSaveInterview() {
    if (!selectedApp) return;
    const appId = selectedApp._id || selectedApp.id;

    try {
      setSubmitting(true);
      const updated = await updateApplication(appId, {
        status: 'interview',
        interviewSchedule: {
          date: interviewDate,
          time: interviewTime,
          location: interviewLocation,
          note: interviewNote,
        },
        candidateFeedback: `Lời mời phỏng vấn: Ngày ${interviewDate} lúc ${interviewTime} tại ${interviewLocation}. Ghi chú: ${interviewNote}`,
        internalNote,
      });

      setApplications((prev) =>
        prev.map((a) => ((a._id || a.id) === appId ? { ...a, ...updated, status: 'interview' } : a))
      );

      setToast({ type: 'success', message: 'Đã gửi lời mời phỏng vấn cho ứng viên thành công!' });
      setInterviewModalOpen(false);
      setSelectedApp(null);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi xếp lịch phỏng vấn.' });
    } finally {
      setSubmitting(false);
    }
  }

  // Send formal job offer
  async function handleSendOfferSubmit() {
    if (!selectedApp) return;
    const appId = selectedApp._id || selectedApp.id;

    try {
      setSubmitting(true);
      const result = await sendOffer(appId, {
        position: offerPosition,
        wage: Number(offerWage),
        wageUnit: offerWageUnit,
        expectedSchedule: offerSchedule,
        proposedStartDate: offerStartDate,
        expiryDays: Number(offerExpiryDays),
        note: offerNote,
        candidateFeedback: offerNote,
        internalNote,
      });

      setApplications((prev) =>
        prev.map((a) => ((a._id || a.id) === appId ? { ...a, ...result.application, status: 'offer_sent' } : a))
      );

      setToast({
        type: 'success',
        message: `🎉 Đã gửi Đề nghị nhận việc (Offer) tới ứng viên ${selectedApp.studentName}! Hãy chờ ứng viên xác nhận.`,
      });
      setOfferModalOpen(false);
      setSelectedApp(null);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi gửi đề nghị nhận việc.' });
    } finally {
      setSubmitting(false);
    }
  }

  // Rescind offer
  async function handleRescindOffer(app) {
    const appId = app._id || app.id;
    if (!window.confirm(`Bạn có chắc chắn muốn thu hồi đề nghị nhận việc gửi cho ${app.studentName}?`)) return;

    try {
      setSubmitting(true);
      const result = await rescindOffer(appId, 'Thu hồi theo yêu cầu của nhà tuyển dụng');
      setApplications((prev) =>
        prev.map((a) => ((a._id || a.id) === appId ? { ...a, status: 'offer_rescinded' } : a))
      );
      setToast({ type: 'info', message: 'Đã thu hồi đề nghị nhận việc thành công.' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi thu hồi đề nghị.' });
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = candidates.filter((a) => {
    if (activeTab === 'submitted') return a.status === 'submitted' || a.status === 'pending' || !a.status;
    if (activeTab === 'screening') return a.status === 'screening' || a.status === 'reviewing' || a.status === 'shortlisted';
    if (activeTab === 'interview') return a.status === 'interview';
    if (activeTab === 'offer_sent') return a.status === 'offer_sent';
    if (activeTab === 'offer_accepted') return a.status === 'offer_accepted';
    if (activeTab === 'rejected') return ['rejected', 'withdrawn', 'offer_declined', 'offer_expired', 'offer_rescinded'].includes(a.status);
    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-green-50 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main flex items-center gap-2">
            <Users className="w-6 h-6 text-green-dark" /> Quản lý ứng viên tuyển dụng
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Quy trình tuyển dụng chuẩn: Nộp hồ sơ ➔ Sàng lọc ➔ Phỏng vấn ➔ Gửi Offer ➔ Ứng viên chấp nhận ➔ Tự động tạo Nhân viên.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1.5 bg-cream/70 rounded-2xl border border-green-50 self-start md:self-center overflow-x-auto max-w-full">
          {PIPELINE_TABS.map((tab) => {
            let count = 0;
            if (tab.id === 'all') count = candidates.length;
            else if (tab.id === 'submitted') count = candidates.filter(a => ['submitted', 'pending'].includes(a.status) || !a.status).length;
            else if (tab.id === 'screening') count = candidates.filter(a => ['screening', 'reviewing', 'shortlisted'].includes(a.status)).length;
            else if (tab.id === 'interview') count = candidates.filter(a => a.status === 'interview').length;
            else if (tab.id === 'offer_sent') count = candidates.filter(a => a.status === 'offer_sent').length;
            else if (tab.id === 'offer_accepted') count = candidates.filter(a => a.status === 'offer_accepted').length;
            else if (tab.id === 'rejected') count = candidates.filter(a => ['rejected', 'withdrawn', 'offer_declined', 'offer_expired', 'offer_rescinded'].includes(a.status)).length;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5',
                  activeTab === tab.id
                    ? 'bg-white text-green-dark shadow-xs'
                    : 'text-text-muted hover:text-text-main hover:bg-white/50'
                )}
              >
                <span>{tab.label}</span>
                <span className={clsx(
                  'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                  activeTab === tab.id ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Applications List */}
      {loading ? (
        <div className="text-center py-16 text-text-muted">Đang tải danh sách hồ sơ ứng viên...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-card">
          <p className="text-sm text-text-muted">Chưa có ứng viên nào trong danh mục này.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((app) => {
            const statusInfo = getStatusBadge(app.status);
            const appliedDate = app.appliedAt || (app.createdAt ? new Date(app.createdAt).toLocaleDateString('vi-VN') : 'Mới nộp');

            return (
              <div
                key={app._id || app.id}
                className="bg-white p-5 rounded-3xl border border-gray-100 shadow-card hover:border-green-200 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Candidate Info */}
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-green-50 text-green-dark font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                      {app.studentName ? app.studentName.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-base text-text-main">
                          {app.studentName}
                        </h3>
                        <Badge variant={statusInfo.variant} className="text-[11px] font-bold">
                          {statusInfo.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-text-muted mt-0.5">
                        Ứng tuyển vị trí: <strong className="text-text-main">{app.selectedPosition || app.jobTitle}</strong> • Ngày nộp: {appliedDate}
                      </p>
                    </div>
                  </div>

                  {/* Metadata Pills */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted pt-1">
                    <span className="flex items-center gap-1 bg-gray-50 px-2.5 py-1 rounded-xl border border-gray-100 font-medium">
                      🎓 Sinh viên Hòa Lạc
                    </span>
                    {app.studentPhone && (
                      <span className="flex items-center gap-1 bg-gray-50 px-2.5 py-1 rounded-xl border border-gray-100 font-medium text-gray-700">
                        <Phone className="w-3 h-3 text-green-dark" /> {app.studentPhone}
                      </span>
                    )}
                    {app.studentEmail && (
                      <span className="flex items-center gap-1 bg-gray-50 px-2.5 py-1 rounded-xl border border-gray-100 font-medium text-gray-600">
                        ✉️ {app.studentEmail}
                      </span>
                    )}
                    {app.selectedShift && (
                      <span className="flex items-center gap-1 bg-green-50 text-green-800 px-2.5 py-1 rounded-xl border border-green-100 font-bold">
                        <Clock className="w-3 h-3" /> {app.selectedShift}
                      </span>
                    )}
                  </div>

                  {/* Candidate Note */}
                  {app.note && (
                    <div className="p-2.5 rounded-xl bg-cream/40 border border-amber-100 text-xs text-text-main">
                      <span className="font-bold text-amber-900">Lời nhắn:</span> "{app.note}"
                    </div>
                  )}

                  {/* Interview Information Banner */}
                  {app.status === 'interview' && app.interviewSchedule?.date && (
                    <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-100 text-xs text-purple-900 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-600 shrink-0" />
                      <span>
                        Lịch phỏng vấn: <strong>{app.interviewSchedule.date} ({app.interviewSchedule.time || 'Chưa định giờ'})</strong> tại <strong>{app.interviewSchedule.location}</strong>
                      </span>
                    </div>
                  )}

                  {/* Offer Information Banner */}
                  {app.status === 'offer_sent' && app.offer && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-900 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Send className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          Đã gửi Offer vị trí <strong>{app.offer.position}</strong> ({Number(app.offer.wage).toLocaleString('vi-VN')}đ/{app.offer.wageUnit}). Đang chờ phản hồi.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRescindOffer(app)}
                        className="text-red-600 hover:text-red-700 font-bold text-[11px] underline shrink-0"
                      >
                        Thu hồi Offer
                      </button>
                    </div>
                  )}

                  {/* Offer Accepted Banner */}
                  {app.status === 'offer_accepted' && (
                    <div className="p-2.5 rounded-xl bg-green-50 border border-green-200 text-xs text-green-900 flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600 shrink-0" />
                      <span>
                        Ứng viên đã chấp nhận Offer! Đã tạo hồ sơ nhân viên trong <strong>Tab Nhân viên</strong>.
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 border-t md:border-t-0 pt-3 md:pt-0 shrink-0">
                  <div className="flex items-center gap-1.5">
                    {app.studentPhone && (
                      <>
                        <a
                          href={`tel:${app.studentPhone}`}
                          className="p-2 rounded-xl bg-green-50 hover:bg-green-100 text-green-dark transition-colors"
                          title="Gọi trực tiếp"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                        <a
                          href={`https://zalo.me/${app.studentPhone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
                          title="Chat Zalo"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      </>
                    )}
                  </div>

                  {/* Dynamic Primary Pipeline CTA based on state */}
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {['submitted', 'pending'].includes(app.status) && (
                      <button
                        type="button"
                        onClick={() => { setSelectedApp(app); handleStatusChange('screening'); }}
                        className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-colors"
                      >
                        Chuyển sang Sàng lọc
                      </button>
                    )}

                    {['screening', 'reviewing', 'shortlisted'].includes(app.status) && (
                      <>
                        <button
                          type="button"
                          onClick={() => openInterviewModal(app)}
                          className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs transition-colors"
                        >
                          Hẹn phỏng vấn
                        </button>
                        <button
                          type="button"
                          onClick={() => openOfferModal(app)}
                          className="px-3 py-1.5 rounded-xl bg-green-main hover:bg-green-dark text-white font-bold text-xs transition-colors shadow-xs"
                        >
                          Gửi Offer nhận việc 📨
                        </button>
                      </>
                    )}

                    {app.status === 'interview' && (
                      <button
                        type="button"
                        onClick={() => openOfferModal(app)}
                        className="px-3 py-1.5 rounded-xl bg-green-main hover:bg-green-dark text-white font-bold text-xs transition-colors shadow-xs"
                      >
                        Gửi Offer nhận việc 📨
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => openDetailModal(app)}
                      className="px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs transition-colors"
                    >
                      Chi tiết & Ghi chú
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAIL & STATUS MANAGEMENT MODAL */}
      {selectedApp && !interviewModalOpen && !offerModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedApp(null)}
          title={`Hồ sơ: ${selectedApp.studentName}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 space-y-1.5">
              <p><strong>Vị trí:</strong> {selectedApp.selectedPosition || selectedApp.jobTitle}</p>
              <p><strong>Ca làm mong muốn:</strong> {selectedApp.selectedShift || 'Linh hoạt'}</p>
              <p><strong>SĐT:</strong> {selectedApp.studentPhone || 'Chưa cập nhật'}</p>
              <p><strong>Email:</strong> {selectedApp.studentEmail || 'Chưa cập nhật'}</p>
              {selectedApp.note && <p><strong>Lời nhắn:</strong> "{selectedApp.note}"</p>}
            </div>

            <div>
              <label className="font-bold text-gray-800 block mb-1">Ghi chú nội bộ (Chỉ nhà tuyển dụng thấy):</label>
              <textarea
                rows={2}
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder="Nhập đánh giá ứng viên, điểm mạnh/yếu..."
                className="w-full p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-main"
              />
            </div>

            <div>
              <label className="font-bold text-gray-800 block mb-1">Tin nhắn gửi ứng viên:</label>
              <textarea
                rows={2}
                value={candidateFeedback}
                onChange={(e) => setCandidateFeedback(e.target.value)}
                placeholder="Lời nhắn ứng viên sẽ nhìn thấy trong trang quản lý của họ..."
                className="w-full p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-main"
              />
            </div>

            <div className="pt-2 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleStatusChange('rejected')}
                disabled={submitting}
                className="px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 font-bold transition-colors"
              >
                Từ chối hồ sơ
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openOfferModal(selectedApp)}
                  className="px-3.5 py-2 rounded-xl bg-green-main hover:bg-green-dark text-white font-bold transition-colors shadow-xs"
                >
                  Gửi Offer nhận việc 📨
                </button>
                <button
                  type="button"
                  onClick={() => openInterviewModal(selectedApp)}
                  className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold transition-colors"
                >
                  Hẹn phỏng vấn 📅
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* STRUCTURED INTERVIEW MODAL */}
      {interviewModalOpen && selectedApp && (
        <Modal
          isOpen={true}
          onClose={() => setInterviewModalOpen(false)}
          title={`Lên lịch phỏng vấn: ${selectedApp.studentName}`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-gray-800 block mb-1">Ngày phỏng vấn *</label>
                <input
                  type="date"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  className="w-full p-2 rounded-xl border border-gray-200 font-semibold"
                />
              </div>
              <div>
                <label className="font-bold text-gray-800 block mb-1">Giờ phỏng vấn *</label>
                <input
                  type="time"
                  value={interviewTime}
                  onChange={(e) => setInterviewTime(e.target.value)}
                  className="w-full p-2 rounded-xl border border-gray-200 font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-gray-800 block mb-1">Địa điểm phỏng vấn (hoặc link online) *</label>
              <input
                type="text"
                value={interviewLocation}
                onChange={(e) => setInterviewLocation(e.target.value)}
                placeholder="Địa chỉ quán hoặc link Google Meet..."
                className="w-full p-2 rounded-xl border border-gray-200"
              />
            </div>

            <div>
              <label className="font-bold text-gray-800 block mb-1">Lời nhắn / dặn dò ứng viên:</label>
              <textarea
                rows={2}
                value={interviewNote}
                onChange={(e) => setInterviewNote(e.target.value)}
                placeholder="Ví dụ: Vui lòng mang theo thẻ sinh viên và đến trước 5 phút..."
                className="w-full p-2 rounded-xl border border-gray-200"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setInterviewModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={submitting || !interviewDate || !interviewLocation}
                onClick={handleSaveInterview}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold disabled:opacity-50"
              >
                {submitting ? 'Đang gửi...' : 'Gửi lời mời phỏng vấn'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* FORMAL JOB OFFER MODAL */}
      {offerModalOpen && selectedApp && (
        <Modal
          isOpen={true}
          onClose={() => setOfferModalOpen(false)}
          title={`Gửi đề nghị nhận việc (Job Offer): ${selectedApp.studentName}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-950">
              <p className="font-bold text-sm">Lời mời hợp tác chính thức</p>
              <p className="text-[11px] mt-0.5 text-emerald-800">
                Sau khi bạn gửi Offer, ứng viên sẽ nhận thông báo và có quyền <strong>Đồng ý</strong> hoặc <strong>Từ chối</strong>. Khi ứng viên chấp thuận, hệ thống sẽ tự động tạo hồ sơ nhân viên chính thức.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-gray-800 block mb-1">Vị trí nhận việc *</label>
                <input
                  type="text"
                  value={offerPosition}
                  onChange={(e) => setOfferPosition(e.target.value)}
                  className="w-full p-2 rounded-xl border border-gray-200 font-semibold"
                />
              </div>
              <div>
                <label className="font-bold text-gray-800 block mb-1">Mức lương *</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={offerWage}
                    onChange={(e) => setOfferWage(e.target.value)}
                    className="w-full p-2 rounded-xl border border-gray-200 font-semibold"
                  />
                  <select
                    value={offerWageUnit}
                    onChange={(e) => setOfferWageUnit(e.target.value)}
                    className="p-2 rounded-xl border border-gray-200 font-semibold bg-white"
                  >
                    <option value="hour">đ/giờ</option>
                    <option value="shift">đ/ca</option>
                    <option value="month">đ/tháng</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-gray-800 block mb-1">Ca làm việc dự kiến</label>
                <input
                  type="text"
                  value={offerSchedule}
                  onChange={(e) => setOfferSchedule(e.target.value)}
                  className="w-full p-2 rounded-xl border border-gray-200"
                />
              </div>
              <div>
                <label className="font-bold text-gray-800 block mb-1">Ngày bắt đầu làm việc</label>
                <input
                  type="date"
                  value={offerStartDate}
                  onChange={(e) => setOfferStartDate(e.target.value)}
                  className="w-full p-2 rounded-xl border border-gray-200"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-gray-800 block mb-1">Thời hạn phản hồi offer</label>
              <select
                value={offerExpiryDays}
                onChange={(e) => setOfferExpiryDays(e.target.value)}
                className="w-full p-2 rounded-xl border border-gray-200 bg-white font-semibold"
              >
                <option value="1">Trong vòng 24 giờ</option>
                <option value="3">Trong vòng 3 ngày</option>
                <option value="5">Trong vòng 5 ngày</option>
                <option value="7">Trong vòng 7 ngày</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-gray-800 block mb-1">Lời nhắn gửi kèm offer:</label>
              <textarea
                rows={2}
                value={offerNote}
                onChange={(e) => setOfferNote(e.target.value)}
                className="w-full p-2 rounded-xl border border-gray-200"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setOfferModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={submitting || !offerPosition || !offerWage}
                onClick={handleSendOfferSubmit}
                className="px-4 py-2 rounded-xl bg-green-main hover:bg-green-dark text-white font-bold disabled:opacity-50 shadow-xs"
              >
                {submitting ? 'Đang gửi...' : 'Gửi Đề nghị nhận việc 📨'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
