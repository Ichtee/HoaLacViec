import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { getAdminAnalytics } from '@/services';
import { pageName } from '@/utils/pageNames.js';

function formatSeconds(total) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes ? `${minutes} phút ${seconds} giây` : `${seconds} giây`;
}

function Metric({ label, value }) {
  return (
    <div className="bg-white p-4 rounded-2xl ring-1 ring-green-100/70 shadow-card">
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-text-main mt-1">{value}</p>
    </div>
  );
}

/** Truy cập website 30 ngày gần nhất, lấy từ Google Analytics 4 qua server. */
export function AnalyticsMetrics() {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getAdminAnalytics()
      .then((result) => { if (active) setData(result); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  return (
    <section className="space-y-3" aria-labelledby="analytics-title">
      <h2 id="analytics-title" className="text-lg font-bold text-text-main flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-green-dark" /> Truy cập website (30 ngày)
      </h2>
      {failed ? (
        <p className="text-sm text-text-muted">Không lấy được số liệu từ Google Analytics.</p>
      ) : !data ? (
        <p className="text-sm text-text-muted">Đang tải...</p>
      ) : !data.configured ? (
        <p className="text-sm text-text-muted">Chưa kết nối Google Analytics (thiếu GA_PROPERTY_ID / GA_SERVICE_ACCOUNT_JSON trên server).</p>
      ) : (
        <>
          {data.realtime && (
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Đang online (30 phút qua)" value={data.realtime.activeUsers} />
              <Metric label="Lượt xem trang (30 phút qua)" value={data.realtime.pageViews} />
            </div>
          )}
          <p className="text-xs text-text-muted">Số liệu 30 ngày bên dưới Google cập nhật chậm 12–48 giờ.</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric label="Người dùng" value={data.activeUsers} />
            <Metric label="Lượt truy cập" value={data.sessions} />
            <Metric label="Lượt xem trang" value={data.pageViews} />
            <Metric label="Thời gian trung bình / lượt" value={formatSeconds(data.avgSessionSeconds)} />
          </div>
          {data.topPages.length > 0 && (
            <div className="bg-white p-4 rounded-2xl ring-1 ring-green-100/70 shadow-card">
              <p className="text-xs font-semibold text-gray-500 mb-2">Trang xem nhiều nhất</p>
              <ul className="space-y-1">
                {data.topPages.map((page) => (
                  <li key={page.path} className="flex justify-between text-sm">
                    <span className="truncate text-text-main" title={page.path}>{pageName(page.path)}</span>
                    <span className="font-semibold text-gray-900 ml-3">{page.views}</span>
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
