import { Link } from 'react-router-dom';
import { MapPin, Clock, Users, Bookmark, BookmarkCheck, Navigation, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';
import { JOB_TYPE_LABELS, SALARY_UNIT_LABELS } from '@/constants';
import { formatVND, formatDate, getGoogleMapsDirectionsUrl } from '@/utils';

export function JobCard({ job, onSave, onToggleSave, isSaved, compact = false }) {
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

  const storeName = employer?.storeName || job.storeName || 'Cửa hàng địa phương';
  const addressText = job.address?.split(',')[0] || employer?.address?.split(',')[0] || 'Hòa Lạc';
  const distanceText = job.distanceMeters !== null && job.distanceMeters !== undefined
    ? (job.distanceMeters < 1000 ? `${Math.round(job.distanceMeters)}m` : `${(job.distanceMeters / 1000).toFixed(1)}km`)
    : null;

  return (
    <Link to={`/jobs/${jobId}`} className="group block h-full">
      <div className="bg-white rounded-xl border border-gray-200/90 hover:border-gray-300 transition-colors p-4 relative flex flex-col justify-between h-full">
        {/* Save button */}
        {handleSaveClick && (
          <button
            onClick={handleSave}
            aria-label={isSaved ? 'Bỏ lưu' : 'Lưu việc'}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-md text-gray-400 hover:text-green-dark hover:bg-gray-50 transition-colors z-10"
          >
            {isSaved ? <BookmarkCheck className="w-4 h-4 text-green-dark" /> : <Bookmark className="w-4 h-4" />}
          </button>
        )}

        <div className="flex-1 flex flex-col pr-6">
          {/* 1. Job Title */}
          <h3
            className="font-semibold text-text-main text-sm sm:text-base leading-snug line-clamp-2 group-hover:text-green-dark transition-colors"
            title={job.title}
          >
            {job.title}
          </h3>

          {/* 2. Store & Verification */}
          <div className="flex items-center gap-1.5 text-xs text-text-muted mt-1 truncate">
            <span className="font-medium text-text-main truncate">{storeName}</span>
            {employer?.verified && (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" title="Cửa hàng đã xác minh" />
            )}
          </div>

          {/* 3. Salary - Scannable */}
          <div className="mt-2.5 flex items-baseline gap-1">
            <span className="text-sm sm:text-base font-bold text-green-dark">
              {formatVND(job.salaryAmount)}
            </span>
            <span className="text-xs text-text-muted">{unitLabel}</span>
          </div>

          {/* 4. Shift & Location Metadata */}
          {!compact && (
            <div className="mt-2.5 pt-2.5 border-t border-gray-100 space-y-1 text-xs text-text-muted">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span>{typeLabel}</span>
                </span>
                {job.slots && (
                  <span className="text-gray-400">• {job.slots} chỗ</span>
                )}
              </div>

              <div className="flex items-center gap-1 truncate" title={job.address || employer?.address}>
                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="truncate">{addressText}</span>
                {distanceText && (
                  <span className="text-gray-500 font-medium shrink-0">• Cách {distanceText}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 5. Footer: Match Score / Featured & Quiet Directions Action */}
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-100 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            {job.featured && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                Ưu tiên
              </span>
            )}
            {job.matchScore && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-50 text-green-800 border border-green-200">
                Khớp {job.matchScore}%
              </span>
            )}
            <span className="text-[11px] text-text-light truncate">
              {formatDate(job.postedAt)}
            </span>
          </div>

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
                className="inline-flex items-center gap-1 text-[11px] font-medium text-text-muted hover:text-green-dark transition-colors py-0.5 px-1 rounded hover:bg-gray-50 shrink-0"
                title="Mở chỉ đường Google Maps"
              >
                <Navigation className="w-3 h-3 text-gray-400" />
                <span>Chỉ đường</span>
              </button>
            );
          })()}
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
  return (
    <div className="p-4 bg-white rounded-xl border border-gray-200 space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-text-main">Mức độ phù hợp với lịch của bạn</span>
        <span className={clsx('text-base font-bold', hasConflict ? 'text-red-600' : 'text-green-dark')}>
          {score}%
        </span>
      </div>

      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={clsx('h-full transition-all duration-300', hasConflict ? 'bg-red-500' : 'bg-green-main')}
          style={{ width: `${score}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
        <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
          <span className="text-gray-500 block text-[11px]">Khớp thời gian:</span>
          <span className="font-semibold text-text-main">
            {scheduleScore !== undefined ? `${scheduleScore}%` : '85%'}
          </span>
        </div>

        <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
          <span className="text-gray-500 block text-[11px]">Khoảng cách:</span>
          <span className="font-semibold text-text-main">
            {distanceKm !== null && distanceKm !== undefined ? `~${distanceKm} km` : 'Gần trường'}
          </span>
        </div>
      </div>

      {reasons && reasons.length > 0 && (
        <ul className="space-y-1 pt-1 text-text-muted text-[11px]">
          {reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="text-green-600 mt-0.5">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
