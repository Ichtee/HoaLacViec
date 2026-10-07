import express from 'express';
import mongoose from 'mongoose';
import { QuickShift } from '../models/QuickShift.js';
import { Shift, parseVietnamDateTime } from '../models/Shift.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { Notification } from '../models/Notification.js';
import { authenticate, authorize, requireActiveUser } from '../middlewares/auth.js';
import { LABOR_ROLES } from '../utils/applicationDto.js';

const router = express.Router();

const MAX_DAYS_AHEAD = 7;
const MIN_WITHDRAW_LEAD_MS = 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function toPublicDTO(doc, viewerId) {
  const claims = doc.claims || [];
  return {
    id: doc._id,
    _id: doc._id,
    employerUserId: doc.employerUserId,
    storeName: doc.storeName,
    title: doc.title,
    description: doc.description,
    address: doc.address,
    location: doc.location,
    date: doc.date,
    startTime: doc.startTime,
    endTime: doc.endTime,
    startAt: doc.startAt,
    endAt: doc.endAt,
    headcount: doc.headcount,
    claimedCount: claims.length,
    remaining: Math.max(0, doc.headcount - claims.length),
    wageRate: doc.wageRate,
    status: doc.status,
    claimedByMe: Boolean(viewerId && claims.some((c) => String(c.userId) === String(viewerId))),
  };
}

async function notify(data) {
  try {
    await Notification.create(data);
  } catch (err) {
    console.warn('[quick-shifts] notification failed:', err.message);
  }
}

// GET /api/quick-shifts - ca lẻ đang mở, sắp diễn ra (cần đăng nhập để tránh lộ dữ liệu cửa hàng)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const rows = await QuickShift.find({ status: 'open', startAt: { $gt: new Date() } })
      .sort({ startAt: 1 })
      .limit(100)
      .lean();
    res.json(rows.map((row) => toPublicDTO(row, req.user._id)));
  } catch (err) {
    next(err);
  }
});

// GET /api/quick-shifts/mine
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    if (req.user.role === 'employer') {
      const rows = await QuickShift.find({ employerUserId: req.user._id }).sort({ startAt: -1 }).limit(100).lean();
      return res.json(rows.map((row) => ({ ...toPublicDTO(row, req.user._id), claims: row.claims })));
    }
    if (LABOR_ROLES.includes(req.user.role)) {
      const rows = await QuickShift.find({ 'claims.userId': req.user._id }).sort({ startAt: -1 }).limit(100).lean();
      return res.json(rows.map((row) => toPublicDTO(row, req.user._id)));
    }
    return res.status(403).json({ error: 'Không có quyền truy cập.', code: 'FORBIDDEN' });
  } catch (err) {
    next(err);
  }
});

// POST /api/quick-shifts - cửa hàng đã xác minh đăng ca lẻ (hiển thị ngay, không qua duyệt)
router.post('/', authenticate, authorize('employer'), requireActiveUser, async (req, res, next) => {
  try {
    const profile = await EmployerProfile.findOne({ userId: req.user._id });
    if (!profile?.verified) {
      throw httpError(403, 'EMPLOYER_NOT_VERIFIED', 'Hãy xác minh nhà tuyển dụng trước khi đăng ca lẻ.');
    }

    const { title, description, date, startTime, endTime, headcount, wageRate, address } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      throw httpError(400, 'INVALID_TITLE', 'Vui lòng nhập tên vị trí cần người.');
    }
    if (!DATE_RE.test(String(date)) || !TIME_RE.test(String(startTime)) || !TIME_RE.test(String(endTime))) {
      throw httpError(400, 'INVALID_TIME', 'Ngày hoặc giờ ca làm không hợp lệ.');
    }
    const people = Number(headcount);
    const wage = Number(wageRate);
    if (!Number.isInteger(people) || people < 1 || people > 20) {
      throw httpError(400, 'INVALID_HEADCOUNT', 'Số người cần tuyển phải từ 1 đến 20.');
    }
    if (!Number.isFinite(wage) || wage < 10000 || wage > 500000) {
      throw httpError(400, 'INVALID_WAGE', 'Mức lương theo giờ phải từ 10.000đ đến 500.000đ.');
    }

    const startAt = parseVietnamDateTime(date, startTime, false);
    const endAt = parseVietnamDateTime(date, endTime, endTime <= startTime);
    const now = Date.now();
    if (!startAt || Number.isNaN(startAt.getTime()) || startAt.getTime() <= now) {
      throw httpError(400, 'PAST_SHIFT', 'Ca làm phải bắt đầu trong tương lai.');
    }
    if (startAt.getTime() > now + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) {
      throw httpError(400, 'TOO_FAR', `Chỉ đăng ca lẻ trong vòng ${MAX_DAYS_AHEAD} ngày tới.`);
    }
    if (endAt.getTime() - startAt.getTime() > 12 * 60 * 60 * 1000) {
      throw httpError(400, 'SHIFT_TOO_LONG', 'Một ca không được dài quá 12 giờ.');
    }

    const created = await QuickShift.create({
      employerUserId: req.user._id,
      storeName: profile.storeName,
      title: title.trim(),
      description: typeof description === 'string' ? description.trim().slice(0, 1000) : '',
      address: typeof address === 'string' && address.trim() ? address.trim() : profile.address || '',
      location: profile.location?.lat != null ? { lat: profile.location.lat, lng: profile.location.lng } : undefined,
      date,
      startTime,
      endTime,
      startAt,
      endAt,
      headcount: people,
      wageRate: wage,
    });
    res.status(201).json(toPublicDTO(created.toObject ? created.toObject() : created, req.user._id));
  } catch (err) {
    next(err);
  }
});

// POST /api/quick-shifts/:id/claim - nhận ca (đến trước được trước, cập nhật nguyên tử)
router.post('/:id/claim', authenticate, requireActiveUser, async (req, res, next) => {
  try {
    if (!LABOR_ROLES.includes(req.user.role)) {
      throw httpError(403, 'FORBIDDEN', 'Chỉ tài khoản người tìm việc mới có thể nhận ca.');
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw httpError(400, 'INVALID_ID', 'Mã ca không hợp lệ.');
    }

    const quick = await QuickShift.findById(req.params.id).lean();
    if (!quick) throw httpError(404, 'NOT_FOUND', 'Không tìm thấy ca lẻ.');
    if (String(quick.employerUserId) === String(req.user._id)) {
      throw httpError(400, 'SELF_CLAIM', 'Bạn không thể nhận ca do chính mình đăng.');
    }

    const overlap = await Shift.findOne({
      $or: [{ studentUserId: req.user._id }, { employeeUserId: req.user._id }],
      scheduleStatus: { $ne: 'cancelled' },
      startAt: { $lt: quick.endAt },
      endAt: { $gt: quick.startAt },
    }).lean();
    if (overlap) {
      throw httpError(409, 'SHIFT_CONFLICT', 'Bạn đã có ca làm trùng giờ với ca này.');
    }

    const now = new Date();
    const claim = {
      userId: req.user._id,
      name: req.user.name || '',
      phone: req.user.phone || '',
      claimedAt: now,
    };
    const updated = await QuickShift.findOneAndUpdate(
      {
        _id: quick._id,
        status: 'open',
        startAt: { $gt: now },
        'claims.userId': { $ne: req.user._id },
        $expr: { $lt: [{ $size: '$claims' }, '$headcount'] },
      },
      { $push: { claims: claim } },
      { new: true }
    );
    if (!updated) {
      throw httpError(409, 'CLAIM_UNAVAILABLE', 'Ca này đã đủ người, đã bắt đầu hoặc bạn đã nhận rồi.');
    }

    let shift;
    try {
      shift = await Shift.create({
        employerUserId: quick.employerUserId,
        studentUserId: req.user._id,
        studentName: req.user.name || '',
        studentPhone: req.user.phone || '',
        storeName: quick.storeName,
        role: quick.title,
        positionTitle: quick.title,
        date: quick.date,
        startTime: quick.startTime,
        endTime: quick.endTime,
        startAt: quick.startAt,
        endAt: quick.endAt,
        wageRate: quick.wageRate,
        scheduleStatus: 'published',
        assignmentStatus: 'accepted',
        publishedAt: now,
        quickShiftId: quick._id,
      });
    } catch (err) {
      await QuickShift.updateOne({ _id: quick._id }, { $pull: { claims: { userId: req.user._id } } });
      throw err;
    }

    await QuickShift.updateOne(
      { _id: quick._id, 'claims.userId': req.user._id },
      { $set: { 'claims.$.shiftId': shift._id } }
    );
    if (updated.claims.length >= updated.headcount) {
      await QuickShift.updateOne({ _id: quick._id, status: 'open' }, { $set: { status: 'filled' } });
    }

    await notify({
      userId: quick.employerUserId,
      title: 'Có người nhận ca lẻ ⚡',
      message: `${req.user.name || 'Một ứng viên'} đã nhận ca "${quick.title}" ngày ${quick.date} (${quick.startTime}–${quick.endTime}).`,
      type: 'shift',
      link: '/employer/quick-shifts',
    });

    res.status(201).json({
      message: 'Nhận ca thành công! Ca đã được thêm vào lịch làm việc của bạn.',
      shiftId: shift._id,
      quickShift: toPublicDTO(updated.toObject ? updated.toObject() : updated, req.user._id),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/quick-shifts/:id/withdraw - người lao động trả ca (trước giờ bắt đầu ít nhất 1 giờ)
router.post('/:id/withdraw', authenticate, requireActiveUser, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw httpError(400, 'INVALID_ID', 'Mã ca không hợp lệ.');
    }
    const quick = await QuickShift.findById(req.params.id).lean();
    const claim = quick?.claims?.find((c) => String(c.userId) === String(req.user._id));
    if (!quick || !claim) throw httpError(404, 'NOT_FOUND', 'Bạn chưa nhận ca này.');
    if (new Date(quick.startAt).getTime() - Date.now() < MIN_WITHDRAW_LEAD_MS) {
      throw httpError(409, 'TOO_LATE', 'Chỉ có thể trả ca trước giờ bắt đầu ít nhất 1 giờ.');
    }

    const pulled = await QuickShift.findOneAndUpdate(
      { _id: quick._id, 'claims.userId': req.user._id },
      { $pull: { claims: { userId: req.user._id } } },
      { new: true }
    );
    if (!pulled) throw httpError(409, 'ALREADY_WITHDRAWN', 'Bạn đã trả ca này.');
    if (claim.shiftId) {
      await Shift.updateOne(
        { _id: claim.shiftId, attendanceStatus: 'not_started' },
        { $set: { scheduleStatus: 'cancelled', status: 'cancelled' } }
      );
    }
    await QuickShift.updateOne({ _id: quick._id, status: 'filled' }, { $set: { status: 'open' } });

    await notify({
      userId: quick.employerUserId,
      title: 'Một nhân viên đã trả ca lẻ',
      message: `${req.user.name || 'Nhân viên'} đã trả ca "${quick.title}" ngày ${quick.date}. Ca đã mở lại cho người khác nhận.`,
      type: 'shift',
      link: '/employer/quick-shifts',
    });
    res.json({ message: 'Đã trả ca.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/quick-shifts/:id/cancel - cửa hàng huỷ ca lẻ
router.post('/:id/cancel', authenticate, authorize('employer'), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw httpError(400, 'INVALID_ID', 'Mã ca không hợp lệ.');
    }
    const quick = await QuickShift.findOneAndUpdate(
      { _id: req.params.id, employerUserId: req.user._id, status: { $in: ['open', 'filled'] } },
      { $set: { status: 'cancelled' } },
      { new: true }
    );
    if (!quick) throw httpError(404, 'NOT_FOUND', 'Không tìm thấy ca lẻ hoặc ca không thể huỷ.');

    const shiftIds = quick.claims.map((c) => c.shiftId).filter(Boolean);
    if (shiftIds.length) {
      await Shift.updateMany(
        { _id: { $in: shiftIds }, attendanceStatus: 'not_started' },
        { $set: { scheduleStatus: 'cancelled', status: 'cancelled' } }
      );
    }
    for (const claim of quick.claims) {
      await notify({
        userId: claim.userId,
        title: 'Ca lẻ đã bị huỷ',
        message: `Cửa hàng ${quick.storeName} đã huỷ ca "${quick.title}" ngày ${quick.date}.`,
        type: 'shift',
        link: '/student/shifts',
      });
    }
    res.json({ message: 'Đã huỷ ca lẻ.' });
  } catch (err) {
    next(err);
  }
});

export default router;
