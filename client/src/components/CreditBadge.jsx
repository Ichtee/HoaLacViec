import { Link } from 'react-router-dom';
import { Coins, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { useCredits } from '@/hooks/useCredits.js';

const LOW_CREDITS = 20;

/** Credit balance chip for the employer header. Shows the number; the whole chip links to top-up. */
export function CreditBadge({ className = '' }) {
  const balance = useCredits();
  if (balance === null) return null;
  const low = balance < LOW_CREDITS;
  return (
    <Link
      to="/employer/credits"
      aria-label={`Số dư ${balance} credit. Nạp thêm credit`}
      title="Credit dùng để làm nổi bật tin, gia hạn và đăng ca lẻ"
      className={clsx(
        'inline-flex items-center gap-1.5 h-11 pl-3 pr-2 rounded-full border text-sm font-bold transition-colors',
        low
          ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
          : 'bg-green-50 border-green-200 text-green-dark hover:bg-green-100',
        className
      )}
    >
      <Coins className="w-4 h-4" aria-hidden="true" />
      <span>{balance}</span>
      <span className="hidden sm:inline font-medium text-xs">credit</span>
      <span className="w-6 h-6 rounded-full bg-green-main text-white flex items-center justify-center" aria-hidden="true">
        <Plus className="w-3.5 h-3.5" />
      </span>
    </Link>
  );
}
