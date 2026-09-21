import express from 'express';
import { Review } from '../models/Review.js';
import { User } from '../models/User.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// GET /api/reviews
// Query by targetId (user received reviews) or reviewerId (reviews given) or studentId
router.get('/', async (req, res) => {
  try {
    const { targetId, reviewerId, studentId, storeId } = req.query;
    const filter = {};

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

    const formatted = reviews.map(r => {
      const isGiven = studentId && r.reviewerId && r.reviewerId.toString() === studentId.toString();
      return {
        ...r,
        id: r._id,
        date: r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : '10/09/2026',
        authorName: r.reviewerName || 'Quản lý cửa hàng',
        storeName: r.storeName || 'Cửa hàng đối tác Hòa Lạc',
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
    const { targetId, rating, comment, tags, storeName } = req.body;

    if (!targetId || !rating || !comment) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đối tượng đánh giá, số sao và nhận xét.' });
    }

    if (targetId.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Bạn không thể tự đánh giá chính mình.' });
    }

    const review = await Review.create({
      reviewerId: req.user._id,
      reviewerName: req.user.name || 'Thành viên',
      reviewerRole: req.user.role || 'student',
      targetId,
      rating: Math.min(5, Math.max(1, Number(rating))),
      comment: comment.trim(),
      tags: Array.isArray(tags) ? tags : [],
      storeName: storeName || '',
    });

    res.status(201).json(review);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

