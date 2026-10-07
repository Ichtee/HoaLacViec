import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { getAdminMetrics } from '@/services';

const pct = (value) => (value == null ? '—' : `${value}%`);

function formatDuration(hours) {
  if (hours == null) return '—';
  if (hours < 48) return `${hours} giờ`;
  return `${Math.round((hours / 24) * 10) / 10} ngày`;
}

function Metric({ label, value, hint }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-text-main mt-1">{value}</p>
      {hint && <p className="text-[11px] text-text-muted mt-1">{hint}</p>}
    </div>
  );
}

/** Chỉ số vận hành nền tảng: tốc độ tuyển, lấp đầy, vắng mặt, quay lại, hoạt động tuần. */
export function PlatformMetrics() {
  const [metrics, setMetrics] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getAdminMetrics()
      .then((data) => { if (active) setMetrics(data); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  if (failed) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-green-dark" /> Chỉ số vận hành
      </h2>
      {!metrics ? (
        <p className="text-sm text-text-muted">Đang tính toán...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <Metric label="Từ đăng tin đến tuyển được" value={formatDuration(metrics.avgHoursToFirstHire)} hint="Trung bình lần tuyển đầu tiên" />
            <Metric label="Tỷ lệ lấp đầy" value={pct(metrics.fillRate)} hint="Đã tuyển / chỉ tiêu" />
            <Metric label="Tỷ lệ vắng mặt" value={pct(metrics.noShowRate)} hint={`${metrics.shifts30d.noShows}/${metrics.shifts30d.completed + metrics.shifts30d.noShows} ca trong 30 ngày`} />
            <Metric label="Nhà tuyển dụng quay lại" value={pct(metrics.employerReturnRate)} hint="Đăng từ 2 tin trở lên" />
            <Metric label="Người dùng hoạt động tuần" value={metrics.weeklyActiveUsers} hint="Ứng tuyển, đăng tin hoặc nhắn tin" />
          </div>
          {Object.keys(metrics.applicationFunnel || {}).length > 0 && (
            <p className="text-xs text-text-muted">
              Phễu đơn ứng tuyển: {Object.entries(metrics.applicationFunnel).map(([status, count]) => `${status} ${count}`).join(' · ')}
            </p>
          )}
        </>
      )}
    </section>
  );
}
