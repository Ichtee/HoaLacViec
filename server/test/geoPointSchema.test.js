import test from 'node:test';
import assert from 'node:assert/strict';

import { EmployerProfile } from '../src/models/EmployerProfile.js';
import { StudentProfile } from '../src/models/StudentProfile.js';
import { Job } from '../src/models/Job.js';
import { MicroTask } from '../src/models/MicroTask.js';

test('models do not materialize an incomplete GeoJSON Point without coordinates', () => {
  const documents = [
    new EmployerProfile({ userId: '507f1f77bcf86cd799439011', storeName: 'Store', address: 'Address' }),
    new StudentProfile({ userId: '507f1f77bcf86cd799439012' }),
    new Job({ storeName: 'Store', salaryAmount: 100000 }),
    new MicroTask({
      title: 'Task',
      description: 'Description',
      reward: 10000,
      location: 'Address',
      deadlineDate: new Date('2026-09-28'),
      requesterId: '507f1f77bcf86cd799439013',
      requesterName: 'Requester',
      requesterPhone: '0900000000',
    }),
  ];

  for (const document of documents) {
    assert.equal(document.geoPoint, undefined);
  }
});

test('models retain a complete GeoJSON Point', () => {
  const profile = new EmployerProfile({
    userId: '507f1f77bcf86cd799439011',
    storeName: 'Store',
    address: 'Address',
    geoPoint: { type: 'Point', coordinates: [105.5252, 21.0135] },
  });

  assert.equal(profile.geoPoint.type, 'Point');
  assert.deepEqual(profile.geoPoint.coordinates, [105.5252, 21.0135]);
  assert.equal(profile.validateSync(), undefined);
});
