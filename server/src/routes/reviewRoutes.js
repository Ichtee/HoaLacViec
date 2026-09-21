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
        { rating: avg, reviewCount: total }
      );
      await EmployerProfile.findOneAndUpdate(
        { userId: targetUserId },
        { rating: avg, reviewCount: total }
      );
    }
  } catch (err) {
    console.warn('Sync aggregate rating error:', err.message);
  }
}

// GET /api/reviews
router.get('/', async (req, res) => {
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
        storeName: r.storeName || 'Cửa hàng đối tác',
        type: r.type || (isGiven ? 'given' : 'received'),
        tags: r.tags && r.tags.length > 0 ? r.tags : ['Đúng giờ', 'Chăm chỉ', 'Thân thiện'],
      };
    });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reviews (Authenticated)
router.post('/', authenticate, async (req, res) => {
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

    if (!targetId || !rating || !comment) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đối tượng đánh giá, số sao và nhận xét.' });
    }

    // Anti self-review
    if (targetId.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Bạn không thể tự đánh giá chính mình.' });
    }

    const numRating = Math.min(5, Math.max(1, Number(rating)));
    if (isNaN(numRating)) {
      return res.status(400).json({ error: 'Số sao đánh giá phải từ 1 đến 5.' });
    }

    // Verify transaction if provided
    if (transactionId) {
      if (transactionType === 'shift') {
        const shift = await Shift.findById(transactionId);
        if (!shift) {
          return res.status(404).json({ error: 'Không tìm thấy ca làm việc để đánh giá.' });
        }
        if (shift.status !== 'approved' && shift.status !== 'completed') {
          return res.status(400).json({ error: 'Chỉ có thể đánh giá sau khi ca làm đã hoàn tất và được duyệt công.' });
        }
      } else if (transactionType === 'task') {
        const task = await MicroTask.findById(transactionId);
        if (!task) {
          return res.status(404).json({ error: 'Không tìm thấy việc vặt để đánh giá.' });
        }
        if (task.status !== 'completed') {
          return res.status(400).json({ error: 'Chỉ có thể đánh giá sau khi việc vặt đã được xác nhận hoàn thành.' });
        }
      }

      // Check duplicate review
      const existing = await Review.findOne({
        reviewerId: req.user._id,
        transactionId,
      });
      if (existing) {
        return res.status(409).json({ error: 'Bạn đã gửi đánh giá cho giao dịch / ca làm này rồi.' });
      }
    }

    const review = await Review.create({
      reviewerId: req.user._id,
      reviewerName: req.user.name || 'Thành viên',
      reviewerRole: req.user.role || 'student',
      targetId,
      transactionType: transactionType || 'direct',
      transactionId: transactionId || null,
      rating: numRating,
      comment: comment.trim(),
      tags: Array.isArray(tags) ? tags : [],
      storeName: storeName || '',
      status: 'published',
    });

    // Update aggregate rating for target user
    syncAggregateRating(targetId);

    // Send notification to target user
    try {
      await Notification.create({
        userId: targetId,
        title: 'Bạn nhận được đánh giá mới ⭐',
        message: `${req.user.name || 'Một người dùng'} vừa đánh giá bạn ${numRating} sao: "${comment.slice(0, 80)}${comment.length > 80 ? '...' : ''}"`,
        type: 'review',
        link: req.user.role === 'student' ? '/employer/profile' : '/student/profile',
      });
    } catch (notifErr) {
      console.warn('Review notification error:', notifErr.message);
    }

    res.status(201).json({ ...review.toObject(), id: review._id });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Bạn đã gửi đánh giá cho ca làm hoặc việc vặt này rồi.' });
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
