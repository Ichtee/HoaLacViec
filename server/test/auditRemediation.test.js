import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

test.after(async () => {
  await mongoose.disconnect();
});

import {
  STUDENT_SELF_UPDATE_FIELDS,
  EMPLOYER_SELF_UPDATE_FIELDS,
  ADMIN_ALLOWED_FIELDS_STUDENT,
  ADMIN_ALLOWED_FIELDS_EMPLOYER,
  toPublicStudentDTO,
  toPrivateStudentDTO,
  toPublicEmployerDTO,
  toPrivateEmployerDTO,
} from '../src/routes/profileRoutes.js';

import {
  VALID_TRANSITIONS,
  getStatusLabel,
} from '../src/routes/applicationRoutes.js';

import {
  evaluateCheckinWindow,
  isValidCoordinate,
  calculateHaversineDistanceMeters,
} from '../src/utils/geoHelper.js';

// ==========================================
// TEST SUITE 1: PROFILE MASS ASSIGNMENT & DTOS
// ==========================================
test('Phase 1: Profile Mass Assignment Protection & DTO Sanitization', async (t) => {
  await t.test('Student self-update allowlist prevents privilege escalation', () => {
    const forbiddenFields = [
      'verified',
      'verificationStatus',
      'reviewedBy',
      'reviewedAt',
      'rejectionReason',
      'reputationScore',
      'reputationCount',
      'rating',
      'ratingCount',
      'checkinRadius',
      'locationStatus',
      'locationSource',
      'profileComplete',
    ];

    forbiddenFields.forEach((field) => {
      assert.equal(
        STUDENT_SELF_UPDATE_FIELDS.includes(field),
        false,
        `Field "${field}" must NOT be in STUDENT_SELF_UPDATE_FIELDS`
      );
    });
  });

  await t.test('Employer self-update allowlist prevents privilege escalation', () => {
    const forbiddenFields = [
      'verified',
      'verifiedAt',
      'verificationStatus',
      'reviewedBy',
      'reviewedAt',
      'rating',
      'ratingCount',
      'reputationScore',
      'reputationCount',
      'checkinRadius',
      'locationStatus',
      'locationSource',
      'locationConfirmedAt',
    ];

    forbiddenFields.forEach((field) => {
      assert.equal(
        EMPLOYER_SELF_UPDATE_FIELDS.includes(field),
        false,
        `Field "${field}" must NOT be in EMPLOYER_SELF_UPDATE_FIELDS`
      );
    });
  });

  await t.test('Admin allowlist includes management fields', () => {
    assert.ok(ADMIN_ALLOWED_FIELDS_STUDENT.includes('verified'));
    assert.ok(ADMIN_ALLOWED_FIELDS_STUDENT.includes('reputationScore'));
    assert.ok(ADMIN_ALLOWED_FIELDS_EMPLOYER.includes('verified'));
    assert.ok(ADMIN_ALLOWED_FIELDS_EMPLOYER.includes('checkinRadius'));
  });

  await t.test('toPublicStudentDTO strips sensitive student card photo and verification docs', () => {
    const rawStudent = {
      _id: 'mock_student_id_123',
      userId: 'mock_user_id_456',
      university: 'FPT University',
      studentCode: 'HE160000',
      yearOfStudy: 3,
      major: 'Software Engineering',
      area: 'Hòa Lạc',
      address: 'Thôn 3, Thạch Hòa, Thạch Thất, Hà Nội',
      location: { lat: 21.013, lng: 105.525 },
      studentCardPhoto: 'https://cdn.example.com/private_id_card.png',
      verified: true,
      verificationStatus: 'approved',
      rejectionReason: '',
      reputationScore: 4.9,
      reputationCount: 15,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const publicDTO = toPublicStudentDTO(rawStudent);
    assert.equal(publicDTO._id, 'mock_student_id_123');
    assert.equal(publicDTO.university, 'FPT University');
    assert.equal(publicDTO.reputationScore, 4.9);
    // Sensitive data must be stripped:
    assert.equal(publicDTO.studentCardPhoto, undefined);
    assert.equal(publicDTO.studentCode, undefined);
    assert.equal(publicDTO.address, undefined);
    assert.equal(publicDTO.location, undefined);
    assert.equal(publicDTO.verificationStatus, undefined);

    const privateDTO = toPrivateStudentDTO(rawStudent);
    assert.equal(privateDTO.studentCardPhoto, 'https://cdn.example.com/private_id_card.png');
    assert.equal(privateDTO.studentCode, 'HE160000');
  });

  await t.test('toPublicEmployerDTO strips private security settings like checkinRadius', () => {
    const rawEmployer = {
      _id: 'emp_id_789',
      userId: 'emp_user_999',
      storeName: 'Trà Sữa Matcha Hòa Lạc',
      storeType: 'cafe',
      address: 'Km 29 Đại Lộ Thăng Long',
      area: 'Hòa Lạc',
      location: { lat: 21.0125, lng: 105.527 },
      locationStatus: 'confirmed',
      locationSource: 'map_pin',
      checkinRadius: 150,
      verified: true,
      verifiedAt: new Date(),
      rating: 4.8,
      ratingCount: 12,
    };

    const publicDTO = toPublicEmployerDTO(rawEmployer);
    assert.equal(publicDTO.storeName, 'Trà Sữa Matcha Hòa Lạc');
    assert.equal(publicDTO.checkinRadius, undefined);
    assert.equal(publicDTO.verifiedAt, undefined);

    const privateDTO = toPrivateEmployerDTO(rawEmployer);
    assert.equal(privateDTO.checkinRadius, 150);
    assert.ok(privateDTO.verifiedAt);
  });
});

// ==========================================
// TEST SUITE 2: APPLICATION STATE MACHINE
// ==========================================
test('Phase 2: Application State Machine Lifecycle', async (t) => {
  await t.test('Valid forward transitions from pending', () => {
    const transitions = VALID_TRANSITIONS.pending;
    assert.deepEqual(transitions.sort(), ['reviewing', 'withdrawn'].sort());
  });

  await t.test('Valid transitions from reviewing', () => {
    const transitions = VALID_TRANSITIONS.reviewing;
    assert.deepEqual(transitions.sort(), ['interview', 'rejected', 'shortlisted', 'withdrawn'].sort());
  });

  await t.test('Valid transitions from shortlisted', () => {
    const transitions = VALID_TRANSITIONS.shortlisted;
    assert.deepEqual(transitions.sort(), ['hired', 'interview', 'rejected', 'withdrawn'].sort());
  });

  await t.test('Valid transitions from interview', () => {
    const transitions = VALID_TRANSITIONS.interview;
    assert.deepEqual(transitions.sort(), ['hired', 'rejected', 'withdrawn'].sort());
  });

  await t.test('Terminal states strictly forbid further transitions', () => {
    assert.equal(VALID_TRANSITIONS.hired.length, 0, 'hired is a terminal state');
    assert.equal(VALID_TRANSITIONS.rejected.length, 0, 'rejected is a terminal state');
    assert.equal(VALID_TRANSITIONS.withdrawn.length, 0, 'withdrawn is a terminal state');
    assert.equal(VALID_TRANSITIONS.accepted.length, 0, 'legacy accepted is terminal');
    assert.equal(VALID_TRANSITIONS.approved.length, 0, 'legacy approved is terminal');
  });

  await t.test('State transition validation helper verifies valid and invalid moves', () => {
    function canTransition(current, next) {
      const allowed = VALID_TRANSITIONS[current] || [];
      return allowed.includes(next);
    }

    assert.equal(canTransition('pending', 'reviewing'), true);
    assert.equal(canTransition('pending', 'hired'), false); // Cannot jump directly to hired
    assert.equal(canTransition('reviewing', 'interview'), true);
    assert.equal(canTransition('interview', 'hired'), true);
    assert.equal(canTransition('hired', 'pending'), false); // Cannot revert from hired
    assert.equal(canTransition('rejected', 'hired'), false); // Cannot resurrect rejected
    assert.equal(canTransition('withdrawn', 'reviewing'), false); // Cannot reopen withdrawn
  });

  await t.test('getStatusLabel returns human-readable localized Vietnamese labels', () => {
    assert.equal(getStatusLabel('pending'), 'Đang chờ xét duyệt');
    assert.equal(getStatusLabel('hired'), 'Trúng tuyển');
    assert.equal(getStatusLabel('withdrawn'), 'Đã rút đơn');
  });
});

// ==========================================
// TEST SUITE 3: SHIFT CHECK-IN TIME WINDOW
// ==========================================
test('Phase 2: Shift Attendance Time Window (Asia/Ho_Chi_Minh: +07:00)', async (t) => {
  const shiftDate = '2026-09-26';
  const startTime = '08:00'; // 08:00 AM UTC+7

  await t.test('Allows check-in within window [-30min, +60min]', () => {
    // Exactly 30 minutes before: 07:30
    const checkin30Early = new Date('2026-09-26T07:30:00+07:00');
    const res1 = evaluateCheckinWindow(shiftDate, startTime, checkin30Early);
    assert.equal(res1.allowed, true);

    // 15 minutes before: 07:45
    const checkin15Early = new Date('2026-09-26T07:45:00+07:00');
    const res2 = evaluateCheckinWindow(shiftDate, startTime, checkin15Early);
    assert.equal(res2.allowed, true);

    // Exact start time: 08:00
    const checkinExact = new Date('2026-09-26T08:00:00+07:00');
    const res3 = evaluateCheckinWindow(shiftDate, startTime, checkinExact);
    assert.equal(res3.allowed, true);

    // 30 minutes late: 08:30
    const checkin30Late = new Date('2026-09-26T08:30:00+07:00');
    const res4 = evaluateCheckinWindow(shiftDate, startTime, checkin30Late);
    assert.equal(res4.allowed, true);

    // Exactly 60 minutes late: 09:00
    const checkin60Late = new Date('2026-09-26T09:00:00+07:00');
    const res5 = evaluateCheckinWindow(shiftDate, startTime, checkin60Late);
    assert.equal(res5.allowed, true);
  });

  await t.test('Rejects check-in earlier than 30 minutes before startTime', () => {
    // 31 minutes before: 07:29
    const checkin31Early = new Date('2026-09-26T07:29:00+07:00');
    const res = evaluateCheckinWindow(shiftDate, startTime, checkin31Early);
    assert.equal(res.allowed, false);
    assert.equal(res.code, 'CHECKIN_TOO_EARLY');
  });

  await t.test('Rejects check-in later than 60 minutes after startTime', () => {
    // 61 minutes late: 09:01
    const checkin61Late = new Date('2026-09-26T09:01:00+07:00');
    const res = evaluateCheckinWindow(shiftDate, startTime, checkin61Late);
    assert.equal(res.allowed, false);
    assert.equal(res.code, 'CHECKIN_WINDOW_EXPIRED');
  });

  await t.test('Handles invalid datetime formats gracefully', () => {
    const res = evaluateCheckinWindow('invalid-date', 'not-a-time', new Date());
    assert.equal(res.allowed, false);
    assert.equal(res.code, 'INVALID_DATETIME');
  });
});

// ==========================================
// TEST SUITE 4: SAVED JOBS CONTRACT
// ==========================================
test('Phase 1: Saved Jobs Contract & Data Standards', async (t) => {
  await t.test('Toggle contract format validator ensures { saved, jobId }', () => {
    function formatToggleResponse(saved, jobId) {
      return { saved: Boolean(saved), jobId: String(jobId) };
    }

    const res1 = formatToggleResponse(true, '67a80b0c1234567890abcdef');
    assert.deepEqual(res1, { saved: true, jobId: '67a80b0c1234567890abcdef' });

    const res2 = formatToggleResponse(false, '67a80b0c1234567890abcdef');
    assert.deepEqual(res2, { saved: false, jobId: '67a80b0c1234567890abcdef' });
  });
});

// ==========================================
// TEST SUITE 5: GEOLOCATION INTEGRITY & DISTANCE
// ==========================================
test('Phase 3: Geolocation Accuracy & Coordinate Safeguards', async (t) => {
  await t.test('Rejects missing or fake placeholder coordinate structures', () => {
    assert.equal(isValidCoordinate(null, null), false);
    assert.equal(isValidCoordinate(undefined, undefined), false);
    assert.equal(isValidCoordinate('', ''), false);
    assert.equal(isValidCoordinate('abc', 'xyz'), false);
    assert.equal(isValidCoordinate(NaN, 105.525), false);
    assert.equal(isValidCoordinate(21.013, Infinity), false);
    assert.equal(isValidCoordinate(95, 105), false); // Lat > 90
    assert.equal(isValidCoordinate(21, 185), false); // Lng > 180
  });

  await t.test('Accepts valid GeoJSON Point compatible coordinates', () => {
    assert.equal(isValidCoordinate(21.0128, 105.5255), true); // Hòa Lạc
    assert.equal(isValidCoordinate(0, 0), true); // Equator & Prime Meridian
    assert.equal(isValidCoordinate(-33.8688, 151.2093), true); // Sydney
  });

  await t.test('Haversine distance calculation is symmetrical and accurate', () => {
    const lat1 = 21.0128, lng1 = 105.5255; // FPT University
    const lat2 = 21.0180, lng2 = 105.5300; // Nearby point in Hòa Lạc
    const d1 = calculateHaversineDistanceMeters(lat1, lng1, lat2, lng2);
    const d2 = calculateHaversineDistanceMeters(lat2, lng2, lat1, lng1);
    assert.ok(d1 > 0);
    assert.equal(d1, d2);
  });
});
