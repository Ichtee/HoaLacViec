import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  MapPin, Clock, DollarSign, Users, Star, CheckCircle, Shield,
  Bookmark, BookmarkCheck, Send, ArrowLeft, Bus, AlertTriangle, Calendar, Navigation, ExternalLink,
  Phone, MessageCircle, Flag
} from 'lucide-react';
import { useAsync } from '@/hooks';
import { getJob, applyToJob, toggleSaveJob, isSavedJob, getAvailability, getStudentProfile, createReport, updateUserProfile } from '@/services';
import { useAuth } from '@/hooks/useAuth.jsx';
import { JobCard, MatchScoreBar } from '@/components/JobCard.jsx';
import { VerifiedBadge, Badge } from '@/components/Badge.jsx';
import { Button } from '@/components/Button.jsx';
import { Modal } from '@/components/Modal.jsx';
import { Textarea } from '@/components/Form.jsx';
import { LoadingPage, ErrorAlert } from '@/components/Feedback.jsx';
import { JOB_TYPE_LABELS, SALARY_UNIT_LABELS, DAYS_OF_WEEK } from '@/constants';
import { formatVND, formatDate, computeMatchScore, formatDistance, haversineDistance } from '@/utils';

export default function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isStudent, profileId, user, updateUser } = useAuth();

  const [saved, setSaved] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [candidateName, setCandidateName] = useState(user?.name || '');
  const [candidatePhone, setCandidatePhone] = useState(user?.phone || '');
  const [candidateShift, setCandidateShift] = useState('Ca Sáng (7h - 12h)');
  const [applyNote, setApplyNote] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [applySuccess, setApplySuccess] = useState(false);
  const [matchResult, setMatchResult] = useState(null);

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

  useEffect(() => {
    if (user?.name && !candidateName) setCandidateName(user.name);
    if (user?.phone && !candidatePhone) setCandidatePhone(user.phone);
  }, [user]);

  const { data: job, loading, error } = useAsync(() => getJob(id), [id]);

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
        const phoneFromProfile = user?.phone || profile?.phone || profile?.contactPhone;
        if (phoneFromProfile && !candidatePhone) {
          setCandidatePhone(phoneFromProfile);
        }
      }).catch(() => {});
    }
  }, [job, isAuthenticated, profileId, user, candidatePhone]);

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
    if (user?.name && !candidateName) setCandidateName(user.name);
    if (user?.phone && !candidatePhone) setCandidatePhone(user.phone);
    setApplyOpen(true);
  }

  async function handleApply(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!isAuthenticated) { navigate(`/login?redirect=/jobs/${id}`); return; }
    if (!isStudent) return;
    if (!candidatePhone.trim()) {
      setApplyError('Vui lòng nhập số điện thoại hoặc Zalo liên hệ.');
      return;
    }
    setApplying(true);
    setApplyError('');
    try {
      const targetId = job._id || job.id;
      const combinedNote = `[Ca mong muốn: ${candidateShift}]${applyNote ? ` ${applyNote}` : ''}`;
      await applyToJob(profileId, targetId, combinedNote, {
        name: candidateName,
        phone: candidatePhone,
      });
      if (candidatePhone && !user?.phone) {
        updateUserProfile({ phone: candidatePhone.trim() }).catch(() => {});
        if (updateUser) updateUser({ ...user, phone: candidatePhone.trim() });
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
  const typeLabel = JOB_TYPE_LABELS[job.type] || job.type;
  const unitLabel = SALARY_UNIT_LABELS[job.salaryUnit] || '';
  const contactPhone = job.contactPhone || emp?.contactPhone || emp?.phone || job.phone;

  // Construct search destination for Google Maps: use full address directly
  const fullAddress = job.address || emp?.address || '';
  const mapSearchQuery = fullAddress
    || (job.storeName ? `${job.storeName}, Hòa Lạc, Thạch Thất, Hà Nội` : '')
    || (job.location?.lat && job.location?.lng ? `${job.location.lat},${job.location.lng}` : 'Hòa Lạc, Thạch Thất, Hà Nội');

  const googleMapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapSearchQuery)}`;
  const googleMapsNavUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapSearchQuery)}`;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-text-muted hover:text-green-dark text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Quay lại
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">
          {/* Job header card */}
          <div className="card">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-green-light flex items-center justify-center text-green-dark font-bold text-2xl flex-shrink-0">
                {emp?.storeName?.[0] || '?'}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge variant="green">{typeLabel}</Badge>
                  {emp?.verified && <VerifiedBadge />}
                  {job.featured && <Badge variant="pink">⭐ Nổi bật</Badge>}
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
              <Info icon={Clock} label="Hạn nộp" value={formatDate(job.closesAt)} />
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

          {/* Schedule */}
          {job.schedule?.length > 0 && (
            <div className="card">
              <h2 className="section-title mb-4">Lịch làm việc</h2>
              <div className="space-y-2">
                {job.schedule.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-green-50 rounded-2xl">
                    <Calendar className="w-4 h-4 text-green-main flex-shrink-0" />
                    <span className="font-medium text-text-main text-sm">
                      {DAYS_OF_WEEK[s.dayOfWeek - 1]}
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
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-600">Một số ca làm có thể trùng với lịch học của bạn.</p>
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
                  {fullAddress || 'Khu CNC Hòa Lạc, Thạch Thất, Hà Nội'}
                </div>
              </div>

              {/* Single clean Google Maps Directions Button */}
              <a
                href={googleMapsNavUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all"
                title="Mở chỉ đường Google Maps từ vị trí của bạn đến quán"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Chỉ đường trên Google Maps</span>
              </a>

              {/* Direct Phone & Zalo */}
              {contactPhone && (
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-pink-main shrink-0" /> Số điện thoại / Zalo quán:
                  </p>
                  <div className="p-2.5 rounded-xl bg-pink-50/60 border border-pink-100 flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-text-main tracking-wide">{contactPhone}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={`tel:${contactPhone}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all"
                        title="Gọi trực tiếp cho chủ quán"
                      >
                        <Phone className="w-3 h-3" /> Gọi ngay
                      </a>
                      <a
                        href={`https://zalo.me/${contactPhone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all"
                        title="Nhắn tin Zalo"
                      >
                        <MessageCircle className="w-3 h-3" /> Zalo
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {emp?.rating > 0 && (
                <p className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  {emp.rating.toFixed(1)} ({emp.ratingCount} đánh giá)
                </p>
              )}
              {emp?.description && <p className="text-xs leading-relaxed mt-2">{emp.description}</p>}
            </div>
          </div>

          {/* Safety & Report Scam */}
          <div className="card bg-red-50/40 border border-red-100 p-4">
            <div className="flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-bold text-gray-800">Cảnh báo an toàn</p>
                <p className="text-gray-500 text-[11px] leading-relaxed">
                  Tuyệt đối không nộp bất kỳ khoản phí giữ chỗ hoặc giao CCCD/thẻ sinh viên gốc cho người tuyển dụng.
                </p>
                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-bold pt-1 transition-colors"
                >
                  <Flag className="w-3.5 h-3.5" /> Báo cáo tin có dấu hiệu lừa đảo
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Apply modal */}
      <Modal isOpen={applyOpen} onClose={() => setApplyOpen(false)} title="Ứng tuyển công việc" size="md">
        <form onSubmit={handleApply} className="space-y-4 text-xs">
          {/* Job summary card */}
          <div className="p-3 bg-green-50/70 border border-green-100 rounded-2xl flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-green-dark">Vị trí ứng tuyển:</span>
              <h4 className="font-bold text-sm text-text-main mt-0.5">{job.title}</h4>
              <p className="text-text-muted">{emp?.storeName || job.storeName}</p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold text-green-dark">Mức lương:</span>
              <p className="font-bold text-sm text-orange-600">{formatVND(job.salaryAmount)}{unitLabel}</p>
            </div>
          </div>

          {/* Form fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-text-main mb-1">
                Họ và tên sinh viên <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={candidateName}
                onChange={e => setCandidateName(e.target.value)}
                placeholder="Ví dụ: Nguyễn Văn A"
                className="w-full p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-main font-semibold text-text-main"
              />
            </div>
            <div>
              <label className="block font-bold text-text-main mb-1">
                Số điện thoại / Zalo <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={candidatePhone}
                onChange={e => setCandidatePhone(e.target.value)}
                placeholder="Ví dụ: 0987654321"
                className="w-full p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-main font-semibold text-text-main"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-text-main mb-1">
              Ca làm việc mong muốn
            </label>
            <select
              value={candidateShift}
              onChange={e => setCandidateShift(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-main font-semibold text-text-main bg-white"
            >
              <option value="Ca Sáng (7h - 12h)">Ca Sáng (7h - 12h)</option>
              <option value="Ca Chiều (12h - 17h)">Ca Chiều (12h - 17h)</option>
              <option value="Ca Tối (17h - 22h)">Ca Tối (17h - 22h)</option>
              <option value="Ca Xoay / Linh hoạt theo lịch học">Ca Xoay / Linh hoạt theo lịch học</option>
              <option value="Full-time cuối tuần (Thứ 7 & CN)">Full-time cuối tuần (Thứ 7 & CN)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-text-main mb-1">
              Kinh nghiệm & Giới thiệu bản thân
            </label>
            <textarea
              rows={3}
              value={applyNote}
              onChange={e => setApplyNote(e.target.value)}
              placeholder="Ví dụ: Em từng làm phục vụ quán cafe 3 tháng, chăm chỉ, đúng giờ, có xe máy đi lại..."
              className="w-full p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-main resize-none text-xs text-text-main"
            />
          </div>

          <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-xl text-[11px] text-blue-800 flex items-center gap-1.5">
            <span>🛡️</span>
            <span>Số điện thoại/Zalo của bạn sẽ được gửi trực tiếp đến chủ quán để sắp xếp phỏng vấn.</span>
          </div>

          {applyError && <p className="text-red-500 font-semibold text-xs">{applyError}</p>}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setApplyOpen(false)}
              className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-text-muted font-bold"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={applying}
              className="px-5 py-2 rounded-xl bg-green-main hover:bg-green-dark text-white font-bold disabled:opacity-50 shadow-sm"
            >
              {applying ? 'Đang gửi hồ sơ...' : 'Xác nhận nộp đơn'}
            </button>
          </div>
        </form>
      </Modal>

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
              <select
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
                Mô tả chi tiết bằng chứng <span className="text-red-500">*</span>:
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
