import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  MapPin,
  Calendar,
  Building2,
  Check,
  Sparkles,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import {
  getApplications,
  withdrawApplication,
  acceptOffer,
  declineOffer,
} from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Modal } from '@/components/Modal.jsx';
import { Toast } from '@/components/Feedback.jsx';

export default function ApplicationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedApp, setSelectedApp] = useState(null);
  const [withdrawId, setWithdrawId] = useState(null);
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Decline Offer Modal
  const [declineModalApp, setDeclineModalApp] = useState(null);
  const [declineReason, setDeclineReason] = useState('');

  const loadApps = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getApplications({ studentId: user?.id });
      setApplications(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadApps();
  }, [loadApps]);


  // Handle Accept Offer
  async function handleAcceptOffer(app) {
    const appId = app.id || app._id;
    try {
      setSubmitting(true);
      await acceptOffer(appId);
      setToast({
        type: 'success',
        message: '🎉 Chúc mừng bạn đã chấp nhận đề nghị nhận việc và chính thức trở thành nhân viên! Đang chuyển đến lịch ca...',
      });
      // Refresh applications and navigate
      setApplications((prev) =>
        prev.map((a) => ((a.id || a._id) === appId ? { ...a, status: 'hired' } : a))
      );
      setTimeout(() => {
        navigate('/student/shifts');
      }, 1500);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi chấp nhận đề nghị nhận việc.' });
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Decline Offer
  async function handleConfirmDeclineOffer() {
    if (!declineModalApp) return;
    const appId = declineModalApp.id || declineModalApp._id;

    try {
      setSubmitting(true);
      await declineOffer(appId, declineReason);
      setApplications((prev) =>
        prev.map((a) => ((a.id || a._id) === appId ? { ...a, status: 'offer_declined' } : a))
      );
      setToast({ type: 'info', message: 'Bạn đã từ chối đề nghị nhận việc.' });
      setDeclineModalApp(null);
      setDeclineReason('');
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi từ chối đề nghị.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmWithdraw() {
    if (!withdrawId) return;
    try {
      await withdrawApplication(withdrawId);
      setApplications((prev) =>
        prev.map((a) => ((a.id || a._id) === withdrawId ? { ...a, status: 'withdrawn' } : a))
      );
      setToast({ type: 'success', message: 'Đã rút đơn ứng tuyển thành công.' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi rút đơn ứng tuyển.' });
    } finally {
      setWithdrawId(null);
    }
  }

  const filteredApps = applications.filter((a) => {
    if (activeTab === 'offer_sent') return a.status === 'offer_sent';
    if (activeTab === 'submitted') return a.status === 'submitted' || a.status === 'pending' || !a.status;
    if (activeTab === 'screening') return a.status === 'screening' || a.status === 'reviewing' || a.status === 'shortlisted';
    if (activeTab === 'interview') return a.status === 'interview';
    if (activeTab === 'hired') return a.status === 'hired' || a.status === 'offer_accepted' || a.status === 'approved' || a.status === 'accepted';
    if (activeTab === 'rejected') return ['rejected', 'withdrawn', 'offer_declined', 'offer_expired', 'offer_rescinded'].includes(a.status);
    return true;
  });

  const getStudentStatusBadge = (status) => {
    switch (status) {
      case 'hired':
      case 'approved':
      case 'accepted':
        return { variant: 'success', label: 'Trúng tuyển chính thức 🎉' };
      case 'offer_accepted':
        return { variant: 'success', label: 'Đã chấp nhận Offer 🤝' };
      case 'offer_sent':
        return { variant: 'purple', label: 'Nhận Đề Nghị Việc Làm (Offer)! 📨' };
      case 'interview':
        return { variant: 'purple', label: 'Mời phỏng vấn 📅' };
      case 'screening':
      case 'reviewing':
        return { variant: 'info', label: 'Đang xem xét' };
      case 'shortlisted':
        return { variant: 'info', label: 'Lọt vòng sơ loại' };
      case 'offer_declined':
        return { variant: 'neutral', label: 'Đã từ chối Offer' };
      case 'offer_expired':
        return { variant: 'neutral', label: 'Offer hết hạn' };
      case 'rejected':
        return { variant: 'danger', label: 'Chưa phù hợp' };
      case 'withdrawn':
        return { variant: 'neutral', label: 'Đã rút đơn' };
      case 'submitted':
      case 'pending':
      default:
        return { variant: 'warning', label: 'Đang chờ duyệt' };
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header & Tabs */}
      <div className="bg-white p-6 rounded-3xl border border-green-50 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main flex items-center gap-2">
            <FileText className="w-6 h-6 text-green-main" /> Quản lý đơn ứng tuyển
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Theo dõi trạng thái xét duyệt hồ sơ và phản hồi đề nghị nhận việc từ các nhà tuyển dụng Hòa Lạc.
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1.5 bg-cream/70 rounded-2xl border border-green-50 self-start md:self-center overflow-x-auto max-w-full">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'offer_sent', label: 'Có Offer 📨' },
            { id: 'submitted', label: 'Chờ duyệt' },
            { id: 'screening', label: 'Đang xét' },
            { id: 'interview', label: 'Phỏng vấn' },
            { id: 'hired', label: 'Trúng tuyển' },
            { id: 'rejected', label: 'Từ chối / Rút' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-white text-green-dark shadow-sm'
                  : 'text-text-muted hover:text-text-main'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-text-muted">Đang tải danh sách đơn...</div>
      ) : filteredApps.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-green-50 shadow-card space-y-3">
          <FileText className="w-12 h-12 text-text-muted mx-auto opacity-50" />
          <h3 className="text-base font-bold text-text-main">Không tìm thấy đơn ứng tuyển nào</h3>
          <p className="text-xs text-text-muted">Ứng tuyển các công việc mới tại trang danh sách để bắt đầu nhận ca làm.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredApps.map((app) => {
            const badge = getStudentStatusBadge(app.status);
            const isOffer = app.status === 'offer_sent';
            const offer = app.offer || {};

            return (
              <div
                key={app.id || app._id}
                className={clsx(
                  'p-5 rounded-3xl border transition-all flex flex-col justify-between gap-4 shadow-card',
                  isOffer
                    ? 'bg-gradient-to-r from-emerald-50/80 to-green-50/80 border-emerald-300'
                    : 'bg-white border-green-50 hover:border-green-main'
                )}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        {app.storeName || 'Cửa hàng tuyển dụng'}
                      </span>
                      <span className="text-gray-300">•</span>
                      <Badge variant={badge.variant} className="text-[11px] font-bold">
                        {badge.label}
                      </Badge>
                    </div>

                    <h2 className="text-base sm:text-lg font-bold text-text-main leading-snug">
                      {app.jobTitle}
                    </h2>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                      {app.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-green-main" /> {app.location}
                        </span>
                      )}
                      {app.selectedPosition && (
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md font-medium">
                          Vị trí: {app.selectedPosition}
                        </span>
                      )}
                      {app.selectedShift && (
                        <span className="bg-green-50 text-green-800 px-2 py-0.5 rounded-md font-medium">
                          Ca: {app.selectedShift}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedApp(app)}
                      className="px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs transition-colors"
                    >
                      Xem chi tiết đơn
                    </button>

                    <Link
                      to={`/student/messages?open=application:${app.id || app._id}`}
                      className="px-3 py-1.5 rounded-xl bg-green-50 hover:bg-green-100 text-green-dark font-bold text-xs transition-colors"
                    >
                      Nhắn tin
                    </Link>

                    {['submitted', 'screening', 'pending', 'reviewing'].includes(app.status) && (
                      <button
                        type="button"
                        onClick={() => setWithdrawId(app.id || app._id)}
                        className="px-3 py-1.5 rounded-xl text-red-600 hover:bg-red-50 font-bold text-xs transition-colors"
                      >
                        Rút đơn
                      </button>
                    )}
                  </div>
                </div>

                {/* SPECIAL PROMINENT BANNER FOR JOB OFFER */}
                {isOffer && (
                  <div className="mt-2 p-4 rounded-2xl bg-white border border-emerald-200 shadow-xs space-y-3">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                      <Sparkles className="w-5 h-5 text-emerald-600" />
                      <span>Đề nghị nhận việc chính thức (Job Offer)</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-emerald-50/50 p-3 rounded-xl">
                      <div>
                        <span className="text-gray-500 block">Vị trí:</span>
                        <strong className="text-gray-900">{offer.position || app.selectedPosition}</strong>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Mức lương:</span>
                        <strong className="text-emerald-700 font-bold">
                          {(offer.wage || 25000).toLocaleString('vi-VN')} đ/{offer.wageUnit === 'hour' ? 'giờ' : offer.wageUnit}
                        </strong>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Hạn phản hồi:</span>
                        <strong className="text-amber-800">
                          {offer.expiryDate ? new Date(offer.expiryDate).toLocaleDateString('vi-VN') : 'Sớm nhất có thể'}
                        </strong>
                      </div>
                    </div>

                    {offer.note && (
                      <p className="text-xs text-gray-600 italic">
                        "{offer.note}"
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setDeclineModalApp(app)}
                        className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold text-xs transition-colors"
                      >
                        Từ chối đề nghị
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleAcceptOffer(app)}
                        className="px-5 py-2 rounded-xl bg-green-main hover:bg-green-dark text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4" /> Đồng ý nhận việc (Accept Offer)
                      </button>
                    </div>
                  </div>
                )}

                {/* SPECIAL BANNER FOR INTERVIEW */}
                {app.status === 'interview' && app.interviewSchedule?.date && (
                  <div className="mt-2 p-3.5 rounded-2xl bg-purple-50 border border-purple-200 text-purple-950 text-xs space-y-1">
                    <p className="font-bold flex items-center gap-1.5 text-purple-900">
                      <Calendar className="w-4 h-4 text-purple-600" /> Lời mời phỏng vấn từ nhà tuyển dụng
                    </p>
                    <p>
                      Thời gian: <strong>{app.interviewSchedule.date}</strong> lúc <strong>{app.interviewSchedule.time || 'Theo hẹn'}</strong>
                    </p>
                    <p>Địa điểm: <strong>{app.interviewSchedule.location}</strong></p>
                    {app.interviewSchedule.note && <p className="italic text-purple-800">"{app.interviewSchedule.note}"</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedApp && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedApp(null)}
          title={`Chi tiết đơn: ${selectedApp.jobTitle}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 space-y-1.5">
              <p><strong>Cơ sở / Quán:</strong> {selectedApp.storeName}</p>
              <p><strong>Vị trí ứng tuyển:</strong> {selectedApp.selectedPosition || selectedApp.jobTitle}</p>
              <p><strong>Ca làm mong muốn:</strong> {selectedApp.selectedShift || 'Linh hoạt'}</p>
              <p><strong>Ngày nộp:</strong> {selectedApp.appliedAt}</p>
              {selectedApp.note && <p><strong>Lời nhắn của bạn:</strong> "{selectedApp.note}"</p>}
            </div>

            {selectedApp.candidateFeedback && (
              <div className="p-3.5 bg-green-50 rounded-2xl border border-green-200 space-y-1">
                <p className="font-bold text-green-950">Phản hồi từ Nhà Tuyển Dụng:</p>
                <p className="text-green-800">{selectedApp.candidateFeedback}</p>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold"
              >
                Đóng
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* DECLINE OFFER MODAL */}
      {declineModalApp && (
        <Modal
          isOpen={true}
          onClose={() => setDeclineModalApp(null)}
          title="Từ chối đề nghị nhận việc"
        >
          <div className="space-y-4 text-xs">
            <p className="text-gray-700">
              Bạn có chắc chắn muốn từ chối đề nghị nhận việc vị trí <strong>{declineModalApp.offer?.position || declineModalApp.jobTitle}</strong> từ quán <strong>{declineModalApp.storeName}</strong> không?
            </p>
            <div>
              <label className="font-bold text-gray-800 block mb-1">Lý do từ chối (tùy chọn):</label>
              <textarea
                rows={2}
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Ví dụ: Lịch học thay đổi / đã tìm được công việc khác phù hợp hơn..."
                className="w-full p-2.5 rounded-xl border border-gray-200"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setDeclineModalApp(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmDeclineOffer}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* WITHDRAW MODAL */}
      {withdrawId && (
        <Modal
          isOpen={true}
          onClose={() => setWithdrawId(null)}
          title="Xác nhận rút đơn ứng tuyển"
        >
          <div className="space-y-4 text-xs">
            <p className="text-gray-700">
              Bạn có chắc chắn muốn rút đơn ứng tuyển này không? Nhà tuyển dụng sẽ không thể xét duyệt hồ sơ này nữa.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setWithdrawId(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold"
              >
                Không, giữ lại
              </button>
              <button
                type="button"
                onClick={handleConfirmWithdraw}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                Đồng ý rút đơn
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
