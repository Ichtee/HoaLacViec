const ALLOWED_BYPASS_ROLES = new Set(['student', 'employer']);

export function isAccountVerificationDisabled() {
  return String(process.env.DISABLE_ACCOUNT_VERIFICATION).toLowerCase() === 'true';
}

export function getVerificationBypassRole() {
  const configuredRole = String(
    process.env.ACCOUNT_VERIFICATION_BYPASS_ROLE || 'student'
  ).toLowerCase();

  return ALLOWED_BYPASS_ROLES.has(configuredRole) ? configuredRole : 'student';
}

/**
 * Development/demo escape hatch for the account onboarding flow.
 * Pending accounts receive an effective role/status for the current request.
 * Nothing is persisted, so turning the flag off restores the verification flow.
 */
export function activatePendingUserWhenVerificationDisabled(user) {
  if (!isAccountVerificationDisabled() || !user || user.role === 'admin') {
    return user;
  }

  if (user.role === 'pending') {
    user.role = getVerificationBypassRole();
  }

  if (user.status === 'pending') {
    user.status = 'active';
  }

  return user;
}
