import { useState, useEffect } from 'react';
import {
  ArrowLeftRight, Calendar, Clock, MapPin, Search, Filter, CheckCircle,
  User, Building2, AlertCircle, Plus
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getSwapRequests, applySwap } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Modal } from '@/components/Modal.jsx';
import { Toast } from '@/components/Feedback.jsx';

export default function SwapMarketplacePage() {
  const { user } = useAuth();
  const [swaps, setSwaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSwap, setSelectedSwap] = useState(null);
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    loadSwaps();
  }, []);

  async function loadSwaps() {
    try {
      setLoading(true);
      const data = await getSwapRequests();
      setSwaps(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleTakeShift() {
    if (!selectedSwap) return;
    try {
      setSubmitting(true);
      await applySwap(selectedSwap.id, {
        applicantId: user.id,
        applicantName: user.name,
        note
      });
      setSwaps(prev => prev.map(s => s.id === selectedSwap.id ? { ...s, status: 'pending_approval', applicantName: user.name } : s));
      setToast({ type: 'success', message: 'Đã gửi yêu cầu nhận ca! Quản lý cửa hàng sẽ duyệt đổi ca cho bạn.' });
      setSelectedSwap(null);
      setNote('');
    } catch (err) {
      setToast({ type: 'error', message: 'Có lỗi xảy ra khi nhận ca.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="bg-gradient-to-r from-pink-dark via-pink-main to-purple-600 rounded-3xl p-6 sm:p-8 text-white shadow-soft relative overflow-hidden">
        <div className="max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold mb-3">
            <ArrowLeftRight className="w-3.5 h-3.5" /> Chợ Nhường & Đổi Ca Sinh Viên
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Sàn Đổi Ca Siêu Tốc Hòa Lạc 🔄
          </h1>
          <p className="mt-2 text-pink-100 text-xs sm:text-sm leading-relaxed">
            Bạn kẹt lịch thi hay có việc đột xuất? Nhường ca cho các bạn sinh viên khác hoặc nhận ca nhượng lại để kiếm thêm thu nhập ngay trong ngày.
          </p>
        </div>
      </div>

      {/* Swap List */}
      {loading ? (
        <div className="text-center py-12 text-text-muted">Đang tải danh sách đổi ca...</div>
      ) : swaps.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-green-50 shadow-card space-y-3">
          <ArrowLeftRight className="w-12 h-12 text-pink-300 mx-auto opacity-60" />
          <h3 className="text-base font-bold text-text-main">Hiện chưa có ca nào cần nhường</h3>
          <p className="text-xs text-text-muted">Nếu bạn cần đổi ca của mình, truy cập mục Lịch Làm để đăng bài nhượng ca.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {swaps.map(swap => (
            <div
              key={swap.id}
              className="bg-white p-6 rounded-3xl border border-green-50 hover:border-pink-300 transition-all shadow-card flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Badge variant={swap.status === 'open' ? 'warning' : 'info'} size="sm">
                    {swap.status === 'open' ? 'Đang tìm người nhận ca' : 'Đang chờ quản lý duyệt'}
                  </Badge>
                  <span className="text-[11px] font-bold text-pink-main bg-pink-50 px-2 py-0.5 rounded-full">
                    {swap.wage || '25.000đ/h'}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-green-100 text-green-dark font-bold text-xs flex items-center justify-center">
                    {swap.ownerName?.charAt(0) || 'S'}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-text-main">{swap.ownerName}</h4>
                    <p className="text-[10px] text-text-muted">Sinh viên cần nhượng ca</p>
                  </div>
                </div>

                <h3 className="text-base font-bold text-text-main">{swap.storeName || 'Cửa hàng Hòa Lạc'}</h3>

                <div className="mt-3 p-3 rounded-2xl bg-cream/60 space-y-1 text-xs">
                  <p className="flex items-center gap-1.5 font-medium text-text-main">
                    📅 Ngày: <strong>{swap.date}</strong>
                  </p>
                  <p className="flex items-center gap-1.5 font-medium text-text-main">
                    ⏰ Khung giờ: <strong>{swap.time}</strong>
                  </p>
                  <p className="flex items-center gap-1 text-text-muted text-[11px] mt-1">
                    <MapPin className="w-3 h-3 text-red-400 shrink-0" /> {swap.location || 'Tân Xã, Thạch Thất'}
                  </p>
                </div>

                {swap.reason && (
                  <p className="mt-3 text-xs text-text-muted italic bg-pink-50/40 p-2.5 rounded-xl border border-pink-100">
                    💬 "Lý do: {swap.reason}"
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-green-50 flex items-center justify-between">
                {swap.ownerId === user?.id ? (
                  <span className="text-xs text-text-muted italic">Ca do bạn đăng</span>
                ) : (
                  <button
                    onClick={() => setSelectedSwap(swap)}
                    disabled={swap.status !== 'open'}
                    className="w-full py-2.5 rounded-xl bg-pink-main text-white font-semibold text-xs hover:bg-pink-dark transition-all disabled:opacity-50"
                  >
                    {swap.status === 'open' ? 'Nhận ca này →' : 'Đã có người đăng ký'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Take Shift Modal */}
      {selectedSwap && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedSwap(null)}
          title="Xác nhận làm thay ca"
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-pink-50 border border-pink-100 space-y-2">
              <h4 className="text-sm font-bold text-pink-dark">Chi tiết ca sẽ nhận</h4>
              <p className="text-text-main">Cửa hàng: <strong>{selectedSwap.storeName}</strong></p>
              <p className="text-text-main">Thời gian: <strong>{selectedSwap.date} ({selectedSwap.time})</strong></p>
              <p className="text-text-main">Địa điểm: <strong>{selectedSwap.location}</strong></p>
            </div>

            <div>
              <label className="block font-bold text-text-main mb-1">Lời nhắn gửi tới sinh viên & quản lý cửa hàng:</label>
              <textarea
                rows={3}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Ví dụ: Mình rảnh khung giờ này, sẵn sàng đến đúng giờ..."
                className="w-full p-3 rounded-xl border border-green-100 focus:outline-none focus:ring-2 focus:ring-pink-main resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedSwap(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-text-muted font-semibold"
              >
                Hủy
              </button>
              <button
                onClick={handleTakeShift}
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-pink-main text-white font-semibold hover:bg-pink-dark disabled:opacity-50"
              >
                {submitting ? 'Đang gửi...' : 'Gửi yêu cầu nhận ca'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
