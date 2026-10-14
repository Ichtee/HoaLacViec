import { test, expect } from '@playwright/test';
import { PNG_B64, PNG, buildDocx } from './docxFixture.js';
import { seedUser, signIn, apiCall } from './helpers.js';

test.use({ launchOptions: { slowMo: Number(process.env.SLOWMO) || 0 } });

test('đăng blog từ file Word giữ định dạng + vị trí ảnh, ảnh bìa chọn từ máy', async ({ page }) => {
  const title = `Blog Word ${Date.now().toString(36)}`;
  const admin = await seedUser('admin');
  await signIn(page, admin.email);

  // Không cho ảnh đi lên Cloudinary thật: trả URL cố định
  await page.route('**/api/uploads/image', (route) => route.fulfill({ json: { url: `data:image/png;base64,${PNG_B64}` } }));

  await page.goto('/admin/blogs');
  await page.getByRole('button', { name: /Viết bài mới/ }).click();
  await expect(page).toHaveURL(/\/admin\/blogs\/new/); // trang riêng, không còn modal
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Gửi form trống: hiện khung tóm tắt lỗi
  await page.getByRole('button', { name: /Đăng bài viết ngay/ }).first().click();
  await expect(page.getByRole('alert').filter({ hasText: 'Vui lòng nhập tiêu đề' })).toBeVisible();

  // Không còn ô nhập link ảnh bìa
  await expect(page.getByLabel(/đường dẫn ảnh bìa/i)).toHaveCount(0);

  await page.locator('input[accept*=".docx"]').setInputFiles({ name: 'bai.docx', mimeType: 'application/octet-stream', buffer: await buildDocx(title) });
  await expect(page.getByLabel('Tiêu đề bài viết')).toHaveValue(title);
  await expect(page.getByLabel(/Nội dung bài viết/)).toHaveValue(/<strong>chữ đậm<\/strong>/);

  await page.locator('input[accept^="image/"]').setInputFiles({ name: 'bia.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByAltText('Ảnh đã chọn')).toBeVisible();

  await page.getByRole('button', { name: /Đăng bài viết ngay/ }).click();
  await expect(page.getByText(/Đăng bài viết mới thành công/)).toBeVisible();

  const list = await apiCall('/blogs?limit=50');
  const blog = (list.body.blogs || list.body).find((b) => b.title === title);
  await page.goto(`/blogs/${blog.slug}`);

  const body = page.locator('strong', { hasText: 'chữ đậm' }).locator('..').locator('..');
  const order = await body.evaluate((el) => [...el.children].map((c) => (c.querySelector('img') ? 'img' : c.textContent.trim())));
  expect(order).toEqual(['Đoạn trước ảnh chữ đậm', 'img', 'Đoạn sau ảnh']);
});

test('sửa bài viết mở trang riêng, điền sẵn dữ liệu và lưu được', async ({ page }) => {
  const title = `Blog Sửa ${Date.now().toString(36)}`;
  const admin = await seedUser('admin');
  const { token } = await signIn(page, admin.email);
  const created = await apiCall('/blogs', { method: 'POST', token, body: { title, summary: 'Tóm tắt cũ', content: 'Nội dung cũ' } });
  expect(created.status).toBe(201);

  await page.goto('/admin/blogs');
  await page.getByRole('heading', { name: title }).locator('xpath=ancestor::div[contains(@class,"group")]').getByTitle('Chỉnh sửa bài viết').click();
  await expect(page).toHaveURL(/\/admin\/blogs\/.+\/edit/);
  await expect(page.getByLabel('Tiêu đề bài viết')).toHaveValue(title);

  await page.getByLabel('Tóm tắt ngắn gọn').fill('Tóm tắt mới');
  await page.getByRole('button', { name: /Lưu thay đổi/ }).first().click();
  await expect(page.getByText(/Cập nhật bài viết thành công/)).toBeVisible();

  const list = await apiCall('/blogs?limit=50');
  expect((list.body.blogs || list.body).find((b) => b.title === title).summary).toBe('Tóm tắt mới');
});
