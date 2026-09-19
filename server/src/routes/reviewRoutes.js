import express from 'express';
import { Review } from '../models/Review.js';
import { User } from '../models/User.js';

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

// POST /api/reviews
router.post('/', async (req, res) => {
  try {
    const { reviewerId, reviewerName, reviewerRole, targetId, rating, comment } = req.body;

    if (!reviewerId || !targetId || !rating || !comment) {
      return res.status(400).json({ error: 'Thiếu thông tin đánh giá bắt buộc' });
    }

    const review = await Review.create({
      reviewerId,
      reviewerName: reviewerName || 'Thành viên',
      reviewerRole: reviewerRole || 'student',
      targetId,
      rating: Number(rating),
      comment: comment.trim(),
    });

    res.status(201).json(review);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

