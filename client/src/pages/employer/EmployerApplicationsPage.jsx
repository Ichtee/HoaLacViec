import { useState, useEffect } from 'react';
import {
  Users, CheckCircle, XCircle, Clock, Eye, Calendar, Sparkles, MapPin,
  Building2, MessageSquare, ShieldCheck
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getApplications, updateApplication } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Modal } from '@/components/Modal.jsx';
import { Toast } from '@/components/Feedback.jsx';

export default function EmployerApplicationsPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedApp, setSelectedApp] = useState(null);
  const [noteInput, setNoteInput] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadApps();
  }, [user]);

  async function loadApps() {
    try {
      setLoading(true);
      const data = await getApplications({ storeId: user?.id });
      setApplications(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(appId, newStatus) {
    try {
      await updateApplication(appId, { status: newStatus, note: noteInput });
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus, note: noteInput } : a));
      setToast({
        type: newStatus === 'approved' ? 'success' : 'info',
        message: `Đã cập nhật trạng thái ứng viên thành: ${newStatus === 'approved' ? 'Trúng tuyển' : 'Từ chối'}`
      });
      setSelectedApp(null);
      setNoteInput('');
    } catch (err) {
      setToast({ type: 'error', message: 'Lỗi khi cập nhật đơn.' });
    }
  }

  const filtered = applications.filter(a => {
    if (activeTab === 'pending') return a.status === 'pending';
    if (activeTab === 'approved') return a.status === 'approved' || a.status === 'accepted';
    if (activeTab === 'rejected') return a.status === 'rejected';
    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-green-50 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main flex items-center gap-2">
            <Users className="w-6 h-6 text-pink-main" /> Quản lý ứng viên sinh viên
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Xem danh sách hồ sơ sinh viên ứng tuyển, kiểm tra mức độ trùng khớp lịch rảnh và duyệt trúng tuyển.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-cream rounded-2xl border border-green-50 self-start sm:self-center">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'pending', label: 'Chờ duyệt' },
            { id: 'approved', label: 'Đã nhận' },
            { id: 'rejected', label: 'Từ chối' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all',
                activeTab === tab.id ? 'bg-white text-pink-dark shadow-sm' : 'text-text-muted hover:text-text-main'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-text-muted">Đang tải danh sách ứng viên...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-green-50 shadow-card space-y-3">
          <Users className="w-12 h-12 text-text-muted mx-auto opacity-50" />
          <h3 className="text-base font-bold text-text-main">Chưa có ứng viên trong danh mục này</h3>
          <p className="text-xs text-text-muted">Khi sinh viên nộp đơn ứng tuyển, thông tin hồ sơ sẽ tự động xuất hiện tại đây.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(app => (
            <div
              key={app.id}
              className="bg-white p-6 rounded-3xl border border-green-50 shadow-card hover:border-pink-200 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-main to-purple-600 text-white font-bold text-sm flex items-center justify-center">
                    {app.studentName?.charAt(0) || 'S'}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-text-main">{app.studentName || 'Sinh viên FPT'}</h3>
                    <p className="text-xs text-text-muted">
                      Ứng tuyển: <strong className="text-text-main">{app.jobTitle || app.title}</strong> • Ngày nộp: {app.appliedAt}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <Badge variant="outline" size="sm">🎓 FPT Hòa Lạc</Badge>
                  <span className="text-green-main font-semibold bg-green-50 px-2.5 py-0.5 rounded-full text-[11px]">
                    ✨ Matching Lịch Ca: 95%
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-center">
                <Badge
                  variant={
                    app.status === 'approved' || app.status === 'accepted'
                      ? 'success'
                      : app.status === 'rejected'
                      ? 'danger'
                      : 'warning'
                  }
                  size="sm"
                >
                  {app.status === 'approved' || app.status === 'accepted'
                    ? 'Đã trúng tuyển'
                    : app.status === 'rejected'
                    ? 'Đã từ chối'
                    : 'Đang chờ duyệt'}
                </Badge>

                <button
                  onClick={() => { setSelectedApp(app); setNoteInput(app.note || ''); }}
                  className="px-4 py-2 rounded-xl bg-pink-main text-white text-xs font-semibold hover:bg-pink-dark transition-all shadow-sm"
                >
                  Xem CV & Phê duyệt
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Candidate Profile Modal */}
      {selectedApp && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedApp(null)}
          title={`Hồ sơ ứng viên: ${selectedApp.studentName}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-cream/60 space-y-2">
              <h4 className="text-sm font-bold text-text-main">Vị trí: {selectedApp.jobTitle || selectedApp.title}</h4>
              <p className="text-text-muted">Sinh viên: <strong>{selectedApp.studentName}</strong> (Mã SV: HE163456)</p>
              <p className="text-text-muted">Khu vực: <strong>KTX Dom A - ĐH FPT Hòa Lạc</strong></p>
            </div>

            <div>
              <label className="font-bold text-text-main block mb-1">Thư ứng tuyển / Lời nhắn:</label>
              <p className="p-3 rounded-xl bg-gray-50 text-text-muted italic">{selectedApp.coverLetter || 'Mong muốn được thử sức tại cửa hàng...'}</p>
            </div>

            <div>
              <label className="font-bold text-text-main block mb-1">Ghi chú phản hồi cho sinh viên:</label>
              <textarea
                rows={2}
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                placeholder="Ví dụ: Chào em, cửa hàng mời em tới thử việc vào ca sáng Thứ 2 tuần sau..."
                className="w-full p-2.5 rounded-xl border border-green-100 focus:outline-none focus:ring-2 focus:ring-pink-main resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-green-50">
              <button
                onClick={() => handleStatusChange(selectedApp.id, 'rejected')}
                className="px-4 py-2 rounded-xl bg-red-50 text-red-600 font-semibold hover:bg-red-100"
              >
                Từ chối ứng tuyển
              </button>

              <button
                onClick={() => handleStatusChange(selectedApp.id, 'approved')}
                className="px-5 py-2 rounded-xl bg-green-main text-white font-semibold hover:bg-green-dark shadow-sm"
              >
                Trúng tuyển & Phân ca
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
