/**
 * MicroTask Domain Contract, State Machine Transitions & Privacy DTOs
 */

export const TASK_STATUSES = {
  OPEN: 'open',
  ACCEPTED: 'accepted',
  SUBMITTED_FOR_COMPLETION: 'submitted_for_completion',
  COMPLETED: 'completed',
  DISPUTED: 'disputed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
};

export const TASK_CATEGORIES = ['di_cho', 'nau_an', 'xe_om', 'chuyen_do', 'lay_ship', 'khac'];

export const VALID_TASK_TRANSITIONS = {
  [TASK_STATUSES.OPEN]: [TASK_STATUSES.ACCEPTED, TASK_STATUSES.CANCELLED, TASK_STATUSES.EXPIRED],
  [TASK_STATUSES.ACCEPTED]: [TASK_STATUSES.SUBMITTED_FOR_COMPLETION, TASK_STATUSES.DISPUTED],
  [TASK_STATUSES.SUBMITTED_FOR_COMPLETION]: [TASK_STATUSES.COMPLETED, TASK_STATUSES.DISPUTED],
  [TASK_STATUSES.DISPUTED]: [TASK_STATUSES.COMPLETED, TASK_STATUSES.CANCELLED],
  [TASK_STATUSES.COMPLETED]: [],
  [TASK_STATUSES.CANCELLED]: [],
  [TASK_STATUSES.EXPIRED]: [],
};

export function isValidTaskTransition(currentStatus, nextStatus) {
  const allowed = VALID_TASK_TRANSITIONS[currentStatus];
  return Boolean(allowed && allowed.includes(nextStatus));
}

const VN_PHONE_REGEX = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;

export function isValidPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const clean = phone.replace(/[\s.-]/g, '');
  return VN_PHONE_REGEX.test(clean);
}

export function normalizePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return '';
  let clean = phone.replace(/[\s.-]/g, '');
  if (clean.startsWith('+84')) {
    clean = '0' + clean.slice(3);
  }
  return clean;
}

export function maskPhone(phone) {
  if (!phone) return '';
  const clean = phone.toString().trim();
  if (clean.length <= 6) return '***';
  return clean.slice(0, 3) + '****' + clean.slice(-3);
}

const PROHIBITED_KEYWORDS = [
  'cờ bạc', 'đánh bạc', 'cá độ', 'lô đề', 'ma túy', 'cần sa', 'chất kích thích',
  'thi hộ', 'học hộ', 'làm hộ luận văn', 'bằng giả', 'giấy tờ giả', 'gian lận thi',
  'vũ khí', 'dao kiếm', 'tiền giả', 'mại dâm', 'gái gọi', 'bán thận', 'cho vay nặng lãi'
];

export function containsProhibitedContent(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return PROHIBITED_KEYWORDS.some((kw) => lower.includes(kw));
}

export function formatDeadlineDisplay(date) {
  if (!date) return 'Hôm nay';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Hôm nay';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${hours}:${minutes} ${day}/${month}/${year}`;
}

/**
 * Maps a task document to a strict, privacy-safe Public/Participant DTO
 */
export function toTaskDTO(task, currentUserId = null, userRole = null) {
  if (!task) return null;
  const t = typeof task.toObject === 'function' ? task.toObject() : { ...task };

  const uId = currentUserId ? currentUserId.toString() : null;
  const reqId = t.requesterId ? t.requesterId.toString() : null;
  const assId = t.assigneeId ? t.assigneeId.toString() : null;

  const isRequester = Boolean(uId && reqId && uId === reqId);
  const isAssignee = Boolean(uId && assId && uId === assId);
  const isAdmin = userRole === 'admin';
  const isParticipant = isRequester || isAssignee || isAdmin;

  // Unmasked phone only if participant and task is active/progressing
  const unmaskedRequesterPhone = isParticipant && t.status !== TASK_STATUSES.OPEN;
  const unmaskedAssigneePhone = isParticipant;

  return {
    id: t._id || t.id,
    _id: t._id || t.id,
    title: t.title,
    category: t.category,
    description: t.description,
    reward: t.reward,
    itemBudget: t.itemBudget || 0,
    paymentMethod: t.paymentMethod || 'cash',
    location: t.location,
    pickupAddress: t.pickupAddress || '',
    destinationAddress: t.destinationAddress || '',
    deadline: t.deadline,
    deadlineDate: t.deadlineDate,
    status: t.status,
    requesterId: t.requesterId,
    requesterName: t.requesterName,
    requesterPhone: unmaskedRequesterPhone ? t.requesterPhone : maskPhone(t.requesterPhone),
    assigneeId: t.assigneeId || null,
    assigneeName: t.assigneeName || '',
    assigneePhone: unmaskedAssigneePhone ? (t.assigneePhone || '') : maskPhone(t.assigneePhone),
    // Sensitive operational details: only for participants
    completionProof: isParticipant ? (t.completionProof || '') : '',
    completionNote: isParticipant ? (t.completionNote || '') : '',
    disputeReason: isParticipant ? (t.disputeReason || '') : '',
    disputeReportId: isParticipant ? (t.disputeReportId || null) : null,
    cancelReason: isParticipant ? (t.cancelReason || '') : '',
    note: isParticipant ? (t.note || '') : '',
    history: isParticipant ? (t.history || []) : [],
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    isRequester,
    isAssignee,
    canAccept: Boolean(!isRequester && t.status === TASK_STATUSES.OPEN && (!t.deadlineDate || new Date(t.deadlineDate) > new Date())),
    canSubmitCompletion: Boolean(isAssignee && t.status === TASK_STATUSES.ACCEPTED),
    canComplete: Boolean(isRequester && t.status === TASK_STATUSES.SUBMITTED_FOR_COMPLETION),
    canDispute: Boolean((isRequester || isAssignee) && [TASK_STATUSES.ACCEPTED, TASK_STATUSES.SUBMITTED_FOR_COMPLETION].includes(t.status)),
    canCancel: Boolean(isRequester && t.status === TASK_STATUSES.OPEN),
  };
}
