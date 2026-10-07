import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { default: EmployerShiftsPage } = await vite.ssrLoadModule('/src/pages/employer/EmployerShiftsPage.jsx');
  const { AuthProvider } = await vite.ssrLoadModule('/src/hooks/useAuth.jsx');
  const { Modal } = await vite.ssrLoadModule('/src/components/Modal.jsx');
  const { Toast } = await vite.ssrLoadModule('/src/components/Feedback.jsx');
  const page = renderToString(createElement(AuthProvider, null, createElement(EmployerShiftsPage)));
  assert.match(page, /Quản lý Ca Làm/);
  assert.match(renderToString(createElement(Modal, { isOpen: true, title: 'Kiểm tra', onClose: () => {} }, 'Nội dung')), /Nội dung/);
  assert.match(renderToString(createElement(Toast, { message: 'Đã lưu', type: 'success' })), /Đã lưu/);
  process.stdout.write('Employer shifts page, Modal và Toast render thành công.\n');
} finally {
  await vite.close();
}
