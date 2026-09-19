import { useState, useEffect } from 'react';
import { Briefcase, Flag, ShieldCheck, Trash2, Eye, MapPin } from 'lucide-react';
import { adminGetJobs, adminUpdateJob } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Toast } from '@/components/Feedback.jsx';
import { formatVND } from '@/utils';

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
      const list = Array.isArray(data) ? data : (data?.jobs || []);
      setJobs(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(job) {
    const targetId = job._id || job.id;
    const isInactive = job.status === 'rejected' || job.status === 'closed' || job.status === 'removed';
    const newStatus = isInactive ? 'approved' : 'rejected';

    await adminUpdateJob(targetId, { status: newStatus });
    setJobs(prev => prev.map(j => (j._id === targetId || j.id === targetId) ? { ...j, status: newStatus } : j));
    setToast({
      type: newStatus === 'rejected' ? 'info' : 'success',
      message: newStatus === 'rejected' ? 'Đã gỡ bài đăng khỏi sàn tuyển dụng.' : 'Đã duyệt công khai bài tuyển dụng.'
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
            Duyệt bài hoặc gỡ bỏ các bài tuyển dụng có dấu hiệu lừa đảo, đa cấp, không rõ ràng hoặc vi phạm an toàn việc làm sinh viên.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Đang tải danh sách bài đăng...</div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Không có bài đăng nào.</div>
      ) : (
        <div className="space-y-4">
          {jobs.map(job => {
            const isInactive = job.status === 'rejected' || job.status === 'closed' || job.status === 'removed';
            const targetId = job._id || job.id;
            return (
              <div key={targetId} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 text-sm">{job.title}</h3>
                    <Badge variant={isInactive ? 'danger' : 'success'} size="sm">
                      {isInactive ? 'Đã gỡ / Từ chối' : 'Đang hoạt động'}
                    </Badge>
                  </div>
                  <p className="text-gray-600">
                    Cửa hàng: <strong>{job.storeName}</strong> • {job.salaryAmount ? `${formatVND(job.salaryAmount)}/giờ` : (job.salaryText || 'Thỏa thuận')}
                  </p>
                  <p className="text-gray-400 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-red-400" />
                    <span>{job.address || (typeof job.location === 'string' ? job.location : 'Hòa Lạc')}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => handleToggleStatus(job)}
                    className={isInactive ? 'px-4 py-2 rounded-xl bg-green-dark text-white font-semibold text-xs transition-colors' : 'px-4 py-2 rounded-xl bg-red-50 text-red-600 font-semibold text-xs hover:bg-red-100 transition-colors'}
                  >
                    {isInactive ? 'Phục hồi bài đăng' : 'Gỡ bỏ bài đăng'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
