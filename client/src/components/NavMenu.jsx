import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import { MoreHorizontal } from 'lucide-react';

function CountBadge({ count, className }) {
  if (!count) return null;
  return (
    <span className={clsx('min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center', className)}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

function SidebarLink({ to, icon: Icon, label, end, badge, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
          isActive ? 'bg-green-main text-white shadow-sm font-semibold' : 'text-text-muted hover:bg-green-50 hover:text-green-dark'
        )
      }
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="truncate flex-1">{label}</span>
      <CountBadge count={badge} />
    </NavLink>
  );
}

/**
 * Menu bên trái theo nhóm. groups: [{ title?, items: [{ to, label, icon, end?, badgeKey? }] }]
 * badges: { [badgeKey]: number }.
 */
export function SidebarNav({ groups, badges = {}, onNavigate }) {
  return (
    <nav className="flex-1 px-3 py-1 overflow-y-auto" aria-label="Menu chính">
      {groups.map((group, i) => (
        <div key={group.title || i} className={clsx(i > 0 && 'mt-4')}>
          {group.title && (
            <p className="px-3 mb-1 text-[11px] font-bold uppercase tracking-wider text-text-light">{group.title}</p>
          )}
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <SidebarLink key={item.to} {...item} badge={item.badgeKey ? badges[item.badgeKey] : 0} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

/** Thanh điều hướng dưới đáy cho điện thoại: tối đa 4 mục chính + nút "Thêm" mở menu đầy đủ. */
export function BottomNav({ items, badges = {}, onMore }) {
  return (
    <nav
      aria-label="Điều hướng nhanh"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-green-100 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5">
        {items.map(({ to, label, icon: Icon, end, badgeKey }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'relative flex flex-col items-center justify-center gap-0.5 h-14 text-[11px] font-semibold transition-colors',
                  isActive ? 'text-green-dark' : 'text-text-muted'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={clsx('relative px-3.5 py-1 rounded-full transition-colors', isActive && 'bg-green-100')}>
                    <Icon className="w-5 h-5" />
                    {badgeKey && badges[badgeKey] > 0 && (
                      <CountBadge count={badges[badgeKey]} className="absolute -top-1 -right-0.5" />
                    )}
                  </span>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={onMore}
            className="flex flex-col items-center justify-center gap-0.5 h-14 w-full text-[11px] font-semibold text-text-muted"
          >
            <span className="px-3.5 py-1"><MoreHorizontal className="w-5 h-5" /></span>
            <span>Thêm</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
