import { useState, useEffect } from 'react';
import { Briefcase, Flag, ShieldCheck, Trash2, Eye, MapPin } from 'lucide-react';
import { adminGetJobs, adminUpdateJob } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Toast } from '@/components/Feedback.jsx';

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    try {
      setLoading(true);
      const data = await adminGetJobs();
      setJobs(data?.jobs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(jobId, currentStatus) {
    const newStatus = currentStatus === 'removed' ? 'active' : 'removed';
    await adminUpdateJob(jobId, { status: newStatus });
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: newStatus } : j));
    setToast({
      type: newStatus === 'removed' ? 'info' : 'success',
      message: newStatus === 'removed' ? 'Đã gỡ bài đăng khỏi sàn tuyển dụng.' : 'Đã duyệt công khai bài tuyển dụng.'
    });
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-green-dark" /> Kiểm duyệt tin tuyển dụng toàn hệ thống
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Loại bỏ các bài tuyển dụng có dấu hiệu đa cấp, không rõ ràng hoặc vi phạm chính sách địa phương.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Đang tải danh sách bài đăng...</div>
      ) : (
        <div className="space-y-4">
          {jobs.map(job => (
            <div key={job.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 text-sm">{job.title}</h3>
                  <Badge variant={job.status === 'removed' ? 'danger' : 'success'} size="sm">
                    {job.status === 'removed' ? 'Đã gỡ / Vi phạm' : 'Đang hoạt động'}
                  </Badge>
                </div>
                <p className="text-gray-600">Cửa hàng: <strong>{job.storeName}</strong> • {job.salaryText}</p>
                <p className="text-gray-400">📍 Địa điểm: {job.location}</p>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => handleToggleStatus(job.id, job.status)}
                  className={job.status === 'removed' ? 'px-4 py-2 rounded-xl bg-green-dark text-white font-semibold text-xs' : 'px-4 py-2 rounded-xl bg-red-50 text-red-600 font-semibold text-xs hover:bg-red-100'}
                >
                  {job.status === 'removed' ? 'Phôi phục bài đăng' : 'Gỡ bỏ bài đăng'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
