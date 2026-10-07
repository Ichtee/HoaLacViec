import { Star } from 'lucide-react';
import { Modal } from '@/components/Modal.jsx';

/** Năm hộp thoại của trang Việc vặt: nhận việc, báo cáo hoàn thành, khiếu nại, hủy bài, đánh giá. */
export default function MicroTaskModals({
  submitting,
  acceptModalTask,
  setAcceptModalTask,
  acceptPhone,
  setAcceptPhone,
  acceptNote,
  setAcceptNote,
  submitCompletionTask,
  setSubmitCompletionTask,
  completionProof,
  setCompletionProof,
  completionNote,
  setCompletionNote,
  disputeModalTask,
  setDisputeModalTask,
  disputeReason,
  setDisputeReason,
  disputeContent,
  setDisputeContent,
  disputeEvidence,
  setDisputeEvidence,
  cancelModalTask,
  setCancelModalTask,
  cancelReason,
  setCancelReason,
  reviewModalTask,
  setReviewModalTask,
  reviewRating,
  setReviewRating,
  reviewComment,
  setReviewComment,
  handleAcceptTask,
  handleSubmitCompletion,
  handleDisputeTask,
  handleCancelTask,
  handleCreateReview,
}) {
  return (
    <>
      {/* Modal Nhận việc vặt */}
      <Modal isOpen={Boolean(acceptModalTask)} onClose={() => setAcceptModalTask(null)} title="Xác nhận nhận việc vặt" size="md">
        {acceptModalTask && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-2xl border border-green-100 space-y-1">
              <p className="font-bold text-text-main text-sm">{acceptModalTask.title}</p>
              <p className="text-xs text-green-dark font-semibold">
                Thù lao nhận được: {Number(acceptModalTask.reward).toLocaleString('vi-VN')}đ
              </p>
              {acceptModalTask.itemBudget > 0 && (
                <p className="text-xs text-gray-600">
                  Tiền ứng mua hộ: <strong>{Number(acceptModalTask.itemBudget).toLocaleString('vi-VN')}đ</strong>
                </p>
              )}
              <p className="text-xs text-text-muted">
                Địa điểm: <strong className="text-text-main">{acceptModalTask.location}</strong> • Hạn chót: {acceptModalTask.deadline}
              </p>
              <p className="text-xs text-text-muted">
                Người nhờ: {acceptModalTask.requesterName} (SĐT sẽ mở khóa đầy đủ ngay sau khi bạn nhận việc)
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Số điện thoại liên hệ của bạn *</label>
              <input aria-label="Số điện thoại liên hệ của bạn"
                type="tel"
                required
                value={acceptPhone}
                placeholder="Nhập 10 số di động để người nhờ gọi cho bạn"
                onChange={(e) => setAcceptPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-main"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Lời nhắn (không bắt buộc)</label>
              <input aria-label="Lời nhắn (không bắt buộc)"
                type="text"
                value={acceptNote}
                placeholder="VD: Mình có xe máy, khoảng 15 phút nữa mình ghé..."
                onChange={(e) => setAcceptNote(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-main"
              />
            </div>

            <div className="p-3 bg-blue-50/80 border border-blue-200/70 rounded-2xl text-xs text-blue-900 flex items-start gap-2.5">
              <span className="text-base shrink-0">🛡️</span>
              <p className="leading-relaxed">
                <strong>Quy định:</strong> Mỗi bạn sinh viên chỉ được nhận tối đa <strong>2 việc vặt cùng một lúc</strong> để đảm bảo hoàn thành chất lượng và đúng hạn.
              </p>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAcceptModalTask(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold"
              >
                Để sau
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleAcceptTask}
                className="px-5 py-2 rounded-xl bg-green-main hover:bg-green-dark text-white text-xs font-bold shadow-sm"
              >
                {submitting ? 'Đang nhận...' : 'Đồng ý nhận việc'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Báo cáo kết quả hoàn thành (Assignee) */}
      <Modal
        isOpen={Boolean(submitCompletionTask)}
        onClose={() => setSubmitCompletionTask(null)}
        title="Gửi báo cáo hoàn thành công việc"
        size="md"
      >
        {submitCompletionTask && (
          <div className="space-y-4">
            <p className="text-xs text-text-muted">
              Vui lòng cung cấp minh chứng (link ảnh, biên lai, ảnh giao hàng) và ghi chú hoàn tất để người nhờ kiểm tra và nghiệm thu thù lao.
            </p>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Link ảnh minh chứng hoặc biên nhận</label>
              <input aria-label="Link ảnh minh chứng hoặc biên nhận"
                type="text"
                value={completionProof}
                placeholder="VD: Link ảnh Google Drive, Imgur hoặc mô tả đã giao..."
                onChange={(e) => setCompletionProof(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-main"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Ghi chú cho người nhờ</label>
              <textarea aria-label="Ghi chú cho người nhờ"
                rows={3}
                value={completionNote}
                placeholder="VD: Đã gửi đồ tại bàn lễ tân KTX Dom A cho bạn..."
                onChange={(e) => setCompletionNote(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-main"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSubmitCompletionTask(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmitCompletion}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
              >
                {submitting ? 'Đang gửi...' : 'Gửi báo cáo nghiệm thu'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Báo cáo tranh chấp / Khiếu nại */}
      <Modal
        isOpen={Boolean(disputeModalTask)}
        onClose={() => setDisputeModalTask(null)}
        title="Mở khiếu nại tranh chấp việc vặt"
        size="md"
      >
        {disputeModalTask && (
          <div className="space-y-4">
            <div className="p-3 bg-red-50 rounded-2xl border border-red-100 text-xs text-red-700">
              Khi bạn mở khiếu nại, công việc sẽ chuyển sang trạng thái đối soát. Ban quản trị sẽ liên hệ hai bên và xem xét minh chứng để xử lý công bằng.
            </div>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Lý do khiếu nại *</label>
              <input aria-label="Lý do khiếu nại"
                type="text"
                required
                value={disputeReason}
                placeholder="VD: Không liên lạc được, giao thiếu đồ, không trả tiền ứng..."
                onChange={(e) => setDisputeReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Nội dung giải trình chi tiết</label>
              <textarea aria-label="Nội dung giải trình chi tiết"
                rows={3}
                value={disputeContent}
                placeholder="Mô tả cụ thể sự việc, mốc thời gian và yêu cầu giải quyết..."
                onChange={(e) => setDisputeContent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Link bằng chứng (nếu có)</label>
              <input aria-label="Link bằng chứng (nếu có)"
                type="text"
                value={disputeEvidence}
                placeholder="Link ảnh chụp tin nhắn, cuộc gọi, hóa đơn..."
                onChange={(e) => setDisputeEvidence(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDisputeModalTask(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDisputeTask}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm"
              >
                {submitting ? 'Đang gửi...' : 'Gửi khiếu nại lên BQT'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Hủy bài đăng */}
      <Modal isOpen={Boolean(cancelModalTask)} onClose={() => setCancelModalTask(null)} title="Hủy bài đăng việc vặt" size="sm">
        {cancelModalTask && (
          <div className="space-y-4">
            <p className="text-xs text-text-muted">
              Bạn có chắc chắn muốn hủy bài đăng <strong>"{cancelModalTask.title}"</strong>?
            </p>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Lý do hủy (tùy chọn)</label>
              <input aria-label="Lý do hủy (tùy chọn)"
                type="text"
                value={cancelReason}
                placeholder="VD: Đã tìm được người quen giúp, thay đổi kế hoạch..."
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-main"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelModalTask(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold"
              >
                Giữ lại
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleCancelTask}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm"
              >
                {submitting ? 'Đang hủy...' : 'Xác nhận hủy'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Đánh giá sau hoàn thành */}
      <Modal isOpen={Boolean(reviewModalTask)} onClose={() => setReviewModalTask(null)} title="Đánh giá dịch vụ việc vặt" size="md">
        {reviewModalTask && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-text-main mb-2">Số sao đánh giá</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        star <= reviewRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-sm font-bold text-text-main ml-2">{reviewRating} / 5 sao</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Nhận xét chi tiết *</label>
              <textarea aria-label="Nhận xét chi tiết"
                rows={3}
                required
                value={reviewComment}
                placeholder="Nhận xét về thái độ, độ đúng giờ, sự nhiệt tình..."
                onChange={(e) => setReviewComment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-main"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewModalTask(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleCreateReview}
                className="px-5 py-2 rounded-xl bg-green-main hover:bg-green-dark text-white text-xs font-bold shadow-sm"
              >
                {submitting ? 'Đang gửi...' : 'Gửi đánh giá'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
