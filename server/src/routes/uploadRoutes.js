import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { persistImage } from '../services/imageStorageService.js';

const router = express.Router();
const FOLDERS = ['jobs', 'blogs', 'store'];

// POST /api/uploads/image  { image: "data:image/...;base64,...", folder }
// Trả về URL ảnh đã lưu (Cloudinary nếu có cấu hình, nếu không giữ nguyên data URI như các luồng xác minh).
router.post('/image', authenticate, async (req, res, next) => {
  try {
    const { image, folder } = req.body || {};
    if (typeof image !== 'string' || !image.startsWith('data:')) {
      return res.status(400).json({ error: 'Thiếu dữ liệu ảnh.', code: 'INVALID_IMAGE' });
    }
    const url = await persistImage(image, { folder: FOLDERS.includes(folder) ? folder : 'jobs' });
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

export default router;
