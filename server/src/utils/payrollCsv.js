const PAYROLL_LABELS = { not_ready: 'Chưa chốt', ready: 'Chờ thanh toán', paid: 'Đã thanh toán' };

const HEADERS = [
  'Ngày', 'Nhân viên', 'Vị trí', 'Giờ bắt đầu', 'Giờ kết thúc',
  'Số giờ công', 'Lương/giờ (VNĐ)', 'Thành tiền (VNĐ)', 'Trạng thái lương',
];

// Ô bắt đầu bằng = + - @ có thể bị Excel hiểu là công thức (CSV injection)
function escapeCell(value) {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Dựng CSV bảng lương từ các ca đã duyệt công. Có BOM để Excel đọc đúng tiếng Việt.
 * Chỉ tính các ca có attendanceStatus = approved.
 */
export function buildPayrollCsv(shifts = []) {
  const rows = shifts
    .filter((s) => s.attendanceStatus === 'approved')
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.startTime).localeCompare(String(b.startTime)));

  const lines = [HEADERS.map(escapeCell).join(',')];
  let totalMinutes = 0;
  let totalPay = 0;
  for (const s of rows) {
    const minutes = Number(s.workedMinutes) || 0;
    const pay = Number(s.totalPay) || 0;
    totalMinutes += minutes;
    totalPay += pay;
    lines.push([
      s.date,
      s.studentName || s.employeeName || '',
      s.positionTitle || s.role || '',
      s.startTime,
      s.endTime,
      Math.round((minutes / 60) * 100) / 100,
      s.wageRate ?? '',
      pay,
      PAYROLL_LABELS[s.payrollStatus] || s.payrollStatus || '',
    ].map(escapeCell).join(','));
  }
  lines.push(['', '', '', '', 'Tổng cộng', Math.round((totalMinutes / 60) * 100) / 100, '', totalPay, ''].map(escapeCell).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}
