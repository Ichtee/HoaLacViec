import { useState, useEffect } from 'react';
import { Briefcase, MapPin, CheckCircle, XCircle } from 'lucide-react';
import { adminGetJobs, apiApproveJob, apiRejectJob } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Toast } from '@/components/Feedback.jsx';
import { formatVND } from '@/utils';

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState('all'); // 'all', 'pending', 'approved', 'rejected'

  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    try {
      setLoading(true);
      setFetchError(null);
      const data = await adminGetJobs();
      const list = Array.isArray(data) ? data : (data?.jobs || []);
      setJobs(list);
    } catch (err) {
      console.error(err);
      setFetchError(err.message || 'Không thể kết nối máy chủ để tải danh sách.');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(job) {
    try {
      const targetId = job._id || job.id;
      await apiApproveJob(targetId);
      setJobs(prev => prev.map(j => (j._id === targetId || j.id === targetId) ? { ...j, status: 'approved', rejectionReason: '' } : j));
      setToast({ type: 'success', message: 'Đã duyệt bài đăng! Tin tuyển dụng đã chuyển sang mục "Đang hiển thị".' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi duyệt bài đăng.' });
    }
  }

  async function handleReject(job) {
    const reason = prompt('Nhập lý do từ chối / gỡ bỏ tin tuyển dụng này:', 'Thông tin việc làm chưa rõ ràng hoặc không phù hợp tiêu chuẩn.');
    if (reason === null) return; // User cancelled prompt

    try {
      const targetId = job._id || job.id;
      await apiRejectJob(targetId, reason);
      setJobs(prev => prev.map(j => (j._id === targetId || j.id === targetId) ? { ...j, status: 'rejected', rejectionReason: reason } : j));
      setToast({ type: 'info', message: 'Đã từ chối / gỡ bỏ bài đăng tuyển dụng.' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi từ chối bài đăng.' });
    }
  }

  const pendingCount = jobs.filter(j => j.status === 'pending').length;
  const approvedCount = jobs.filter(j => j.status === 'approved').length;
  const rejectedCount = jobs.filter(j => j.status === 'rejected' || j.status === 'closed').length;

  const filteredJobs = jobs.filter(job => {
    if (tab === 'pending') return job.status === 'pending';
    if (tab === 'approved') return job.status === 'approved';
    if (tab === 'rejected') return job.status === 'rejected' || job.status === 'closed';
    return true;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-green-dark" /> Kiểm duyệt tin tuyển dụng toàn hệ thống
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Duyệt bài đăng mới và gỡ bỏ các bài vi phạm tiêu chuẩn an toàn việc làm sinh viên Hòa Lạc.
          </p>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-2xl self-start sm:self-center text-xs flex-wrap">
          <button
            onClick={() => setTab('all')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${tab === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Tất cả ({jobs.length})
          </button>
          <button
            onClick={() => setTab('pending')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 ${tab === 'pending' ? 'bg-white text-amber-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Chờ duyệt
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${pendingCount > 0 ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
              {pendingCount}
            </span>
          </button>
          <button
            onClick={() => setTab('approved')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 ${tab === 'approved' ? 'bg-white text-green-dark shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Đang hiển thị
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${approvedCount > 0 ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
              {approvedCount}
            </span>
          </button>
          <button
            onClick={() => setTab('rejected')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 ${tab === 'rejected' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Từ chối / Gỡ
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${rejectedCount > 0 ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
              {rejectedCount}
            </span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Đang tải danh sách bài đăng...</div>
      ) : fetchError ? (
        <div className="text-center py-8 p-6 bg-red-50 rounded-3xl border border-red-100 space-y-3">
          <p className="text-sm font-semibold text-red-700">{fetchError}</p>
          <button onClick={loadJobs} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-all">
            Thử lại
          </button>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="text-center py-12 p-6 text-gray-400 bg-white rounded-3xl border border-gray-100 space-y-3">
          <p className="text-sm">Không có bài đăng nào trong mục này.</p>
          {tab === 'pending' && approvedCount > 0 && (
            <p className="text-xs text-gray-500">
              Có <strong className="text-green-dark">{approvedCount} bài đã được duyệt</strong> đang hoạt động.{' '}
              <button onClick={() => setTab('approved')} className="text-green-main font-bold underline hover:text-green-dark">
                Xem mục Đang hiển thị →
              </button>
            </p>
          )}
          {tab !== 'all' && (
            <button onClick={() => setTab('all')} className="inline-flex px-3 py-1.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200">
              Xem tất cả ({jobs.length} tin)
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map(job => {
            const isPending = job.status === 'pending';
            const isApproved = job.status === 'approved';
            const isRejected = job.status === 'rejected';
            const targetId = job._id || job.id;

            return (
              <div key={targetId} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
                <div className="space-y-1.5 text-xs flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-gray-900 text-sm">{job.title}</h3>
                    {isPending && (
                      <Badge variant="warning" size="sm">
                        ⏳ Chờ duyệt
                      </Badge>
                    )}
                    {isApproved && (
                      <Badge variant="success" size="sm">
                        ✓ Đang hoạt động
                      </Badge>
                    )}
                    {isRejected && (
                      <Badge variant="danger" size="sm">
                        ✕ Bị từ chối / Đã gỡ
                      </Badge>
                    )}
                    {job.status === 'closed' && (
                      <Badge variant="neutral" size="sm">
                        Đã đóng
                      </Badge>
                    )}
                  </div>

                  <p className="text-gray-600">
                    Cửa hàng: <strong>{job.storeName}</strong> • {job.salaryAmount ? `${formatVND(job.salaryAmount)}/giờ` : (job.salaryText || 'Thỏa thuận')}
                  </p>

                  <p className="text-gray-400 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span>{job.address || (typeof job.location === 'string' ? job.location : 'Hòa Lạc')}</span>
                  </p>

                  {job.rejectionReason && (
                    <p className="text-red-600 bg-red-50 p-2 rounded-xl border border-red-100">
                      <strong>Lý do từ chối:</strong> {job.rejectionReason}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 justify-end shrink-0">
                  {isPending ? (
                    <>
                      <button
                        onClick={() => handleReject(job)}
                        className="px-3.5 py-2 rounded-xl bg-red-50 text-red-600 font-semibold text-xs hover:bg-red-100 transition-colors flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Từ chối
                      </button>
                      <button
                        onClick={() => handleApprove(job)}
                        className="px-4 py-2 rounded-xl bg-green-dark text-white font-semibold text-xs hover:bg-green-700 transition-colors flex items-center gap-1 shadow-sm"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Phê duyệt
                      </button>
                    </>
                  ) : isApproved ? (
                    <button
                      onClick={() => handleReject(job)}
                      className="px-4 py-2 rounded-xl bg-red-50 text-red-600 font-semibold text-xs hover:bg-red-100 transition-colors"
                    >
                      Gỡ bỏ bài đăng
                    </button>
                  ) : (
                    <button
                      onClick={() => handleApprove(job)}
                      className="px-4 py-2 rounded-xl bg-green-dark text-white font-semibold text-xs hover:bg-green-700 transition-colors"
                    >
                      Duyệt lại bài này
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
