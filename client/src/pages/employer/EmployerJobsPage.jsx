import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, Plus, Edit, Trash2, MapPin,
  DollarSign, Users, ExternalLink,
  PauseCircle, PlayCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import {
  getEmployerMyJobs,
  updateJob,
  deleteJob,
} from '@/services';
import { Toast } from '@/components/Feedback.jsx';
import { formatVND, hasConfirmedCoordinates } from '@/utils';

export default function EmployerJobsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [fetchError, setFetchError] = useState(null);

  async function loadJobs() {
    try {
      setLoading(true);
      setFetchError(null);
      const res = await getEmployerMyJobs();
      const list = Array.isArray(res) ? res : (res?.items || res?.jobs || []);
      setJobs(list);
    } catch (err) {
      console.error(err);
      setFetchError(err.message || 'Không thể tải danh sách bài đăng từ máy chủ.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadJobs();
  }, []);

  async function handleToggleStatus(job) {
    const targetId = job._id || job.id;
    const isClosed = job.status === 'closed';
    const newStatus = isClosed ? 'approved' : 'closed';
    await updateJob(targetId, { status: newStatus });
    setJobs(prev => prev.map(j => (j._id === targetId || j.id === targetId) ? { ...j, status: newStatus } : j));
    setToast({ type: 'info', message: `Đã cập nhật trạng thái tin tuyển dụng: ${newStatus === 'approved' ? 'Hoạt động' : 'Tạm đóng'}` });
  }

  async function handleDeleteJob(job) {
    if (!confirm('Bạn có chắc muốn xóa bài đăng tuyển dụng này?')) return;
    const targetId = job._id || job.id;
    await deleteJob(targetId);
    setJobs(prev => prev.filter(j => (j._id || j.id) !== targetId));
    setToast({ type: 'success', message: 'Đã xóa tin tuyển dụng.' });
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-green-50 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-pink-main" /> Quản lý tin tuyển dụng
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Đăng tin tuyển dụng và liên kết địa chỉ Google Maps để sinh viên tìm kiếm và đến quán dễ dàng.
          </p>
        </div>

        <button
          onClick={() => navigate('/employer/jobs/create')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all self-start sm:self-center shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" /> Đăng tin tuyển mới
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-text-muted">Đang tải danh sách bài đăng...</div>
      ) : fetchError ? (
        <div className="bg-red-50 rounded-3xl p-8 text-center border border-red-100 shadow-card space-y-3">
          <p className="text-sm font-semibold text-red-700">{fetchError}</p>
          <button
            onClick={loadJobs}
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-sm"
          >
            Thử tải lại
          </button>
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-green-50 shadow-card space-y-4">
          <Briefcase className="w-12 h-12 text-text-muted mx-auto opacity-40" />
          <h3 className="font-bold text-base text-text-main">Chưa có bài đăng tuyển dụng nào</h3>
          <p className="text-xs text-text-muted max-w-md mx-auto">
            Hãy đăng tin tuyển dụng ca làm để tiếp cận ngay hàng ngàn sinh viên ĐH FPT, KTX ĐHQG đang tìm việc quanh bạn!
          </p>
          <button
            onClick={() => navigate('/employer/jobs/create')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white text-xs font-bold shadow-md transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" /> Đăng tin đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jobs.map(job => {
            const isClosed = job.status === 'closed';
            return (
              <div
                key={job._id || job.id}
                className={clsx(
                  'p-5 rounded-3xl border shadow-card space-y-3 flex flex-col justify-between transition-all',
                  isClosed
                    ? 'bg-gray-50/90 border-gray-200 opacity-80 hover:opacity-100'
                    : 'bg-white border-green-100 hover:border-green-300'
                )}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={clsx(
                        'text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider',
                        isClosed ? 'bg-gray-200 text-gray-600' : 'bg-pink-100 text-pink-700'
                      )}>
                        {job.type === 'shift' ? 'Theo ca' : 'Part-time'}
                      </span>
                      <h3 className={clsx(
                        'font-bold text-base mt-1 line-clamp-1',
                        isClosed ? 'text-gray-500 line-through' : 'text-text-main'
                      )}>
                        {job.title}
                      </h3>
                    </div>

                    {job.status === 'draft' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-300 shrink-0">
                        <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                        Bản nháp
                      </span>
                    ) : job.status === 'pending' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                        Chờ duyệt
                      </span>
                    ) : job.status === 'rejected' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 shrink-0" title={job.rejectionReason || 'Chưa đạt tiêu chuẩn'}>
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        Bị từ chối
                      </span>
                    ) : isClosed ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-700 border border-gray-300 shrink-0">
                        <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                        Đã đóng
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Đang tuyển
                      </span>
                    )}
                  </div>

                  {job.status === 'rejected' && job.rejectionReason && (
                    <div className="mt-2 p-2 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs">
                      <strong>Lý do từ chối:</strong> {job.rejectionReason}
                    </div>
                  )}

                  {job.status === 'draft' && (
                    <div className="mt-2 p-2 bg-gray-50 text-gray-600 border border-gray-200 rounded-xl text-[11px]">
                      Tin nháp — chưa gửi duyệt. Nhấn <strong>Sửa</strong> để hoàn thiện và gửi đăng.
                    </div>
                  )}

                  {job.status === 'pending' && (
                    <div className="mt-2 p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-[11px]">
                      Tin tuyển dụng đang được Quản trị viên Hòa Lạc Việc kiểm duyệt trước khi hiển thị công khai.
                    </div>
                  )}

                  <div className="mt-3 space-y-1 text-xs text-text-muted">
                    <div className="flex items-center gap-1.5 text-orange-600 font-bold">
                      <DollarSign className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      <span>{formatVND(job.salaryAmount || 25000)}/giờ</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <span className="truncate">{job.address || 'Hòa Lạc'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-green-dark shrink-0" />
                      <span>Cần tuyển: {job.slots || 1} bạn</span>
                    </div>
                  </div>

                  {job.positions?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {job.positions.map((pos, pIdx) => (
                        <span key={pIdx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-bold border border-purple-100">
                          🎯 {pos.title}: {pos.shift.split('(')[0].trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs gap-2">
                  {['approved', 'paused', 'closed'].includes(job.status) && (
                    <button
                      onClick={() => handleToggleStatus(job)}
                      className={clsx(
                        'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all shadow-sm',
                        isClosed
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                      )}
                    >
                      {isClosed ? (
                        <><PlayCircle className="w-4 h-4" /> Mở lại tin</>
                      ) : (
                        <><PauseCircle className="w-4 h-4 text-amber-700" /> Tạm dừng tuyển</>
                      )}
                    </button>
                  )}

                  <div className="flex items-center gap-1.5">
                    {(() => {
                      const lat = job.location?.lat ?? job.lat ?? job.geoPoint?.coordinates?.[1];
                      const lng = job.location?.lng ?? job.lng ?? job.geoPoint?.coordinates?.[0];
                      const isConfirmed = hasConfirmedCoordinates(job);
                      const navUrl = isConfirmed
                        ? `https://www.google.com/maps/dir/?api=1&destination=${Number(lat)},${Number(lng)}`
                        : (job.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}` : null);
                      if (!navUrl) return null;
                      return (
                        <a
                          href={navUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors flex items-center gap-1 text-[11px] font-semibold border border-transparent hover:border-blue-200"
                          title={isConfirmed ? "Mở chỉ đường trên Google Maps đến tọa độ chính xác" : "Mở tìm kiếm địa chỉ này trên Google Maps"}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      );
                    })()}
                    <button
                      onClick={() => navigate(`/employer/jobs/${job._id || job.id}/edit`)}
                      className="p-2 text-gray-500 hover:text-pink-600 hover:bg-pink-50 rounded-xl transition-colors border border-transparent hover:border-pink-200"
                      title="Chỉnh sửa tin tuyển dụng này"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteJob(job)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-200"
                      title="Xóa tin"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
