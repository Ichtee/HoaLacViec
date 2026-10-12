

import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Briefcase, Plus, Edit, Trash2, MapPin,
  DollarSign, Users, ExternalLink,
  PauseCircle, PlayCircle, AlertTriangle, Sparkles, RefreshCw, Clock
} from 'lucide-react';
import { clsx } from 'clsx';

import {
  getEmployerMyJobs,
  submitJobForReview,
  pauseJob,
  closeJob,
  reopenJob,
  deleteJob,
  apiGetMyCredits,
  apiGetCreditPricing,
  apiRenewJob,
} from '@/services';
import { Toast } from '@/components/Feedback.jsx';
import { formatVND, getGoogleMapsDirectionsUrl } from '@/utils';
import { ActionMenu } from '@/components/ActionMenu.jsx';
import { PageHeader } from '@/components/PageHeader.jsx';
import FeatureJobModal from '@/components/FeatureJobModal.jsx';

const jobId = (j) => j._id || j.id;
const ddmm = (d) => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

export default function EmployerJobsPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [balance, setBalance] = useState(0);
  const [listingDays, setListingDays] = useState(null);
  const [prices, setPrices] = useState(null);
  const [featureJob, setFeatureJob] = useState(null);
  const [notice, setNotice] = useState(null); // { message, to, label } shown when a credit action is refused
  const [searchParams, setSearchParams] = useSearchParams();
  const upsellId = searchParams.get('upsell');

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
    Promise.all([apiGetMyCredits(), apiGetCreditPricing()])
      .then(([me, pricing]) => { setBalance(me.balance); setPrices(pricing.prices); setListingDays(pricing.listingDays); })
      .catch(() => {});
  }, []);

  // ?upsell=<id> from the posting flow: open the featured modal once, then drop the param
  useEffect(() => {
    if (!upsellId || loading || !prices) return;
    const target = jobs.find(j => String(jobId(j)) === upsellId);
    if (target) setFeatureJob(target);
    setSearchParams({}, { replace: true });
  }, [upsellId, loading, prices, jobs, setSearchParams]);

  function replaceJob(updated) {
    setJobs(prev => prev.map(j => (jobId(j) === jobId(updated) ? updated : j)));
  }

  function handleFeatureDone({ job, balance: newBalance }) {
    replaceJob(job);
    setBalance(newBalance);
    setFeatureJob(null);
    setToast({ type: 'success', message: 'Đã mua tin nổi bật.' });
  }

  async function handleRenew(job) {
    if (!confirm(`Gia hạn tin thêm ${listingDays ? `${listingDays} ngày` : ''} với ${prices.renew_14d} credit?`)) return;
    try {
      const res = await apiRenewJob(jobId(job));
      replaceJob(res.job);
      setBalance(res.balance);
      setToast({ type: 'success', message: 'Đã gia hạn tin.' });
    } catch (err) {
      if (err.code === 'INSUFFICIENT_CREDITS') {
        setNotice({ message: err.message, to: '/employer/credits', label: 'Nạp thêm credit' });
        return;
      }
      setToast({ type: 'error', message: err.message || 'Không thể gia hạn tin.' });
    }
  }

  async function handleToggleStatus(job) {
    const targetId = job._id || job.id;
    try {
      const result = job.status === 'draft'
        ? await submitJobForReview(targetId)
        : job.status === 'approved'
          ? await pauseJob(targetId)
          : await reopenJob(targetId);
      const updated = result.job;
      setJobs(prev => prev.map(j => (j._id === targetId || j.id === targetId) ? updated : j));
      setToast({ type: 'success', message: result.message });
    } catch (err) {
      if (err.code === 'LISTING_QUOTA_REACHED') {
        setNotice({ message: err.message, to: `/employer/jobs/${targetId}/edit`, label: 'Mở tin để dùng credit đăng thêm' });
      } else if (err.code === 'INSUFFICIENT_CREDITS') {
        setNotice({ message: err.message, to: '/employer/credits', label: 'Nạp thêm credit' });
      } else {
        setToast({ type: 'error', message: err.message || 'Không thể đổi trạng thái tin.' });
      }
    }
  }

  async function handleCloseJob(job) {
    try {
      const targetId = job._id || job.id;
      const result = await closeJob(targetId);
      setJobs(prev => prev.map(j => (j._id === targetId || j.id === targetId) ? result.job : j));
      setToast({ type: 'success', message: result.message });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể đóng tin.' });
    }
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
      <PageHeader
        icon={Briefcase}
        title="Quản lý tin tuyển dụng"
        description="Đăng tin tuyển dụng và liên kết địa chỉ Google Maps để sinh viên tìm kiếm và đến quán dễ dàng."
        actions={
          <>
            <button
              onClick={() => navigate('/employer/jobs/create')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-brand-gradient shadow-brand hover:brightness-110 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all self-start sm:self-center shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" /> Đăng tin tuyển mới
            </button>
          </>
        }
      />

      {notice && (
        <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs">
          <span>{notice.message}</span>
          <Link to={notice.to} className="font-bold underline">{notice.label}</Link>
          <button type="button" onClick={() => setNotice(null)} className="ml-auto font-semibold">Đóng</button>
        </div>
      )}

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
        <div className="bg-white rounded-3xl p-12 text-center ring-1 ring-green-100/60 shadow-card space-y-4">
          <Briefcase className="w-12 h-12 text-text-muted mx-auto opacity-40" />
          <h3 className="font-bold text-base text-text-main">Chưa có bài đăng tuyển dụng nào</h3>
          <p className="text-xs text-text-muted max-w-md mx-auto">
            Hãy đăng tin tuyển dụng ca làm để tiếp cận ngay hàng ngàn sinh viên ĐH FPT, KTX ĐHQG đang tìm việc quanh bạn!
          </p>
          <button
            onClick={() => navigate('/employer/jobs/create')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-gradient shadow-brand hover:brightness-110 text-white text-xs font-bold shadow-md transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" /> Đăng tin đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jobs.map(job => {
            const isClosed = job.status === 'closed';
            const isExpired = job.status === 'expired' || (job.closesAt && new Date(job.closesAt) < new Date());
            const showExpiredBadge = job.status === 'expired' || (job.status === 'approved' && isExpired);
            const featuredActive = job.featuredUntil && new Date(job.featuredUntil) > new Date();
            const canFeature = ['approved', 'pending'].includes(job.status) && !isExpired;
            const canRenew = ['approved', 'paused', 'expired'].includes(job.status);
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
                        isClosed ? 'bg-gray-200 text-gray-600' : 'bg-green-100 text-green-dark'
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
                    ) : showExpiredBadge ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 shrink-0">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        Đã hết hạn
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
                    <div className="flex items-center gap-1.5 text-orange-700 font-bold">
                      <DollarSign className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      <span>{formatVND(job.salaryAmount || 25000)}/giờ</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-red-700 shrink-0" />
                      <span className="truncate">{job.address || 'Hòa Lạc'}</span>
                    </div>
                    {(job.locationStatus !== 'confirmed' || job.locationNeedsReview) && (
                      <button
                        type="button"
                        onClick={() => navigate(`/employer/jobs/${job._id || job.id}/edit#job-step-3`)}
                        className="mt-1.5 w-full text-left flex items-start gap-1.5 p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100 transition-colors"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                          <strong>Ghim vị trí để sinh viên thấy khoảng cách.</strong>{' '}
                          {job.locationNeedsReview ? 'Vị trí hiện tại đang ở điểm mặc định trên bản đồ.' : 'Tin chưa có vị trí trên bản đồ.'}
                        </span>
                      </button>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-green-dark shrink-0" />
                      <span>Còn tuyển: {job.slots ?? 0} bạn</span>
                    </div>
                    {job.closesAt && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                        <span>Hết hạn: {ddmm(job.closesAt)}</span>
                      </div>
                    )}
                    {featuredActive && (
                      <div className="flex items-center gap-1.5 text-amber-700 font-bold">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>Nổi bật đến {ddmm(job.featuredUntil)}</span>
                      </div>
                    )}
                    {job.featuredDaysPending > 0 && (
                      <div className="flex items-center gap-1.5 text-amber-700 font-bold">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>Nổi bật {job.featuredDaysPending} ngày sau khi được duyệt</span>
                      </div>
                    )}
                  </div>

                  {job.positions?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {job.positions.map((pos, pIdx) => (
                        <span key={pIdx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-50 text-green-dark text-[10px] font-bold border border-green-100">
                          🎯 {pos.title}: {String(pos.shift || '').split('(')[0].trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {prices && (canFeature || canRenew) && (
                  <div className="flex flex-wrap gap-2">
                    {canFeature && !job.featuredDaysPending && (
                      <button
                        type="button"
                        onClick={() => setFeatureJob(job)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 font-semibold text-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Làm nổi bật
                      </button>
                    )}
                    {canRenew && (
                      <button
                        type="button"
                        onClick={() => handleRenew(job)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-green-200 bg-white text-text-main hover:bg-green-50 font-semibold text-xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Gia hạn{listingDays ? ` ${listingDays} ngày` : ''} ({prices.renew_14d} credit)
                      </button>
                    )}
                  </div>
                )}

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                  {['draft', 'approved', 'paused', 'closed'].includes(job.status) ? (
                    <button
                      onClick={() => handleToggleStatus(job)}
                      className={clsx(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-xs transition-all border',
                        isClosed
                          ? 'bg-green-main hover:bg-green-dark text-white border-green-main'
                          : 'bg-white hover:bg-green-50 text-text-main border-green-200'
                      )}
                    >
                      {job.status === 'draft' ? 'Gửi duyệt tin'
                        : job.status === 'approved' ? <><PauseCircle className="w-4 h-4 text-text-muted" /> Tạm dừng tuyển</>
                          : job.status === 'paused' ? 'Mở lại để duyệt'
                            : <><PlayCircle className="w-4 h-4" /> Mở lại để duyệt</>}
                    </button>
                  ) : <span />}

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => navigate(`/employer/jobs/${job._id || job.id}/edit`)}
                      className="btn btn-primary btn-sm"
                    >
                      <Edit className="w-4 h-4" /> Sửa
                    </button>
                    <ActionMenu
                      label={`Thêm hành động cho tin ${job.title}`}
                      items={[
                        { label: 'Chỉ đường (Google Maps)', icon: ExternalLink, href: getGoogleMapsDirectionsUrl(job) || undefined, hidden: !getGoogleMapsDirectionsUrl(job) },
                        { label: 'Đóng tin tuyển dụng', icon: PauseCircle, onClick: () => handleCloseJob(job), hidden: !['approved', 'paused'].includes(job.status) },
                        { label: 'Xóa tin', icon: Trash2, onClick: () => handleDeleteJob(job), danger: true },
                      ]}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {featureJob && prices && (
        <FeatureJobModal
          job={featureJob}
          prices={prices}
          balance={balance}
          onClose={() => setFeatureJob(null)}
          onDone={handleFeatureDone}
        />
      )}
    </div>
  );
}
