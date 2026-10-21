import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReports, parseRealtime } from '../src/services/analyticsService.js';

test('parseReports maps GA4 rows and tolerates an empty property', () => {
  const totals = { rows: [{ metricValues: [{ value: '12' }, { value: '30' }, { value: '210' }, { value: '95.6' }] }] };
  const pages = { rows: [{ dimensionValues: [{ value: '/jobs' }], metricValues: [{ value: '80' }] }] };
  assert.deepEqual(parseReports(totals, pages), { activeUsers: 12, sessions: 30, pageViews: 210, avgSessionSeconds: 96, topPages: [{ path: '/jobs', views: 80 }] });
  assert.deepEqual(parseReports({}, {}), { activeUsers: 0, sessions: 0, pageViews: 0, avgSessionSeconds: 0, topPages: [] });
});

test('parseRealtime reads active users and page views, zero when nobody is online', () => {
  assert.deepEqual(parseRealtime({ rows: [{ metricValues: [{ value: '3' }, { value: '7' }] }] }), { activeUsers: 3, pageViews: 7 });
  assert.deepEqual(parseRealtime({}), { activeUsers: 0, pageViews: 0 });
});
