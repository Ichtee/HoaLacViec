import { Bike, CheckCircle, Clock, MapPin, User, AlertTriangle, Star, ExternalLink, Send } from 'lucide-react';
import { Badge } from '@/components/Badge.jsx';

export default function MicroTaskCard({
  task,
  user,
  setSubmitCompletionTask,
  setCompletionProof,
  setCompletionNote,
  setDisputeModalTask,
  setCancelModalTask,
  setReviewModalTask,
  setReviewRating,
  setReviewComment,
  handleOpenAccept,
  handleCompleteTask,
}) {
  const taskId = task._id || task.id;
  const status = task.status;

  const isOpen = status === 'open';
  const isAccepted = status === 'accepted';
  const isSubmitted = status === 'submitted_for_completion';
  const isCompleted = status === 'completed';
  const isDisputed = status === 'disputed';
  const isCancelled = status === 'cancelled';
  const isExpired = status === 'expired';

  const isRequester =
    task.isRequester ||
    (user?._id && task.requesterId && (task.requesterId._id || task.requesterId).toString() === user._id.toString());
  const isAssignee =
    task.isAssignee ||
    (user?._id && task.assigneeId && (task.assigneeId._id || task.assigneeId).toString() === user._id.toString());
  const isParticipant = isRequester || isAssignee || user?.role === 'admin';

  const hasRoute = Boolean(task.pickupAddress && task.destinationAddress);
  const directionsUrl = hasRoute
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(task.pickupAddress)}&destination=${encodeURIComponent(task.destinationAddress)}`
    : task.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.location)}`
    : null;

  return (
    <div
      className="bg-white rounded-3xl p-6 border border-gray-100 hover:border-orange-300 shadow-card hover:shadow-modal transition-all flex flex-col justify-between space-y-4"
    >
      <div className="space-y-3">
        {/* Top: Status & Reward */}
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant={
              isOpen
                ? 'green'
                : isAccepted
                ? 'warning'
                : isSubmitted
                ? 'purple'
                : isCompleted
                ? 'success'
                : isDisputed
                ? 'danger'
                : 'gray'
            }
            size="sm"
          >
            {isOpen && 'Đang tìm người'}
            {isAccepted && 'Đang thực hiện'}
            {isSubmitted && 'Chờ nghiệm thu'}
            {isCompleted && 'Đã hoàn thành'}
            {isDisputed && 'Đang tranh chấp'}
            {isCancelled && 'Đã hủy'}
            {isExpired && 'Đã hết hạn'}
          </Badge>

          <div className="text-right">
            <span className="text-sm sm:text-base font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-100">
              {Number(task.reward).toLocaleString('vi-VN')}đ
            </span>
            {task.itemBudget > 0 && (
              <p className="text-[10px] text-gray-500 mt-1">
                + Ứng mua {Number(task.itemBudget).toLocaleString('vi-VN')}đ ({task.paymentMethod === 'banking' ? 'CK' : 'Tiền mặt'})
              </p>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="font-bold text-base text-text-main leading-snug line-clamp-2">
          {task.title}
        </h3>

        {/* Description */}
        <p className="text-xs text-text-muted leading-relaxed line-clamp-3">
          {task.description}
        </p>

        {/* Route or Location Info */}
        <div className="space-y-1.5 pt-2 text-xs text-text-muted">
          {hasRoute ? (
            <div className="p-2.5 rounded-xl bg-orange-50/50 border border-orange-100 space-y-1 text-xs">
              <div className="flex items-center gap-1.5 text-text-main font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="truncate">Đón: {task.pickupAddress}</span>
              </div>
              <div className="flex items-center gap-1.5 text-text-main font-medium">
                <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                <span className="truncate">Đến: {task.destinationAddress}</span>
              </div>
              {task.route?.distanceKm != null && (
                <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md inline-flex items-center gap-1 my-1 border border-emerald-200/50">
                  🛵 Lộ trình: {task.route.distanceKm} km (~{task.route.durationMinutes} phút)
                </div>
              )}
              {directionsUrl && (
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 pt-0.5"
                >
                  <ExternalLink className="w-3 h-3" /> Chỉ đường lộ trình trên Google Maps
                </a>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 truncate">
                <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                <span className="font-medium text-text-main truncate" title={task.location}>
                  {task.location}
                </span>
              </div>
              {directionsUrl && (
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-lg shrink-0 transition-colors"
                  title="Tìm địa chỉ trên Google Maps"
                >
                  Bản đồ ↗
                </a>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>
              Hạn chót: <span className="font-semibold text-text-main">{task.deadline}</span>
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Người nhờ: <strong className="text-text-main">{task.requesterName}</strong></span>
            </div>
            {isParticipant && task.requesterPhone && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                {task.requesterPhone}
              </span>
            )}
          </div>

          {task.assigneeName && (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Bike className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Người nhận: <strong className="text-text-main">{task.assigneeName}</strong></span>
              </div>
              {isParticipant && task.assigneePhone && (
                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                  {task.assigneePhone}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Sensitive Proof or Dispute Box (Participants only) */}
        {isParticipant && task.completionProof && (
          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-xs space-y-1">
            <p className="font-bold text-blue-900 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-blue-600" /> Minh chứng hoàn thành:
            </p>
            <p className="text-blue-800 break-words">{task.completionProof}</p>
            {task.completionNote && <p className="text-blue-700 italic">Ghi chú: {task.completionNote}</p>}
          </div>
        )}

        {isParticipant && isDisputed && task.disputeReason && (
          <div className="p-2.5 rounded-xl bg-red-50 border border-red-100 text-xs space-y-1">
            <p className="font-bold text-red-900 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> Lý do khiếu nại tranh chấp:
            </p>
            <p className="text-red-800">{task.disputeReason}</p>
          </div>
        )}
      </div>

      {/* Bottom Actions based strictly on Role & Status */}
      <div className="pt-3 border-t border-gray-100 space-y-2">
        {isOpen && (
          <>
            {isRequester ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-text-muted italic">Đang chờ bạn nhận việc...</span>
                <button
                  onClick={() => setCancelModalTask(task)}
                  className="px-3 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold"
                >
                  Hủy bài đăng
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleOpenAccept(task)}
                className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95"
              >
                <CheckCircle className="w-4 h-4" /> Nhận việc này ({Number(task.reward).toLocaleString('vi-VN')}đ)
              </button>
            )}
          </>
        )}

        {isAccepted && (
          <div className="flex flex-col gap-2">
            {isAssignee ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSubmitCompletionTask(task);
                    setCompletionProof('');
                    setCompletionNote('');
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> Gửi kết quả hoàn thành
                </button>
                <button
                  onClick={() => setDisputeModalTask(task)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 text-xs font-medium"
                  title="Báo cáo sự cố hoặc tranh chấp"
                >
                  Khiếu nại
                </button>
              </div>
            ) : isRequester ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-amber-700 font-medium">
                  Đang thực hiện ({task.assigneeName})
                </span>
                <button
                  onClick={() => setDisputeModalTask(task)}
                  className="px-2.5 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold"
                >
                  Báo sự cố
                </button>
              </div>
            ) : (
              <span className="text-xs text-gray-500 text-center block">Đang có bạn thực hiện</span>
            )}
          </div>
        )}

        {isSubmitted && (
          <div className="flex flex-col gap-2">
            {isRequester ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCompleteTask(taskId)}
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" /> Xác nhận nghiệm thu ✓
                </button>
                <button
                  onClick={() => setDisputeModalTask(task)}
                  className="px-3 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold"
                >
                  Khiếu nại
                </button>
              </div>
            ) : isAssignee ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-blue-700 font-medium">
                  Đã nộp kết quả — Đang chờ nghiệm thu
                </span>
                <button
                  onClick={() => setDisputeModalTask(task)}
                  className="px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 text-xs"
                >
                  Khiếu nại
                </button>
              </div>
            ) : (
              <span className="text-xs text-gray-500 text-center block">Chờ nghiệm thu hoàn thành</span>
            )}
          </div>
        )}

        {isCompleted && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-xl">
              ✓ Đã hoàn thành
            </span>
            {isParticipant && (
              <button
                onClick={() => {
                  setReviewModalTask(task);
                  setReviewRating(5);
                  setReviewComment('');
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold transition-colors"
              >
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> Đánh giá
              </button>
            )}
          </div>
        )}

        {isDisputed && (
          <div className="w-full text-center text-xs text-red-700 font-medium py-1.5 bg-red-50 rounded-xl">
            ⚠️ Đang được Ban quản trị đối soát giải quyết
          </div>
        )}

        {isCancelled && (
          <div className="w-full text-center text-xs text-gray-500 py-1.5 bg-gray-50 rounded-xl">
            Đã hủy bỏ công việc
          </div>
        )}

        {isExpired && (
          <div className="w-full text-center text-xs text-gray-400 py-1.5 bg-gray-50 rounded-xl">
            Đã hết hạn hoàn thành
          </div>
        )}
      </div>
    </div>
  );
}
