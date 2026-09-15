import { useState, useEffect } from 'react';
import {
  Briefcase, Plus, Search, Edit, Trash2, ToggleLeft, ToggleRight, MapPin,
  Clock, DollarSign, Users, Eye, CheckCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getJobs, createJob, updateJob, deleteJob } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Modal } from '@/components/Modal.jsx';
import { Toast } from '@/components/Feedback.jsx';

export default function EmployerJobsPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // New Job Form State
  const [formData, setFormData] = useState({
    title: '',
    jobType: 'Theo ca',
    salaryText: '25.000đ/giờ',
    salaryMin: 25000,
    location: 'Tân Xã, Thạch Thất (Cạnh ĐH FPT)',
    shiftDetail: 'Sáng: 7h-12h | Tối: 17h-22h',
    slots: 3,
    description: '',
    requirements: 'Chăm chỉ, nhanh nhẹn, làm được ca xoay.',
    benefits: 'Bao cơm ca, thưởng doanh số hàng tháng.'
  });

  useEffect(() => {
    loadJobs();
  }, [user]);

  async function loadJobs() {
    try {
      setLoading(true);
      const res = await getJobs({ storeName: user?.name });
      setJobs(res?.jobs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateJob(e) {
    e.preventDefault();
    try {
      setSubmitting(true);
      const newJob = await createJob({
        ...formData,
        storeName: user?.name || 'Cửa hàng',
        storeId: user?.id,
        status: 'active'
      });
      setJobs(prev => [newJob, ...prev]);
      setToast({ type: 'success', message: 'Tạo tin tuyển dụng thành công! Đã công khai bài đăng.' });
      setIsModalOpen(false);
      setFormData({
        title: '',
        jobType: 'Theo ca',
        salaryText: '25.000đ/giờ',
        salaryMin: 25000,
        location: 'Tân Xã, Thạch Thất (Cạnh ĐH FPT)',
        shiftDetail: 'Sáng: 7h-12h | Tối: 17h-22h',
        slots: 3,
        description: '',
        requirements: 'Chăm chỉ, nhanh nhẹn, làm được ca xoay.',
        benefits: 'Bao cơm ca, thưởng doanh số hàng tháng.'
      });
    } catch (err) {
      setToast({ type: 'error', message: 'Lỗi khi tạo bài tuyển dụng.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(job) {
    const newStatus = job.status === 'closed' ? 'active' : 'closed';
    await updateJob(job.id, { status: newStatus });
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: newStatus } : j));
    setToast({ type: 'info', message: `Đã cập nhật trạng thái tin tuyển dụng: ${newStatus === 'active' ? 'Hoạt động' : 'Tạm đóng'}` });
  }

  async function handleDeleteJob(jobId) {
    if (!confirm('Bạn có chắc muốn xóa bài đăng tuyển dụng này?')) return;
    await deleteJob(jobId);
    setJobs(prev => prev.filter(j => j.id !== jobId));
    setToast({ type: 'success', message: 'Đã xóa tin tuyển dụng.' });
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-green-50 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-pink-main" /> Tin tuyển dụng của bạn
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Đăng mới và điều chỉnh các bài đăng tìm sinh viên làm part-time / theo ca tại Hòa Lạc.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-pink-main text-white font-bold text-xs hover:bg-pink-dark transition-all shadow-sm shrink-0 self-start sm:self-center"
        >
          <Plus className="w-4 h-4" /> Đăng tin tuyển ca mới
        </button>
      </div>

      {/* Jobs Grid */}
      {loading ? (
        <div className="text-center py-12 text-text-muted">Đang tải tin tuyển dụng...</div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-green-50 shadow-card space-y-3">
          <Briefcase className="w-12 h-12 text-pink-300 mx-auto opacity-60" />
          <h3 className="text-base font-bold text-text-main">Chưa có bài đăng tuyển dụng nào</h3>
          <p className="text-xs text-text-muted">Tạo bài tuyển dụng đầu tiên để tiếp cận hàng ngàn sinh viên tại Hòa Lạc.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {jobs.map(job => (
            <div
              key={job.id}
              className="bg-white p-6 rounded-3xl border border-green-50 shadow-card flex flex-col justify-between space-y-4 hover:border-pink-200 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Badge variant={job.status === 'closed' ? 'secondary' : 'success'} size="sm">
                    {job.status === 'closed' ? 'Đã tạm dừng' : 'Đang tuyển (Active)'}
                  </Badge>
                  <span className="text-xs font-bold text-pink-main">{job.salaryText}</span>
                </div>

                <h3 className="text-lg font-bold text-text-main">{job.title}</h3>
                <p className="text-xs text-text-muted mt-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" /> {job.location}
                </p>

                <div className="mt-3 p-3 rounded-2xl bg-cream/60 text-xs space-y-1">
                  <p>⏰ Lịch ca: <strong>{job.shiftDetail || 'Linh hoạt'}</strong></p>
                  <p>👥 Số lượng cần tuyển: <strong>{job.slots || 2} người</strong></p>
                </div>
              </div>

              <div className="pt-3 border-t border-green-50 flex items-center justify-between">
                <button
                  onClick={() => handleToggleStatus(job)}
                  className="text-xs font-semibold text-text-muted hover:text-text-main flex items-center gap-1"
                >
                  {job.status === 'closed' ? <ToggleLeft className="w-4 h-4 text-gray-400" /> : <ToggleRight className="w-4 h-4 text-green-main" />}
                  {job.status === 'closed' ? 'Mở lại tin' : 'Tạm dừng tin'}
                </button>

                <button
                  onClick={() => handleDeleteJob(job.id)}
                  className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal create job */}
      {isModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsModalOpen(false)}
          title="Đăng bài tuyển dụng mới"
        >
          <form onSubmit={handleCreateJob} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-text-main mb-1">Tiêu đề công việc *</label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Tuyển Nhân viên Pha chế ca Tối (17h-22h)"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-green-100 focus:outline-none focus:ring-2 focus:ring-pink-main"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-text-main mb-1">Loại hình</label>
                <select
                  value={formData.jobType}
                  onChange={e => setFormData({ ...formData, jobType: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-green-100 focus:outline-none focus:ring-2 focus:ring-pink-main bg-white"
                >
                  <option value="Theo ca">Theo ca</option>
                  <option value="Part-time">Part-time cố định</option>
                  <option value="Theo giờ">Theo giờ linh hoạt</option>
                  <option value="Sự kiện">Sự kiện ngắn hạn</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-text-main mb-1">Mức lương (hiển thị)</label>
                <input
                  type="text"
                  required
                  value={formData.salaryText}
                  onChange={e => setFormData({ ...formData, salaryText: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-green-100 focus:outline-none focus:ring-2 focus:ring-pink-main"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-text-main mb-1">Địa điểm làm việc cụ thể tại Hòa Lạc</label>
              <input
                type="text"
                required
                value={formData.location}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-green-100 focus:outline-none focus:ring-2 focus:ring-pink-main"
              />
            </div>

            <div>
              <label className="block font-bold text-text-main mb-1">Chi tiết khung ca làm việc</label>
              <input
                type="text"
                required
                placeholder="Ca Sáng: 7:00 - 12:00 | Ca Tối: 17:00 - 22:00"
                value={formData.shiftDetail}
                onChange={e => setFormData({ ...formData, shiftDetail: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-green-100 focus:outline-none focus:ring-2 focus:ring-pink-main"
              />
            </div>

            <div>
              <label className="block font-bold text-text-main mb-1">Mô tả chi tiết công việc</label>
              <textarea
                rows={3}
                placeholder="Nêu rõ công việc hàng ngày: Chào đón khách, chuẩn bị nguyên liệu, dọn dẹp bàn ghế..."
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-green-100 focus:outline-none focus:ring-2 focus:ring-pink-main resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-text-muted font-semibold"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-pink-main text-white font-semibold hover:bg-pink-dark disabled:opacity-50"
              >
                {submitting ? 'Đang tạo bài...' : 'Đăng tuyển ngay'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
