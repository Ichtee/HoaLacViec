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
    try {
      await reviewVerification(id, { status });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
      setToast({
        type: status === 'approved' ? 'success' : 'info',
        message: status === 'approved' ? 'Đã cấp huy hiệu Doanh nghiệp xác thực!' : 'Đã từ chối cấp huy hiệu.'
      });
    } catch (err) {
      setToast({ type: 'error', message: 'Lỗi khi xử lý.' });
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
            Kiểm tra giấy phép kinh doanh của cửa hàng trước khi hiển thị tích xanh xác thực trên ứng dụng.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Đang tải danh sách...</div>
      ) : requests.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-3xl border text-gray-400">Không có yêu cầu xác thực nào</div>
      ) : (
        <div className="space-y-4">
          {requests.map(req => (
            <div key={req.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 text-sm">{req.storeName}</h3>
                  <Badge variant={req.status === 'approved' ? 'success' : req.status === 'rejected' ? 'danger' : 'warning'} size="sm">
                    {req.status === 'approved' ? 'Đã cấp huy hiệu' : req.status === 'rejected' ? 'Đã từ chối' : 'Chờ duyệt'}
                  </Badge>
                </div>
                <p className="text-gray-500">Mã GPKD: <strong className="text-gray-900">{req.businessLicense}</strong></p>
                <p className="text-gray-500">📍 Địa chỉ: {req.address}</p>
                <p className="text-gray-400 text-[11px]">Ngày gửi: {req.submittedAt}</p>
              </div>

              {req.status === 'pending' && (
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => handleReview(req.id, 'rejected')}
                    className="px-4 py-2 rounded-xl bg-red-50 text-red-600 font-semibold text-xs hover:bg-red-100"
                  >
                    Từ chối
                  </button>
                  <button
                    onClick={() => handleReview(req.id, 'approved')}
                    className="px-4 py-2 rounded-xl bg-green-dark text-white font-semibold text-xs hover:bg-green-700 shadow-sm"
                  >
                    Phê duyệt & Cấp tích xanh
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
