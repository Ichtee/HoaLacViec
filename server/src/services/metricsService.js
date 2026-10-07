import { Job } from '../models/Job.js';
import { Employment } from '../models/Employment.js';
import { Shift } from '../models/Shift.js';
import { Application } from '../models/Application.js';
import { Message } from '../models/Message.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const round = (value, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const ratio = (part, whole) => (whole > 0 ? round((part / whole) * 100) : null);

/**
 * Thời gian trung bình (giờ) từ lúc tin được duyệt/đăng đến lần tuyển thành công đầu tiên.
 * Hàm thuần: nhận danh sách { postedAt, firstHireAt }.
 */
export function averageHoursToFirstHire(rows = []) {
  const hours = rows
    .map(({ postedAt, firstHireAt }) => (new Date(firstHireAt) - new Date(postedAt)) / (60 * 60 * 1000))
    .filter((h) => Number.isFinite(h) && h >= 0);
  return hours.length ? round(hours.reduce((a, b) => a + b, 0) / hours.length) : null;
}

/** Tỷ lệ nhà tuyển dụng quay lại: có từ 2 tin trở lên trên tổng số nhà tuyển dụng từng đăng tin. */
export function employerReturnRate(jobsPerEmployer = []) {
  return ratio(jobsPerEmployer.filter((n) => n >= 2).length, jobsPerEmployer.length);
}

export async function getPlatformMetrics(now = new Date()) {
  const since7 = new Date(now.getTime() - 7 * DAY_MS);
  const since30 = new Date(now.getTime() - 30 * DAY_MS);

  const [
    firstHireRows,
    capacity,
    shiftOutcomes,
    jobsPerEmployer,
    activeApplicants,
    activeEmployers,
    activeChatters,
    funnel,
  ] = await Promise.all([
    // Mỗi tin: thời điểm tuyển đầu tiên
    Employment.aggregate([
      { $match: { sourceApplicationId: { $ne: null } } },
      { $group: { _id: '$jobId', firstHireAt: { $min: '$createdAt' } } },
      { $lookup: { from: Job.collection.name, localField: '_id', foreignField: '_id', as: 'job' } },
      { $unwind: '$job' },
      { $project: { firstHireAt: 1, postedAt: { $ifNull: ['$job.moderatedAt', '$job.postedAt'] } } },
    ]),
    // Tỷ lệ lấp đầy: tổng đã tuyển / tổng chỉ tiêu các tin đã từng được duyệt
    Job.aggregate([
      { $match: { status: { $in: ['approved', 'paused', 'closed', 'expired'] } } },
      { $group: { _id: null, hired: { $sum: '$hiredCount' }, target: { $sum: '$headcountTarget' } } },
    ]),
    // Ca 30 ngày qua theo kết quả chấm công
    Shift.aggregate([
      { $match: { startAt: { $gte: since30, $lte: now }, scheduleStatus: { $ne: 'cancelled' } } },
      { $group: { _id: '$attendanceStatus', count: { $sum: 1 } } },
    ]),
    Job.aggregate([
      { $match: { employerUserId: { $ne: null }, status: { $ne: 'draft' } } },
      { $group: { _id: '$employerUserId', jobs: { $sum: 1 } } },
    ]),
    Application.distinct('studentId', { createdAt: { $gte: since7 } }),
    Job.distinct('employerUserId', { createdAt: { $gte: since7 } }),
    Message.distinct('senderId', { createdAt: { $gte: since7 } }),
    Application.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const target = capacity[0]?.target || 0;
  const hired = capacity[0]?.hired || 0;
  const outcomes = Object.fromEntries(shiftOutcomes.map((o) => [o._id, o.count]));
  const completed = outcomes.approved || 0;
  const noShows = outcomes.no_show || 0;

  const weeklyActive = new Set([...activeApplicants, ...activeEmployers, ...activeChatters].map(String));

  return {
    generatedAt: now.toISOString(),
    avgHoursToFirstHire: averageHoursToFirstHire(firstHireRows),
    fillRate: ratio(hired, target),
    noShowRate: ratio(noShows, completed + noShows),
    shifts30d: { completed, noShows, total: Object.values(outcomes).reduce((a, b) => a + b, 0) },
    employerReturnRate: employerReturnRate(jobsPerEmployer.map((row) => row.jobs)),
    weeklyActiveUsers: weeklyActive.size,
    applicationFunnel: Object.fromEntries(funnel.map((row) => [row._id, row.count])),
  };
}
