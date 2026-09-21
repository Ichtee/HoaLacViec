import express from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

function createToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Cấu hình bảo mật JWT_SECRET bị thiếu trên máy chủ.');
  }
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email, name: user.name },
    secret,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        error: 'Vui lòng cung cấp đầy đủ email và mật khẩu.',
        code: 'MISSING_FIELDS',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    // Anti-enumeration: Return generic error if user not found or password does not match
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        error: 'Email hoặc mật khẩu không chính xác.',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Account status validation
    if (user.status === 'locked' || user.status === 'suspended') {
      return res.status(403).json({
        error: 'Tài khoản của bạn đang bị tạm khóa hoặc đình chỉ hoạt động.',
        code: 'ACCOUNT_LOCKED',
      });
    }

    if (user.status === 'deleted') {
      return res.status(401).json({
        error: 'Tài khoản này đã bị xóa khỏi hệ thống.',
        code: 'ACCOUNT_DELETED',
      });
    }

    let profile = null;
    if (user.role === 'student') {
      profile = await StudentProfile.findOne({ userId: user._id });
    } else if (user.role === 'employer') {
      profile = await EmployerProfile.findOne({ userId: user._id });
    }

    const token = createToken(user);
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar,
        status: user.status,
        profileId: profile?._id || null,
        profile,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role, phone, university, storeName, address } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'Họ tên, email và mật khẩu là bắt buộc.',
        code: 'MISSING_FIELDS',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Mật khẩu phải có độ dài tối thiểu 6 ký tự.',
        code: 'WEAK_PASSWORD',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({
        error: 'Email này đã được sử dụng trong hệ thống.',
        code: 'EMAIL_EXISTS',
      });
    }

    // SECURITY: Disallow public registration as admin
    const allowedRole = role === 'employer' ? 'employer' : 'student';

    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: allowedRole,
      phone: phone ? phone.trim() : '',
      status: 'active',
    });

    let profile = null;
    if (newUser.role === 'student') {
      profile = await StudentProfile.create({
        userId: newUser._id,
        university: university || 'Đại học FPT Hòa Lạc',
        studentCode: 'HE' + Math.floor(100000 + Math.random() * 900000),
      });
    } else if (newUser.role === 'employer') {
      profile = await EmployerProfile.create({
        userId: newUser._id,
        storeName: storeName || name.trim(),
        address: address || 'Khu CNC Hòa Lạc',
        contactPhone: phone ? phone.trim() : '',
      });
    }

    const token = createToken(newUser);
    res.status(201).json({
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        phone: newUser.phone,
        status: newUser.status,
        profileId: profile?._id || null,
        profile,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me (Protected)
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = req.user;
    let profile = null;
    if (user.role === 'student') {
      profile = await StudentProfile.findOne({ userId: user._id });
    } else if (user.role === 'employer') {
      profile = await EmployerProfile.findOne({ userId: user._id });
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      avatar: user.avatar,
      status: user.status,
      profileId: profile?._id || null,
      profile,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/change-password (Protected)
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        error: 'Vui lòng nhập mật khẩu cũ và mật khẩu mới.',
        code: 'MISSING_FIELDS',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'Mật khẩu mới phải có tối thiểu 6 ký tự.',
        code: 'WEAK_PASSWORD',
      });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({
        error: 'Mật khẩu cũ không chính xác.',
        code: 'INVALID_PASSWORD',
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Đổi mật khẩu thành công.', code: 'PASSWORD_CHANGED' });
  } catch (err) {
    next(err);
  }
});

export default router;
