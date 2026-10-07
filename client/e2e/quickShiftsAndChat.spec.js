import { test, expect } from '@playwright/test';
import { seedUser, seedJob, signIn, apiLogin, apiCall } from './helpers.js';

function tomorrow() {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test('ca lẻ: cửa hàng đăng, hai sinh viên tranh nhau chỗ cuối, chỉ một người nhận được', async ({ browser }) => {
  const employer = await seedUser('employer');
  const first = await seedUser('student', 'Sinh Viên Một');
  const second = await seedUser('student', 'Sinh Viên Hai');
  const title = `Rửa bát E2E ${Date.now().toString(36)}`;

  const employerCtx = await browser.newContext({ locale: 'vi-VN' });
  const employerPage = await employerCtx.newPage();
  await signIn(employerPage, employer.email);
  await employerPage.goto('/employer/quick-shifts');
  await employerPage.getByRole('button', { name: /Đăng ca lẻ/ }).first().click();
  await employerPage.getByPlaceholder('Ví dụ: Phục vụ bàn').fill(title);
  await employerPage.locator('input[type="date"]').fill(tomorrow());
  await employerPage.getByLabel(/Số người/).fill('1');
  await employerPage.getByRole('button', { name: 'Đăng ca', exact: true }).click();
  await expect(employerPage.getByText(/Đã đăng ca lẻ/)).toBeVisible();
  await expect(employerPage.getByText(title)).toBeVisible();

  const claim = async (student) => {
    const ctx = await browser.newContext({ locale: 'vi-VN' });
    const page = await ctx.newPage();
    await signIn(page, student.email);
    await page.goto('/student/quick-shifts');
    const card = page.getByText(title).locator('xpath=ancestor::div[.//button[contains(., "Nhận ca ngay")]][1]');
    return { page, card, ctx };
  };

  const a = await claim(first);
  const b = await claim(second);
  await expect(a.card).toBeVisible();
  await expect(b.card).toBeVisible();

  // Cả hai bấm gần như cùng lúc
  await Promise.all([
    a.card.getByRole('button', { name: /Nhận ca ngay/ }).click(),
    b.card.getByRole('button', { name: /Nhận ca ngay/ }).click(),
  ]);
  await expect.poll(async () => {
    const mine = await Promise.all([first, second].map(async (s) => {
      const token = (await apiLogin(s.email)).token;
      return (await apiCall('/quick-shifts/mine', { token })).body.length;
    }));
    return mine.reduce((x, y) => x + y, 0);
  }).toBe(1);

  // Cửa hàng thấy đã đủ người
  await employerPage.reload();
  await expect(employerPage.getByText('Đã đủ người')).toBeVisible();
  await expect(employerPage.getByText(/1\/1 người đã nhận/)).toBeVisible();

  await Promise.all([a.ctx.close(), b.ctx.close(), employerCtx.close()]);
});

test('chat: sinh viên nhắn từ đơn ứng tuyển, nhà tuyển dụng nhận và trả lời; liên hệ bị ẩn trước offer', async ({ browser }) => {
  const employer = await seedUser('employer');
  const student = await seedUser('student', 'Sinh Viên Chat');
  const job = await seedJob(employer.id);
  const studentToken = (await apiLogin(student.email)).token;
  const applied = await apiCall('/applications', { method: 'POST', token: studentToken, body: { jobId: job.id, phone: '0933333333' } });
  expect(applied.status).toBe(201);

  const sCtx = await browser.newContext({ locale: 'vi-VN' });
  const studentPage = await sCtx.newPage();
  await signIn(studentPage, student.email);
  await studentPage.goto('/student/applications');
  await studentPage.getByRole('link', { name: 'Nhắn tin' }).first().click();
  await expect(studentPage).toHaveURL(/\/student\/messages/);
  await studentPage.getByPlaceholder('Nhập tin nhắn...').fill('Chào quán, em có thể đi làm ca tối ạ');
  await studentPage.getByRole('button', { name: 'Gửi' }).click();
  await expect(studentPage.getByTestId('chat-message').filter({ hasText: 'Chào quán, em có thể đi làm ca tối ạ' })).toBeVisible();

  const eCtx = await browser.newContext({ locale: 'vi-VN' });
  const employerPage = await eCtx.newPage();
  await signIn(employerPage, employer.email);
  await employerPage.goto('/employer/applications');
  // Trước khi có offer, số điện thoại ứng viên không xuất hiện
  await expect(employerPage.getByText('0933333333')).toHaveCount(0);
  await employerPage.goto('/employer/messages');
  await employerPage.getByRole('button', { name: /Sinh Viên Chat|Ứng tuyển/ }).first().click();
  await expect(employerPage.getByTestId('chat-message').filter({ hasText: 'Chào quán, em có thể đi làm ca tối ạ' })).toBeVisible();
  await employerPage.getByPlaceholder('Nhập tin nhắn...').fill('Mời em qua quán phỏng vấn nhé');
  await employerPage.getByRole('button', { name: 'Gửi' }).click();

  // Sinh viên nhận được phản hồi (hỏi lại máy chủ mỗi 5 giây)
  await expect(studentPage.getByTestId('chat-message').filter({ hasText: 'Mời em qua quán phỏng vấn nhé' })).toBeVisible({ timeout: 15_000 });

  await Promise.all([sCtx.close(), eCtx.close()]);
});
