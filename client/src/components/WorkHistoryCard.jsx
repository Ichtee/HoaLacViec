import { useEffect, useState } from 'react';
import { Award } from 'lucide-react';
import { getWorkHistory } from '@/services';

function Stat({ label, value }) {
  return (
    <div className="bg-green-50/50 rounded-2xl p-3 text-center">
      <p className="text-xl font-bold text-text-main">{value}</p>
      <p className="text-[11px] text-text-muted mt-0.5">{label}</p>
    </div>
  );
}

/**
 * Hồ sơ làm việc tự động (thay CV): số ca, giờ làm, tỷ lệ đúng giờ và điểm uy tín,
 * lấy từ dữ liệu ca đã duyệt và đánh giá của cửa hàng.
 */
export function WorkHistoryCard({ userId }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    getWorkHistory(userId)
      .then((result) => { if (active) setData(result); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [userId]);

  if (failed) return null;

  const pct = (value) => (value == null ? '—' : `${value}%`);

  return (
    <section className="bg-white p-6 rounded-3xl border border-green-50 shadow-card space-y-4">
      <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
        <Award className="w-5 h-5 text-green-dark" /> Hồ sơ làm việc
      </h2>
      {!data ? (
        <p className="text-sm text-text-muted">Đang tải...</p>
      ) : data.completedShifts === 0 && data.noShows === 0 ? (
        <p className="text-sm text-text-muted">
          Hồ sơ sẽ tự động cập nhật sau những ca làm đầu tiên được cửa hàng duyệt công.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Ca đã hoàn thành" value={data.completedShifts} />
            <Stat label="Giờ làm" value={data.totalHours} />
            <Stat label="Đúng giờ" value={pct(data.onTimeRate)} />
            <Stat
              label="Điểm uy tín"
              value={data.reputationCount ? `${Number(data.reputationScore).toFixed(1)} ★` : '—'}
            />
          </div>
          <p className="text-xs text-text-muted">
            Đã làm tại {data.storesWorkedAt} cửa hàng · Tỷ lệ có mặt {pct(data.attendanceRate)}
            {data.topRoles?.length ? ` · Vị trí: ${data.topRoles.map((r) => r.title).join(', ')}` : ''}
          </p>
        </>
      )}
    </section>
  );
}
