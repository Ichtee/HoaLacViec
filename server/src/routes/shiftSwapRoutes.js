import express from 'express';
import mongoose from 'mongoose';
import { ShiftSwap, OPEN_SWAP_STATUSES } from '../models/ShiftSwap.js';
import { Shift } from '../models/Shift.js';
import { Employment } from '../models/Employment.js';
import { User } from '../models/User.js';
import { Notification } from '../models/Notification.js';
import { authenticate, authorize, requireActiveUser } from '../middlewares/auth.js';
import { validateShiftEligibilityAndConflict } from '../services/schedulingService.js';
import { LABOR_ROLES } from '../utils/applicationDto.js';

const router = express.Router();
router.use(authenticate, requireActiveUser);

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

const sameId = (a, b) => String(a?._id || a) === String(b?._id || b);

async function notify(userId, title, message, link) {
  try {
    await Notification.create({ userId, title, message, type: 'shift', link });
  } catch (err) {
    console.warn('[shift-swaps] notification failed:', err.message);
  }
}

function describeShift(shift) {
  return `${shift.date} (${shift.startTime}–${shift.endTime}) tại ${shift.storeName || 'cửa hàng'}`;
}

function assertLabor(user) {
  if (!LABOR_ROLES.includes(user.role)) {
    throw httpError(403, 'FORBIDDEN', 'Chỉ nhân viên mới có thể thực hiện thao tác này.');
  }
}

async function loadSwap(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw httpError(400, 'INVALID_ID', 'Mã đề nghị không hợp lệ.');
  const swap = await ShiftSwap.findById(id);
  if (!swap) throw httpError(404, 'NOT_FOUND', 'Không tìm thấy đề nghị đổi ca.');
  return swap;
}

// Chuyển trạng thái có điều kiện để hai thao tác đồng thời không ghi đè nhau
async function transition(swap, from, to, extra = {}) {
  const updated = await ShiftSwap.findOneAndUpdate(
    { _id: swap._id, status: from },
    { $set: { status: to, decidedAt: new Date(), ...extra } },
    { new: true }
  );
  if (!updated) throw httpError(409, 'INVALID_STATE', 'Đề nghị đã được xử lý hoặc không còn hiệu lực.');
  return updated;
}

// GET /api/shift-swaps - đề nghị liên quan đến tôi (người nhờ, đồng nghiệp hoặc cửa hàng)
router.get('/', async (req, res, next) => {
  try {
    const me = req.user._id;
    const filter = req.user.role === 'employer'
      ? { employerUserId: me }
      : { $or: [{ requesterUserId: me }, { targetUserId: me }] };
    const swaps = await ShiftSwap.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    const shifts = await Shift.find({ _id: { $in: swaps.map((s) => s.shiftId) } })
      .select('date startTime endTime storeName positionTitle').lean();
    const byId = new Map(shifts.map((s) => [String(s._id), s]));
    res.json(swaps.map((swap) => ({ ...swap, id: swap._id, shift: byId.get(String(swap.shiftId)) || null })));
  } catch (err) {
    next(err);
  }
});

// GET /api/shift-swaps/colleagues?shiftId= - đồng nghiệp có thể nhận ca
router.get('/colleagues', async (req, res, next) => {
  try {
    assertLabor(req.user);
    const { shiftId } = req.query;
    if (!mongoose.Types.ObjectId.isValid(shiftId)) throw httpError(400, 'INVALID_ID', 'Mã ca không hợp lệ.');
    const shift = await Shift.findById(shiftId).lean();
    if (!shift || !sameId(shift.studentUserId || shift.employeeUserId, req.user._id)) {
      throw httpError(404, 'NOT_FOUND', 'Không tìm thấy ca của bạn.');
    }
    const employments = await Employment.find({
      employerUserId: shift.employerUserId, status: 'active', employeeUserId: { $ne: req.user._id },
    }).populate('employeeUserId', 'name').lean();
    res.json(employments
      .filter((e) => e.employeeUserId)
      .map((e) => ({ userId: e.employeeUserId._id, name: e.employeeUserId.name || 'Nhân viên' })));
  } catch (err) {
    next(err);
  }
});

// POST /api/shift-swaps { shiftId, targetUserId, message }
router.post('/', async (req, res, next) => {
  try {
    assertLabor(req.user);
    const { shiftId, targetUserId, message = '' } = req.body;
    if (!mongoose.Types.ObjectId.isValid(shiftId) || !mongoose.Types.ObjectId.isValid(targetUserId)) {
      throw httpError(400, 'INVALID_ID', 'Thiếu mã ca hoặc đồng nghiệp.');
    }
    if (typeof message !== 'string' || message.length > 300) {
      throw httpError(400, 'INVALID_MESSAGE', 'Lời nhắn tối đa 300 ký tự.');
    }
    if (sameId(targetUserId, req.user._id)) {
      throw httpError(400, 'SELF_SWAP', 'Bạn không thể nhờ chính mình làm thay.');
    }

    const shift = await Shift.findById(shiftId).lean();
    if (!shift || !sameId(shift.studentUserId || shift.employeeUserId, req.user._id)) {
      throw httpError(404, 'NOT_FOUND', 'Không tìm thấy ca của bạn.');
    }
    if (shift.scheduleStatus !== 'published' || shift.attendanceStatus !== 'not_started' ||
        new Date(shift.startAt).getTime() <= Date.now()) {
      throw httpError(409, 'SHIFT_NOT_SWAPPABLE', 'Chỉ có thể nhờ đổi các ca sắp tới, chưa bắt đầu.');
    }

    const [target, peerEmployment] = await Promise.all([
      User.findById(targetUserId),
      Employment.findOne({ employeeUserId: targetUserId, employerUserId: shift.employerUserId, status: 'active' }),
    ]);
    if (!target || !peerEmployment) {
      throw httpError(400, 'TARGET_INELIGIBLE', 'Đồng nghiệp phải đang làm việc tại cùng cửa hàng.');
    }
    if (await ShiftSwap.exists({ shiftId, status: { $in: OPEN_SWAP_STATUSES } })) {
      throw httpError(409, 'SWAP_EXISTS', 'Ca này đang có một đề nghị đổi ca chưa hoàn tất.');
    }

    const swap = await ShiftSwap.create({
      shiftId,
      employerUserId: shift.employerUserId,
      requesterUserId: req.user._id,
      requesterName: req.user.name || '',
      targetUserId,
      targetName: target.name || '',
      message: message.trim(),
    });
    await notify(targetUserId, 'Đồng nghiệp nhờ bạn làm thay ca',
      `${req.user.name || 'Một đồng nghiệp'} nhờ bạn làm thay ca ${describeShift(shift)}.`, '/student/swaps');
    res.status(201).json({ ...swap.toObject(), id: swap._id });
  } catch (err) {
    next(err);
  }
});

// POST /api/shift-swaps/:id/peer-accept | peer-decline (đồng nghiệp được nhờ)
router.post('/:id/peer-accept', async (req, res, next) => {
  try {
    assertLabor(req.user);
    const swap = await loadSwap(req.params.id);
    if (!sameId(swap.targetUserId, req.user._id)) throw httpError(403, 'FORBIDDEN', 'Đề nghị này không dành cho bạn.');
    const shift = await Shift.findById(swap.shiftId).lean();
    if (!shift) throw httpError(404, 'NOT_FOUND', 'Ca làm không còn tồn tại.');

    // Kiểm tra sớm để báo lỗi rõ ràng cho đồng nghiệp (xung đột lịch, nghỉ phép...)
    await validateShiftEligibilityAndConflict({
      studentUserId: req.user._id, employerUserId: swap.employerUserId,
      startAt: new Date(shift.startAt), endAt: new Date(shift.endAt), excludeShiftId: shift._id,
    });
    await transition(swap, 'pending_peer', 'pending_employer');
    await notify(swap.employerUserId, 'Có đề nghị đổi ca chờ duyệt',
      `${swap.requesterName} nhờ ${swap.targetName} làm thay ca ${describeShift(shift)}.`, '/employer/swaps');
    await notify(swap.requesterUserId, 'Đồng nghiệp đã đồng ý làm thay',
      `${swap.targetName} đã đồng ý. Đang chờ cửa hàng duyệt.`, '/student/swaps');
    res.json({ message: 'Đã đồng ý. Đề nghị được chuyển cho cửa hàng duyệt.' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/peer-decline', async (req, res, next) => {
  try {
    assertLabor(req.user);
    const swap = await loadSwap(req.params.id);
    if (!sameId(swap.targetUserId, req.user._id)) throw httpError(403, 'FORBIDDEN', 'Đề nghị này không dành cho bạn.');
    await transition(swap, 'pending_peer', 'declined');
    await notify(swap.requesterUserId, 'Đồng nghiệp từ chối làm thay',
      `${swap.targetName} không thể làm thay ca của bạn.`, '/student/swaps');
    res.json({ message: 'Đã từ chối.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/shift-swaps/:id/cancel (người nhờ rút lại)
router.post('/:id/cancel', async (req, res, next) => {
  try {
    assertLabor(req.user);
    const swap = await loadSwap(req.params.id);
    if (!sameId(swap.requesterUserId, req.user._id)) throw httpError(403, 'FORBIDDEN', 'Bạn không phải người tạo đề nghị.');
    const from = OPEN_SWAP_STATUSES.includes(swap.status) ? swap.status : null;
    if (!from) throw httpError(409, 'INVALID_STATE', 'Đề nghị đã được xử lý.');
    await transition(swap, from, 'cancelled');
    res.json({ message: 'Đã rút lại đề nghị.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/shift-swaps/:id/approve (cửa hàng duyệt: chuyển ca sang đồng nghiệp)
router.post('/:id/approve', authorize('employer'), async (req, res, next) => {
  try {
    const swap = await loadSwap(req.params.id);
    if (!sameId(swap.employerUserId, req.user._id)) throw httpError(403, 'FORBIDDEN', 'Đề nghị không thuộc cửa hàng của bạn.');
    if (swap.status !== 'pending_employer') throw httpError(409, 'INVALID_STATE', 'Đề nghị chưa sẵn sàng để duyệt.');

    const shift = await Shift.findById(swap.shiftId).lean();
    if (!shift || new Date(shift.startAt).getTime() <= Date.now()) {
      await ShiftSwap.updateOne({ _id: swap._id, status: 'pending_employer' }, { $set: { status: 'expired', decidedAt: new Date() } });
      throw httpError(409, 'SHIFT_NOT_SWAPPABLE', 'Ca đã bắt đầu hoặc không còn tồn tại.');
    }

    // Kiểm tra lại tại thời điểm duyệt vì lịch của đồng nghiệp có thể đã thay đổi
    const { employment } = await validateShiftEligibilityAndConflict({
      studentUserId: swap.targetUserId, employerUserId: swap.employerUserId,
      startAt: new Date(shift.startAt), endAt: new Date(shift.endAt), excludeShiftId: shift._id,
    });
    const target = await User.findById(swap.targetUserId);

    const moved = await Shift.findOneAndUpdate(
      {
        _id: shift._id,
        studentUserId: swap.requesterUserId,
        scheduleStatus: 'published',
        attendanceStatus: 'not_started',
      },
      {
        $set: {
          studentUserId: swap.targetUserId,
          employeeUserId: swap.targetUserId,
          studentId: swap.targetUserId,
          studentName: target?.name || swap.targetName,
          employeeName: target?.name || swap.targetName,
          studentPhone: target?.phone || '',
          assignmentStatus: 'assigned',
          employmentId: employment?._id || null,
          reminderSentAt: null,
        },
      },
      { new: true }
    );
    if (!moved) throw httpError(409, 'SHIFT_CHANGED', 'Ca làm đã thay đổi, không thể chuyển.');

    await transition(swap, 'pending_employer', 'approved');
    await notify(swap.targetUserId, 'Bạn được giao thêm một ca',
      `Cửa hàng đã duyệt: bạn làm thay ca ${describeShift(shift)}.`, '/student/shifts');
    await notify(swap.requesterUserId, 'Cửa hàng đã duyệt đổi ca',
      `${swap.targetName} sẽ làm thay ca ${describeShift(shift)}.`, '/student/shifts');
    res.json({ message: 'Đã duyệt và chuyển ca cho nhân viên mới.' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reject', authorize('employer'), async (req, res, next) => {
  try {
    const swap = await loadSwap(req.params.id);
    if (!sameId(swap.employerUserId, req.user._id)) throw httpError(403, 'FORBIDDEN', 'Đề nghị không thuộc cửa hàng của bạn.');
    const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 300) : '';
    await transition(swap, 'pending_employer', 'rejected', { responseNote: note });
    for (const userId of [swap.requesterUserId, swap.targetUserId]) {
      await notify(userId, 'Cửa hàng không duyệt đổi ca', note || 'Ca làm giữ nguyên người phụ trách ban đầu.', '/student/swaps');
    }
    res.json({ message: 'Đã từ chối đề nghị.' });
  } catch (err) {
    next(err);
  }
});

export default router;
