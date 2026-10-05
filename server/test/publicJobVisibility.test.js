import test from 'node:test';
import assert from 'node:assert/strict';
import { Job } from '../src/models/Job.js';
import { EmployerProfile } from '../src/models/EmployerProfile.js';

process.env.NODE_ENV = 'test';
const { default: app } = await import('../src/app.js');

test('public job listing only includes jobs whose details are public', async (t) => {
  const originals = {
    countDocuments: Job.countDocuments,
    find: Job.find,
    findById: Job.findById,
    employerFind: EmployerProfile.find,
  };
  t.after(() => {
    Job.countDocuments = originals.countDocuments;
    Job.find = originals.find;
    Job.findById = originals.findById;
    EmployerProfile.find = originals.employerFind;
  });

  const approvedId = '507f1f77bcf86cd799439021';
  const pendingId = '507f1f77bcf86cd799439022';
  const jobs = [
    { _id: approvedId, title: 'Approved job', status: 'approved' },
    { _id: pendingId, title: 'Pending job', status: 'pending' },
  ];
  let listFilter;
  Job.countDocuments = async (filter) => {
    listFilter = filter;
    return 1;
  };
  Job.find = () => ({
    sort: () => ({
      skip: () => ({
        limit: () => ({ lean: async () => jobs.filter(job => job.status === listFilter.$and.find(condition => condition.status)?.status) }),
      }),
    }),
  });
  Job.findById = id => ({ lean: async () => jobs.find(job => job._id === id) || null });
  EmployerProfile.find = () => ({ lean: async () => [] });

  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  for (const query of ['', '?status=all', '?status=pending']) {
    const response = await fetch(`${base}/api/jobs${query}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.jobs.map(job => job._id), [approvedId]);
    assert.deepEqual(listFilter.$and.find(condition => condition.status), { status: 'approved' });
  }

  const approved = await fetch(`${base}/api/jobs/${approvedId}`);
  assert.equal(approved.status, 200);
  const pending = await fetch(`${base}/api/jobs/${pendingId}`);
  assert.equal(pending.status, 404);
});
