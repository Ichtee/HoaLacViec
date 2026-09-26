import express from 'express';
import mongoose from 'mongoose';
import { MicroTask } from '../models/MicroTask.js';
import { Notification } from '../models/Notification.js';
import { Report } from '../models/Report.js';
import { authenticate, optionalAuthenticate, requireActiveUser } from '../middlewares/auth.js';
import {
  TASK_STATUSES,
  TASK_CATEGORIES,
  isValidTaskTransition,
  isValidPhoneNumber,
  normalizePhoneNumber,
  containsProhibitedContent,
  formatDeadlineDisplay,
  toTaskDTO,
} from '../utils/taskContract.js';

const router = express.Router();

/**
 * Log structured notification error without crashing execution
 */
function logNotificationError(context, err) {
  console.error('[NotificationError]', {
    context,
    message: err?.message,
    timestamp: new Date().toISOString(),
  });
}

// ─── GET /api/tasks ────────────────────────────────────────────────
router.get('/', optionalAuthenticate, async (req, res, next) => {
  try {
    const {
      category,
      status,
      tab = 'open',
      search,
      sort = 'newest',
      page = 1,
      limit = 12,
      requesterId,
      assigneeId,
    } = req.query;

    const currentUserId = req.user?._id?.toString() || null;
    const userRole = req.user?.role || null;
    const now = new Date();

    // Auto-expire overdue open tasks in the background
    await MicroTask.updateMany(
      {
        status: TASK_STATUSES.OPEN,
        deadlineDate: { $lt: now },
        isDeleted: false,
      },
      {
        $set: { status: TASK_STATUSES.EXPIRED },
        $push: {
          history: {
            status: TASK_STATUSES.EXPIRED,
            note: 'Tự động hết hạn do quá thời hạn hoàn thành',
            timestamp: now,
          },
        },
      }
    ).catch((err) => console.warn('[AutoExpireWarn]', err.message));

    const filter = { isDeleted: false };

    // Category filter
    if (category && category !== 'all' && TASK_CATEGORIES.includes(category)) {
      filter.category = category;
    }

    // Tab-based & Status Filtering
    if (tab === 'open') {
      filter.status = TASK_STATUSES.OPEN;
      filter.deadlineDate = { $gt: now };
    } else if (tab === 'my_posted') {
      if (!currentUserId) {
        return res.status(401).json({ error: 'Vui lòng đăng nhập để xem việc đã đăng.', code: 'UNAUTHORIZED' });
      }
      filter.requesterId = req.user._id;
    } else if (tab === 'my_accepted') {
      if (!currentUserId) {
        return res.status(401).json({ error: 'Vui lòng đăng nhập để xem việc đã nhận.', code: 'UNAUTHORIZED' });
      }
      filter.assigneeId = req.user._id;
    } else if (tab === 'awaiting_approval') {
      if (!currentUserId) {
        return res.status(401).json({ error: 'Vui lòng đăng nhập để xem mục này.', code: 'UNAUTHORIZED' });
      }
      filter.status = TASK_STATUSES.SUBMITTED_FOR_COMPLETION;
      if (userRole !== 'admin') {
        filter.$or = [{ requesterId: req.user._id }, { assigneeId: req.user._id }];
      }
    } else if (tab === 'completed') {
      if (!currentUserId) {
        return res.status(401).json({ error: 'Vui lòng đăng nhập để xem mục này.', code: 'UNAUTHORIZED' });
      }
      filter.status = TASK_STATUSES.COMPLETED;
      if (userRole !== 'admin') {
        filter.$or = [{ requesterId: req.user._id }, { assigneeId: req.user._id }];
      }
    } else if (tab === 'disputed') {
      if (!currentUserId) {
        return res.status(401).json({ error: 'Vui lòng đăng nhập để xem mục này.', code: 'UNAUTHORIZED' });
      }
      filter.status = TASK_STATUSES.DISPUTED;
      if (userRole !== 'admin') {
        filter.$or = [{ requesterId: req.user._id }, { assigneeId: req.user._id }];
      }
    } else if (status) {
      filter.status = status;
    }

    // Direct requester/assignee filter (for targeted queries)
    if (requesterId && mongoose.Types.ObjectId.isValid(requesterId)) {
      filter.requesterId = requesterId;
    }
    if (assigneeId && mongoose.Types.ObjectId.isValid(assigneeId)) {
      filter.assigneeId = assigneeId;
    }

    // Search query
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { location: { $regex: q, $options: 'i' } },
        { pickupAddress: { $regex: q, $options: 'i' } },
        { destinationAddress: { $regex: q, $options: 'i' } },
      ];
    }

    // Sort order
    let sortQuery = { createdAt: -1 };
    if (sort === 'reward_desc') sortQuery = { reward: -1, createdAt: -1 };
    if (sort === 'reward_asc') sortQuery = { reward: 1, createdAt: -1 };
    if (sort === 'deadline_asc') sortQuery = { deadlineDate: 1, createdAt: -1 };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const [total, tasks] = await Promise.all([
      MicroTask.countDocuments(filter),
      MicroTask.find(filter).sort(sortQuery).skip(skip).limit(limitNum).lean(),
    ]);

    const formatted = tasks.map((t) => toTaskDTO(t, currentUserId, userRole));

    // Return both pagination metadata and top-level tasks array compatibility
    res.json({
      tasks: formatted,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
      // Convenience properties
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/tasks/:id ─────────────────────────────────────────────
router.get('/:id', optionalAuthenticate, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Mã việc vặt không hợp lệ.', code: 'INVALID_ID' });
    }

    const task = await MicroTask.findOne({ _id: req.params.id, isDeleted: false }).lean();
    if (!task) {
      return res.status(404).json({ error: 'Không tìm thấy việc vặt hoặc việc đã bị xóa.', code: 'NOT_FOUND' });
    }

    // Auto-expire check
    if (task.status === TASK_STATUSES.OPEN && task.deadlineDate && new Date(task.deadlineDate) < new Date()) {
      task.status = TASK_STATUSES.EXPIRED;
      await MicroTask.updateOne({ _id: task._id }, { $set: { status: TASK_STATUSES.EXPIRED } });
    }

    const currentUserId = req.user?._id?.toString() || null;
    const userRole = req.user?.role || null;

    res.json(toTaskDTO(task, currentUserId, userRole));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/tasks (Đăng việc vặt mới) ───────────────────────────
router.post('/', authenticate, requireActiveUser, async (req, res, next) => {
  try {
    const {
      title,
      category,
      description,
      reward,
      itemBudget = 0,
      paymentMethod = 'cash',
      location,
      pickupAddress = '',
      destinationAddress = '',
      deadlineDate,
      phone,
    } = req.body;

    // Validate required fields
    if (!title || !description || reward === undefined || reward === null) {
      return res.status(400).json({
        error: 'Vui lòng điền đủ tiêu đề, mô tả và tiền thù lao.',
        code: 'MISSING_FIELDS',
      });
    }

    const cleanTitle = String(title).trim();
    const cleanDesc = String(description).trim();

    if (cleanTitle.length < 5 || cleanTitle.length > 120) {
      return res.status(400).json({
        error: 'Tiêu đề việc vặt phải từ 5 đến 120 ký tự.',
        code: 'INVALID_TITLE_LENGTH',
      });
    }

    if (cleanDesc.length < 10 || cleanDesc.length > 2000) {
      return res.status(400).json({
        error: 'Mô tả chi tiết phải từ 10 đến 2000 ký tự.',
        code: 'INVALID_DESCRIPTION_LENGTH',
      });
    }

    // Policy Check: prohibited content
    if (containsProhibitedContent(cleanTitle) || containsProhibitedContent(cleanDesc)) {
      return res.status(400).json({
        error: 'Nội dung chứa từ khóa vi phạm quy định cộng đồng (cờ bạc, ma túy, thi hộ, hàng cấm...).',
        code: 'PROHIBITED_CONTENT',
      });
    }

    // Category validate
    const selectedCategory = TASK_CATEGORIES.includes(category) ? category : 'di_cho';

    // Reward validation: integer, min 5000 VNĐ, max 20,000,000 VNĐ
    const numReward = parseInt(reward, 10);
    if (isNaN(numReward) || numReward < 5000 || numReward > 20000000) {
      return res.status(400).json({
        error: 'Tiền thù lao phải từ 5.000 VNĐ đến 20.000.000 VNĐ.',
        code: 'INVALID_REWARD',
      });
    }

    const numBudget = Math.max(0, parseInt(itemBudget, 10) || 0);

    // Location validation
    let primaryLocation = String(location || '').trim();
    const cleanPickup = String(pickupAddress || '').trim();
    const cleanDestination = String(destinationAddress || '').trim();

    if (['xe_om', 'chuyen_do'].includes(selectedCategory)) {
      if (!cleanPickup || !cleanDestination) {
        return res.status(400).json({
          error: 'Vui lòng cung cấp cả điểm đón/xuất phát và điểm đến cho dịch vụ xe ôm/chuyển đồ.',
          code: 'MISSING_ROUTE_POINTS',
        });
      }
      primaryLocation = `${cleanPickup} → ${cleanDestination}`;
    } else {
      if (!primaryLocation) {
        return res.status(400).json({
          error: 'Vui lòng nhập địa chỉ / địa điểm thực hiện việc vặt.',
          code: 'MISSING_LOCATION',
        });
      }
    }

    // Deadline validation: must be future ISO Date
    if (!deadlineDate) {
      return res.status(400).json({
        error: 'Vui lòng chọn thời hạn hoàn thành công việc.',
        code: 'MISSING_DEADLINE',
      });
    }

    const parsedDeadline = new Date(deadlineDate);
    if (isNaN(parsedDeadline.getTime())) {
      return res.status(400).json({
        error: 'Thời hạn hoàn thành không hợp lệ.',
        code: 'INVALID_DEADLINE',
      });
    }

    if (parsedDeadline.getTime() <= Date.now() + 60000) {
      return res.status(400).json({
        error: 'Thời hạn hoàn thành phải ở tương lai (tối thiểu sau thời điểm hiện tại 1 phút).',
        code: 'DEADLINE_IN_PAST',
      });
    }

    // Phone validation
    const candidatePhone = phone || req.user.phone || '';
    if (!isValidPhoneNumber(candidatePhone)) {
      return res.status(400).json({
        error: 'Số điện thoại liên hệ không hợp lệ. Vui lòng nhập đúng 10 số di động Việt Nam.',
        code: 'INVALID_PHONE',
      });
    }
    const cleanPhone = normalizePhoneNumber(candidatePhone);

    const task = await MicroTask.create({
      title: cleanTitle,
      category: selectedCategory,
      description: cleanDesc,
      reward: numReward,
      itemBudget: numBudget,
      paymentMethod: paymentMethod === 'banking' ? 'banking' : 'cash',
      location: primaryLocation,
      pickupAddress: cleanPickup,
      destinationAddress: cleanDestination,
      deadline: formatDeadlineDisplay(parsedDeadline),
      deadlineDate: parsedDeadline,
      requesterId: req.user._id,
      requesterName: req.user.name || 'Thành viên Hòa Lạc',
      requesterPhone: cleanPhone,
      status: TASK_STATUSES.OPEN,
      history: [
        {
          status: TASK_STATUSES.OPEN,
          changedBy: req.user._id,
          note: 'Đăng việc vặt mới lên chợ',
          timestamp: new Date(),
        },
      ],
    });

    res.status(201).json(toTaskDTO(task, req.user._id, req.user.role));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/tasks/:id/accept (Nhận việc vặt - Atomic Race-Safe) ───
router.post('/:id/accept', authenticate, requireActiveUser, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Mã việc vặt không hợp lệ.', code: 'INVALID_ID' });
    }

    // Role check: Only active students can accept tasks
    if (req.user.role !== 'student') {
      return res.status(403).json({
        error: 'Chỉ tài khoản sinh viên (student) mới có quyền nhận việc vặt kiếm thêm thu nhập.',
        code: 'ONLY_STUDENTS_CAN_ACCEPT',
      });
    }

    const { note, assigneePhone } = req.body;

    const task = await MicroTask.findOne({ _id: req.params.id, isDeleted: false });
    if (!task) {
      return res.status(404).json({ error: 'Không tìm thấy việc vặt này.', code: 'NOT_FOUND' });
    }

    // Anti self-accept: requester cannot accept own task
    if (task.requesterId.toString() === req.user._id.toString()) {
      return res.status(400).json({
        error: 'Bạn không thể tự nhận công việc do chính mình đăng.',
        code: 'SELF_ACCEPT_FORBIDDEN',
      });
    }

    // Check expiration
    if (task.deadlineDate && new Date(task.deadlineDate) < new Date()) {
      await MicroTask.updateOne({ _id: task._id }, { $set: { status: TASK_STATUSES.EXPIRED } });
      return res.status(400).json({
        error: 'Công việc này đã quá thời hạn hoàn thành và đã tự động đóng.',
        code: 'TASK_EXPIRED',
      });
    }

    // Validate phone for assignee
    const candidatePhone = assigneePhone || req.user.phone || '';
    if (!isValidPhoneNumber(candidatePhone)) {
      return res.status(400).json({
        error: 'Vui lòng cung cấp số điện thoại liên hệ hợp lệ để người nhờ việc có thể gọi cho bạn.',
        code: 'INVALID_PHONE',
      });
    }
    const cleanAssigneePhone = normalizePhoneNumber(candidatePhone);

    const now = new Date();

    // Atomic update enforcing status: 'open' and non-expired
    const updated = await MicroTask.findOneAndUpdate(
      {
        _id: req.params.id,
        status: TASK_STATUSES.OPEN,
        isDeleted: false,
        deadlineDate: { $gt: now },
      },
      {
        $set: {
          status: TASK_STATUSES.ACCEPTED,
          assigneeId: req.user._id,
          assigneeName: req.user.name || 'Sinh viên nhận việc',
          assigneePhone: cleanAssigneePhone,
          note: note ? String(note).trim() : '',
        },
        $push: {
          history: {
            status: TASK_STATUSES.ACCEPTED,
            changedBy: req.user._id,
            note: `Nhận việc bởi ${req.user.name || 'Sinh viên'}`,
            timestamp: now,
          },
        },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(409).json({
        error: 'Rất tiếc! Công việc này vừa có bạn khác nhận trước hoặc đã không còn mở nhận việc.',
        code: 'TASK_ALREADY_TAKEN',
      });
    }

    // Send Notification to Requester
    try {
      await Notification.create({
        userId: updated.requesterId,
        title: 'Có bạn nhận việc vặt của bạn! 🎉',
        message: `${req.user.name || 'Một bạn sinh viên'} đã nhận việc "${updated.title}". Số điện thoại liên hệ: ${cleanAssigneePhone}.`,
        type: 'task',
        link: '/tasks?tab=my_posted',
      });
    } catch (notifErr) {
      logNotificationError('task_accept_notification', notifErr);
    }

    res.json({
      message: 'Đã nhận việc thành công! Số điện thoại liên hệ hai bên đã được mở khóa.',
      task: toTaskDTO(updated, req.user._id, req.user.role),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/tasks/:id/submit-completion (Assignee gửi minh chứng hoàn thành) ───
router.post('/:id/submit-completion', authenticate, requireActiveUser, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Mã việc vặt không hợp lệ.', code: 'INVALID_ID' });
    }

    const task = await MicroTask.findOne({ _id: req.params.id, isDeleted: false });
    if (!task) {
      return res.status(404).json({ error: 'Không tìm thấy việc vặt.', code: 'NOT_FOUND' });
    }

    const isAssignee = task.assigneeId && task.assigneeId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isAssignee && !isAdmin) {
      return res.status(403).json({
        error: 'Chỉ người đã nhận việc mới có quyền gửi báo cáo kết quả hoàn thành.',
        code: 'FORBIDDEN',
      });
    }

    if (task.status !== TASK_STATUSES.ACCEPTED) {
      return res.status(409).json({
        error: `Công việc đang ở trạng thái "${task.status}", chỉ có thể gửi kết quả khi đang ở trạng thái "accepted".`,
        code: 'INVALID_STATUS',
      });
    }

    const { proof, completionProof, note, completionNote } = req.body;
    const finalProof = String(proof || completionProof || '').trim();
    const finalNote = String(note || completionNote || '').trim();

    const now = new Date();

    const updated = await MicroTask.findOneAndUpdate(
      { _id: req.params.id, status: TASK_STATUSES.ACCEPTED, isDeleted: false },
      {
        $set: {
          status: TASK_STATUSES.SUBMITTED_FOR_COMPLETION,
          completionProof: finalProof,
          completionNote: finalNote,
        },
        $push: {
          history: {
            status: TASK_STATUSES.SUBMITTED_FOR_COMPLETION,
            changedBy: req.user._id,
            note: finalNote || 'Gửi báo cáo hoàn thành công việc kèm minh chứng',
            timestamp: now,
          },
        },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(409).json({
        error: 'Trạng thái công việc đã bị thay đổi bởi thao tác khác.',
        code: 'STATE_CONFLICT',
      });
    }

    // Notify requester
    try {
      await Notification.create({
        userId: updated.requesterId,
        title: 'Người nhận việc đã hoàn tất! 📦',
        message: `${updated.assigneeName || 'Người nhận việc'} đã báo cáo hoàn thành "${updated.title}". Vui lòng kiểm tra và xác nhận hoàn tất.`,
        type: 'task',
        link: '/tasks?tab=awaiting_approval',
      });
    } catch (notifErr) {
      logNotificationError('task_submit_completion_notification', notifErr);
    }

    res.json({
      message: 'Đã gửi báo cáo kết quả công việc thành công! Vui lòng chờ người nhờ nghiệm thu.',
      task: toTaskDTO(updated, req.user._id, req.user.role),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/tasks/:id/complete (Requester xác nhận hoàn thành) ───
router.post('/:id/complete', authenticate, requireActiveUser, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Mã việc vặt không hợp lệ.', code: 'INVALID_ID' });
    }

    const task = await MicroTask.findOne({ _id: req.params.id, isDeleted: false });
    if (!task) {
      return res.status(404).json({ error: 'Không tìm thấy việc vặt.', code: 'NOT_FOUND' });
    }

    const isRequester = task.requesterId && task.requesterId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isRequester && !isAdmin) {
      return res.status(403).json({
        error: 'Chỉ người đăng việc mới có quyền chốt xác nhận hoàn thành công việc.',
        code: 'FORBIDDEN',
      });
    }

    // Rule: Không cho /complete nhận trạng thái accepted (phải qua submitted_for_completion)
    if (task.status !== TASK_STATUSES.SUBMITTED_FOR_COMPLETION) {
      return res.status(400).json({
        error: `Không thể chốt hoàn thành công việc ở trạng thái "${task.status}". Người nhận việc phải gửi kết quả hoàn thành trước.`,
        code: 'INVALID_STATUS',
      });
    }

    const now = new Date();

    const updated = await MicroTask.findOneAndUpdate(
      { _id: req.params.id, status: TASK_STATUSES.SUBMITTED_FOR_COMPLETION, isDeleted: false },
      {
        $set: { status: TASK_STATUSES.COMPLETED },
        $push: {
          history: {
            status: TASK_STATUSES.COMPLETED,
            changedBy: req.user._id,
            note: 'Người đăng việc xác nhận đã hoàn tất công việc',
            timestamp: now,
          },
        },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(409).json({
        error: 'Trạng thái công việc đã bị thay đổi bởi thao tác khác.',
        code: 'STATE_CONFLICT',
      });
    }

    // Notify assignee
    try {
      if (updated.assigneeId) {
        await Notification.create({
          userId: updated.assigneeId,
          title: 'Việc vặt đã được xác nhận hoàn thành! ✅',
          message: `Người nhờ đã xác nhận nghiệm thu công việc "${updated.title}". Bạn có thể gửi đánh giá cho người nhờ việc.`,
          type: 'task',
          link: '/tasks?tab=completed',
        });
      }
    } catch (notifErr) {
      logNotificationError('task_complete_notification', notifErr);
    }

    res.json({
      message: 'Đã xác nhận hoàn thành việc vặt thành công!',
      task: toTaskDTO(updated, req.user._id, req.user.role),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/tasks/:id/dispute (Báo cáo tranh chấp việc vặt) ─────
router.post('/:id/dispute', authenticate, requireActiveUser, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Mã việc vặt không hợp lệ.', code: 'INVALID_ID' });
    }

    const { reason, content, evidenceUrl } = req.body;
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({
        error: 'Vui lòng cung cấp lý do tranh chấp / khiếu nại.',
        code: 'MISSING_REASON',
      });
    }

    const task = await MicroTask.findOne({ _id: req.params.id, isDeleted: false });
    if (!task) {
      return res.status(404).json({ error: 'Không tìm thấy việc vặt.', code: 'NOT_FOUND' });
    }

    const isRequester = task.requesterId && task.requesterId.toString() === req.user._id.toString();
    const isAssignee = task.assigneeId && task.assigneeId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isRequester && !isAssignee && !isAdmin) {
      return res.status(403).json({
        error: 'Bạn không phải là người tham gia trong việc vặt này để báo cáo tranh chấp.',
        code: 'FORBIDDEN',
      });
    }

    if (![TASK_STATUSES.ACCEPTED, TASK_STATUSES.SUBMITTED_FOR_COMPLETION].includes(task.status)) {
      return res.status(400).json({
        error: `Không thể mở tranh chấp khi công việc đang ở trạng thái "${task.status}".`,
        code: 'INVALID_STATUS',
      });
    }

    const now = new Date();
    const cleanReason = String(reason).trim();
    const cleanContent = String(content || cleanReason).trim();

    // The other party is the reported user
    const reportedUserId = isRequester ? task.assigneeId : task.requesterId;

    // Create Report record linked to task
    const report = await Report.create({
      reporterId: req.user._id,
      reporterName: req.user.name || 'Người khiếu nại',
      reporterEmail: req.user.email || '',
      targetType: 'task',
      targetId: task._id,
      target: task.title,
      reportedUserId: reportedUserId || null,
      openedBy: req.user._id,
      reason: cleanReason,
      content: cleanContent,
      evidenceUrl: evidenceUrl ? String(evidenceUrl).trim() : '',
      status: 'pending',
      history: [
        {
          action: 'opened_dispute',
          performedBy: req.user._id,
          note: `Mở khiếu nại tranh chấp cho việc "${task.title}": ${cleanReason}`,
          timestamp: now,
        },
      ],
    });

    // Atomic update task to disputed
    const updated = await MicroTask.findOneAndUpdate(
      {
        _id: task._id,
        status: { $in: [TASK_STATUSES.ACCEPTED, TASK_STATUSES.SUBMITTED_FOR_COMPLETION] },
        isDeleted: false,
      },
      {
        $set: {
          status: TASK_STATUSES.DISPUTED,
          disputeReason: cleanReason,
          disputeReportId: report._id,
        },
        $push: {
          history: {
            status: TASK_STATUSES.DISPUTED,
            changedBy: req.user._id,
            note: `Mở tranh chấp: ${cleanReason}`,
            timestamp: now,
          },
        },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(409).json({
        error: 'Trạng thái công việc đã bị thay đổi bởi thao tác khác.',
        code: 'STATE_CONFLICT',
      });
    }

    // Notify the other participant
    try {
      if (reportedUserId) {
        await Notification.create({
          userId: reportedUserId,
          title: 'Công việc phát sinh khiếu nại tranh chấp ⚠️',
          message: `${req.user.name || 'Bên tham gia'} đã gửi khiếu nại về công việc "${task.title}". Ban quản trị đang xử lý.`,
          type: 'task',
          link: '/tasks?tab=disputed',
        });
      }
    } catch (notifErr) {
      logNotificationError('task_dispute_notification', notifErr);
    }

    res.json({
      message: 'Đã gửi khiếu nại tranh chấp tới ban quản trị. Công việc đã chuyển sang trạng thái đối soát.',
      task: toTaskDTO(updated, req.user._id, req.user.role),
      reportId: report._id,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/tasks/:id/cancel (Hủy việc vặt) ─────────────────────
router.post('/:id/cancel', authenticate, requireActiveUser, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Mã việc vặt không hợp lệ.', code: 'INVALID_ID' });
    }

    const { cancelReason } = req.body;
    const task = await MicroTask.findOne({ _id: req.params.id, isDeleted: false });
    if (!task) {
      return res.status(404).json({ error: 'Không tìm thấy việc vặt.', code: 'NOT_FOUND' });
    }

    const isRequester = task.requesterId && task.requesterId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isRequester && !isAdmin) {
      return res.status(403).json({
        error: 'Chỉ người đăng việc mới có quyền hủy bài đăng này.',
        code: 'FORBIDDEN',
      });
    }

    // Can only cancel directly when open (or admin moderation)
    if (task.status !== TASK_STATUSES.OPEN && !isAdmin) {
      return res.status(400).json({
        error: `Không thể hủy trực tiếp khi việc đang ở trạng thái "${task.status}". Nếu có tranh chấp vui lòng bấm "Khiếu nại".`,
        code: 'CANNOT_CANCEL_IN_PROGRESS',
      });
    }

    const now = new Date();
    const cleanReason = String(cancelReason || 'Người đăng hủy bài').trim();

    const updated = await MicroTask.findOneAndUpdate(
      { _id: task._id, isDeleted: false },
      {
        $set: {
          status: TASK_STATUSES.CANCELLED,
          cancelReason: cleanReason,
        },
        $push: {
          history: {
            status: TASK_STATUSES.CANCELLED,
            changedBy: req.user._id,
            note: cleanReason,
            timestamp: now,
          },
        },
      },
      { new: true }
    );

    // If there was an assignee, notify them
    if (updated.assigneeId) {
      try {
        await Notification.create({
          userId: updated.assigneeId,
          title: 'Việc vặt đã bị hủy ⚠️',
          message: `Công việc "${updated.title}" đã được người đăng hủy với lý do: ${cleanReason}.`,
          type: 'task',
          link: '/tasks',
        });
      } catch (notifErr) {
        logNotificationError('task_cancel_notification', notifErr);
      }
    }

    res.json({
      message: 'Đã hủy việc vặt thành công.',
      task: toTaskDTO(updated, req.user._id, req.user.role),
    });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/tasks/:id (Soft-delete bài đăng để giữ Audit Log) ──
router.delete('/:id', authenticate, requireActiveUser, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Mã việc vặt không hợp lệ.', code: 'INVALID_ID' });
    }

    const task = await MicroTask.findOne({ _id: req.params.id, isDeleted: false });
    if (!task) {
      return res.status(404).json({ error: 'Không tìm thấy việc vặt.', code: 'NOT_FOUND' });
    }

    const isRequester = task.requesterId && task.requesterId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isRequester && !isAdmin) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa bài đăng này.', code: 'FORBIDDEN' });
    }

    if ([TASK_STATUSES.ACCEPTED, TASK_STATUSES.SUBMITTED_FOR_COMPLETION].includes(task.status)) {
      return res.status(400).json({
        error: 'Công việc đang có người thực hiện, không thể xóa ngay. Hãy liên hệ đối phương hoặc mở khiếu nại.',
        code: 'TASK_IN_PROGRESS',
      });
    }

    // Soft delete to maintain audit history
    await MicroTask.updateOne(
      { _id: task._id },
      {
        $set: { isDeleted: true },
        $push: {
          history: {
            status: 'deleted',
            changedBy: req.user._id,
            note: 'Đã xóa bài đăng khỏi hệ thống (soft delete)',
            timestamp: new Date(),
          },
        },
      }
    );

    res.json({ message: 'Đã xóa bài đăng việc vặt thành công.' });
  } catch (err) {
    next(err);
  }
});

export default router;
