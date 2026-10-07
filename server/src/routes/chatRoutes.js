import express from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { Application } from '../models/Application.js';
import { MicroTask } from '../models/MicroTask.js';
import { Employment } from '../models/Employment.js';
import { User } from '../models/User.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { Notification } from '../models/Notification.js';
import { authenticate, requireActiveUser } from '../middlewares/auth.js';
import { LABOR_ROLES } from '../utils/applicationDto.js';

const router = express.Router();
router.use(authenticate, requireActiveUser);

const MAX_PAGE = 100;

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

const sameId = (a, b) => String(a?._id || a) === String(b?._id || b);

// Một đơn ứng tuyển chỉ có hai bên: ứng viên và nhà tuyển dụng sở hữu tin.
async function resolveApplicationParties(refId, actor) {
  const application = await Application.findById(refId).populate('jobId', 'title storeName').lean();
  if (!application) throw httpError(404, 'NOT_FOUND', 'Không tìm thấy đơn ứng tuyển.');

  let employerUserId = application.employerUserId || application.employerId;
  if (employerUserId && !(await User.findById(employerUserId))) {
    const profile = await EmployerProfile.findById(employerUserId);
    employerUserId = profile?.userId || null;
  }
  if (!employerUserId) throw httpError(409, 'NO_COUNTERPART', 'Đơn này chưa gắn với nhà tuyển dụng.');

  const isStudent = LABOR_ROLES.includes(actor.role) && sameId(application.studentId, actor._id);
  const isEmployer = actor.role === 'employer' && sameId(employerUserId, actor._id);
  if (!isStudent && !isEmployer) {
    throw httpError(403, 'FORBIDDEN', 'Bạn không thuộc cuộc trao đổi này.');
  }

  const [student, employer] = await Promise.all([
    User.findById(application.studentId),
    User.findById(employerUserId),
  ]);
  return {
    title: `Ứng tuyển: ${application.jobId?.title || 'vị trí'}`,
    participants: [
      { userId: application.studentId, name: student?.name || application.studentName || 'Ứng viên' },
      { userId: employerUserId, name: application.jobId?.storeName || employer?.name || 'Nhà tuyển dụng' },
    ],
  };
}

// Việc vặt: chỉ người đăng và người đã nhận việc.
async function resolveTaskParties(refId, actor) {
  const task = await MicroTask.findById(refId).lean();
  if (!task) throw httpError(404, 'NOT_FOUND', 'Không tìm thấy việc vặt.');
  if (!task.assigneeId) throw httpError(409, 'NO_COUNTERPART', 'Việc vặt chưa có người nhận.');
  if (!sameId(task.requesterId, actor._id) && !sameId(task.assigneeId, actor._id)) {
    throw httpError(403, 'FORBIDDEN', 'Bạn không thuộc cuộc trao đổi này.');
  }
  const [requester, assignee] = await Promise.all([User.findById(task.requesterId), User.findById(task.assigneeId)]);
  return {
    title: `Việc vặt: ${task.title}`,
    participants: [
      { userId: task.requesterId, name: requester?.name || 'Người đăng' },
      { userId: task.assigneeId, name: assignee?.name || 'Người nhận' },
    ],
  };
}

// Nhân viên: chủ quán và người đang làm. Nếu nhân viên đến từ một đơn ứng tuyển thì dùng chung
// cuộc trò chuyện của đơn đó (không tách hai luồng cho cùng một cặp).
async function resolveEmploymentTarget(refId, actor) {
  const employment = await Employment.findById(refId).populate('jobId', 'title storeName').lean();
  if (!employment) throw httpError(404, 'NOT_FOUND', 'Không tìm thấy thông tin nhân viên.');
  if (!sameId(employment.employerUserId, actor._id) && !sameId(employment.employeeUserId, actor._id)) {
    throw httpError(403, 'FORBIDDEN', 'Bạn không thuộc cuộc trao đổi này.');
  }
  if (employment.sourceApplicationId && await Application.exists({ _id: employment.sourceApplicationId })) {
    return { kind: 'application', refId: employment.sourceApplicationId, parties: await resolveApplicationParties(employment.sourceApplicationId, actor) };
  }
  const [employee, employer] = await Promise.all([User.findById(employment.employeeUserId), User.findById(employment.employerUserId)]);
  return {
    kind: 'employment',
    refId: employment._id,
    parties: {
      title: `Công việc: ${employment.jobId?.title || employment.positionTitle || 'nhân viên'}`,
      participants: [
        { userId: employment.employeeUserId, name: employee?.name || 'Nhân viên' },
        { userId: employment.employerUserId, name: employment.jobId?.storeName || employer?.name || 'Nhà tuyển dụng' },
      ],
    },
  };
}

async function loadConversationFor(id, user) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw httpError(400, 'INVALID_ID', 'Mã cuộc trò chuyện không hợp lệ.');
  const conversation = await Conversation.findById(id);
  const me = conversation?.participants.find((p) => sameId(p.userId, user._id));
  if (!conversation || !me) throw httpError(404, 'NOT_FOUND', 'Không tìm thấy cuộc trò chuyện.');
  return { conversation, me };
}

function toDTO(conversation, userId, unread = 0) {
  const other = conversation.participants.find((p) => !sameId(p.userId, userId));
  return {
    id: conversation._id,
    kind: conversation.kind,
    refId: conversation.refId,
    title: conversation.title,
    otherName: other?.name || '',
    lastMessageAt: conversation.lastMessageAt,
    lastMessagePreview: conversation.lastMessagePreview,
    unread,
  };
}

async function countUnread(conversation, userId) {
  const me = conversation.participants.find((p) => sameId(p.userId, userId));
  return Message.countDocuments({
    conversationId: conversation._id,
    senderId: { $ne: userId },
    createdAt: { $gt: me?.lastReadAt || new Date(0) },
  });
}

// POST /api/chats/open { kind, refId } - tìm hoặc tạo cuộc trò chuyện
router.post('/open', async (req, res, next) => {
  try {
    let { kind, refId } = req.body;
    if (!['application', 'task', 'employment'].includes(kind) || !mongoose.Types.ObjectId.isValid(refId)) {
      throw httpError(400, 'INVALID_INPUT', 'Thiếu hoặc sai thông tin cuộc trò chuyện.');
    }
    let parties;
    if (kind === 'employment') {
      const target = await resolveEmploymentTarget(refId, req.user);
      ({ kind, refId, parties } = target);
    } else {
      parties = kind === 'application'
        ? await resolveApplicationParties(refId, req.user)
        : await resolveTaskParties(refId, req.user);
    }

    let conversation = await Conversation.findOne({ kind, refId });
    if (!conversation) {
      try {
        conversation = await Conversation.create({ kind, refId, title: parties.title, participants: parties.participants });
      } catch (err) {
        if (err.code !== 11000) throw err;
        conversation = await Conversation.findOne({ kind, refId });
      }
    }
    res.json(toDTO(conversation, req.user._id, await countUnread(conversation, req.user._id)));
  } catch (err) {
    next(err);
  }
});

// GET /api/chats
router.get('/', async (req, res, next) => {
  try {
    const conversations = await Conversation.find({ 'participants.userId': req.user._id })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .limit(50);
    const result = [];
    for (const conversation of conversations) {
      result.push(toDTO(conversation, req.user._id, await countUnread(conversation, req.user._id)));
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/chats/unread-count
router.get('/unread-count', async (req, res, next) => {
  try {
    const conversations = await Conversation.find({ 'participants.userId': req.user._id }).limit(100);
    let total = 0;
    for (const conversation of conversations) total += await countUnread(conversation, req.user._id);
    res.json({ count: total });
  } catch (err) {
    next(err);
  }
});

// GET /api/chats/:id/messages?after=<ISO>  (đồng thời đánh dấu đã đọc)
router.get('/:id/messages', async (req, res, next) => {
  try {
    const { conversation } = await loadConversationFor(req.params.id, req.user);
    const filter = { conversationId: conversation._id };
    if (req.query.after) {
      const after = new Date(String(req.query.after));
      if (Number.isNaN(after.getTime())) throw httpError(400, 'INVALID_CURSOR', 'Mốc thời gian không hợp lệ.');
      filter.createdAt = { $gt: after };
    }
    const messages = await Message.find(filter).sort({ createdAt: 1 }).limit(MAX_PAGE).lean();

    await Conversation.updateOne(
      { _id: conversation._id, 'participants.userId': req.user._id },
      { $set: { 'participants.$.lastReadAt': new Date() } }
    );
    res.json({
      conversation: toDTO(conversation, req.user._id, 0),
      messages: messages.map((m) => ({
        id: m._id,
        senderId: m.senderId,
        body: m.body,
        createdAt: m.createdAt,
        mine: sameId(m.senderId, req.user._id),
      })),
    });
  } catch (err) {
    next(err);
  }
});

const sendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `chat:${req.user?._id || 'anon'}`,
  validate: { keyGeneratorIpFallback: false },
  message: { error: 'Bạn gửi tin nhắn quá nhanh. Vui lòng chậm lại một chút.', code: 'RATE_LIMIT_EXCEEDED' },
});

// POST /api/chats/:id/messages { body }
router.post('/:id/messages', sendLimiter, async (req, res, next) => {
  try {
    const { conversation, me } = await loadConversationFor(req.params.id, req.user);
    const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
    if (!body || body.length > 1000) {
      throw httpError(400, 'INVALID_MESSAGE', 'Tin nhắn không được để trống và tối đa 1000 ký tự.');
    }

    const message = await Message.create({ conversationId: conversation._id, senderId: req.user._id, body });
    const sentAt = message.createdAt || new Date();
    await Conversation.updateOne(
      { _id: conversation._id, 'participants.userId': req.user._id },
      {
        $set: {
          lastMessageAt: sentAt,
          lastMessagePreview: body.slice(0, 80),
          lastSenderId: req.user._id,
          'participants.$.lastReadAt': sentAt,
        },
      }
    );

    // Chỉ báo khi người kia đã đọc hết tin trước đó, tránh spam thông báo
    const other = conversation.participants.find((p) => !sameId(p.userId, req.user._id));
    const otherCaughtUp = !conversation.lastMessageAt ||
      new Date(other.lastReadAt) >= new Date(conversation.lastMessageAt) ||
      !sameId(conversation.lastSenderId, req.user._id);
    if (other && otherCaughtUp) {
      try {
        await Notification.create({
          userId: other.userId,
          title: `Tin nhắn mới từ ${me.name || req.user.name || 'người dùng'}`,
          message: body.slice(0, 80),
          type: 'system',
          link: conversation.kind === 'application' && LABOR_ROLES.includes(req.user.role)
            ? '/employer/messages'
            : '/student/messages',
        });
      } catch (err) {
        console.warn('[chat] notification failed:', err.message);
      }
    }

    res.status(201).json({
      id: message._id,
      senderId: message.senderId,
      body: message.body,
      createdAt: sentAt,
      mine: true,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
