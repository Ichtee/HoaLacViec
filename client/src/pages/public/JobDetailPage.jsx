import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { useState, useEffect } from 'react';
import {
  MapPin,
  Clock,
  DollarSign,
  Users,
  Star,
  CheckCircle,
  Shield,
  Bookmark,
  BookmarkCheck,
  Send,
  ArrowLeft,
  Bus,
  AlertTriangle,
  Calendar,
  Navigation,
  Phone,
  MessageCircle,
  Flag,
  Briefcase,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAsync } from '@/hooks';
import { getJob, getReviews, applyToJob, toggleSaveJob, isSavedJob, getAvailability, getStudentProfile, createReport, updateUserProfile } from '@/services';
import { useAuth } from '@/hooks/useAuth.jsx';
import { MatchScoreBar } from '@/components/JobCard.jsx';
import { VerifiedBadge, Badge } from '@/components/Badge.jsx';
import { Button } from '@/components/Button.jsx';
import { Modal } from '@/components/Modal.jsx';

import { LoadingPage, ErrorAlert } from '@/components/Feedback.jsx';
import { JOB_TYPE_LABELS, SALARY_UNIT_LABELS, DAYS_OF_WEEK } from '@/constants';
import { formatVND, formatDate, computeMatchScore, getGoogleMapsDirectionsUrl } from '@/utils';
import { avatarColorClass, avatarInitial } from '@/utils/avatarColor.js';
import { ApplyJobModal } from './apply/ApplyJobModal.jsx';

export default function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Trong khu sinh viên đã có thanh điều hướng dưới đáy, nên thanh ứng tuyển phải nằm phía trên nó
  const insideStudentArea = pathname.startsWith('/student');
  const { isAuthenticated, isStudent, profileId, user, updateUser } = useAuth();

  const [saved, setSaved] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [profilePhone, setProfilePhone] = useState('');
  const [applyKey, setApplyKey] = useState(0); // đổi mỗi lần mở để form ứng tuyển được đặt lại
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [applySuccess, setApplySuccess] = useState(false);
  const [matchResult, setMatchResult] = useState(null);
  const [visiblePositionsCount, setVisiblePositionsCount] = useState(5);
  const [storeReviewResult, setStoreReviewResult] = useState({ targetId: '', reviews: [] });

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Lừa đảo / Yêu cầu đặt cọc phí');
  const [reportContent, setReportContent] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  async function handleReportSubmit(e) {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate(`/login?redirect=/jobs/${id}`);
      return;
    }
    try {
      setSubmittingReport(true);
      await createReport({
        targetType: 'job',
        targetId: job._id || job.id,
        target: `${job.title} (${job.storeName || ''})`,
        reason: reportReason,
        content: reportContent,
      });
      setReportSuccess(true);
      setTimeout(() => {
        setReportOpen(false);
        setReportSuccess(false);
        setReportContent('');
      }, 2000);
    } catch (err) {
      alert(err.message || 'Lỗi gửi báo cáo');
    } finally {
      setSubmittingReport(false);
    }
  }

  const { data: job, loading, error } = useAsync(() => getJob(id), [id]);

  useEffect(() => {
    const targetId = job?.employerUserId || job?.employer?.userId;
    if (!targetId) return;
    let active = true;
    getReviews({ targetId, transactionType: 'shift' })
      .then((data) => { if (active) setStoreReviewResult({ targetId, reviews: Array.isArray(data) ? data : [] }); })
      .catch(() => { if (active) setStoreReviewResult({ targetId, reviews: [] }); });
    return () => { active = false; };
  }, [job?.employerUserId, job?.employer?.userId]);

  // Load saved status and match score
  useEffect(() => {
    if (!job || !isAuthenticated) return;
    const targetId = job._id || job.id;
    isSavedJob(targetId).then(setSaved).catch(() => {});
    // Compute match score
    if (profileId) {
      Promise.all([
        getAvailability(profileId),
        getStudentProfile(profileId),
      ]).then(([avail, profile]) => {
        const result = computeMatchScore(job, avail, profile?.location);
        setMatchResult(result);
        setProfilePhone(profile?.phone || profile?.contactPhone || '');
      }).catch(() => {});
    }
  }, [job, isAuthenticated, profileId, user]);

  async function handleSave() {
    if (!isAuthenticated) { navigate('/login'); return; }
    const targetId = job._id || job.id;
    const prevSaved = saved;
    setSaved(!prevSaved); // Optimistic
    try {
      const result = await toggleSaveJob(targetId);
      setSaved(Boolean(result.saved));
    } catch (err) {
      setSaved(prevSaved); // Rollback on error
      alert(err.message || 'Không thể cập nhật việc làm đã lưu.');
    }
  }

  function handleOpenApply() {
    if (!isAuthenticated) { navigate(`/login?redirect=/jobs/${id}`); return; }
    setApplyError('');
    setApplyKey((k) => k + 1);
    setApplyOpen(true);
  }

  async function handleApply({ name, phone, position, shift, note }) {
    if (!isAuthenticated) { navigate(`/login?redirect=/jobs/${id}`); return; }
    if (!isStudent) return;
    if (!phone) {
      setApplyError('Vui lòng nhập số điện thoại hoặc Zalo liên hệ.');
      return;
    }
    setApplying(true);
    setApplyError('');
    try {
      const targetId = job._id || job.id;
      await applyToJob(profileId, targetId, note, {
        name,
        phone,
        selectedPosition: position,
        selectedShift: shift,
      });
      if (phone && !user?.phone) {
        updateUserProfile({ phone }).catch(() => {});
        if (updateUser) updateUser({ ...user, phone });
      }
      setApplySuccess(true);
      setApplyOpen(false);
    } catch (err) {
      setApplyError(err.message);
    } finally {
      setApplying(false);
    }
  }

  if (loading) return <LoadingPage />;
  if (error) return <ErrorAlert message={error} onRetry={() => navigate(-1)} />;
  if (!job) return null;

  const emp = job.employer;
  const storeReviews = storeReviewResult.targetId === (job.employerUserId || job.employer?.userId)
    ? storeReviewResult.reviews : [];
  const typeLabel = JOB_TYPE_LABELS[job.type] || job.type;
  const unitLabel = SALARY_UNIT_LABELS[job.salaryUnit] || '';
  const contactPhone = job.contactPhone || emp?.contactPhone || emp?.phone || job.phone;

  // Strictly format job address: no employer.address fallback
  const displayAddress = (job.address && job.address.trim())
    ? job.address.trim()
    : '';

  // Google Maps directions URL based strictly on job.address
  const directionsUrl = getGoogleMapsDirectionsUrl(job);
  const showStickyApply = !applySuccess && !(isAuthenticated && !isStudent);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 lg:pb-8">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-text-muted hover:text-green-dark text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Quay lại
      </button>

      {showStickyApply && (
        <div
          className={clsx(
            'lg:hidden fixed inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-green-100 px-4 py-3 flex items-center gap-3',
            insideStudentArea ? 'bottom-14' : 'bottom-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]'
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-text-main truncate">{formatVND(job.salaryAmount)}{unitLabel}</p>
            <p className="text-xs text-text-muted truncate">{job.title}</p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            aria-label={saved ? 'Bỏ lưu' : 'Lưu việc'}
            className="p-3 rounded-full border border-green-200 text-green-dark"
          >
            {saved ? <BookmarkCheck className="w-5 h-5 text-green-main" /> : <Bookmark className="w-5 h-5" />}
          </button>
          <Button variant="primary" size="md" onClick={handleOpenApply} leftIcon={<Send className="w-4 h-4" />}>
            Ứng tuyển
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">
          {/* Job header card */}
          <div className="card">
            <div className="flex items-start gap-4">
              <div className={clsx('w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-2xl flex-shrink-0', avatarColorClass(emp?.storeName))}>
                {avatarInitial(emp?.storeName)}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge variant="green">{typeLabel}</Badge>
                  {emp?.verified && <VerifiedBadge />}
                  {job.featured && <Badge variant="pink">Nổi bật</Badge>}
                </div>
                <h1 className="text-2xl font-bold text-text-main leading-tight mb-1">{job.title}</h1>
                <p className="text-text-muted">{emp?.storeName}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-green-50">
              <Info icon={DollarSign} label="Mức lương" value={`${formatVND(job.salaryAmount)}${unitLabel}`} />
              <Info
                icon={MapPin}
                label="Khu vực"
                value={job.address ? job.address.split(',').slice(-2).join(', ').trim() : 'Hòa Lạc'}
              />
              <Info icon={Users} label="Số vị trí" value={`${job.slots} người`} />
              {job.closesAt && <Info icon={Clock} label="Hạn nộp" value={formatDate(job.closesAt)} />}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              {!applySuccess ? (
                isAuthenticated && !isStudent ? (
                  <div className="flex-1 px-4 py-3 bg-gray-100 rounded-2xl text-xs text-gray-500 font-medium text-center flex items-center justify-center">
                    Tài khoản {user?.role === 'employer' ? 'Nhà tuyển dụng' : 'Quản trị viên'} (Chỉ dành cho sinh viên ứng tuyển)
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleOpenApply}
                    leftIcon={<Send className="w-4 h-4" />}
                    className="flex-1"
                  >
                    Ứng tuyển ngay
                  </Button>
                )
              ) : (
                <div className="flex-1 flex items-center gap-2 px-6 py-3 bg-green-light rounded-full">
                  <CheckCircle className="w-5 h-5 text-green-main" />
                  <span className="font-semibold text-green-dark">Đã gửi đơn thành công!</span>
                </div>
              )}
              <Button
                variant="outline"
                size="lg"
                onClick={handleSave}
                leftIcon={saved ? <BookmarkCheck className="w-4 h-4 text-green-main" /> : <Bookmark className="w-4 h-4" />}
              >
                {saved ? 'Đã lưu' : 'Lưu việc'}
              </Button>
            </div>
          </div>

          {/* Positions & Shifts */}
          {job.positions?.length > 0 && (
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="section-title flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-green-main" /> Vị trí tuyển dụng & Ca làm việc
                </h2>
                <span className="text-xs text-text-muted font-medium">
                  {job.positions.length} vị trí
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {job.positions.slice(0, visiblePositionsCount).map((pos, pIdx) => (
                  <div key={pIdx} className="p-3.5 rounded-2xl bg-cream/70 border border-green-100 flex items-center justify-between gap-3 animate-scale-in">
                    <div>
                      <h4 className="font-bold text-sm text-text-main">{pos.title}</h4>
                      <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1 font-medium">
                        <Clock className="w-3.5 h-3.5 text-green-dark" /> {pos.shift}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="px-2.5 py-1 rounded-xl bg-green-100 text-green-dark font-bold text-[11px]">
                        Tuyển {pos.quantity || 1} bạn
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {job.positions.length > 5 && (
                <div className="pt-2 flex items-center justify-center">
                  {visiblePositionsCount < job.positions.length ? (
                    <button
                      type="button"
                      onClick={() => setVisiblePositionsCount(prev => prev + Math.min(5, job.positions.length - prev))}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-50 hover:bg-green-100 text-green-dark font-bold text-xs transition-colors shadow-xs"
                    >
                      <ChevronDown className="w-4 h-4" />
                      Xem thêm ({Math.min(5, job.positions.length - visiblePositionsCount) === job.positions.length - visiblePositionsCount ? `còn lại ${job.positions.length - visiblePositionsCount} vị trí` : `thêm ${Math.min(5, job.positions.length - visiblePositionsCount)} vị trí`})
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setVisiblePositionsCount(5)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 font-semibold text-xs transition-colors"
                    >
                      <ChevronUp className="w-4 h-4" />
                      Thu gọn (chỉ hiện 5 vị trí)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div className="card">
            <h2 className="section-title mb-4">Mô tả công việc</h2>
            <p className="text-text-muted leading-relaxed">{job.description}</p>

            {job.requirements?.length > 0 && (
              <>
                <h3 className="font-semibold text-text-main mt-5 mb-3">Yêu cầu</h3>
                <ul className="space-y-2">
                  {job.requirements.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-text-muted text-sm">
                      <CheckCircle className="w-4 h-4 text-green-main mt-0.5 flex-shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {job.benefits?.length > 0 && (
              <>
                <h3 className="font-semibold text-text-main mt-5 mb-3">Quyền lợi</h3>
                <ul className="space-y-2">
                  {job.benefits.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-green-dark text-sm">
                      <Star className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Reviews from students who completed shifts at this store */}
          <div className="card">
            <h2 className="section-title mb-4">Đánh giá nơi làm việc</h2>
            {storeReviews.length === 0 ? <p className="text-sm text-text-muted">Chưa có nhận xét từ sinh viên đã làm việc tại cửa hàng.</p> :
              <div className="space-y-4">
                {storeReviews.slice(0, 5).map((review) => <div key={review.id || review._id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-text-main">{review.authorName}</span>
                    <span className="text-text-muted">{review.date}</span>
                  </div>
                  <p className="text-yellow-600 text-sm" aria-label={`${review.rating} trên 5 sao`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</p>
                  {review.comment && <p className="text-sm text-text-main mt-1">{review.comment}</p>}
                </div>)}
              </div>}
          </div>

          {/* Schedule */}
          {job.schedule?.length > 0 && (
            <div className="card">
              <h2 className="section-title mb-4">Lịch làm việc</h2>
              <div className="space-y-2">
                {job.schedule.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-green-50 rounded-2xl">
                    <Calendar className="w-4 h-4 text-green-main flex-shrink-0" />
                    <span className="font-medium text-text-main text-sm">
                      {DAYS_OF_WEEK[s.dayOfWeek - 1] || `Thứ ${s.dayOfWeek}` || 'Linh hoạt'}
                    </span>
                    <span className="text-text-muted text-sm">
                      {s.startTime} – {s.endTime}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bus routes */}
          {job.busRoutes?.length > 0 && (
            <div className="p-4 bg-blue-50 rounded-2xl flex items-start gap-3">
              <Bus className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-800">Tuyến xe buýt kết nối</p>
                <p className="text-xs text-blue-600 mt-0.5">{job.busRoutes.join(', ')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Match score */}
          {matchResult && (
            <div className="card">
              <h3 className="font-semibold text-text-main mb-3">Mức độ phù hợp của bạn</h3>
              <MatchScoreBar {...matchResult} />
              {matchResult.hasConflict && (
                <div className="flex items-start gap-2 mt-3 p-3 bg-red-50 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-red-700 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-700">Một số ca làm có thể trùng với lịch học của bạn.</p>
                </div>
              )}
            </div>
          )}
          {!isAuthenticated && (
            <div className="card text-center">
              <p className="text-sm text-text-muted mb-3">Đăng nhập để xem mức độ phù hợp với lịch học của bạn</p>
              <Button variant="secondary" size="sm" onClick={() => navigate('/login')}>Đăng nhập</Button>
            </div>
          )}

          {/* Store info */}
          <div className="card">
            <h3 className="font-semibold text-text-main mb-3">Thông tin cửa hàng</h3>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl bg-green-light flex items-center justify-center text-green-dark font-bold text-xl">
                {emp?.storeName?.[0]}
              </div>
              <div>
                <p className="font-semibold text-text-main">{emp?.storeName}</p>
                <p className="text-xs text-text-muted">{emp?.storeType}</p>
              </div>
            </div>
            {emp?.verified && (
              <div className="flex items-center gap-2 p-2 bg-green-50 rounded-xl mb-3">
                <Shield className="w-4 h-4 text-green-main" />
                <p className="text-xs text-green-dark font-medium">Cửa hàng đã được Admin xác thực</p>
              </div>
            )}
            <div className="space-y-3 text-sm text-text-muted">
              <div>
                <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-green-main shrink-0" /> Địa chỉ làm việc:
                </p>
                <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-xs font-medium text-text-main leading-relaxed break-words">
                  {displayAddress || 'Chưa có thông tin địa chỉ cụ thể'}
                </div>
              </div>

              {/* Google Maps Directions */}
              {directionsUrl && (
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white border border-green-200 text-green-dark hover:bg-green-50 font-bold text-xs transition-all"
                  title="Chỉ đường trên Google Maps"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Chỉ đường trên Google Maps</span>
                </a>
              )}

              {/* Direct Phone & Zalo */}
              {contactPhone && (
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-pink-700 shrink-0" /> Số điện thoại / Zalo quán:
                  </p>
                  <div className="p-3 rounded-2xl bg-pink-50/50 border border-pink-100 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-text-main tracking-wider">{contactPhone}</span>
                      <span className="text-[10px] font-medium text-pink-600 bg-pink-100/70 px-2 py-0.5 rounded-full">
                        Liên hệ trực tiếp
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={`tel:${contactPhone}`}
                        className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all"
                        title="Gọi trực tiếp cho chủ quán"
                      >
                        <Phone className="w-3.5 h-3.5" /> Gọi ngay
                      </a>
                      <a
                        href={`https://zalo.me/${String(contactPhone).replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white border border-green-200 text-green-dark hover:bg-green-50 font-bold text-xs transition-all"
                        title="Nhắn tin Zalo"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Nhắn Zalo
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {emp?.ratingCount > 0 ? (
                <p className="flex items-center gap-2 text-xs">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span className="font-bold text-text-main">{Number(emp.rating || 0).toFixed(1)}</span>
                  <span className="text-text-muted">({emp.ratingCount} đánh giá)</span>
                </p>
              ) : (
                <p className="flex items-center gap-2 text-xs text-text-muted">
                  <Star className="w-4 h-4 text-gray-300" />
                  <span>Chưa có đánh giá</span>
                </p>
              )}
              {emp?.description && <p className="text-xs leading-relaxed mt-2">{emp.description}</p>}
            </div>
          </div>

          {/* Safety & Report Scam */}
          <div className="card bg-red-50/40 border border-red-100 p-4">
            <div className="flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-bold text-gray-800">Cảnh báo an toàn</p>
                <p className="text-gray-500 text-[11px] leading-relaxed">
                  Tuyệt đối không nộp bất kỳ khoản phí giữ chỗ hoặc giao CCCD/thẻ sinh viên gốc cho người tuyển dụng.
                </p>
                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-red-700 hover:text-red-700 font-bold pt-1 transition-colors"
                >
                  <Flag className="w-3.5 h-3.5" /> Báo cáo tin có dấu hiệu lừa đảo
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Apply modal */}
      <ApplyJobModal
        key={applyKey}
        isOpen={applyOpen}
        onClose={() => setApplyOpen(false)}
        job={job}
        unitLabel={unitLabel}
        storeName={emp?.storeName || job.storeName}
        user={user}
        defaultPhone={profilePhone}
        matchResult={matchResult}
        applying={applying}
        error={applyError}
        onSubmit={handleApply}
      />

      {/* Report Scam / Violation Modal */}
      <Modal isOpen={reportOpen} onClose={() => setReportOpen(false)} title="Báo cáo tin tuyển dụng vi phạm" size="md">
        {reportSuccess ? (
          <div className="p-6 text-center space-y-2">
            <CheckCircle className="w-10 h-10 text-green-main mx-auto" />
            <h4 className="font-bold text-base text-text-main">Đã gửi báo cáo thành công!</h4>
            <p className="text-xs text-text-muted">
              Cảm ơn bạn đã đóng góp giúp môi trường việc làm sinh viên Hòa Lạc an toàn và minh bạch.
            </p>
          </div>
        ) : (
          <form onSubmit={handleReportSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-text-main mb-1">Lý do báo cáo vi phạm:</label>
              <select aria-label="Lý do báo cáo vi phạm:"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
              >
                <option value="Lừa đảo / Yêu cầu đặt cọc phí">Lừa đảo / Yêu cầu đặt cọc tiền giữ chỗ</option>
                <option value="Thông tin mức lương sai sự thật">Thông tin mức lương / địa chỉ sai lệch thực tế</option>
                <option value="Yêu cầu giữ giấy tờ tùy thân gốc">Yêu cầu giữ CCCD / Thẻ sinh viên gốc</option>
                <option value="Thái độ đe dọa / Quấy rối">Thái độ không chuẩn mực / Quấy rối</option>
                <option value="Lý do khác">Lý do khác</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-text-main mb-1">
                Mô tả chi tiết bằng chứng <span className="text-red-700">*</span>:
              </label>
              <textarea
                rows={4}
                required
                value={reportContent}
                onChange={(e) => setReportContent(e.target.value)}
                placeholder="Mô tả cụ thể sự việc đã xảy ra, tin nhắn hoặc bằng chứng trao đổi..."
                className="w-full p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-gray-100 text-text-muted font-semibold hover:bg-gray-200"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submittingReport}
                className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50"
              >
                {submittingReport ? 'Đang gửi...' : 'Gửi báo cáo vi phạm'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-green-main mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs text-text-muted">{label}</p>
        <p className="text-sm font-semibold text-text-main">{value}</p>
      </div>
    </div>
  );
}
