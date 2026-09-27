import test from 'node:test';
import assert from 'node:assert/strict';
import { generateBlogSlug } from '../src/routes/blogRoutes.js';
import { Blog } from '../src/models/Blog.js';
import { authorize } from '../src/middlewares/auth.js';

test('1. generateBlogSlug normalizes Vietnamese diacritics and special characters', () => {
  const title = 'Cảnh Báo Lừa Đảo Tại Khu Công Nghệ Cao Hòa Lạc & Cần Thận!';
  const slug = generateBlogSlug(title);

  assert.ok(typeof slug === 'string');
  assert.ok(!/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(slug), 'Slug must not contain Vietnamese accents');
  assert.ok(!/[A-Z]/.test(slug), 'Slug must be lowercase');
  assert.ok(!/[!&?]/.test(slug), 'Slug must not contain special symbols');
  assert.ok(slug.includes('canh-bao-lua-dao-tai-khu-cong-nghe-cao-hoa-lac-can-than'));
});

test('2. generateBlogSlug handles empty or undefined titles with fallback', () => {
  const emptySlug = generateBlogSlug('');
  assert.ok(emptySlug.startsWith('bai-viet-'));

  const nullSlug = generateBlogSlug(null);
  assert.ok(nullSlug.startsWith('bai-viet-'));
});

test('3. Blog Model Schema validates required fields', () => {
  const incompleteBlog = new Blog({});
  const err = incompleteBlog.validateSync();

  assert.ok(err, 'Expected validation error for missing fields');
  assert.ok(err.errors.title, 'Title is required');
  assert.ok(err.errors.summary, 'Summary is required');
  assert.ok(err.errors.content, 'Content is required');
  assert.ok(err.errors.slug, 'Slug is required');
});

test('4. Blog Model Schema accepts valid blog with category enum and defaults', () => {
  const validBlog = new Blog({
    title: 'Kinh nghiệm phỏng vấn tại Hòa Lạc',
    slug: 'kinh-nghiem-phong-van-hoa-lac-1234',
    summary: 'Tóm tắt các mẹo phỏng vấn xin việc cho sinh viên.',
    content: 'Nội dung chi tiết về cách trả lời phỏng vấn xin việc...',
    category: 'phong_van',
  });

  const err = validBlog.validateSync();
  assert.equal(err, undefined, 'Valid blog should have no validation errors');
  assert.equal(validBlog.views, 0);
  assert.equal(validBlog.featured, false);
  assert.equal(validBlog.author?.name, 'Ban Biên Tập Hoa Lạc Việc');
  assert.equal(validBlog.author?.role, 'Admin');
});

test('5. Blog Model rejects invalid category enum', () => {
  const invalidCategoryBlog = new Blog({
    title: 'Tiêu đề hợp lệ',
    slug: 'slug-hop-le-1234',
    summary: 'Tóm tắt hợp lệ',
    content: 'Nội dung hợp lệ',
    category: 'khong_hop_le_123',
  });

  const err = invalidCategoryBlog.validateSync();
  assert.ok(err?.errors?.category, 'Expected enum validation error for category');
});

test('6. Admin Authorization middleware strictly protects blog management routes', () => {
  const adminAuthorizer = authorize('admin');

  // Test 1: Unauthenticated request (no user attached)
  let statusResult = null;
  let jsonResult = null;
  let nextCalled = false;

  const mockRes = {
    status(code) {
      statusResult = code;
      return {
        json(data) {
          jsonResult = data;
        },
      };
    },
  };

  adminAuthorizer({ user: null }, mockRes, () => { nextCalled = true; });
  assert.equal(statusResult, 401);
  assert.equal(nextCalled, false);

  // Test 2: Student user trying to access admin blog route
  statusResult = null;
  nextCalled = false;
  adminAuthorizer({ user: { role: 'student', name: 'Sinh viên' } }, mockRes, () => { nextCalled = true; });
  assert.equal(statusResult, 403);
  assert.equal(nextCalled, false);

  // Test 3: Employer user trying to access admin blog route
  statusResult = null;
  nextCalled = false;
  adminAuthorizer({ user: { role: 'employer', name: 'Nhà tuyển dụng' } }, mockRes, () => { nextCalled = true; });
  assert.equal(statusResult, 403);
  assert.equal(nextCalled, false);

  // Test 4: Worker user trying to access admin blog route
  statusResult = null;
  nextCalled = false;
  adminAuthorizer({ user: { role: 'worker', name: 'Lao động tự do' } }, mockRes, () => { nextCalled = true; });
  assert.equal(statusResult, 403);
  assert.equal(nextCalled, false);

  // Test 5: Admin user granted access
  statusResult = null;
  nextCalled = false;
  adminAuthorizer({ user: { role: 'admin', name: 'Quản trị viên' } }, mockRes, () => { nextCalled = true; });
  assert.equal(statusResult, null);
  assert.equal(nextCalled, true);
});
