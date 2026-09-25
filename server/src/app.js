import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import authRoutes from './routes/authRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import blogRoutes from './routes/blogRoutes.js';
import applicationRoutes from './routes/applicationRoutes.js';
import shiftRoutes from './routes/shiftRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import savedJobRoutes from './routes/savedJobRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import reportRoutes from './routes/reportRoutes.js';

dotenv.config();

// Fail fast if JWT_SECRET is missing in production or development
if (!process.env.JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET is not configured! Halting server startup.');
  process.exit(1);
}

const app = express();

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Precise CORS origin whitelist from environment
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

if (process.env.FRONTEND_URL && !allowedOrigins.includes(process.env.FRONTEND_URL.trim())) {
  allowedOrigins.push(process.env.FRONTEND_URL.trim());
}

if (process.env.NODE_ENV !== 'production') {
  ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'].forEach(o => {
    if (!allowedOrigins.includes(o)) allowedOrigins.push(o);
  });
}

app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.onrender.com') ||
      process.env.NODE_ENV !== 'production'
    ) {
      return callback(null, true);
    }
    return callback(new Error('Chặn truy cập bởi chính sách CORS'));
  },
  credentials: true,
}));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Quá nhiều yêu cầu đăng nhập/đăng ký. Vui lòng thử lại sau 15 phút.', code: 'RATE_LIMIT_EXCEEDED' },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/google', authLimiter);

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/saved-jobs', savedJobRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);

// GET /api/universities (Lấy danh sách các trường đại học tại Việt Nam từ Hipolabs)
let cachedUniversities = null;
let lastFetchTime = 0;

app.get('/api/universities', async (req, res) => {
  const now = Date.now();
  if (cachedUniversities && (now - lastFetchTime < 24 * 60 * 60 * 1000)) {
    return res.json(cachedUniversities);
  }

  try {
    const [res1, res2] = await Promise.allSettled([
      fetch('http://universities.hipolabs.com/search?country=Vietnam'),
      fetch('http://universities.hipolabs.com/search?country=Viet%20Nam'),
    ]);

    const data1 = res1.status === 'fulfilled' ? await res1.value.json().catch(() => []) : [];
    const data2 = res2.status === 'fulfilled' ? await res2.value.json().catch(() => []) : [];

    const map = new Map();
    const priorityList = [
      { name: 'Đại học FPT Hòa Lạc (FPT University)', domain: 'fpt.edu.vn' },
      { name: 'Đại học Quốc gia Hà Nội - Hòa Lạc (VNU Hanoi)', domain: 'vnu.edu.vn' },
      { name: 'ĐH Công nghệ - ĐHQGHN (VNU-UET)', domain: 'uet.vnu.edu.vn' },
      { name: 'Đại học Bách Khoa Hà Nội (HUST)', domain: 'hust.edu.vn' },
    ];
    priorityList.forEach((item) => map.set(item.name.toLowerCase(), item));

    [...data1, ...data2].forEach((item) => {
      if (item && item.name) {
        const key = item.name.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            name: item.name.trim(),
            domain: item.domains?.[0] || '',
            web_page: item.web_pages?.[0] || '',
          });
        }
      }
    });

    cachedUniversities = Array.from(map.values());
    lastFetchTime = now;
    res.json(cachedUniversities);
  } catch (err) {
    if (cachedUniversities) return res.json(cachedUniversities);
    res.status(500).json({ error: 'Không thể tải danh sách trường đại học' });
  }
});

// Root & Health check
app.get('/', (req, res) => {
  res.json({
    name: 'Hoa Lac Viec Backend API',
    status: 'online',
    version: '1.0.0',
    health: '/api/health',
  });
});

app.get('/api/health', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  res.status(isDbConnected ? 200 : 503).json({
    status: isDbConnected ? 'ok' : 'degraded',
    service: 'Hoa Lac Viec Backend API',
    time: new Date().toISOString(),
    database: isDbConnected ? 'MongoDB Connected' : 'MongoDB Disconnected',
  });
});

// Centralized error handling middleware with sanitized errors (no mongo stack leaks)
app.use((err, req, res, next) => {
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({ error: err.message, code: 'CORS_ERROR' });
  }

  // Handle Mongoose Validation Errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      error: messages.join(', ') || 'Dữ liệu không hợp lệ.',
      code: 'VALIDATION_ERROR',
    });
  }

  // Handle Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: `Định dạng ${err.path} không hợp lệ.`,
      code: 'INVALID_ID',
    });
  }

  // Handle Mongo Duplicate Key Error (E11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'dữ liệu';
    return res.status(409).json({
      error: `Giá trị ${field} đã tồn tại trong hệ thống.`,
      code: 'DUPLICATE_KEY',
    });
  }

  if (process.env.NODE_ENV !== 'test') {
    console.error('[Server Error]', err);
  }

  const status = typeof err.status === 'number' ? err.status : 500;
  res.status(status).json({
    error: status === 500 && process.env.NODE_ENV === 'production'
      ? 'Đã xảy ra sự cố nội bộ trên máy chủ.'
      : err.message || 'Lỗi hệ thống máy chủ',
    code: err.code || 'SERVER_ERROR',
  });
});

export default app;
export { app };
