

/**
 * Strict Authorization Assertion: Employer Owner or Admin
 */
export function assertIsEmployerOwnerOrAdmin(shift, actor) {
  if (!actor) {
    const err = new Error('Yêu cầu xác thực tài khoản.');
    err.status = 401;
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  if (['student', 'worker', 'freelancer'].includes(actor.role)) {
    const err = new Error('Người lao động không có quyền thực hiện thao tác quản lý lịch và chấm công.');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }
  if (actor.role === 'admin') return true;

  const actorIdStr = String(actor._id || actor.id);
  const shiftEmployerUserIdStr = String(shift.employerUserId?._id || shift.employerUserId || '');
  const shiftEmployerIdStr = String(shift.employerId?._id || shift.employerId || '');

  if (actorIdStr !== shiftEmployerUserIdStr && actorIdStr !== shiftEmployerIdStr) {
    const err = new Error('Bạn không có quyền thao tác trên ca làm việc của cơ sở này.');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }
  return true;
}

/**
 * Strict Authorization Assertion: Assigned Student / Employee (Read-only access)
 */
export function assertIsAssignedStudent(shift, actor) {
  if (!actor) {
    const err = new Error('Yêu cầu xác thực tài khoản.');
    err.status = 401;
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  const actorIdStr = String(actor._id || actor.id);
  const employeeUserIdStr = String(shift.employeeUserId?._id || shift.employeeUserId || shift.studentUserId?._id || shift.studentUserId || shift.studentId || '');

  if (actorIdStr !== employeeUserIdStr) {
    const err = new Error('Bạn không có quyền thao tác trên ca làm của người khác.');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }
  return true;
}
