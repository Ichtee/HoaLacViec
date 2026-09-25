import test from 'node:test';
import assert from 'node:assert/strict';

function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Vui lòng nhập mật khẩu.' };
  }
  if (password.length < 6) {
    return { valid: false, error: 'Mật khẩu phải có tối thiểu 6 ký tự.' };
  }
  if (password.length > 32) {
    return { valid: false, error: 'Mật khẩu không được vượt quá 32 ký tự.' };
  }
  return { valid: true };
}

test('Password Validation Rules (min: 6, max: 32)', async (t) => {
  await t.test('Accepts valid password within [6, 32]', () => {
    assert.equal(validatePassword('123456').valid, true); // Boundary: min 6
    assert.equal(validatePassword('a'.repeat(32)).valid, true); // Boundary: max 32
    assert.equal(validatePassword('MyStrongPass123!').valid, true); // Typical password
  });

  await t.test('Rejects password shorter than 6 characters', () => {
    assert.equal(validatePassword('').valid, false);
    assert.equal(validatePassword('12345').valid, false); // Length 5
    assert.equal(validatePassword('a').valid, false);
  });

  await t.test('Rejects password longer than 32 characters', () => {
    assert.equal(validatePassword('a'.repeat(33)).valid, false); // Length 33
    assert.equal(validatePassword('a'.repeat(50)).valid, false);
  });

  await t.test('Rejects non-string types and null/undefined', () => {
    assert.equal(validatePassword(null).valid, false);
    assert.equal(validatePassword(undefined).valid, false);
    assert.equal(validatePassword(123456).valid, false);
    assert.equal(validatePassword({}).valid, false);
  });
});
