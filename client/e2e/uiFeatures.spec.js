import { test, expect } from '@playwright/test';
import { seedUser, seedJob, seedShift, signIn } from './helpers.js';

const DESKTOP = { width: 1366, height: 800 };

test('tìm việc trên màn hình rộng: danh sách và bản đồ cạnh nhau, chip lọc hoạt động', async ({ browser }) => {
  const employer = await seedUser('employer', 'Cà Phê Lá');
  await seedJob(employer.id, { title: 'Nhân viên pha chế ca tối' });
  const ctx = await browser.newContext({ viewport: DESKTOP });
  await ctx.addInitScript(() => { try { localStorage.setItem('hlv_location_banner_dismissed', '1'); } catch { /* */ } });
  const page = await ctx.newPage();
  await page.goto('/jobs');
  const map = page.getByRole('complementary', { name: 'Bản đồ việc làm' });
  const list = page.getByText('Nhân viên pha chế ca tối').first();
  await expect(map).toBeVisible();
  await expect(list).toBeVisible();
  const [mapBox, listBox] = [await map.boundingBox(), await list.boundingBox()];
  expect(listBox.x + listBox.width, 'danh sách nằm bên trái bản đồ').toBeLessThanOrEqual(mapBox.x + 4);

  const chip = page.getByRole('button', { name: 'Cửa hàng xác thực' });
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await ctx.close();
});

test('đăng tin: thanh tiến độ cập nhật khi điền và xem trước hiển thị đúng nội dung', async ({ page }) => {
  const employer = await seedUser('employer', 'Cà Phê Lá');
  await signIn(page, employer.email);
  await page.goto('/employer/jobs/create');
  await expect(page.getByText(/Đã hoàn thành\s*0\/4 bước/)).toBeVisible();

  await page.getByPlaceholder(/Tuyển Nhân viên Pha chế/).fill('Pha chế ca sáng thứ bảy');
  await expect(page.getByText(/Đã hoàn thành\s*1\/4 bước/)).toBeVisible();
  await page.getByPlaceholder(/Nêu rõ công việc hàng ngày/).fill('Pha chế đồ uống, dọn quầy bar và phục vụ khách.');
  await expect(page.getByText(/Đã hoàn thành\s*2\/4 bước/)).toBeVisible();

  await page.getByRole('button', { name: 'Xem trước' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Pha chế ca sáng thứ bảy')).toBeVisible();
  await expect(dialog.getByText(/Pha chế đồ uống, dọn quầy bar/)).toBeVisible();
});

test('quản lý ca: chuyển sang lịch tuần và thấy ca trong tuần này', async ({ page }) => {
  const employer = await seedUser('employer');
  const student = await seedUser('student', 'Sinh Viên Lịch Tuần');
  await seedShift({ employerId: employer.id, studentId: student.id, studentName: 'Sinh Viên Lịch Tuần', hoursAhead: 20 });
  await signIn(page, employer.email);
  await page.goto('/employer/shifts');
  await page.getByRole('tab', { name: 'Lịch tuần' }).click();
  const week = page.getByRole('region', { name: 'Lịch ca theo tuần' });
  await expect(week).toBeVisible();
  await expect(week.getByText('Sinh Viên Lịch Tuần')).toBeVisible();
  // sang tuần sau thì không còn ca
  await week.getByRole('button', { name: 'Tuần sau' }).click();
  await expect(week.getByText('Sinh Viên Lịch Tuần')).toHaveCount(0);
});

test('quản trị: bảng tài khoản sắp xếp theo cột khi bấm tiêu đề', async ({ page }) => {
  const admin = await seedUser('admin', 'Admin Sắp Xếp');
  await seedUser('student', 'Aaron Đầu Bảng');
  await seedUser('student', 'Zed Cuối Bảng');
  await signIn(page, admin.email);
  await page.goto('/admin/users');
  const names = async () => page.locator('table tbody tr td:first-child p.font-bold').allTextContents();
  const asc = await names();
  expect(asc.indexOf('Aaron Đầu Bảng')).toBeLessThan(asc.indexOf('Zed Cuối Bảng'));
  await page.getByRole('columnheader', { name: /Người dùng/ }).getByRole('button').click();
  const desc = await names();
  expect(desc.indexOf('Zed Cuối Bảng')).toBeLessThan(desc.indexOf('Aaron Đầu Bảng'));
});
