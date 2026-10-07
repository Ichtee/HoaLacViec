import { clsx } from 'clsx';
import { Lock } from 'lucide-react';
import { getRoleLabel } from './constants.js';

const TONES = {
  green: { active: 'bg-white border-green-main shadow-md ring-2 ring-green-100', idle: 'hover:border-green-200', icon: 'bg-green-100 text-green-700' },
  blue: { active: 'bg-white border-blue-600 shadow-md ring-2 ring-blue-100', idle: 'hover:border-blue-200', icon: 'bg-blue-100 text-blue-700' },
  purple: { active: 'bg-white border-purple-600 shadow-md ring-2 ring-purple-100', idle: 'hover:border-purple-200', icon: 'bg-purple-100 text-purple-700' },
};

/** Thẻ chọn một vai trò xác minh; `badge` = { className, label } đã tính sẵn từ trạng thái hồ sơ. */
export default function RoleTabCard({ role, tone, Icon, title, description, badge, active, lockedRole, onSelect }) {
  const isLockedOut = Boolean(lockedRole && lockedRole !== role);
  const t = TONES[tone];
  return (
    <button
      type="button"
      disabled={isLockedOut}
      onClick={() => {
        if (isLockedOut) return;
        onSelect(role);
      }}
      className={clsx(
        'p-4 sm:p-5 rounded-3xl border-2 text-left transition-all duration-200 relative overflow-hidden h-full flex flex-col justify-between',
        isLockedOut
          ? 'bg-gray-50/70 border-dashed border-gray-200 opacity-60 cursor-not-allowed select-none'
          : active
          ? t.active
          : `bg-white/80 border-gray-200 ${t.idle} hover:bg-white`
      )}
    >
      <div>
        <div className="flex items-start justify-between">
          <div className={clsx(
            'w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-xl font-bold mb-3',
            isLockedOut ? 'bg-gray-100 text-gray-500' : t.icon
          )}>
            <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          {isLockedOut ? (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Đã khóa
            </span>
          ) : (
            <span className={clsx('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full', badge.className)}>
              {badge.label}
            </span>
          )}
        </div>
        <h3 className={clsx('text-sm sm:text-base font-bold', isLockedOut ? 'text-gray-500' : 'text-text-main')}>{title}</h3>
        <p className="text-[11px] sm:text-xs text-text-muted mt-1 leading-relaxed">{description}</p>
      </div>
      {isLockedOut && (
        <p className="text-[10px] text-amber-700 font-semibold mt-2 flex items-center gap-1">
          <Lock className="w-3 h-3 shrink-0" /> Không thể chọn (đã nộp {getRoleLabel(lockedRole)})
        </p>
      )}
    </button>
  );
}
