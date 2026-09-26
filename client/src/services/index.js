/**
 * Production Service Layer — 100% Real API connected to Express + MongoDB Atlas
 * Zero mock dependencies in production
 */

export * from './api.js';

// Re-export explicit service names expected by UI components
export {
  apiLogin as login,
  apiGoogleLogin as googleLogin,
  apiRegister as register,
  apiGetMe as getMe,
  apiUpdateUserProfile as updateUserProfile,
  apiChangePassword as changePassword,
  apiGetJobs as getJobs,
  apiGetJob as getJob,
  apiCreateJob as createJob,
  apiResolveMapLink as resolveMapLink,
  apiSearchPlaces as searchPlaces,
  apiGeocodeAddress as geocodeAddress,
  apiGetEmployerMyJobs as getEmployerMyJobs,
  apiSubmitJobForReview as submitJobForReview,
  apiPauseJob as pauseJob,
  apiCloseJob as closeJob,
  apiReopenJob as reopenJob,
  apiUpdateJob as updateJob,
  apiDeleteJob as deleteJob,
  apiApply as applyToJob,
  apiGetApplications as getApplications,
  apiUpdateApplication as updateApplication,
  apiWithdrawApplication as withdrawApplication,
  apiGetShifts as getShifts,
  apiCreateShift as createShift,
  apiCheckIn as checkIn,
  apiCheckOut as checkOut,
  apiApproveAttendance as approveAttendance,
  apiDisputeShift as disputeShift,
  apiGetTasks as getTasks,
  apiGetTask as getTask,
  apiCreateTask as createTask,
  apiAcceptTask as acceptTask,
  apiSubmitTaskCompletion as submitTaskCompletion,
  apiCompleteTask as completeTask,
  apiDisputeTask as disputeTask,
  apiCancelTask as cancelTask,
  apiDeleteTask as deleteTask,
  apiGetBlogs as getBlogs,
  apiGetBlog as getBlog,
  apiCreateBlog as createBlog,
  apiGetStudentProfile as getStudentProfile,
  apiSubmitStudentVerification as submitStudentVerification,
  apiGetStudentVerification as getStudentVerification,
  apiGetUniversities as getUniversities,
  apiUpdateStudentProfile as updateStudentProfile,
  apiGetEmployerProfile as getEmployerProfile,
  apiUpdateEmployerProfile as updateEmployerProfile,
  apiGetAvailability as getAvailability,
  apiUpsertAvailability as upsertAvailability,
  apiGetReviews as getReviews,
  apiCreateReview as createReview,
  apiGetVerificationRequests as getVerificationRequests,
  apiGetEmployerVerification as getEmployerVerification,
  apiSubmitEmployerVerification as submitEmployerVerification,
  apiAdminGetJobs as adminGetJobs,
  apiAdminUpdateJob as adminUpdateJob,
  apiGetAllUsers as getAllUsers,
  apiGetSavedJobs,
  apiGetSavedJobIds,
  apiSaveJob,
  apiUnsaveJob,
  apiToggleSaveJob,
  apiGetNotifications,
  apiGetUnreadNotificationCount,
  apiMarkNotificationRead,
  apiMarkAllNotificationsRead,
  apiDeleteNotification,
} from './api.js';

import {
  apiApproveVerification,
  apiRejectVerification,
  apiGetJobs,
  apiGetSavedJobs,
  apiToggleSaveJob,
  apiGetSavedJobIds,
} from './api.js';

export async function reviewVerification(id, action, reason) {
  const act = typeof action === 'object' ? action?.status : action;
  const resReason = typeof action === 'object' ? action?.reason : reason;
  if (act === 'approve' || act === 'approved') {
    return apiApproveVerification(id);
  } else if (act === 'reject' || act === 'rejected') {
    return apiRejectVerification(id, resReason);
  }
  return Promise.resolve();
}

export {
  apiGetReports as getReports,
  apiCreateReport as createReport,
  apiResolveReport as resolveReport,
} from './api.js';

function getLocalSavedJobIds() {
  try {
    return JSON.parse(localStorage.getItem('hlv_saved_jobs') || '[]');
  } catch {
    return [];
  }
}

export async function getSavedJobs() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (token) {
    const data = await apiGetSavedJobs();
    return Array.isArray(data) ? data : [];
  }
  const ids = getLocalSavedJobIds();
  if (ids.length === 0) return [];
  const all = await apiGetJobs();
  const list = Array.isArray(all) ? all : (all?.items || all?.jobs || []);
  return list.filter((j) => ids.includes(j._id || j.id));
}

export async function toggleSaveJob(jobId) {
  if (!jobId) throw new Error('Mã việc làm không được để trống');
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (token) {
    // Authenticated user: DO NOT silently fallback to localStorage on API error!
    const res = await apiToggleSaveJob(jobId);
    return { saved: Boolean(res.saved), jobId };
  }

  // Guest users only: localStorage fallback
  let ids = getLocalSavedJobIds();
  const exists = ids.includes(jobId);
  if (exists) {
    ids = ids.filter((id) => id !== jobId);
  } else {
    ids.push(jobId);
  }
  localStorage.setItem('hlv_saved_jobs', JSON.stringify(ids));
  return { saved: !exists, jobId };
}

export async function isSavedJob(jobId) {
  if (!jobId) return false;
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (token) {
    try {
      const ids = await apiGetSavedJobIds();
      return Array.isArray(ids) && ids.includes(jobId);
    } catch {
      return false;
    }
  }
  const ids = getLocalSavedJobIds();
  return ids.includes(jobId);
}

export const dataMode = 'api';
