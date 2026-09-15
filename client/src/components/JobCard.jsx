import { Link } from 'react-router-dom';
import { MapPin, Clock, DollarSign, Users, CheckCircle, Star, Bookmark, BookmarkCheck } from 'lucide-react';
import { clsx } from 'clsx';
import { Badge, VerifiedBadge } from './Badge.jsx';
import { JOB_TYPE_LABELS, SALARY_UNIT_LABELS } from '@/constants';
import { formatVND, formatDate } from '@/utils';

export function JobCard({ job, onSave, isSaved, compact = false }) {
  const typeLabel = JOB_TYPE_LABELS[job.type] || job.type;
  const unitLabel = SALARY_UNIT_LABELS[job.salaryUnit] || '';
  const employer = job.employer;

  function handleSave(e) {
    e.preventDefault();
    e.stopPropagation();
    onSave?.(job.id);
  }

  return (
    <Link to={`/jobs/${job.id}`} className="block">
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
            {employer?.storeName?.[0] || '?'}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Badge variant="green">{typeLabel}</Badge>
              {employer?.verified && <VerifiedBadge />}
            </div>
            <h3 className="font-bold text-text-main text-base leading-tight line-clamp-2">{job.title}</h3>
            <p className="text-text-muted text-sm mt-0.5">{employer?.storeName}</p>
          </div>
        </div>

        {!compact && (
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-1.5 text-sm text-text-muted">
              <DollarSign className="w-4 h-4 text-green-main flex-shrink-0" />
              <span className="font-semibold text-text-main">{formatVND(job.salaryAmount)}<span className="text-text-muted font-normal">{unitLabel}</span></span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-text-muted">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{employer?.address?.split(',')[0] || 'Hòa Lạc'}</span>
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
          <p className="text-xs text-text-light">Đăng {formatDate(job.postedAt)}</p>
          {job.featured && (
            <Badge variant="pink">⭐ Nổi bật</Badge>
          )}
        </div>
      </div>
    </Link>
  );
}

export function MatchScoreBar({ score, reasons, hasConflict }) {
  const color = hasConflict ? 'bg-red-400' : score >= 70 ? 'bg-green-main' : score >= 40 ? 'bg-yellow-400' : 'bg-gray-300';
  return (
    <div className="p-4 bg-green-50 rounded-2xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-text-main">Mức độ phù hợp</span>
        <span className={clsx('text-lg font-bold', hasConflict ? 'text-red-500' : 'text-green-dark')}>
          {score}%
        </span>
      </div>
      <div className="w-full h-2 bg-white rounded-full overflow-hidden mb-3">
        <div className={clsx('h-full rounded-full transition-all duration-500', color)} style={{ width: `${score}%` }} />
      </div>
      <ul className="space-y-1">
        {reasons.map((r, i) => (
          <li key={i} className="text-xs text-text-muted flex items-start gap-1.5">
            <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0 text-green-main" />
            {r}
          </li>
        ))}
      </ul>
      {!score && <p className="text-xs text-text-light italic">Đăng nhập và hoàn thiện lịch rảnh để xem mức phù hợp.</p>}
    </div>
  );
}
