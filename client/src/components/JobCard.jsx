import { Link } from 'react-router-dom';
import { MapPin, Clock, DollarSign, Users, CheckCircle, Star, Bookmark, BookmarkCheck, Calendar, Navigation } from 'lucide-react';
import { clsx } from 'clsx';
import { Badge, VerifiedBadge } from './Badge.jsx';
import { JOB_TYPE_LABELS, SALARY_UNIT_LABELS } from '@/constants';
import { formatVND, formatDate } from '@/utils';

export function JobCard({ job, onSave, isSaved, compact = false }) {
  const typeLabel = JOB_TYPE_LABELS[job.type] || job.type;
  const unitLabel = SALARY_UNIT_LABELS[job.salaryUnit] || '';
  const employer = job.employer;
  const jobId = job._id || job.id;

  function handleSave(e) {
    e.preventDefault();
    e.stopPropagation();
    onSave?.(jobId);
  }

  return (
    <Link to={`/jobs/${jobId}`} className="block">
      <div className="card-hover relative">
        {/* Save button */}
        {onSave && (
          <button
            onClick={handleSave}
            aria-label={isSaved ? 'Bỏ lưu' : 'Lưu việc'}
            className="absolute top-4 right-4 p-2 rounded-xl text-text-muted hover:text-green-main hover:bg-green-50 transition-all"
          >
            {isSaved ? <BookmarkCheck className="w-5 h-5 text-green-main" /> : <Bookmark className="w-5 h-5" />}
          </button>
        )}

        <div className="flex items-start gap-3 pr-8">
          {/* Store avatar */}
          <div className="w-12 h-12 rounded-2xl bg-green-light flex items-center justify-center text-green-dark font-bold text-lg flex-shrink-0">
            {employer?.storeName?.[0] || job.storeName?.[0] || '?'}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Badge variant="green">{typeLabel}</Badge>
              {employer?.verified && <VerifiedBadge />}
              {job.matchScore && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                  🎯 Khớp {job.matchScore}%
                </span>
              )}
            </div>
            <h3 className="font-bold text-text-main text-base leading-tight line-clamp-2">{job.title}</h3>
            <p className="text-text-muted text-sm mt-0.5">{employer?.storeName || job.storeName}</p>
          </div>
        </div>

        {!compact && (
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-1.5 text-sm text-text-muted">
              <DollarSign className="w-4 h-4 text-green-main flex-shrink-0" />
              <span className="font-semibold text-text-main">{formatVND(job.salaryAmount)}<span className="text-text-muted font-normal">{unitLabel}</span></span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-text-muted">
              <MapPin className="w-4 h-4 flex-shrink-0 text-red-500" />
              <span className="truncate">{employer?.address?.split(',')[0] || job.address?.split(',')[0] || 'Hòa Lạc'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-text-muted">
              <Users className="w-4 h-4 flex-shrink-0" />
              <span>{job.slots} vị trí</span>
            </div>
            {employer?.rating > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-text-muted">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                <span>{employer.rating.toFixed(1)} ({employer.ratingCount} đánh giá)</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-green-50">
          <div className="flex items-center gap-2">
            <p className="text-xs text-text-light">Đăng {formatDate(job.postedAt)}</p>
            {(() => {
              const dest = job.address
                || (job.storeName ? `${job.storeName}, Hòa Lạc, Thạch Thất, Hà Nội` : '')
                || (job.location?.lat && job.location?.lng ? `${job.location.lat},${job.location.lng}` : 'Hòa Lạc, Thạch Thất, Hà Nội');
              const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(navUrl, '_blank');
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-semibold transition-colors"
                  title="Mở chỉ đường trên Google Maps đến vị trí này"
                >
                  <Navigation className="w-3 h-3 text-blue-600" />
                  <span>Chỉ đường</span>
                </button>
              );
            })()}
          </div>
          {job.featured && (
            <Badge variant="pink">⭐ Nổi bật</Badge>
          )}
        </div>
      </div>
    </Link>
  );
}

export function MatchScoreBar({
  score = 85,
  scheduleScore,
  distanceScore,
  distanceKm,
  recommendation,
  reasons = [],
  hasConflict = false
}) {
  const color = hasConflict ? 'bg-red-400' : score >= 70 ? 'bg-green-main' : score >= 40 ? 'bg-yellow-400' : 'bg-gray-300';

  return (
    <div className="p-4 bg-green-50 rounded-2xl space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text-main">Mức độ phù hợp tổng quan</span>
        <span className={clsx('text-xl font-bold', hasConflict ? 'text-red-500' : 'text-green-dark')}>
          {score}%
        </span>
      </div>

      <div className="w-full h-2.5 bg-white rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all duration-500', color)} style={{ width: `${score}%` }} />
      </div>

      {/* Breakdown: Schedule Match & Distance Match */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="bg-white/80 p-2.5 rounded-xl border border-green-100">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-green-800">
            <Calendar className="w-3.5 h-3.5 text-green-600" /> Khớp lịch học
          </div>
          <p className="text-sm font-bold text-text-main mt-0.5">
            {scheduleScore !== undefined ? `${scheduleScore}%` : '85%'}
          </p>
          <p className="text-[10px] text-text-muted">Không trùng lịch thi/học</p>
        </div>

        <div className="bg-white/80 p-2.5 rounded-xl border border-green-100">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-blue-800">
            <Navigation className="w-3.5 h-3.5 text-blue-600" /> Vị trí gần
          </div>
          <p className="text-sm font-bold text-text-main mt-0.5">
            {distanceKm !== null && distanceKm !== undefined ? `~${distanceKm} km` : 'Gần trường'}
          </p>
          <p className="text-[10px] text-text-muted">{recommendation || 'Khu CNC Hòa Lạc'}</p>
        </div>
      </div>

      {reasons && reasons.length > 0 && (
        <ul className="space-y-1 pt-1">
          {reasons.map((r, i) => (
            <li key={i} className="text-xs text-text-muted flex items-start gap-1.5">
              <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0 text-green-main" />
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
