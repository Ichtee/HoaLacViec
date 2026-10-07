import { useState } from 'react';
import { Check, Eye } from 'lucide-react';
import { clsx } from 'clsx';
import { Modal } from '@/components/Modal.jsx';
import { JobCard } from '@/components/JobCard.jsx';

export const JOB_FORM_STEPS = [
  { id: 'job-step-1', label: 'Thông tin cơ bản' },
  { id: 'job-step-2', label: 'Vị trí & ca' },
  { id: 'job-step-3', label: 'Địa điểm' },
  { id: 'job-step-4', label: 'Mô tả' },
];

/** Bước nào đã điền đủ các trường bắt buộc (chỉ để hiển thị tiến độ, không thay thế kiểm tra khi gửi). */
export function computeStepCompletion(formData) {
  const positions = Array.isArray(formData.positions) ? formData.positions : [];
  return [
    Boolean(formData.title?.trim()) && Number(formData.salaryAmount) > 0 && Boolean(String(formData.contactPhone || '').trim()),
    positions.length > 0 && positions.every((p) => p.title?.trim() && Number(p.quantity) > 0),
    Boolean(formData.address?.trim()) && formData.lat !== null && formData.lng !== null,
    Boolean(formData.description?.trim()),
  ];
}

function scrollToStep(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Thanh tiến độ dính trên cùng của biểu mẫu đăng tin + nút xem trước.
 * previewJob: đối tượng có hình dạng giống tin thật để dựng JobCard.
 */
export function JobFormStepper({ formData, previewJob, storeName }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const done = computeStepCompletion(formData);
  const completed = done.filter(Boolean).length;
  const percent = Math.round((completed / JOB_FORM_STEPS.length) * 100);

  return (
    <>
      <div className="sticky top-16 z-20 -mx-4 sm:mx-0 px-4 sm:px-4 py-3 bg-cream/95 backdrop-blur-md sm:rounded-2xl border-b sm:border border-green-100">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-xs font-semibold text-text-muted" aria-live="polite">
            Đã hoàn thành <span className="text-green-dark">{completed}/{JOB_FORM_STEPS.length}</span> bước
          </p>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-green-200 bg-white text-green-dark text-xs font-semibold hover:bg-green-50 transition-colors"
          >
            <Eye className="w-4 h-4" /> Xem trước
          </button>
        </div>
        <div className="h-1.5 rounded-full bg-green-100 overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Tiến độ điền tin">
          <div className="h-full bg-green-main rounded-full transition-all duration-300" style={{ width: `${percent}%` }} />
        </div>
        <ol className="mt-2.5 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {JOB_FORM_STEPS.map((step, i) => (
            <li key={step.id} className="shrink-0">
              <button
                type="button"
                onClick={() => scrollToStep(step.id)}
                className={clsx(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors',
                  done[i]
                    ? 'bg-green-50 border-green-200 text-green-dark'
                    : 'bg-white border-gray-200 text-text-muted hover:border-green-main'
                )}
              >
                <span
                  className={clsx(
                    'w-4 h-4 rounded-full flex items-center justify-center text-[10px]',
                    done[i] ? 'bg-green-main text-white' : 'bg-gray-100 text-gray-500'
                  )}
                >
                  {done[i] ? <Check className="w-3 h-3" /> : i + 1}
                </span>
                {step.label}
              </button>
            </li>
          ))}
        </ol>
      </div>

      <Modal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} title="Xem trước tin tuyển dụng" size="md">
        <p className="text-xs text-text-muted mb-3">Đây là cách sinh viên nhìn thấy tin của bạn trong danh sách việc làm.</p>
        <div className="pointer-events-none" aria-hidden="true">
          <JobCard job={previewJob} />
        </div>
        <div className="mt-4 space-y-3 text-sm">
          <p className="text-xs font-semibold text-text-muted">Cửa hàng: {storeName}</p>
          {formData.description?.trim() ? (
            <div>
              <h3 className="font-bold text-text-main mb-1">Mô tả công việc</h3>
              <p className="text-text-muted whitespace-pre-line">{formData.description}</p>
            </div>
          ) : (
            <p className="text-text-muted italic">Chưa có mô tả công việc.</p>
          )}
          {formData.requirements?.trim() && (
            <div>
              <h3 className="font-bold text-text-main mb-1">Yêu cầu & quyền lợi</h3>
              <p className="text-text-muted whitespace-pre-line">{formData.requirements}</p>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
