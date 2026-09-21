import { useState, useEffect } from 'react';
import {
  Users, CheckCircle, XCircle, Clock, Eye, Calendar, Sparkles, MapPin,
  Building2, MessageSquare, ShieldCheck, Phone, MessageCircle, FileText,
  UserCheck, AlertCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getApplications, updateApplication } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Modal } from '@/components/Modal.jsx';
import { Toast } from '@/components/Feedback.jsx';

const PIPELINE_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'pending', label: 'Mới nộp' },
  { id: 'reviewing', label: 'Đang xem xét' },
  { id: 'interview', label: 'Phỏng vấn' },
  { id: 'hired', label: 'Trúng tuyển' },
  { id: 'rejected', label: 'Từ chối' },
];

function getStatusBadge(status) {
  switch (status) {
    case 'hired':
    case 'approved':
    case 'accepted':
      return { variant: 'success', label: 'Trúng tuyển 🎉' };
    case 'interview':
      return { variant: 'purple', label: 'Mời phỏng vấn 📅' };
    case 'reviewing':
      return { variant: 'info', label: 'Đang xem xét' };
    case 'shortlisted':
      return { variant: 'info', label: 'Vào vòng sơ loại' };
    case 'rejected':
      return { variant: 'danger', label: 'Đã từ chối' };
    case 'withdrawn':
      return { variant: 'neutral', label: 'Đã rút đơn' };
    case 'pending':
    default:
      return { variant: 'warning', label: 'Mới nộp' };
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

  function openDetailModal(app) {
    setSelectedApp(app);
    setCandidateFeedback(app.candidateFeedback || app.employerNote || app.note || '');
    setInternalNote(app.internalNote || '');
  }

  async function handleStatusChange(targetStatus) {
    if (!selectedApp) return;
    const appId = selectedApp._id || selectedApp.id;

    try {
      setSubmitting(true);
      const updated = await updateApplication(appId, {
        status: targetStatus,
        candidateFeedback,
        internalNote,
        employerNote: candidateFeedback,
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

  const filtered = applications.filter((a) => {
    if (activeTab === 'pending') return a.status === 'pending' || !a.status;
    if (activeTab === 'reviewing') return a.status === 'reviewing' || a.status === 'shortlisted';
    if (activeTab === 'interview') return a.status === 'interview';
    if (activeTab === 'hired') return a.status === 'hired' || a.status === 'approved' || a.status === 'accepted';
    if (activeTab === 'rejected') return a.status === 'rejected';
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
            Quy trình tuyển dụng chuyên nghiệp: Tiếp nhận hồ sơ ➔ Xem xét ➔ Phỏng vấn ➔ Tiếp nhận trúng tuyển.
          </p>
        </div>

        {/* Pipeline Tabs */}
        <div className="flex items-center gap-1 p-1.5 bg-cream/80 rounded-2xl border border-green-50 overflow-x-auto max-w-full">
          {PIPELINE_TABS.map((tab) => {
            const count = applications.filter((a) => {
              if (tab.id === 'all') return true;
              if (tab.id === 'pending') return a.status === 'pending' || !a.status;
              if (tab.id === 'reviewing') return a.status === 'reviewing' || a.status === 'shortlisted';
              if (tab.id === 'interview') return a.status === 'interview';
              if (tab.id === 'hired') return a.status === 'hired' || a.status === 'approved' || a.status === 'accepted';
              if (tab.id === 'rejected') return a.status === 'rejected';
              return false;
            }).length;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5',
                  activeTab === tab.id
                    ? 'bg-white text-green-dark shadow-sm'
                    : 'text-text-muted hover:text-text-main'
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={clsx(
                    'px-1.5 py-0.2 rounded-full text-[10px]',
                    activeTab === tab.id ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-text-muted">Đang tải danh sách ứng viên...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-green-50 shadow-card space-y-3">
          <Users className="w-12 h-12 text-text-muted mx-auto opacity-40" />
          <h3 className="text-base font-bold text-text-main">Không có ứng viên trong giai đoạn này</h3>
          <p className="text-xs text-text-muted">
            Khi sinh viên nộp đơn ứng tuyển, thông tin hồ sơ sẽ tự động xuất hiện tại đây.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((app) => {
            const badge = getStatusBadge(app.status);
            const appliedDate = app.appliedAt || (app.createdAt ? new Date(app.createdAt).toLocaleDateString('vi-VN') : 'Mới đây');

            return (
              <div
                key={app._id || app.id}
                className="bg-white p-5 sm:p-6 rounded-3xl border border-green-50 shadow-card hover:border-green-200 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2.5 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-green-600 to-emerald-500 text-white font-bold text-base flex items-center justify-center shadow-sm">
                      {app.studentName?.charAt(0) || 'S'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-text-main">
                          {app.studentName || 'Sinh viên Hòa Lạc'}
                        </h3>
                        <Badge variant={badge.variant} size="sm">
                          {badge.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-text-muted mt-0.5">
                        Ứng tuyển: <strong className="text-text-main">{app.jobTitle || app.title || 'Công việc'}</strong> • Ngày nộp: {appliedDate}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 text-xs">
                    <Badge variant="outline" size="sm">🎓 Sinh viên Hòa Lạc</Badge>
                    {app.studentPhone && (
                      <span className="inline-flex items-center gap-1 font-semibold text-gray-800 bg-gray-100 px-2.5 py-0.5 rounded-full text-[11px]">
                        <Phone className="w-3 h-3 text-green-dark" /> {app.studentPhone}
                      </span>
                    )}
                    {app.studentEmail && (
                      <span className="text-text-muted text-[11px]">
                        ✉️ {app.studentEmail}
                      </span>
                    )}
                    <span className="text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full text-[11px]">
                      ✨ Lịch rảnh phù hợp
                    </span>
                  </div>

                  {(app.coverLetter || app.note) && (
                    <p className="text-xs text-text-muted bg-gray-50 border border-gray-100 p-2.5 rounded-xl line-clamp-2 max-w-2xl font-medium">
                      "{app.coverLetter || app.note}"
                    </p>
                  )}

                  {app.candidateFeedback && (
                    <p className="text-xs text-green-800 bg-green-50/70 border border-green-100 p-2 rounded-xl max-w-2xl">
                      💬 <strong>Phản hồi của quán:</strong> {app.candidateFeedback}
                    </p>
                  )}
                </div>

                {/* Right action buttons */}
                <div className="flex flex-wrap items-center gap-2 self-end md:self-center">
                  {app.studentPhone && (
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`tel:${app.studentPhone}`}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all"
                        title="Gọi điện thoại"
                      >
                        <Phone className="w-3.5 h-3.5" /> Gọi
                      </a>
                      <a
                        href={`https://zalo.me/${app.studentPhone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all"
                        title="Nhắn tin Zalo"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Zalo
                      </a>
                    </div>
                  )}

                  <button
                    onClick={() => openDetailModal(app)}
                    className="px-4 py-2 rounded-xl bg-green-main hover:bg-green-dark text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Quản lý ứng viên
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Candidate Pipeline Modal */}
      {selectedApp && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedApp(null)}
          title={`Hồ sơ & Quy trình: ${selectedApp.studentName || 'Sinh viên'}`}
        >
          <div className="space-y-4 text-xs">
            {/* Candidate Summary */}
            <div className="p-4 rounded-2xl bg-cream/70 space-y-2 border border-green-100">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-text-main">
                  Vị trí: {selectedApp.jobTitle || selectedApp.title || 'Công việc'}
                </h4>
                <Badge variant={getStatusBadge(selectedApp.status).variant} size="sm">
                  {getStatusBadge(selectedApp.status).label}
                </Badge>
              </div>
              <p className="text-text-muted">Sinh viên: <strong className="text-text-main">{selectedApp.studentName}</strong></p>
              {selectedApp.studentPhone && (
                <p className="text-text-muted flex items-center gap-1.5">
                  <span>Số điện thoại / Zalo:</span>
                  <a href={`tel:${selectedApp.studentPhone}`} className="font-bold text-blue-600 hover:underline">
                    {selectedApp.studentPhone}
                  </a>
                </p>
              )}
              {selectedApp.studentEmail && (
                <p className="text-text-muted">Email: <strong>{selectedApp.studentEmail}</strong></p>
              )}
            </div>

            {/* Cover Letter / Note */}
            <div>
              <label className="font-bold text-text-main block mb-1">Thư ứng tuyển & Lời nhắn của sinh viên:</label>
              <p className="p-3 rounded-xl bg-gray-50 text-text-main whitespace-pre-line font-medium leading-relaxed border border-gray-100">
                {selectedApp.coverLetter || selectedApp.note || 'Không có ghi chú thêm.'}
              </p>
            </div>

            {/* Candidate Feedback (Student will see this) */}
            <div>
              <label className="font-bold text-text-main block mb-1">
                Phản hồi gửi sinh viên <span className="text-text-muted font-normal">(Sinh viên sẽ thấy trong thông báo):</span>
              </label>
              <textarea
                rows={2}
                value={candidateFeedback}
                onChange={(e) => setCandidateFeedback(e.target.value)}
                placeholder="Ví dụ: Chào em, cửa hàng mời em tới phỏng vấn thử việc vào ca sáng Thứ 2..."
                className="w-full p-2.5 rounded-xl border border-green-100 focus:outline-none focus:ring-2 focus:ring-green-main resize-none bg-white"
              />
            </div>

            {/* Internal Note (Only employer sees this) */}
            <div>
              <label className="font-bold text-text-main block mb-1">
                Ghi chú nội bộ <span className="text-text-muted font-normal">(Chỉ nội bộ quán nhìn thấy):</span>
              </label>
              <textarea
                rows={2}
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder="Ghi chú đánh giá, ấn tượng vòng phỏng vấn, thái độ..."
                className="w-full p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-main resize-none bg-gray-50/50"
              />
            </div>

            {/* Pipeline Stage Transitions */}
            <div className="pt-2 border-t border-green-50">
              <p className="font-bold text-text-main mb-2">Chuyển giai đoạn tuyển dụng:</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleStatusChange('reviewing')}
                  className={clsx(
                    'px-3 py-2 rounded-xl text-xs font-semibold border transition-all',
                    selectedApp.status === 'reviewing'
                      ? 'bg-blue-50 text-blue-700 border-blue-300 ring-2 ring-blue-200'
                      : 'bg-white hover:bg-blue-50 text-blue-600 border-blue-200'
                  )}
                >
                  Đang xem xét
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleStatusChange('interview')}
                  className={clsx(
                    'px-3 py-2 rounded-xl text-xs font-semibold border transition-all',
                    selectedApp.status === 'interview'
                      ? 'bg-purple-50 text-purple-700 border-purple-300 ring-2 ring-purple-200'
                      : 'bg-white hover:bg-purple-50 text-purple-600 border-purple-200'
                  )}
                >
                  Mời phỏng vấn 📅
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleStatusChange('hired')}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
                >
                  Trúng tuyển 🎉
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleStatusChange('rejected')}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-all"
                >
                  Từ chối hồ sơ
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
