import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Application, INACTIVE_APPLICATION_STATUSES } from '../src/models/Application.js';

const base = () => ({
  studentId: new mongoose.Types.ObjectId(),
  jobId: new mongoose.Types.ObjectId(),
  studentName: 'Sinh viên',
});

test('terminal application statuses release the unique (student, job) slot', async () => {
  for (const status of INACTIVE_APPLICATION_STATUSES) {
    const app = new Application({ ...base(), status });
    await app.validate();
    assert.equal(app.isActive, false, status);
  }
  for (const status of ['submitted', 'screening', 'shortlisted', 'interview', 'offer_sent', 'offer_accepted', 'hired']) {
    const app = new Application({ ...base(), status });
    await app.validate();
    assert.equal(app.isActive, true, status);
  }
});

test('unique student/job index is partial on active applications only', () => {
  const [, options] = Application.schema.indexes().find(([fields, opts]) =>
    fields.studentId === 1 && fields.jobId === 1 && opts?.unique);
  assert.deepEqual(options.partialFilterExpression, { isActive: true });
});

test('status change on a withdrawn application keeps isActive in sync', async () => {
  const app = new Application({ ...base(), status: 'submitted' });
  app.status = 'withdrawn';
  await app.validate();
  assert.equal(app.isActive, false);
});
