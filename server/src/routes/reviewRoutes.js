import express from 'express';
import mongoose from 'mongoose';
import { Review } from '../models/Review.js';
import { User } from '../models/User.js';
import { Shift } from '../models/Shift.js';
import { MicroTask } from '../models/MicroTask.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { Notification } from '../models/Notification.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// Store ratings come from completed shifts; task reputation is separate.
export async function syncAggregateRating(targetUserId, transactionType) {
  try {
    const stats = await Review.aggregate([
      { $match: { targetId: new mongoose.Types.ObjectId(targetUserId), status: 'published', ...(transactionType === 'shift' ? { transactionType: 'shift' } : {}) } },
      {
        $group: {
          _id: '$targetId',
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    const avg = stats.length ? Number(stats[0].averageRating.toFixed(1)) : 0;
    const total = stats.length ? stats[0].totalReviews : 0;
    if (transactionType === 'task') {
      await StudentProfile.findOneAndUpdate(
        { userId: targetUserId },
        { $set: { reputationScore: avg, reputationCount: total } }
      );
    } else if (transactionType === 'shift') {
      await EmployerProfile.findOneAndUpdate(
        { userId: targetUserId },
        { $set: { rating: avg, ratingCount: total } }
      );
    }
  } catch (err) {
    console.warn('Sync aggregate rating error:', err.message);
  }
}

// GET /api/reviews
router.get('/', async (req, res, next) => {
  try {
    const { targetId, reviewerId, studentId, storeId, transactionType } = req.query;
    const filter = { status: 'published' };
    if (transactionType && ['shift', 'task'].includes(transactionType)) filter.transactionType = transactionType;

    if (studentId) {
      filter.$or = [{ targetId: studentId }, { reviewerId: studentId }];
    } else {
      const target = targetId || storeId;
      if (target) {
        filter.targetId = target;
      }
      if (reviewerId) {
        filter.reviewerId = reviewerId;
      }
    }

    const reviews = await Review.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const formatted = reviews.map((r) => {
      const isGiven = studentId && r.reviewerId && r.reviewerId.toString() === studentId.toString();
      return {
        ...r,
        id: r._id,
        date: r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : 'Mới đây',
        authorName: r.reviewerName || 'Thành viên Hòa Lạc',
        storeName: r.storeName || '',
        type: studentId ? (isGiven ? 'given' : 'received') : r.type,
        tags: Array.isArray(r.tags) ? r.tags : [],
      };
    });

    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

// POST /api/reviews (Authenticated - Requires real completed transaction)
router.post('/', authenticate, async (req, res, next) => {
  try {
    const {
      targetId,
      rating,
      comment,
      tags,
      storeName,
      transactionType,
      transactionId,
      criteria,
    } = req.body;

    if (rating == null || (transactionType !== 'shift' && !comment)) {
      return res.status(400).json({
        error: 'Vui lòng cung cấp số sao và nhận xét.',
        code: 'MISSING_FIELDS',
      });
    }

    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ error: 'Số sao đánh giá phải từ 1 đến 5.', code: 'INVALID_RATING' });
    }
    if (comment != null && (typeof comment !== 'string' || comment.length > 1000)) {
      return res.status(400).json({ error: 'Nhận xét không hợp lệ hoặc quá dài.', code: 'INVALID_COMMENT' });
    }

    // Require real transaction verification
    if (!transactionId || !transactionType) {
      return res.status(400).json({
        error: 'Đánh giá yêu cầu phải gắn với một ca làm việc hoặc việc vặt đã hoàn thành để xác thực.',
        code: 'TRANSACTION_REQUIRED',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({ error: 'Mã giao dịch không hợp lệ.', code: 'INVALID_TRANSACTION_ID' });
    }

    let finalTargetId = targetId;
    let finalStoreName = storeName || '';
    let validatedCriteria = undefined;

    if (transactionType === 'shift') {
      const shift = await Shift.findById(transactionId);
      if (!shift) {
        return res.status(404).json({ error: 'Không tìm thấy ca làm việc liên quan.', code: 'TRANSACTION_NOT_FOUND' });
      }

      const shiftApproved = shift.attendanceStatus
        ? shift.attendanceStatus === 'approved'
        : ['approved', 'completed', 'payroll_ready', 'paid'].includes(shift.status);
      if (!shiftApproved) {
        return res.status(400).json({
          error: 'Chỉ có thể đánh giá sau khi ca làm việc đã được duyệt hoàn thành.',
          code: 'SHIFT_NOT_COMPLETED',
        });
      }

      const isStudentParticipant =
        (shift.studentUserId && shift.studentUserId.toString() === req.user._id.toString()) ||
        (shift.studentId && shift.studentId.toString() === req.user._id.toString());

      if (req.user.role !== 'student' || !isStudentParticipant) {
        return res.status(403).json({
          error: 'Chỉ sinh viên đã làm ca này mới có thể đánh giá cửa hàng.',
          code: 'FORBIDDEN',
        });
      }

      const employerProfile = await EmployerProfile.findOne({ userId: shift.employerUserId });
      if (!employerProfile) {
        return res.status(404).json({ error: 'Không tìm thấy hồ sơ cửa hàng.', code: 'STORE_NOT_FOUND' });
      }
      finalTargetId = employerProfile.userId;
      finalStoreName = shift.storeName || employerProfile.storeName;

      const allowedCriteria = ['jobAccuracy', 'shiftManagement', 'workEnvironment', 'payment'];
      if (criteria && (typeof criteria !== 'object' || Array.isArray(criteria) ||
        Object.keys(criteria).some((key) => !allowedCriteria.includes(key)))) {
        return res.status(400).json({ error: 'Tiêu chí đánh giá không hợp lệ.', code: 'INVALID_CRITERIA' });
      }
      validatedCriteria = {};
      for (const key of allowedCriteria) {
        if (criteria?.[key] == null) continue;
        const value = Number(criteria[key]);
        if (!Number.isInteger(value) || value < 1 || value > 5 ||
          (key === 'payment' && shift.payrollStatus !== 'paid')) {
          return res.status(400).json({ error: 'Điểm tiêu chí không hợp lệ hoặc chưa đến lúc đánh giá thanh toán.', code: 'INVALID_CRITERIA' });
        }
        validatedCriteria[key] = value;
      }
    } else if (transactionType === 'task') {
      const task = await MicroTask.findById(transactionId);
      if (!task) {
        return res.status(404).json({ error: 'Không tìm thấy việc vặt liên quan.', code: 'TRANSACTION_NOT_FOUND' });
      }

      if (task.status !== 'completed') {
        return res.status(400).json({
          error: 'Chỉ có thể đánh giá sau khi việc vặt đã được xác nhận hoàn thành.',
          code: 'TASK_NOT_COMPLETED',
        });
      }

      const isRequester = task.requesterId && task.requesterId.toString() === req.user._id.toString();
      const isAssignee = task.assigneeId && task.assigneeId.toString() === req.user._id.toString();

      if (!isRequester && !isAssignee && req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Bạn không phải là người tham gia trong việc vặt này để đánh giá.',
          code: 'FORBIDDEN',
        });
      }

      // Backend authoritatively deduces opposite participant as targetId
      if (isRequester) {
        finalTargetId = task.assigneeId;
      } else if (isAssignee) {
        finalTargetId = task.requesterId;
      }

      finalStoreName = `Việc vặt: ${task.title}`;
    } else {
      return res.status(400).json({ error: 'Loại giao dịch không hợp lệ (hỗ trợ: shift, task).', code: 'INVALID_TRANSACTION_TYPE' });
    }

    if (!finalTargetId || !mongoose.Types.ObjectId.isValid(finalTargetId)) {
      return res.status(400).json({ error: 'Không xác định được đối tượng đánh giá hợp lệ.', code: 'INVALID_ID' });
    }

    // Anti self-review
    if (finalTargetId.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Bạn không thể tự đánh giá chính mình.', code: 'SELF_REVIEW_FORBIDDEN' });
    }

    // Check duplicate review on same transaction
    const existingReview = await Review.findOne({
      reviewerId: req.user._id,
      transactionId,
    });

    if (existingReview) {
      return res.status(409).json({
        error: 'Bạn đã gửi đánh giá cho giao dịch này rồi.',
        code: 'DUPLICATE_REVIEW',
      });
    }

    const review = await Review.create({
      reviewerId: req.user._id,
      reviewerName: req.user.name || 'Người dùng',
      reviewerRole: req.user.role,
      targetId: finalTargetId,
      storeName: finalStoreName,
      transactionType,
      transactionId,
      rating: numRating,
      comment: typeof comment === 'string' ? comment.trim() : '',
      tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
      criteria: validatedCriteria,
      type: 'given',
      status: 'published',
    });

    // Asynchronously recalculate target aggregate rating
    await syncAggregateRating(finalTargetId, transactionType);

    // Send notification to target user
    try {
      await Notification.create({
        userId: finalTargetId,
        title: transactionType === 'shift' ? 'Cửa hàng nhận được đánh giá mới ⭐' : 'Bạn nhận được đánh giá mới ⭐',
        message: `${req.user.name || 'Một thành viên'} đã đánh giá ${transactionType === 'shift' ? 'cửa hàng' : 'bạn'} ${numRating} sao${comment?.trim() ? `: "${comment.trim().slice(0, 80)}..."` : '.'}`,
        type: 'system',
        link: transactionType === 'shift' ? '/employer/profile' : (req.user.role === 'student' ? '/employer/profile' : '/student/reviews'),
      });
    } catch (notifErr) {
      console.warn('Failed to send review notification:', notifErr.message);
    }

    res.status(201).json({
      message: 'Gửi đánh giá thành công!',
      review: { ...review.toObject(), id: review._id },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        error: 'Bạn đã gửi đánh giá cho giao dịch này rồi.',
        code: 'DUPLICATE_REVIEW',
      });
    }
    next(err);
  }
});

export default router;
