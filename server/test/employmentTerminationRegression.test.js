import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Employment } from '../src/models/Employment.js';
import { Shift } from '../src/models/Shift.js';
import { EmployerProfile } from '../src/models/EmployerProfile.js';
import { Notification } from '../src/models/Notification.js';
import { terminateEmployment, updateEmployment } from '../src/services/employmentService.js';

const employerId = new mongoose.Types.ObjectId();
const employeeId = new mongoose.Types.ObjectId();
const employmentId = new mongoose.Types.ObjectId();

test('termination cancels only safe future shifts and cannot resurrect employment', async (t) => {
  const originals = {
    employmentFindById: Employment.findById,
    shiftFind: Shift.find,
    profileFindOne: EmployerProfile.findOne,
    notificationCreate: Notification.create,
    transaction: mongoose.connection.transaction,
  };
  t.after(() => {
    Employment.findById = originals.employmentFindById;
    Shift.find = originals.shiftFind;
    EmployerProfile.findOne = originals.profileFindOne;
    Notification.create = originals.notificationCreate;
    mongoose.connection.transaction = originals.transaction;
  });

  const employment = {
    _id: employmentId,
    employerUserId: employerId,
    employeeUserId: employeeId,
    status: 'active',
    workplace: 'Cửa hàng',
    history: [],
    save: async () => {},
  };
  Employment.findById = () => ({
    session: async () => employment,
    then: (resolve) => Promise.resolve(employment).then(resolve),
  });
  EmployerProfile.findOne = async () => null;
  Notification.create = async () => ({});
  mongoose.connection.transaction = async callback => callback({});
  const shift = {
    scheduleStatus: 'published',
    history: [],
    save: async () => {},
  };
  let shiftFilter;
  Shift.find = conditions => {
    shiftFilter = conditions;
    return { session: async () => [shift] };
  };

  const result = await terminateEmployment(employmentId, employerId, { futureShiftAction: 'cancel' });
  assert.equal(result.cancelledShiftsCount, 1);
  assert.equal(employment.status, 'terminated');
  assert.equal(shift.scheduleStatus, 'cancelled');
  assert.equal(String(shiftFilter.employerUserId), String(employerId));
  assert.equal(String(shiftFilter.$or[0].employmentId), String(employmentId));
  assert.equal(shiftFilter.attendanceStatus, 'not_started');
  assert.equal(shiftFilter.payrollStatus, 'not_ready');

  await assert.rejects(
    updateEmployment(employmentId, employerId, { status: 'active' }),
    error => error.code === 'EMPLOYMENT_TERMINATED'
  );
});
