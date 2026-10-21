import { GoogleAuth } from 'google-auth-library';

const CACHE_MS = 10 * 60 * 1000; // GA4 Data API có hạn mức; số liệu chậm vài giờ nên cache 10 phút là đủ
const REALTIME_CACHE_MS = 60 * 1000;
let cache = null;
let realtimeCache = null;
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

/** Hàm thuần: realtime chỉ có 30 phút gần nhất (không có pagePath hay thời gian phiên). */
export function parseRealtime(report = {}) {
  const [activeUsers = 0, pageViews = 0] = report.rows?.[0]?.metricValues?.map((m) => Number(m.value)) || [];
  return { activeUsers, pageViews };
}

async function gaRequest(method, data) {
  auth ||= new GoogleAuth({
    credentials: JSON.parse(process.env.GA_SERVICE_ACCOUNT_JSON),
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });
  const client = await auth.getClient();
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${process.env.GA_PROPERTY_ID}:${method}`;
  return (await client.request({ url, method: 'POST', data })).data;
}

async function getRealtime() {
  if (realtimeCache && Date.now() - realtimeCache.at < REALTIME_CACHE_MS) return realtimeCache.data;
  const report = await gaRequest('runRealtimeReport', { metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }] });
  realtimeCache = { at: Date.now(), data: parseRealtime(report) };
  return realtimeCache.data;
}

async function getReports() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  const dateRanges = [{ startDate: '30daysAgo', endDate: 'today' }];
  const data = await gaRequest('batchRunReports', {
    requests: [
      { dateRanges, metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }, { name: 'averageSessionDuration' }] },
      { dateRanges, dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }], orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 5 },
    ],
  });
  const summary = parseReports(data.reports[0], data.reports[1]);
  cache = { at: Date.now(), data: summary };
  return summary;
}

export async function getAnalyticsSummary() {
  const [summary, realtime] = await Promise.all([getReports(), getRealtime()]);
  return { ...summary, realtime };
}
