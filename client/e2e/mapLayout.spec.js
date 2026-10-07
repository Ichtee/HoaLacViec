import { test, expect } from '@playwright/test';
import { seedUser, seedJob } from './helpers.js';

const pinned = (lat, lng) => ({ location: { lat, lng }, geoPoint: { type: 'Point', coordinates: [lng, lat] }, locationStatus: 'confirmed', locationSource: 'map_pin' });

for (const [name, viewport] of [['máy tính', { width: 1366, height: 800 }], ['máy tính bảng', { width: 820, height: 900 }], ['điện thoại', { width: 390, height: 844 }]]) {
  test(`bản đồ việc làm lấp đầy khung chứa trên ${name}`, async ({ browser }) => {
    const employer = await seedUser('employer', 'Quán Bản Đồ');
    await seedJob(employer.id, { title: 'Việc có ghim', ...pinned(21.0128, 105.5255) });
    const ctx = await browser.newContext({ viewport });
    await ctx.addInitScript(() => { try { localStorage.setItem('hlv_location_banner_dismissed', '1'); } catch { /* */ } });
    const page = await ctx.newPage();
    await page.goto('/jobs');
    if (viewport.width < 1024) await page.getByRole('button', { name: 'Bản đồ' }).first().click();
    await page.locator('.vietmapgl-map').first().waitFor({ state: 'visible' });
    await page.waitForTimeout(800);
    const { frame, canvas } = await page.evaluate(() => {
      const map = document.querySelector('.vietmapgl-map');
      const frameEl = map.closest('.shadow-card'); // khung ngoài của JobMap
      const f = frameEl.getBoundingClientRect();
      const c = map.getBoundingClientRect();
      return { frame: { w: f.width, h: f.height }, canvas: { w: c.width, h: c.height } };
    });
    expect(canvas.h, `canvas ${canvas.h}px phải bằng khung ${frame.h}px`).toBeGreaterThanOrEqual(frame.h - 2);
    expect(canvas.w).toBeGreaterThanOrEqual(frame.w - 4);
    await ctx.close();
  });
}
