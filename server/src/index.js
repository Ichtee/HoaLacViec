import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';

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

// Connect to MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      (origin && (origin.endsWith('.vercel.app') || origin.endsWith('.onrender.com'))) ||
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 attempts per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Quá nhiều yêu cầu đăng nhập/đăng ký. Vui lòng thử lại sau 15 phút.' },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600, // 600 requests per 15 mins per IP
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/google', authLimiter);

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(morgan('dev'));

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
    // Ưu tiên các trường trọng điểm khu vực Hòa Lạc và Hà Nội
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

// Centralized error handling middleware
app.use((err, req, res, next) => {
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({ error: err.message });
  }
  console.error('[Server Error]', err);
  const status = err.status || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' && status === 500
      ? 'Đã xảy ra sự cố nội bộ trên máy chủ.'
      : err.message || 'Lỗi hệ thống máy chủ',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Express] Server running on port ${PORT}`);
});

