/**
 * Service layer — switches between mock and API implementations
 * based on VITE_DATA_MODE env variable.
 *
 * UI code should ONLY call functions from this file.
 * In API mode, features without a backend endpoint will throw
 * an explicit "chưa được hỗ trợ" error (not silently fall back to mock).
 */

import * as mock from '@/mocks/store.js';

const DATA_MODE = import.meta.env.VITE_DATA_MODE || 'mock';

function notSupported(name) {
  return async () => {
    throw new Error(`[API mode] ${name} chưa được hỗ trợ ở backend. Vui lòng dùng VITE_DATA_MODE=mock.`);
  };
}

function resolve(mockFn, apiFn) {
  if (DATA_MODE === 'mock') return mockFn;
  return apiFn || notSupported(mockFn.name);
}

// ─── AUTH ─────────────────────────────────────────────────────────
export const login = resolve(mock.mockLogin, notSupported('login'));
export const register = resolve(mock.mockRegister, notSupported('register'));

// ─── JOBS ─────────────────────────────────────────────────────────
export const getJobs = resolve(mock.mockGetJobs);
export const getJob = resolve(mock.mockGetJob);
export const createJob = resolve(mock.mockCreateJob);
export const updateJob = resolve(mock.mockUpdateJob);
export const deleteJob = resolve(mock.mockDeleteJob);

// ─── APPLICATIONS ─────────────────────────────────────────────────
export const applyToJob = resolve(mock.mockApply);
export const getApplications = resolve(mock.mockGetApplications);
export const updateApplication = resolve(mock.mockUpdateApplication);
export const withdrawApplication = resolve(mock.mockWithdrawApplication);

// ─── SHIFTS ───────────────────────────────────────────────────────
export const getShifts = resolve(mock.mockGetShifts);
export const createShift = resolve(mock.mockCreateShift);
export const checkIn = resolve(mock.mockCheckIn);
export const checkOut = resolve(mock.mockCheckOut);
export const approveAttendance = resolve(mock.mockApproveAttendance);

// ─── SWAP REQUESTS ────────────────────────────────────────────────
export const getSwapRequests = resolve(mock.mockGetSwapRequests);
export const createSwapRequest = resolve(mock.mockCreateSwapRequest);
export const applySwap = resolve(mock.mockApplySwap);
export const approveSwap = resolve(mock.mockApproveSwap);
export const rejectSwap = resolve(mock.mockRejectSwap);

// ─── REVIEWS ─────────────────────────────────────────────────────
export const getReviews = resolve(mock.mockGetReviews);
export const createReview = resolve(mock.mockCreateReview);

// ─── PAYROLL ──────────────────────────────────────────────────────
export const getPayrollStatements = resolve(mock.mockGetPayrollStatements);
export const finalizePayroll = resolve(mock.mockFinalizePayroll);
export const addPayrollAdjustment = resolve(mock.mockAddAdjustment);

// ─── PROFILES ─────────────────────────────────────────────────────
export const getStudentProfile = resolve(mock.mockGetStudentProfile);
export const updateStudentProfile = resolve(mock.mockUpdateStudentProfile);
export const getEmployerProfile = resolve(mock.mockGetEmployerProfile);
export const updateEmployerProfile = resolve(mock.mockUpdateEmployerProfile);

// ─── AVAILABILITY ─────────────────────────────────────────────────
export const getAvailability = resolve(mock.mockGetAvailability);
export const upsertAvailability = resolve(mock.mockUpsertAvailability);

// ─── SAVED JOBS ───────────────────────────────────────────────────
export const getSavedJobs = resolve(mock.mockGetSavedJobs);
export const toggleSaveJob = resolve(mock.mockToggleSaveJob);
export const isSavedJob = resolve(mock.mockIsSavedJob);

// ─── ADMIN ────────────────────────────────────────────────────────
export const getVerificationRequests = resolve(mock.mockGetVerificationRequests);
export const reviewVerification = resolve(mock.mockReviewVerification);
export const getReports = resolve(mock.mockGetReports);
export const resolveReport = resolve(mock.mockResolveReport);
export const adminGetJobs = resolve(mock.mockAdminGetJobs);
export const adminUpdateJob = resolve(mock.mockAdminUpdateJob);
export const getAllUsers = resolve(mock.mockGetAllUsers);

// ─── UTIL ─────────────────────────────────────────────────────────
export const resetDemoData = mock.resetStore;
export const dataMode = DATA_MODE;
