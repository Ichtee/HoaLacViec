import { useState, useEffect } from 'react';
import { Flag, CheckCircle, AlertTriangle, User, Building2 } from 'lucide-react';
import { getReports, resolveReport } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Toast } from '@/components/Feedback.jsx';

export default function AdminReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    try {
      setLoading(true);
      const data = await getReports();
      setReports(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve(id, action) {
    await resolveReport(id, { action });
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'resolved', actionTaken: action } : r));
    setToast({ type: 'success', message: 'Đã xử lý xong báo cáo tranh chấp.' });
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Flag className="w-6 h-6 text-red-500" /> Báo cáo vi phạm & Giải quyết tranh chấp
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Xử lý các khiếu nại về nợ lương, thái độ làm việc, check-in ảo hoặc bài đăng sai sự thật.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Đang tải báo cáo...</div>
      ) : reports.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-3xl border text-gray-400">Không có báo cáo nào</div>
      ) : (
        <div className="space-y-4">
          {reports.map(rep => (
            <div key={rep.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant={rep.status === 'resolved' ? 'success' : 'danger'} size="sm">
                    {rep.status === 'resolved' ? 'Đã giải quyết' : 'Chờ xử lý'}
                  </Badge>
                  <h3 className="font-bold text-gray-900 text-sm">{rep.reason}</h3>
                </div>
                <p className="text-gray-600">Người báo cáo: <strong>{rep.reporterName}</strong> → Đối tượng: <strong>{rep.target}</strong></p>
                <p className="text-gray-500 italic bg-gray-50 p-2.5 rounded-xl border border-gray-100">"{rep.content}"</p>
              </div>

              {rep.status !== 'resolved' && (
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => handleResolve(rep.id, 'warned')}
                    className="px-3.5 py-2 rounded-xl bg-yellow-50 text-yellow-700 font-semibold text-xs hover:bg-yellow-100"
                  >
                    Gửi cảnh cáo
                  </button>
                  <button
                    onClick={() => handleResolve(rep.id, 'refunded_or_banned')}
                    className="px-3.5 py-2 rounded-xl bg-red-600 text-white font-semibold text-xs hover:bg-red-700 shadow-sm"
                  >
                    Khóa tài khoản
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
