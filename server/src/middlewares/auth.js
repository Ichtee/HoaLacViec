import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

/**
 * Authentication middleware
 * Verifies JWT from Authorization: Bearer <token>
 * Loads user from database and verifies account status
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Yêu cầu đăng nhập để thực hiện thao tác này.',
        code: 'UNAUTHORIZED',
      });
    }

    const token = authHeader.split(' ')[1];
    if (!process.env.JWT_SECRET) {
      console.error('[FATAL] JWT_SECRET is not configured!');
      return res.status(500).json({ error: 'Cấu hình bảo mật máy chủ bị lỗi.', code: 'CONFIG_ERROR' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
        code: 'INVALID_TOKEN',
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        error: 'Tài khoản liên kết không tồn tại trong hệ thống.',
        code: 'USER_NOT_FOUND',
      });
    }

    if (user.status === 'locked' || user.status === 'suspended') {
      return res.status(403).json({
        error: 'Tài khoản của bạn đã bị khóa hoặc tạm ngưng hoạt động.',
        code: 'ACCOUNT_LOCKED',
      });
    }

    if (user.status === 'deleted') {
      return res.status(401).json({
        error: 'Tài khoản này đã bị xóa.',
        code: 'ACCOUNT_DELETED',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Role-based authorization middleware
 * @param  {...string} roles Allowed roles ('admin', 'employer', 'student')
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Chưa xác thực người dùng.',
        code: 'UNAUTHORIZED',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Bạn không có quyền thực hiện thao tác này.',
        code: 'FORBIDDEN',
      });
    }

    next();
  };
}

/**
 * Optional authentication middleware
 * Attaches user to req.user if a valid token is provided; otherwise proceeds as guest
 */
export async function optionalAuthenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    if (!process.env.JWT_SECRET) {
      req.user = null;
      return next();
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      req.user = null;
      return next();
    }

    const user = await User.findById(decoded.id);
    if (!user || user.status === 'locked' || user.status === 'suspended' || user.status === 'deleted') {
      req.user = null;
      return next();
    }

    req.user = user;
    next();
  } catch (err) {
    req.user = null;
    next();
  }
}

/**
 * Ensures user is active before accessing core business endpoints
 * (pending/locked users can only access profile setup & verification endpoints)
 */
export function requireActiveUser(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Yêu cầu đăng nhập để thực hiện thao tác này.',
      code: 'UNAUTHORIZED',
    });
  }

  // Admins always bypass status restriction
  if (req.user.role === 'admin') {
    return next();
  }

  if (req.user.status !== 'active') {
    return res.status(403).json({
      error: 'Tài khoản chưa hoàn tất kích hoạt hoặc chưa được phê duyệt để thực hiện thao tác này.',
      code: 'ACCOUNT_NOT_ACTIVE',
      status: req.user.status,
    });
  }

  next();
}

