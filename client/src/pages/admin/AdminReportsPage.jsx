import { useState, useEffect } from 'react';
import { Flag, CheckCircle, ExternalLink, Filter, Clock } from 'lucide-react';
import { getReports, resolveReport } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Modal } from '@/components/Modal.jsx';
import { Toast } from '@/components/Feedback.jsx';

const STATUS_FILTERS = [
  { id: 'all', label: 'Tất cả trạng thái' },
  { id: 'pending', label: 'Chờ xử lý' },
  { id: 'investigating', label: 'Đang xác minh' },
  { id: 'resolved', label: 'Đã giải quyết' },
  { id: 'dismissed', label: 'Đã bác bỏ' },
];

const TARGET_TYPE_FILTERS = [
  { id: 'all', label: 'Tất cả đối tượng' },
  { id: 'task', label: 'Chợ việc vặt' },
  { id: 'job', label: 'Tin tuyển dụng' },
  { id: 'review', label: 'Đánh giá' },
  { id: 'employer', label: 'Nhà tuyển dụng' },
  { id: 'student', label: 'Sinh viên' },
];

export default function AdminReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [toast, setToast] = useState(null);

  // Modal resolve
  const [selectedReport, setSelectedReport] = useState(null);
  const [resolveAction, setResolveAction] = useState('warned');
  const [resolveStatus, setResolveStatus] = useState('resolved');
  const [taskResolution, setTaskResolution] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    getReports({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      targetType: typeFilter !== 'all' ? typeFilter : undefined,
    })
      .then((data) => {
        if (!mounted) return;
        setReports(Array.isArray(data) ? data : data?.reports || []);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error(err);
        setToast({ type: 'error', message: err.message || 'Không thể tải danh sách báo cáo.' });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [statusFilter, typeFilter]);

  function handleOpenResolve(report) {
    setSelectedReport(report);
    setResolveStatus('resolved');
    setResolveAction(report.targetType === 'task' ? 'no_action' : 'warned');
    setTaskResolution(report.targetType === 'task' ? 'completed' : '');
    setResolutionNote('');
  }

  async function handleConfirmResolve(e) {
    e.preventDefault();
    if (!selectedReport) return;
    if (!resolutionNote.trim()) {
      setToast({ type: 'error', message: 'Vui lòng nhập ghi chú kết luận xử lý bắt buộc.' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await resolveReport(selectedReport.id || selectedReport._id, {
        status: resolveStatus,
        action: resolveAction,
        taskResolution: selectedReport.targetType === 'task' ? taskResolution : undefined,
        resolutionNote: resolutionNote.trim(),
      });

      const updated = res.report || res;
      setReports((prev) =>
        prev.map((r) => ((r.id || r._id) === (selectedReport.id || selectedReport._id) ? { ...r, ...updated, status: resolveStatus, actionTaken: resolveAction } : r))
      );

      setToast({ type: 'success', message: 'Đã cập nhật biên bản xử lý báo cáo thành công!' });
      setSelectedReport(null);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi xử lý báo cáo.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-12">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <Flag className="w-6 h-6 text-red-500" /> Quản lý Báo cáo vi phạm & Giải quyết tranh chấp
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Xác minh khiếu nại về việc vặt, nợ lương, thái độ làm việc, check-in ảo hoặc bài đăng sai quy định.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Lọc trạng thái:
          </span>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === f.id
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500">Đối tượng:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            {TARGET_TYPE_FILTERS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Đang tải danh sách báo cáo khiếu nại...</div>
      ) : reports.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-gray-100 shadow-sm text-gray-400 space-y-2">
          <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
          <p className="font-bold text-gray-700 text-sm">Tuyệt vời! Không có báo cáo nào tồn đọng</p>
          <p className="text-xs text-gray-500">Mọi tranh chấp hoặc vi phạm cộng đồng hiện đã được xử lý.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((rep) => {
            const reportId = rep.id || rep._id;
            const isPending = rep.status === 'pending';
            const isInvestigating = rep.status === 'investigating';
            const isResolved = rep.status === 'resolved';
            const isDismissed = rep.status === 'dismissed';

            return (
              <div
                key={reportId}
                className="bg-white p-6 rounded-3xl border border-gray-100 hover:border-gray-200 shadow-sm transition-all flex flex-col md:flex-row md:items-start justify-between gap-6"
              >
                <div className="space-y-2.5 text-xs flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        isResolved
                          ? 'success'
                          : isDismissed
                          ? 'gray'
                          : isInvestigating
                          ? 'warning'
                          : 'danger'
                      }
                      size="sm"
                    >
                      {isPending && 'Chờ xử lý'}
                      {isInvestigating && 'Đang xác minh'}
                      {isResolved && 'Đã giải quyết'}
                      {isDismissed && 'Đã bác bỏ'}
                    </Badge>

                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 uppercase tracking-wide border border-purple-100">
                      {rep.targetType}
                    </span>

                    <span className="text-gray-400 text-[11px] flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {rep.createdAtFormatted || 'Gần đây'}
                    </span>
                  </div>

                  <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-snug">
                    {rep.reason}
                  </h3>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-600 bg-gray-50/80 p-2.5 rounded-xl border border-gray-100">
                    <div>
                      Người báo cáo: <strong>{rep.reporterName || rep.reporterEmail || 'Thành viên'}</strong>
                    </div>
                    <div>
                      Đối tượng: <strong className="text-gray-900">{rep.target}</strong>
                    </div>
                    {rep.reportedUserId && (
                      <div>
                        Bị cáo buộc: <strong className="text-red-700">{rep.reportedUserId.name || rep.reportedUserId.email}</strong> ({rep.reportedUserId.role})
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-1.5">
                    <p className="font-bold text-gray-700">Nội dung khiếu nại:</p>
                    <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{rep.content}</p>
                    {rep.evidenceUrl && (
                      <p className="pt-1">
                        <a
                          href={rep.evidenceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 font-bold hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" /> Xem ảnh minh chứng / tài liệu đính kèm
                        </a>
                      </p>
                    )}
                  </div>

                  {/* Resolution Summary if already addressed */}
                  {(isResolved || isDismissed) && (
                    <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 text-emerald-900 space-y-1">
                      <p className="font-bold flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        Kết luận xử lý: <span className="font-semibold">{rep.actionTaken || 'Đã giải quyết'}</span>
                        {rep.taskResolution && <span className="ml-1 font-bold">({rep.taskResolution})</span>}
                      </p>
                      <p className="text-emerald-800 italic">"{rep.resolutionNote}"</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 shrink-0 md:w-44">
                  {!isResolved && !isDismissed && (
                    <button
                      onClick={() => handleOpenResolve(rep)}
                      className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm transition-all text-center"
                    >
                      Xử lý báo cáo này
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Xử lý báo cáo */}
      <Modal
        isOpen={Boolean(selectedReport)}
        onClose={() => setSelectedReport(null)}
        title="Biên bản giải quyết khiếu nại & Báo cáo vi phạm"
        size="lg"
      >
        {selectedReport && (
          <form onSubmit={handleConfirmResolve} className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 space-y-1 text-xs">
              <p>
                <strong>Khiếu nại về:</strong> {selectedReport.target} ({selectedReport.targetType})
              </p>
              <p>
                <strong>Lý do:</strong> {selectedReport.reason}
              </p>
              {selectedReport.reportedUserId && (
                <p>
                  <strong>Người bị xử lý (nếu kỷ luật):</strong> {selectedReport.reportedUserId.name} ({selectedReport.reportedUserId.role})
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Trạng thái báo cáo *</label>
                <select
                  value={resolveStatus}
                  onChange={(e) => setResolveStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-red-400"
                >
                  <option value="resolved">Đã giải quyết (resolved)</option>
                  <option value="investigating">Đang điều tra / xác minh (investigating)</option>
                  <option value="dismissed">Bác bỏ báo cáo (dismissed)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Hình thức xử lý đối tượng *</label>
                <select
                  value={resolveAction}
                  onChange={(e) => setResolveAction(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-red-400"
                >
                  <option value="no_action">Không áp dụng chế tài (Hòa giải/Không vi phạm)</option>
                  <option value="warned">Gửi cảnh cáo vi phạm</option>
                  <option value="content_removed">Gỡ bỏ nội dung vi phạm</option>
                  <option value="account_suspended">Tạm khóa tài khoản</option>
                  <option value="account_locked">Khóa vĩnh viễn tài khoản</option>
                  <option value="refund_required">Yêu cầu hoàn trả thù lao/chi phí</option>
                </select>
              </div>
            </div>

            {/* If task, allow resolving task state */}
            {selectedReport.targetType === 'task' && (
              <div className="p-3 bg-purple-50/70 rounded-2xl border border-purple-100 space-y-1">
                <label className="block text-xs font-bold text-purple-900 mb-1">
                  Quyết định trạng thái công việc (MicroTask Resolution):
                </label>
                <select
                  value={taskResolution}
                  onChange={(e) => setTaskResolution(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-xs font-semibold text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  <option value="">Không thay đổi trạng thái task</option>
                  <option value="completed">Công nhận hoàn thành (Completed) cho người làm</option>
                  <option value="cancelled">Hủy bỏ công việc (Cancelled) & Hoàn trả</option>
                </select>
                <p className="text-[11px] text-purple-700">
                  Lựa chọn này sẽ cập nhật trực tiếp trạng thái công việc trên hệ thống Chợ việc vặt.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Ghi chú kết luận xử lý bắt buộc *
              </label>
              <textarea
                rows={3}
                required
                value={resolutionNote}
                placeholder="Ghi rõ lý do đưa ra quyết định, căn cứ quy định cộng đồng để lưu biên bản kiểm toán..."
                onChange={(e) => setResolutionNote(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm"
              >
                {submitting ? 'Đang lưu...' : 'Lưu kết luận xử lý'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
