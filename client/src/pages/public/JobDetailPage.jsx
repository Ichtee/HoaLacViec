import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  MapPin, Clock, DollarSign, Users, Star, CheckCircle, Shield,
  Bookmark, BookmarkCheck, Send, ArrowLeft, Bus, AlertTriangle, Calendar
} from 'lucide-react';
import { useAsync } from '@/hooks';
import { getJob, applyToJob, toggleSaveJob, isSavedJob, getAvailability, getStudentProfile } from '@/services';
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
  const { isAuthenticated, isStudent, profileId } = useAuth();

  const [saved, setSaved] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyNote, setApplyNote] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [applySuccess, setApplySuccess] = useState(false);
  const [matchResult, setMatchResult] = useState(null);

  const { data: job, loading, error } = useAsync(() => getJob(id), [id]);

  // Load saved status and match score
  useEffect(() => {
    if (!job || !isAuthenticated || !profileId) return;
    isSavedJob(profileId, job.id).then(setSaved);
    // Compute match score
    Promise.all([
      getAvailability(profileId),
      getStudentProfile(profileId),
    ]).then(([avail, profile]) => {
      const result = computeMatchScore(job, avail, profile.location);
      setMatchResult(result);
    }).catch(() => {});
  }, [job, isAuthenticated, profileId]);

  async function handleSave() {
    if (!isAuthenticated) { navigate('/login'); return; }
    const result = await toggleSaveJob(profileId, job.id);
    setSaved(result.saved);
  }

  async function handleApply() {
    if (!isAuthenticated) { navigate(`/login?redirect=/jobs/${id}`); return; }
    if (!isStudent) return;
    setApplying(true);
    setApplyError('');
    try {
      await applyToJob(profileId, job.id, applyNote);
      setApplySuccess(true);
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
              <Info icon={MapPin} label="Địa điểm" value={emp?.address?.split(',')[0] || 'Hòa Lạc'} />
              <Info icon={Users} label="Số vị trí" value={`${job.slots} người`} />
              <Info icon={Clock} label="Hạn nộp" value={formatDate(job.closesAt)} />
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              {!applySuccess ? (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => isAuthenticated ? setApplyOpen(true) : navigate(`/login?redirect=/jobs/${id}`)}
                  leftIcon={<Send className="w-4 h-4" />}
                  className="flex-1"
                >
                  Ứng tuyển ngay
                </Button>
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
                <p className="text-sm font-semibold text-blue-800">Tuyến xe buýt (dữ liệu demo)</p>
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
            <div className="space-y-2 text-sm text-text-muted">
              <p className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />{emp?.address}</p>
              {emp?.rating > 0 && (
                <p className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  {emp.rating.toFixed(1)} ({emp.ratingCount} đánh giá)
                </p>
              )}
              {emp?.description && <p className="text-xs leading-relaxed mt-2">{emp.description}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Apply modal */}
      <Modal isOpen={applyOpen} onClose={() => setApplyOpen(false)} title="Ứng tuyển vị trí này" size="sm">
        <div className="mb-4 p-4 bg-green-50 rounded-2xl">
          <p className="font-semibold text-text-main">{job.title}</p>
          <p className="text-sm text-text-muted">{emp?.storeName}</p>
        </div>
        <Textarea
          id="apply-note"
          label="Lời giới thiệu (không bắt buộc)"
          value={applyNote}
          onChange={(e) => setApplyNote(e.target.value)}
          placeholder="Chia sẻ ngắn về bản thân hoặc lý do muốn ứng tuyển..."
          rows={3}
        />
        {applyError && <p className="error-msg mt-2">{applyError}</p>}
        <div className="flex gap-3 justify-end mt-5">
          <Button variant="ghost" onClick={() => setApplyOpen(false)}>Hủy</Button>
          <Button variant="primary" onClick={handleApply} loading={applying}>Gửi đơn</Button>
        </div>
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
