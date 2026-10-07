import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedUser, seedJob, seedShift, signIn } from './helpers.js';

// Chỉ chặn các lỗi nghiêm trọng/cực kỳ nghiêm trọng của WCAG 2 A/AA (màu tương phản, nhãn, tên nút...)
async function violationsOf(page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  return results.violations
    .filter((v) => ['serious', 'critical'].includes(v.impact))
    .map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

test('trợ năng: các trang chính không có lỗi nghiêm trọng', async ({ browser }) => {
  test.setTimeout(240000);
  const employer = await seedUser('employer', 'Cà Phê Lá');
  const student = await seedUser('student', 'Trần Thu Linh');
  const admin = await seedUser('admin');
  const job = await seedJob(employer.id, { title: 'Nhân viên pha chế ca tối', description: 'Làm việc gần trường.' });
  await seedShift({ employerId: employer.id, studentId: student.id, studentName: 'Trần Thu Linh', hoursAhead: 26 });

  const groups = [
    [null, ['/', '/jobs', `/jobs/${job.id}`, '/tasks', '/blogs', '/login', '/register']],
    [student.email, ['/student', '/student/shifts', '/student/applications', '/student/profile', '/student/alerts', '/student/messages']],
    [employer.email, ['/employer', '/employer/jobs', '/employer/jobs/create', '/employer/applications', '/employer/shifts']],
    [admin.email, ['/admin', '/admin/users', '/admin/jobs']],
  ];
  const report = [];
  for (const [email, urls] of groups) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript(() => { try { localStorage.setItem('hlv_location_banner_dismissed', '1'); } catch { /* */ } });
    const page = await ctx.newPage();
    if (email) await signIn(page, email);
    for (const url of urls) {
      await page.goto(url);
      await page.waitForTimeout(900);
      for (const v of await violationsOf(page)) report.push(`${url}: ${v}`);
    }
    await ctx.close();
  }
  expect(report, `\n${report.join('\n')}\n`).toEqual([]);
});
