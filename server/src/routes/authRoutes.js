import express from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { User } from '../models/User.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

let oauthClient = null;
function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return null;
  if (!oauthClient) {
    oauthClient = new OAuth2Client(clientId);
  }
  return oauthClient;
}

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

async function buildAuthResponse(user) {
  let profile = null;
  if (user.role === 'student') {
    profile = await StudentProfile.findOne({ userId: user._id });
  } else if (user.role === 'employer') {
    profile = await EmployerProfile.findOne({ userId: user._id });
  }

  const token = createToken(user);
  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      avatar: user.avatar,
      status: user.status,
      hasPassword: Boolean(user.password),
      isGoogleUser: Boolean(user.googleId),
      profileId: profile?._id || null,
      profile,
    },
  };
}

function checkUserAccountStatus(user, res) {
  if (user.status === 'locked' || user.status === 'suspended') {
    res.status(403).json({
      error: 'Tài khoản của bạn đang bị tạm khóa hoặc đình chỉ hoạt động.',
      code: 'ACCOUNT_LOCKED',
    });
    return false;
  }

  if (user.status === 'deleted') {
    res.status(401).json({
      error: 'Tài khoản này đã bị xóa khỏi hệ thống.',
      code: 'ACCOUNT_DELETED',
    });
    return false;
  }

  return true;
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

    if (typeof password !== 'string' || password.length < 6 || password.length > 32) {
      return res.status(400).json({
        error: 'Mật khẩu phải có độ dài từ 6 đến 32 ký tự.',
        code: 'INVALID_CREDENTIALS',
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

    const authRes = await buildAuthResponse(user);
    res.json(authRes);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/google
router.post('/google', async (req, res, next) => {
  try {
    const { credential } = req.body || {};
    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({
        error: 'Thiếu thông tin xác thực từ Google.',
        code: 'MISSING_GOOGLE_CREDENTIAL',
      });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({
        error: 'Dịch vụ Đăng nhập bằng Google chưa được cấu hình trên máy chủ.',
        code: 'CONFIG_ERROR',
      });
    }

    const client = getOAuthClient();
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
    } catch (err) {
      return res.status(401).json({
        error: 'Mã xác thực Google không hợp lệ hoặc đã hết hạn.',
        code: 'INVALID_GOOGLE_TOKEN',
      });
    }

    const payload = ticket?.getPayload();
    if (!payload || !payload.sub || !payload.email || payload.email_verified !== true) {
      return res.status(401).json({
        error: 'Mã xác thực Google không hợp lệ hoặc email chưa được xác thực.',
        code: 'INVALID_GOOGLE_TOKEN',
      });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec) {
      return res.status(401).json({
        error: 'Mã xác thực Google đã hết hạn.',
        code: 'INVALID_GOOGLE_TOKEN',
      });
    }

    const googleId = String(payload.sub).trim();
    const normalizedEmail = String(payload.email).toLowerCase().trim();

    // 1. Look up by googleId first
    let user = await User.findOne({ googleId });
    if (user) {
      if (!checkUserAccountStatus(user, res)) return;
      const authRes = await buildAuthResponse(user);
      return res.json(authRes);
    }

    // 2. Look up by email
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      if (existingUser.googleId && existingUser.googleId !== googleId) {
        return res.status(409).json({
          error: 'Tài khoản này đã được liên kết với một tài khoản Google khác.',
          code: 'ACCOUNT_CONFLICT',
        });
      }

      // Never automatically attach Google authentication to an existing admin account
      if (existingUser.role === 'admin') {
        return res.status(403).json({
          error: 'Tài khoản quản trị viên không được phép đăng nhập hoặc liên kết bằng Google.',
          code: 'ADMIN_GOOGLE_LOGIN_DISALLOWED',
        });
      }

      // Safe auto-link condition: Google must be authoritative for the email
      const isGmail = normalizedEmail.endsWith('@gmail.com');
      const isAuthoritativeDomain = payload.email_verified === true && Boolean(payload.hd);

      if (!isGmail && !isAuthoritativeDomain) {
        return res.status(409).json({
          error: 'Tài khoản đã tồn tại với email này. Vui lòng đăng nhập bằng mật khẩu của bạn để liên kết.',
          code: 'ACCOUNT_LINK_REQUIRED',
        });
      }

      // Safely link Google identity while preserving existing account details
      existingUser.googleId = googleId;
      if (!existingUser.emailVerifiedAt) {
        existingUser.emailVerifiedAt = new Date();
      }
      if (!existingUser.avatar && payload.picture) {
        existingUser.avatar = String(payload.picture).trim();
      }
      await existingUser.save();

      if (!checkUserAccountStatus(existingUser, res)) return;
      const authRes = await buildAuthResponse(existingUser);
      return res.json(authRes);
    }

    // 3. Completely new Google user (starts in pending role and status)
    const cleanName = (typeof payload.name === 'string' && payload.name.trim())
      ? payload.name.trim()
      : normalizedEmail.split('@')[0];

    try {
      user = await User.create({
        googleId,
        name: cleanName,
        email: normalizedEmail,
        avatar: typeof payload.picture === 'string' ? payload.picture.trim() : '',
        emailVerifiedAt: new Date(),
        status: 'pending',
        role: 'pending',
      });
    } catch (createErr) {
      // Handle potential duplicate-key race condition
      if (createErr.code === 11000) {
        user = await User.findOne({
          $or: [{ googleId }, { email: normalizedEmail }],
        });
        if (!user) {
          return res.status(409).json({
            error: 'Xung đột khi tạo tài khoản. Vui lòng thử lại.',
            code: 'ACCOUNT_CONFLICT',
          });
        }
      } else {
        throw createErr;
      }
    }

    if (!checkUserAccountStatus(user, res)) return;
    const authRes = await buildAuthResponse(user);
    return res.status(201).json(authRes);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'Họ tên, email và mật khẩu là bắt buộc.',
        code: 'MISSING_FIELDS',
      });
    }

    if (typeof password !== 'string' || password.length < 6 || password.length > 32) {
      return res.status(400).json({
        error: 'Mật khẩu phải có độ dài từ 6 đến 32 ký tự.',
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

    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: 'pending',
      phone: phone ? phone.trim() : '',
      status: 'pending',
    });

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
        profileId: null,
        profile: null,
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
      hasPassword: Boolean(user.password),
      isGoogleUser: Boolean(user.googleId),
      profileId: profile?._id || null,
      profile,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/profile (Cập nhật thông tin cá nhân cơ bản: họ tên, SĐT, avatar)
router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const { name, phone, avatar } = req.body;
    const updates = {};

    if (typeof name === 'string' && name.trim()) {
      if (name.trim().length < 2) {
        return res.status(400).json({ error: 'Họ và tên phải có ít nhất 2 ký tự.' });
      }
      updates.name = name.trim();
    }

    if (typeof phone === 'string') {
      updates.phone = phone.trim();
    }

    if (typeof avatar === 'string') {
      updates.avatar = avatar.trim();
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true }
    );

    let profile = null;
    if (updatedUser.role === 'student') {
      profile = await StudentProfile.findOne({ userId: updatedUser._id });
    } else if (updatedUser.role === 'employer') {
      profile = await EmployerProfile.findOne({ userId: updatedUser._id });
    }

    res.json({
      message: 'Cập nhật thông tin cá nhân thành công!',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        phone: updatedUser.phone,
        avatar: updatedUser.avatar,
        status: updatedUser.status,
        hasPassword: Boolean(updatedUser.password),
        profileId: profile?._id || null,
        profile,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/change-password (Protected)
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 32) {
      return res.status(400).json({
        error: 'Mật khẩu mới phải có độ dài từ 6 đến 32 ký tự.',
        code: 'WEAK_PASSWORD',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng.', code: 'USER_NOT_FOUND' });
    }

    const hasPassword = Boolean(user.password);

    // Nếu tài khoản đã có mật khẩu, yêu cầu kiểm tra mật khẩu cũ
    if (hasPassword) {
      if (!oldPassword) {
        return res.status(400).json({
          error: 'Vui lòng nhập mật khẩu hiện tại của bạn.',
          code: 'MISSING_FIELDS',
        });
      }

      const isMatch = await user.comparePassword(oldPassword);
      if (!isMatch) {
        return res.status(400).json({
          error: 'Mật khẩu hiện tại không chính xác.',
          code: 'INVALID_PASSWORD',
        });
      }
    }

    // Cập nhật mật khẩu mới (Mongoose pre-save hook sẽ tự động bcrypt hash)
    user.password = newPassword;
    await user.save();

    res.json({
      message: hasPassword ? 'Đổi mật khẩu thành công!' : 'Thiết lập mật khẩu thành công!',
      code: 'PASSWORD_CHANGED',
      hasPassword: true,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
