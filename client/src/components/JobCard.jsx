import { Link } from 'react-router-dom';
import { MapPin, DollarSign, Users, CheckCircle, Star, Bookmark, BookmarkCheck, Calendar, Navigation } from 'lucide-react';
import { clsx } from 'clsx';
import { Badge } from './Badge.jsx';
import { JOB_TYPE_LABELS, SALARY_UNIT_LABELS } from '@/constants';
import { formatVND, formatDate, getGoogleMapsDirectionsUrl } from '@/utils';
import { avatarColorClass, avatarInitial } from '@/utils/avatarColor.js';
import { formatDistanceLabel } from '@/utils/jobLocation.js';

export function JobCard({ job, onSave, onToggleSave, isSaved, isSelected = false, compact = false }) {
  const typeLabel = JOB_TYPE_LABELS[job.type] || job.type;
  const unitLabel = SALARY_UNIT_LABELS[job.salaryUnit] || '';
  const employer = job.employer;
  const jobId = job._id || job.id;
  const handleSaveClick = onSave || onToggleSave;

  function handleSave(e) {
    e.preventDefault();
    e.stopPropagation();
    handleSaveClick?.(jobId);
  }

  return (
    <Link to={`/jobs/${jobId}`} className="group block h-full">
      <div
        className={clsx(
          'relative h-full flex flex-col justify-between p-5 rounded-2xl bg-white transition-all duration-150',
          isSelected
            ? 'border-2 border-green-600 shadow-sm'
            : 'border border-stone-200/90 shadow-xs hover:border-stone-300'
        )}
      >
        {/* Save button */}
        {handleSaveClick && (
          <button
            onClick={handleSave}
            aria-label={isSaved ? 'Bỏ lưu' : 'Lưu việc'}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-500 hover:text-green-main hover:bg-green-50 transition-all z-10"
          >
            {isSaved ? <BookmarkCheck className="w-5 h-5 text-green-main" /> : <Bookmark className="w-5 h-5" />}
          </button>
        )}

        <div className="flex-1 flex flex-col">
          {/* Top header row: Avatar + Badges + Title + Store */}
          <div className="flex items-start gap-3.5 pr-8">
            {/* Store avatar */}
            <div className={clsx('w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg flex-shrink-0', avatarColorClass(employer?.storeName || job.storeName))}>
              {avatarInitial(employer?.storeName || job.storeName)}
            </div>

            <div className="flex-1 min-w-0">
              {/* Badges container with min-height for uniform alignment */}
              <div className="min-h-[26px] flex flex-wrap items-center gap-1.5 mb-1">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 whitespace-nowrap">
                  {typeLabel}
                </span>
                {employer?.verified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 whitespace-nowrap">
                    <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                    Đã xác thực
                  </span>
                )}
                {job.matchScore && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                    Khớp {job.matchScore}%
                  </span>
                )}
                {job.distanceMeters !== null && job.distanceMeters !== undefined && (
                  <span
                    className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold flex items-center gap-0.5"
                    title={job.distanceApproximate
                      ? 'Khoảng cách ước tính: quán chưa ghim vị trí chính xác hoặc vị trí của bạn có sai số lớn'
                      : job.distanceSource === 'vietmap_matrix'
                        ? 'Quãng đường xe máy do Vietmap tính'
                        : 'Khoảng cách đường chim bay từ vị trí GPS của bạn'}
                  >
                    Cách {formatDistanceLabel(job.distanceMeters, job.distanceApproximate)}
                  </span>
                )}
              </div>

              {/* Title & Store */}
              <h3 className="font-bold text-text-main text-base leading-snug line-clamp-2 group-hover:text-green-main transition-colors" title={job.title}>
                {job.title}
              </h3>
              <p className="text-text-muted text-sm mt-0.5 truncate">
                {employer?.storeName || job.storeName || 'Đang cập nhật'}
              </p>
            </div>
          </div>

          {/* Details 2x2 Grid */}
          {!compact && (
            <div className="mt-3.5 pt-3 border-t border-gray-100 grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:text-sm text-text-muted">
              <div className="flex items-center gap-1.5 min-w-0">
                <DollarSign className="w-4 h-4 text-green-main flex-shrink-0" />
                <span className="font-semibold text-text-main truncate">
                  {formatVND(job.salaryAmount)}
                  <span className="text-text-muted font-normal text-xs">{unitLabel}</span>
                </span>
              </div>

              <div className="flex items-center gap-1.5 min-w-0" title={job.address || employer?.address || 'Hòa Lạc'}>
                <MapPin className="w-4 h-4 flex-shrink-0 text-red-700" />
                <span className="truncate">{job.address?.split(',')[0] || employer?.address?.split(',')[0] || 'Hòa Lạc'}</span>
              </div>

              <div className="flex items-center gap-1.5 min-w-0">
                <Users className="w-4 h-4 flex-shrink-0 text-blue-500" />
                <span className="truncate">{job.slots} vị trí</span>
              </div>

              {employer?.ratingCount > 0 && (
                <div className="flex items-center gap-1.5 min-w-0">
                  <Star className="w-4 h-4 flex-shrink-0 text-yellow-400 fill-yellow-400" />
                  <span className="truncate">{employer.rating.toFixed(1)} ({employer.ratingCount} đánh giá)</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer pinned to bottom with mt-auto */}
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100 min-h-[40px]">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-xs text-text-light truncate">Đăng {formatDate(job.postedAt)}</p>
            {(() => {
              const directionsUrl = getGoogleMapsDirectionsUrl(job);
              if (!directionsUrl) return null;

              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(directionsUrl, '_blank');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-stone-100 text-text-muted hover:bg-green-50 hover:text-green-dark text-[11px] font-semibold transition-colors"
                  title="Chỉ đường trên Google Maps"
                >
                  <Navigation className="w-3 h-3" />
                  <span>Chỉ đường</span>
                </button>
              );
            })()}
          </div>
          {job.featured ? (
            <Badge variant="pink"><Star className="w-3 h-3" /> Nổi bật</Badge>
          ) : (
            <div className="h-5" />
          )}
        </div>
      </div>
    </Link>
  );
}

const DISTANCE_BASIS_LABELS = {
  gps: 'Theo vị trí GPS hiện tại',
  profile: 'Theo vị trí trong hồ sơ',
  area: 'Ước tính theo khu vực trong hồ sơ',
};

export function MatchScoreBar({
  score = null,
  timeScore = null,
  distanceMeters = null,
  distanceApproximate = false,
  distanceBasis = null,
  reasons = [],
  hasConflict = false,
}) {
  const hasScore = Number.isFinite(score);
  const color = hasConflict ? 'bg-red-400' : score >= 70 ? 'bg-green-main' : score >= 40 ? 'bg-yellow-400' : 'bg-gray-300';
  const distanceText = Number.isFinite(distanceMeters) ? formatDistanceLabel(distanceMeters, distanceApproximate) : null;

  return (
    <div className="p-4 bg-green-50 rounded-2xl space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text-main">Mức độ phù hợp tổng quan</span>
        <span className={clsx('text-xl font-bold', hasConflict ? 'text-red-700' : 'text-green-dark')}>
          {hasScore ? `${score}%` : '—'}
        </span>
      </div>

      {hasScore ? (
        <div className="w-full h-2.5 bg-white rounded-full overflow-hidden">
          <div className={clsx('h-full rounded-full transition-all duration-500', color)} style={{ width: `${score}%` }} />
        </div>
      ) : (
        <p className="text-xs text-text-muted">Chưa đủ dữ liệu để chấm điểm. Hãy cập nhật lịch rảnh và cho phép định vị.</p>
      )}

      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="bg-white/80 p-2.5 rounded-xl border border-green-100">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-green-800">
            <Calendar className="w-3.5 h-3.5 text-green-600" /> Khớp lịch rảnh
          </div>
          <p className="text-sm font-bold text-text-main mt-0.5">{Number.isFinite(timeScore) ? `${timeScore}%` : 'Chưa xác định'}</p>
          <p className="text-[10px] text-text-muted">{Number.isFinite(timeScore) ? 'So với lịch rảnh của bạn' : 'Cần lịch rảnh và lịch ca'}</p>
        </div>

        <div className="bg-white/80 p-2.5 rounded-xl border border-green-100">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-green-800">
            <Navigation className="w-3.5 h-3.5 text-green-600" /> Khoảng cách
          </div>
          <p className="text-sm font-bold text-text-main mt-0.5">{distanceText || 'Chưa xác định'}</p>
          <p className="text-[10px] text-text-muted">
            {distanceText ? (DISTANCE_BASIS_LABELS[distanceBasis] || 'Đường chim bay') : 'Cần vị trí của bạn và vị trí quán'}
          </p>
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
