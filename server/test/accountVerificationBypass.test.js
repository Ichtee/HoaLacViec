

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activatePendingUserWhenVerificationDisabled,
  getVerificationBypassRole,
  isAccountVerificationDisabled,
} from '../src/config/accountVerification.js';

test('account verification bypass is reversible and does not persist user changes', () => {
  const previousDisabled = process.env.DISABLE_ACCOUNT_VERIFICATION;
  const previousRole = process.env.ACCOUNT_VERIFICATION_BYPASS_ROLE;

  try {
    process.env.DISABLE_ACCOUNT_VERIFICATION = 'true';
    process.env.ACCOUNT_VERIFICATION_BYPASS_ROLE = 'student';

    const pendingUser = {
      role: 'pending',
      status: 'pending',
      save() {
        throw new Error('The temporary bypass must not persist verification state');
      },
    };

    assert.equal(isAccountVerificationDisabled(), true);
    assert.equal(getVerificationBypassRole(), 'student');
    assert.equal(activatePendingUserWhenVerificationDisabled(pendingUser), pendingUser);
    assert.equal(pendingUser.role, 'student');
    assert.equal(pendingUser.status, 'active');
  } finally {
    if (previousDisabled === undefined) delete process.env.DISABLE_ACCOUNT_VERIFICATION;
    else process.env.DISABLE_ACCOUNT_VERIFICATION = previousDisabled;

    if (previousRole === undefined) delete process.env.ACCOUNT_VERIFICATION_BYPASS_ROLE;
    else process.env.ACCOUNT_VERIFICATION_BYPASS_ROLE = previousRole;
  }
});

test('account verification bypass stays inactive unless explicitly enabled', () => {
  const previousDisabled = process.env.DISABLE_ACCOUNT_VERIFICATION;

  try {
    process.env.DISABLE_ACCOUNT_VERIFICATION = 'false';
    const pendingUser = { role: 'pending', status: 'pending' };

    activatePendingUserWhenVerificationDisabled(pendingUser);

    assert.deepEqual(pendingUser, { role: 'pending', status: 'pending' });
  } finally {
    if (previousDisabled === undefined) delete process.env.DISABLE_ACCOUNT_VERIFICATION;
    else process.env.DISABLE_ACCOUNT_VERIFICATION = previousDisabled;
  }
});
