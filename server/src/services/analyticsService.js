import { GoogleAuth } from 'google-auth-library';

const CACHE_MS = 10 * 60 * 1000; // GA4 Data API có hạn mức; số liệu chậm vài giờ nên cache 10 phút là đủ
let cache = null;
let auth = null;

/** GA4 chỉ bật khi có đủ id property (số) và khóa service account. */
export function isAnalyticsConfigured() {
  return Boolean(process.env.GA_PROPERTY_ID && process.env.GA_SERVICE_ACCOUNT_JSON);
}

/** Hàm thuần: đổi phản hồi runReport thành số liệu tổng quan 30 ngày + trang xem nhiều nhất. */
export function parseReports(totals = {}, pages = {}) {
  const row = totals.rows?.[0]?.metricValues?.map((m) => Number(m.value)) || [0, 0, 0, 0];
  const [activeUsers, sessions, pageViews, avgSessionSeconds] = row;
  return {
    activeUsers,
    sessions,
    pageViews,
    avgSessionSeconds: Math.round(avgSessionSeconds),
    topPages: (pages.rows || []).map((r) => ({ path: r.dimensionValues[0].value, views: Number(r.metricValues[0].value) })),
  };
}

export async function getAnalyticsSummary() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  auth ||= new GoogleAuth({
    credentials: JSON.parse(process.env.GA_SERVICE_ACCOUNT_JSON),
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });
  const client = await auth.getClient();
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${process.env.GA_PROPERTY_ID}:batchRunReports`;
  const dateRanges = [{ startDate: '30daysAgo', endDate: 'today' }];
  const { data } = await client.request({
    url,
    method: 'POST',
    data: {
      requests: [
        { dateRanges, metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }, { name: 'averageSessionDuration' }] },
        { dateRanges, dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }], orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 5 },
      ],
    },
  });
  const summary = parseReports(data.reports[0], data.reports[1]);
  cache = { at: Date.now(), data: summary };
  return summary;
}
