import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, Clock, CheckCircle, XCircle, AlertCircle, MapPin, Calendar,
  Building2, ChevronRight, Eye, Trash2
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getApplications, withdrawApplication } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Modal } from '@/components/Modal.jsx';
import { Toast } from '@/components/Feedback.jsx';

export default function ApplicationsPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedApp, setSelectedApp] = useState(null);
  const [withdrawId, setWithdrawId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadApps();
  }, [user]);

  async function loadApps() {
    try {
      setLoading(true);
      const data = await getApplications({ studentId: user?.id });
      setApplications(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmWithdraw() {
    if (!withdrawId) return;
    try {
      await withdrawApplication(withdrawId);
      setApplications(prev => prev.filter(a => a.id !== withdrawId));
      setToast({ type: 'success', message: 'Đã rút đơn ứng tuyển thành công.' });
    } catch (err) {
      setToast({ type: 'error', message: 'Lỗi khi rút đơn ứng tuyển.' });
    } finally {
      setWithdrawId(null);
    }
  }

  const filteredApps = applications.filter(a => {
    if (activeTab === 'pending') return a.status === 'pending' || !a.status;
    if (activeTab === 'reviewing') return a.status === 'reviewing' || a.status === 'shortlisted';
    if (activeTab === 'interview') return a.status === 'interview';
    if (activeTab === 'approved') return a.status === 'approved' || a.status === 'accepted' || a.status === 'hired';
    if (activeTab === 'rejected') return a.status === 'rejected' || a.status === 'withdrawn';
    return true;
  });

  const getStudentStatusBadge = (status) => {
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
        return { variant: 'info', label: 'Lọt vòng sau' };
      case 'rejected':
        return { variant: 'danger', label: 'Chưa phù hợp' };
      case 'withdrawn':
        return { variant: 'neutral', label: 'Đã rút đơn' };
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
            Theo dõi trạng thái duyệt hồ sơ từ các cửa hàng nhà tuyển dụng Hòa Lạc.
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1.5 bg-cream/70 rounded-2xl border border-green-50 self-start md:self-center overflow-x-auto max-w-full">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'pending', label: 'Chờ duyệt' },
            { id: 'reviewing', label: 'Đang xét' },
            { id: 'interview', label: 'Phỏng vấn' },
            { id: 'approved', label: 'Trúng tuyển' },
            { id: 'rejected', label: 'Từ chối / Rút' }
          ].map(tab => (
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
          {filteredApps.map(app => {
            const badge = getStudentStatusBadge(app.status);
            return (
              <div
                key={app.id || app._id}
                className="bg-white p-5 rounded-2xl border border-green-50 shadow-card hover:border-green-main transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-bold text-text-main">{app.jobTitle || app.title}</h3>
                    <Badge variant={badge.variant} size="sm">
                      {badge.label}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted">
                    <span className="flex items-center gap-1 font-medium text-green-dark">
                      <Building2 className="w-3.5 h-3.5 text-green-main" /> {app.storeName}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-red-400" /> {app.location || 'Hòa Lạc'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-500" /> Nộp ngày: {app.appliedAt || (app.createdAt ? new Date(app.createdAt).toLocaleDateString('vi-VN') : 'Mới đây')}
                    </span>
                  </div>

                  {(app.candidateFeedback || app.employerNote || app.note) && (
                    <div className="p-3 rounded-xl bg-green-50/70 text-xs text-text-main font-medium border border-green-100">
                      💬 <strong>Phản hồi từ cửa hàng:</strong> "{app.candidateFeedback || app.employerNote || app.note}"
                    </div>
                  )}
                </div>

              <div className="flex items-center gap-2 border-t md:border-t-0 pt-3 md:pt-0 border-green-50 justify-end">
                <button
                  onClick={() => setSelectedApp(app)}
                  className="px-3 py-2 rounded-xl bg-cream hover:bg-green-50 text-text-main text-xs font-semibold transition-colors flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" /> Chi tiết
                </button>

                {app.status === 'pending' && (
                  <button
                    onClick={() => setWithdrawId(app.id)}
                    className="px-3 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Rút đơn
                  </button>
                )}

                {(app.status === 'approved' || app.status === 'accepted' || app.status === 'hired') && (
                  <Link
                    to="/student/shifts"
                    className="px-3.5 py-2 rounded-xl bg-green-main text-white text-xs font-semibold hover:bg-green-dark transition-all flex items-center gap-1"
                  >
                    <Calendar className="w-3.5 h-3.5" /> Xem lịch làm
                  </Link>
                )}
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* App Detail Modal */}
      {selectedApp && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedApp(null)}
          title="Chi tiết đơn ứng tuyển"
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-cream/60 space-y-2">
              <h4 className="text-sm font-bold text-text-main">{selectedApp.jobTitle || selectedApp.title}</h4>
              <p className="text-text-muted">Cửa hàng: <strong className="text-text-main">{selectedApp.storeName}</strong></p>
              <p className="text-text-muted">Ngày ứng tuyển: {selectedApp.appliedAt}</p>
            </div>

            <div>
              <label className="font-bold text-text-main block mb-1">Lời nhắn của bạn:</label>
              <p className="p-3 rounded-xl bg-gray-50 text-text-muted italic">{selectedApp.coverLetter || 'Không có lời nhắn bổ sung.'}</p>
            </div>

            {selectedApp.matchedAvailability && (
              <div className="p-3 rounded-xl bg-green-50 text-green-dark font-medium">
                ✨ Lịch rảnh match 100% với khung ca của cửa hàng.
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Confirm Withdraw Modal */}
      {withdrawId && (
        <Modal
          isOpen={true}
          onClose={() => setWithdrawId(null)}
          title="Xác nhận rút đơn"
        >
          <div className="space-y-4 text-xs">
            <p className="text-text-main">
              Bạn có chắc chắn muốn rút đơn ứng tuyển công việc này? Thao tác này không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setWithdrawId(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-text-muted text-xs font-semibold hover:bg-gray-200"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmWithdraw}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
              >
                Xác nhận rút
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
