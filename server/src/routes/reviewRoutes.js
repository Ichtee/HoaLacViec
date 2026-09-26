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

// Helper to recalculate and sync aggregate rating for user profile
async function syncAggregateRating(targetUserId) {
  try {
    const stats = await Review.aggregate([
      { $match: { targetId: new mongoose.Types.ObjectId(targetUserId), status: 'published' } },
      {
        $group: {
          _id: '$targetId',
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    if (stats.length > 0) {
      const avg = Number(stats[0].averageRating.toFixed(1));
      const total = stats[0].totalReviews;

      await StudentProfile.findOneAndUpdate(
        { userId: targetUserId },
        { $set: { reputationScore: avg, reputationCount: total } }
      );
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
    const { targetId, reviewerId, studentId, storeId } = req.query;
    const filter = { status: 'published' };

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
        type: r.type || (isGiven ? 'given' : 'received'),
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
    } = req.body;

    if (!rating || !comment) {
      return res.status(400).json({
        error: 'Vui lòng cung cấp số sao và nhận xét.',
        code: 'MISSING_FIELDS',
      });
    }

    const numRating = Math.min(5, Math.max(1, Number(rating)));
    if (isNaN(numRating)) {
      return res.status(400).json({ error: 'Số sao đánh giá phải từ 1 đến 5.', code: 'INVALID_RATING' });
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

    if (transactionType === 'shift') {
      const shift = await Shift.findById(transactionId);
      if (!shift) {
        return res.status(404).json({ error: 'Không tìm thấy ca làm việc liên quan.', code: 'TRANSACTION_NOT_FOUND' });
      }

      if (!['approved', 'completed'].includes(shift.status)) {
        return res.status(400).json({
          error: 'Chỉ có thể đánh giá sau khi ca làm việc đã được duyệt hoàn thành.',
          code: 'SHIFT_NOT_COMPLETED',
        });
      }

      const isStudentParticipant =
        (shift.studentUserId && shift.studentUserId.toString() === req.user._id.toString()) ||
        (shift.studentId && shift.studentId.toString() === req.user._id.toString());

      const isEmployerParticipant =
        (shift.employerUserId && shift.employerUserId.toString() === req.user._id.toString()) ||
        (shift.employerId && shift.employerId.toString() === req.user._id.toString());

      if (!isStudentParticipant && !isEmployerParticipant && req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Bạn không phải là người tham gia trong ca làm việc này.',
          code: 'FORBIDDEN',
        });
      }

      finalStoreName = shift.storeName || finalStoreName;
      if (!finalTargetId) {
        finalTargetId = isStudentParticipant
          ? (shift.employerUserId || shift.employerId)
          : (shift.studentUserId || shift.studentId);
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
      comment: comment.trim(),
      tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
      status: 'published',
    });

    // Asynchronously recalculate target aggregate rating
    await syncAggregateRating(finalTargetId);

    // Send notification to target user
    try {
      await Notification.create({
        userId: finalTargetId,
        title: 'Bạn nhận được đánh giá mới ⭐',
        message: `${req.user.name || 'Một thành viên'} đã đánh giá bạn ${numRating} sao: "${comment.trim().slice(0, 80)}..."`,
        type: 'system',
        link: req.user.role === 'student' ? '/employer/reviews' : '/student/reviews',
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
