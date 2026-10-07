/**
 * Lớp tương thích: toàn bộ nghiệp vụ lịch làm/chấm công đã được tách theo chủ đề trong ./scheduling/.
 * Các nơi gọi cũ vẫn import từ file này.
 */
export * from './scheduling/guards.js';
export * from './scheduling/eligibility.js';
export * from './scheduling/creation.js';
export * from './scheduling/publishing.js';
export * from './scheduling/assignment.js';
export * from './scheduling/changes.js';
export * from './scheduling/attendance.js';
export * from './scheduling/disputes.js';
export * from './scheduling/payroll.js';
