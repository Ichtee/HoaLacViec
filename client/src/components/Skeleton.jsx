import { clsx } from 'clsx';

/** Khối xám nhấp nháy đại diện cho nội dung đang tải. */
export function Skeleton({ className }) {
  return <div aria-hidden="true" className={clsx('animate-pulse rounded-xl bg-green-50', className)} />;
}

/** Khung xương cho một thẻ nội dung (tiêu đề + vài dòng). */
export function CardSkeleton({ lines = 3, className }) {
  return (
    <div className={clsx('card space-y-3', className)} role="status" aria-label="Đang tải">
      <Skeleton className="h-5 w-2/5" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={clsx('h-3.5', i === lines - 1 ? 'w-3/5' : 'w-full')} />
      ))}
    </div>
  );
}

/** Lưới khung xương cho danh sách thẻ. */
export function ListSkeleton({ count = 3, lines = 3, className }) {
  return (
    <div className={clsx('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} lines={lines} />
      ))}
    </div>
  );
}
