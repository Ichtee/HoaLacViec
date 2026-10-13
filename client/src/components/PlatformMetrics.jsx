import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { getAdminMetrics } from '@/services';

const pct = (value) => (value == null ? '—' : `${value}%`);

const FUNNEL_LABELS = {
  submitted: 'Đã nộp', screening: 'Đang sàng lọc', shortlisted: 'Vào danh sách rút gọn', interview: 'Phỏng vấn',
  offer_sent: 'Đã gửi offer', offer_accepted: 'Đã nhận offer', hired: 'Đã tuyển', rejected: 'Từ chối',
  withdrawn: 'Ứng viên rút', offer_declined: 'Từ chối offer', offer_expired: 'Offer hết hạn', offer_rescinded: 'Thu hồi offer',
};

function formatDuration(hours) {
  if (hours == null) return '—';
  if (hours < 48) return `${hours} giờ`;
  return `${Math.round((hours / 24) * 10) / 10} ngày`;
}

function Metric({ label, value, hint }) {
  return (
    <div className="bg-white p-4 rounded-2xl ring-1 ring-green-100/70 shadow-card">
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
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-text-muted">Phễu đơn ứng tuyển</p>
              <ul className="flex flex-wrap gap-2">
                {Object.entries(metrics.applicationFunnel).map(([status, count]) => (
                  <li key={status} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white ring-1 ring-green-100 text-xs text-text-main">
                    {FUNNEL_LABELS[status] || status}
                    <strong className="text-green-dark">{count}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
