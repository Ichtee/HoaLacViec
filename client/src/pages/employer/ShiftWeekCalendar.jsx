import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { Badge } from '@/components/Badge.jsx';
import { addDaysToDateString, formatShortDate, todayString, weekDaysOf } from '@/utils/statusHelpers.js';

/**
 * Lịch tuần cho quản lý ca: mỗi cột một ngày (xếp dọc trên điện thoại).
 * getBadge(shift) -> { variant, label }; renderActions(shift) hiển thị các nút thao tác trong mục "Thao tác".
 */
export function ShiftWeekCalendar({ shifts, getBadge, renderActions, getName }) {
  const today = todayString();
  const [anchor, setAnchor] = useState(today);
  const days = useMemo(() => weekDaysOf(anchor), [anchor]);

  const byDate = useMemo(() => {
    const map = new Map();
    for (const shift of shifts) {
      if (!map.has(shift.date)) map.set(shift.date, []);
      map.get(shift.date).push(shift);
    }
    for (const list of map.values()) list.sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
    return map;
  }, [shifts]);

  const weekTotal = days.reduce((sum, day) => sum + (byDate.get(day)?.length || 0), 0);

  return (
    <section aria-label="Lịch ca theo tuần" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setAnchor(addDaysToDateString(anchor, -7))} aria-label="Tuần trước" className="p-2 rounded-xl border border-green-100 bg-white hover:bg-green-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => setAnchor(today)} className="px-3 py-2 rounded-xl border border-green-100 bg-white hover:bg-green-50 text-xs font-semibold">
            Tuần này
          </button>
          <button type="button" onClick={() => setAnchor(addDaysToDateString(anchor, 7))} aria-label="Tuần sau" className="p-2 rounded-xl border border-green-100 bg-white hover:bg-green-50">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm font-semibold text-text-main">
          {formatShortDate(days[0])} – {formatShortDate(days[6])}
          <span className="ml-2 text-xs font-normal text-text-muted">{weekTotal} ca</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-3">
        {days.map((day) => {
          const list = byDate.get(day) || [];
          const isToday = day === today;
          return (
            <div key={day} className={clsx('rounded-2xl border bg-white p-3 min-h-[8rem]', isToday ? 'border-green-main ring-1 ring-green-main/30' : 'border-green-100')}>
              <p className={clsx('text-xs font-bold mb-2', isToday ? 'text-green-dark' : 'text-text-muted')}>
                {formatShortDate(day)}{isToday && ' · Hôm nay'}
              </p>
              {list.length === 0 ? (
                <p className="text-xs text-text-light">Không có ca</p>
              ) : (
                <ul className="space-y-2">
                  {list.map((shift) => {
                    const badge = getBadge(shift);
                    return (
                      <li key={shift._id || shift.id} className="rounded-xl bg-cream/70 border border-green-50 p-2.5">
                        <p className="text-sm font-semibold text-text-main truncate">{getName(shift)}</p>
                        <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" /> {shift.startTime} – {shift.endTime}
                        </p>
                        <div className="mt-1.5"><Badge variant={badge.variant} size="sm">{badge.label}</Badge></div>
                        <details className="mt-2 group">
                          <summary className="text-xs font-semibold text-green-dark cursor-pointer select-none">Thao tác</summary>
                          <div className="mt-2">{renderActions(shift)}</div>
                        </details>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
