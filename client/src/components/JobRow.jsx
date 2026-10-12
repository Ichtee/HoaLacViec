import { Link } from 'react-router-dom';
import { Bookmark, BookmarkCheck, CheckCircle, Star } from 'lucide-react';
import { clsx } from 'clsx';
import { JOB_TYPE_LABELS, SALARY_UNIT_LABELS } from '@/constants';
import { formatVND, formatDate } from '@/utils';
import { avatarColorClass, avatarInitial } from '@/utils/avatarColor.js';
import { formatDistanceLabel } from '@/utils/jobLocation.js';

const Chip = ({ children }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-stone-100 text-text-main text-xs whitespace-nowrap">{children}</span>
);

/** Hàng tin tuyển dụng gọn (kiểu danh sách của các trang việc làm lớn). Tin nổi bật được tô nền + viền thương hiệu. */
export function JobRow({ job, isSaved, onSave, isSelected = false }) {
  const jobId = job._id || job.id;
  const storeName = job.employer?.storeName || job.storeName || 'Đang cập nhật';
  const hasDistance = job.distanceMeters !== null && job.distanceMeters !== undefined;
  const area = job.address?.split(',')[0] || job.employer?.address?.split(',')[0];

  return (
    <article
      className={clsx(
        'relative flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border transition-colors focus-within:ring-2 focus-within:ring-green-main',
        job.featured ? 'bg-green-50/80 border-green-main' : 'bg-white border-stone-200 hover:border-green-main/60',
        isSelected && 'ring-2 ring-green-main'
      )}
    >
      <div className={clsx('w-12 h-12 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center font-bold text-xl shrink-0', avatarColorClass(storeName))} aria-hidden="true">
        {avatarInitial(storeName)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-0.5 sm:gap-3">
          <h3 className="font-bold text-text-main text-[15px] leading-snug line-clamp-2">
            {/* The title link covers the whole row; the save button sits above it. */}
            <Link to={`/jobs/${jobId}`} className="after:absolute after:inset-0 after:rounded-2xl hover:text-green-dark focus:outline-none">
              {job.title}
            </Link>
          </h3>
          <span className="shrink-0 text-sm font-bold text-green-dark whitespace-nowrap">
            {job.salaryAmount ? `${formatVND(job.salaryAmount)}${SALARY_UNIT_LABELS[job.salaryUnit] || ''}` : 'Thoả thuận'}
          </span>
        </div>

        <p className="mt-0.5 text-xs uppercase tracking-wide text-text-muted truncate flex items-center gap-1">
          {storeName}
          {job.employer?.verified && <CheckCircle className="w-3.5 h-3.5 text-green-main shrink-0" aria-label="Đã xác thực" />}
        </p>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {area && <Chip>{area}</Chip>}
          {JOB_TYPE_LABELS[job.type] && <Chip>{JOB_TYPE_LABELS[job.type]}</Chip>}
          {hasDistance && <Chip>Cách {formatDistanceLabel(job.distanceMeters, job.distanceApproximate)}</Chip>}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-text-muted flex items-center gap-2">
            {job.featured && (
              <span className="inline-flex items-center gap-1 font-semibold text-pink-700">
                <Star className="w-3 h-3 fill-current" /> Nổi bật
              </span>
            )}
            Đăng {formatDate(job.postedAt || job.createdAt)}
          </span>
          {onSave && (
            <button
              type="button"
              onClick={() => onSave(jobId)}
              aria-label={isSaved ? 'Bỏ lưu' : 'Lưu việc'}
              aria-pressed={Boolean(isSaved)}
              className="relative z-10 -m-2 p-2.5 rounded-full text-gray-500 hover:text-green-main hover:bg-green-50"
            >
              {isSaved ? <BookmarkCheck className="w-5 h-5 text-green-main" /> : <Bookmark className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
