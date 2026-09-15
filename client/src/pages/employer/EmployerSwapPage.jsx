import { useState, useEffect } from 'react';
import {
  ArrowLeftRight, CheckCircle, XCircle, User, Calendar, Clock, Building2, ShieldCheck
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getSwapRequests, approveSwap, rejectSwap } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Toast } from '@/components/Feedback.jsx';

export default function EmployerSwapPage() {
  const { user } = useAuth();
  const [swaps, setSwaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadSwaps();
  }, [user]);

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

  async function handleApprove(swapId) {
    try {
      await approveSwap(swapId);
      setSwaps(prev => prev.map(s => s.id === swapId ? { ...s, status: 'approved' } : s));
      setToast({ type: 'success', message: 'Đã duyệt cho phép hai sinh viên đổi ca thành công!' });
    } catch (err) {
      setToast({ type: 'error', message: 'Lỗi khi duyệt đổi ca.' });
    }
  }

  async function handleReject(swapId) {
    try {
      await rejectSwap(swapId);
      setSwaps(prev => prev.map(s => s.id === swapId ? { ...s, status: 'rejected' } : s));
      setToast({ type: 'info', message: 'Đã từ chối yêu cầu đổi ca.' });
    } catch (err) {
      setToast({ type: 'error', message: 'Lỗi khi từ chối.' });
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-green-50 shadow-card flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6 text-purple-600" /> Phê duyệt đổi ca nhân viên
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Xác nhận cho phép các bạn nhân viên sinh viên trao đổi ca làm việc với nhau.
          </p>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-text-muted">Đang tải yêu cầu đổi ca...</div>
      ) : swaps.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-green-50 shadow-card space-y-3">
          <ArrowLeftRight className="w-12 h-12 text-text-muted mx-auto opacity-50" />
          <h3 className="text-base font-bold text-text-main">Không có yêu cầu đổi ca nào</h3>
          <p className="text-xs text-text-muted">Khi nhân viên tạo yêu cầu hoán đổi ca làm, thông tin phê duyệt sẽ hiển thị tại đây.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {swaps.map(swap => (
            <div
              key={swap.id}
              className="bg-white p-6 rounded-3xl border border-green-50 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      swap.status === 'approved'
                        ? 'success'
                        : swap.status === 'rejected'
                        ? 'danger'
                        : 'warning'
                    }
                    size="sm"
                  >
                    {swap.status === 'approved'
                      ? 'Đã chấp thuận'
                      : swap.status === 'rejected'
                      ? 'Đã từ chối'
                      : 'Đang chờ quản lý chốt'}
                  </Badge>
                  <h4 className="text-sm font-bold text-text-main">{swap.storeName || 'Cửa hàng'}</h4>
                </div>

                <div className="p-3 rounded-2xl bg-cream/60 space-y-1 text-xs">
                  <p>👤 Nhân viên gốc: <strong>{swap.ownerName}</strong></p>
                  {swap.applicantName && <p>🤝 Người nhận ca làm thay: <strong className="text-pink-dark">{swap.applicantName}</strong></p>}
                  <p>📅 Ngày ca làm: <strong>{swap.date} ({swap.time})</strong></p>
                  <p className="italic text-text-muted">💬 Lý do: "{swap.reason}"</p>
                </div>
              </div>

              {swap.status !== 'approved' && swap.status !== 'rejected' && (
                <div className="flex items-center gap-2 self-end md:self-center">
                  <button
                    onClick={() => handleReject(swap.id)}
                    className="px-4 py-2 rounded-xl bg-red-50 text-red-600 font-semibold text-xs hover:bg-red-100"
                  >
                    Từ chối
                  </button>
                  <button
                    onClick={() => handleApprove(swap.id)}
                    className="px-4 py-2 rounded-xl bg-green-main text-white font-semibold text-xs hover:bg-green-dark shadow-sm"
                  >
                    Duyệt đổi ca
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
