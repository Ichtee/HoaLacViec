import { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle, XCircle, FileText, Building2, MapPin } from 'lucide-react';
import { getVerificationRequests, reviewVerification } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Toast } from '@/components/Feedback.jsx';

export default function AdminVerificationPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      setLoading(true);
      const data = await getVerificationRequests();
      setRequests(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleReview(id, status) {
    let reason = '';
    if (status === 'rejected') {
      const userReason = prompt('Nhập lý do từ chối hồ sơ xác minh này:', 'Giấy tờ/thông tin chưa đạt tiêu chuẩn quy định.');
      if (userReason === null) return;
      reason = userReason;
    }

    try {
      await reviewVerification(id, status, reason);
      setRequests(prev => prev.map(r => (r._id === id || r.id === id) ? { ...r, status, rejectionReason: reason } : r));
      setToast({
        type: status === 'approved' ? 'success' : 'info',
        message: status === 'approved' ? 'Đã cấp huy hiệu Doanh nghiệp xác thực!' : 'Đã từ chối cấp huy hiệu.'
      });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi xử lý.' });
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-green-dark" /> Duyệt hồ sơ pháp lý & Huy hiệu uy tín
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Kiểm tra thông tin kinh doanh của cơ sở trước khi hiển thị tích xanh xác thực trên ứng dụng.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Đang tải danh sách...</div>
      ) : requests.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-gray-100 text-gray-400">Không có yêu cầu xác thực nào</div>
      ) : (
        <div className="space-y-4">
          {requests.map(req => {
            const targetId = req._id || req.id;
            const isApproved = req.status === 'approved' || req.verified === true;
            const isPending = req.status === 'pending' || (!req.verified && !req.status);
            const isRejected = req.status === 'rejected';

            return (
              <div key={targetId} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 text-xs flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 text-sm">{req.storeName}</h3>
                    <Badge variant={isApproved ? 'success' : isRejected ? 'danger' : 'warning'} size="sm">
                      {isApproved ? '✓ Đã cấp huy hiệu' : isRejected ? '✕ Đã từ chối' : '⏳ Chờ duyệt'}
                    </Badge>
                  </div>
                  <p className="text-gray-600">
                    Người đại diện: <strong>{req.legalName || req.contactName || 'Chưa cập nhật'}</strong> • SĐT: <strong>{req.contactPhone || 'Chưa có'}</strong>
                  </p>
                  {(req.taxCode || req.businessLicense) && (
                    <p className="text-gray-500">Mã số thuế / GPKD: <strong className="text-gray-900">{req.taxCode || req.businessLicense}</strong></p>
                  )}
                  <p className="text-gray-500">📍 Địa chỉ: {req.businessAddress || req.address || 'Hòa Lạc'}</p>
                  {req.rejectionReason && (
                    <p className="text-red-600 bg-red-50 p-2 rounded-xl border border-red-100 text-xs">
                      <strong>Lý do từ chối:</strong> {req.rejectionReason}
                    </p>
                  )}
                </div>

                {isPending && (
                  <div className="flex items-center gap-2 justify-end shrink-0">
                    <button
                      onClick={() => handleReview(targetId, 'rejected')}
                      className="px-4 py-2 rounded-xl bg-red-50 text-red-600 font-semibold text-xs hover:bg-red-100 transition-colors"
                    >
                      Từ chối
                    </button>
                    <button
                      onClick={() => handleReview(targetId, 'approved')}
                      className="px-4 py-2 rounded-xl bg-green-dark text-white font-semibold text-xs hover:bg-green-700 transition-colors shadow-sm"
                    >
                      Phê duyệt & Cấp tích xanh
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
