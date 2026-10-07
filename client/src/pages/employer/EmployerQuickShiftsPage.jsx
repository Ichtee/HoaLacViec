import { useCallback, useEffect, useState } from 'react';
import { Zap, Plus, X } from 'lucide-react';
import { clsx } from 'clsx';
import { getMyQuickShifts, createQuickShift, cancelQuickShift } from '@/services';
import { Modal } from '@/components/Modal.jsx';
import { Toast } from '@/components/Feedback.jsx';

const STATUS_LABEL = {
  open: ['Đang mở', 'bg-green-50 text-green-700'],
  filled: ['Đã đủ người', 'bg-blue-50 text-blue-700'],
  cancelled: ['Đã huỷ', 'bg-gray-100 text-gray-600'],
  expired: ['Hết hạn', 'bg-amber-50 text-amber-700'],
};

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const EMPTY_FORM = () => ({
  title: '', date: today(), startTime: '18:00', endTime: '22:00', headcount: 2, wageRate: 30000, description: '',
});

export default function EmployerQuickShiftsPage() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    try {
      const rows = await getMyQuickShifts();
      setShifts(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không tải được danh sách ca lẻ.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await createQuickShift({ ...form, headcount: Number(form.headcount), wageRate: Number(form.wageRate) });
      setModalOpen(false);
      setForm(EMPTY_FORM());
      setToast({ type: 'success', message: 'Đã đăng ca lẻ. Người tìm việc sẽ thấy ngay.' });
      load();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể đăng ca lẻ.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(shift) {
    try {
      await cancelQuickShift(shift.id);
      setToast({ type: 'success', message: 'Đã huỷ ca lẻ và thông báo cho người đã nhận.' });
      load();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể huỷ ca.' });
    }
  }

  const field = 'mt-1 w-full p-2.5 rounded-xl border border-stone-200 bg-white font-normal focus:ring-2 focus:ring-green-main focus:outline-none';

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-500 fill-yellow-400" /> Tuyển nhanh - ca lẻ
          </h1>
          <p className="text-xs text-text-muted mt-1">Cần người gấp trong vài ngày tới? Đăng ca, người tìm việc đã xác minh nhận trước được trước, không cần duyệt tin.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-green-main text-white font-bold text-xs hover:bg-green-dark shadow-sm shrink-0 self-start sm:self-center"
        >
          <Plus className="w-4 h-4" /> Đăng ca lẻ
        </button>
      </div>

      {loading ? <p className="text-center text-text-muted py-10">Đang tải...</p> : shifts.length === 0 ? (
        <p className="bg-white rounded-2xl p-6 text-sm text-text-muted text-center">Bạn chưa đăng ca lẻ nào.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {shifts.map((shift) => {
            const [label, tone] = STATUS_LABEL[shift.status] || [shift.status, 'bg-gray-100 text-gray-600'];
            return (
              <div key={shift.id} className="bg-white rounded-2xl p-5 border border-stone-200 shadow-card space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-text-main">{shift.title}</p>
                    <p className="text-sm text-text-muted">{shift.date} · {shift.startTime}–{shift.endTime}</p>
                  </div>
                  <span className={clsx('text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0', tone)}>{label}</span>
                </div>
                <p className="text-sm text-text-main">
                  {shift.claimedCount}/{shift.headcount} người đã nhận · {Number(shift.wageRate).toLocaleString('vi-VN')}đ/giờ
                </p>
                {shift.claims?.length > 0 && (
                  <ul className="text-sm text-text-main space-y-1 border-t border-stone-100 pt-2">
                    {shift.claims.map((c) => (
                      <li key={String(c.userId)} className="flex justify-between gap-2">
                        <span>{c.name || 'Người lao động'}</span>
                        {c.phone && <a className="text-green-dark font-semibold" href={`tel:${c.phone}`}>{c.phone}</a>}
                      </li>
                    ))}
                  </ul>
                )}
                {(shift.status === 'open' || shift.status === 'filled') && (
                  <button
                    onClick={() => handleCancel(shift)}
                    className="w-full rounded-xl bg-red-50 text-red-600 py-2 text-sm font-semibold hover:bg-red-100"
                  >
                    Huỷ ca
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <Modal isOpen onClose={() => { if (!submitting) setModalOpen(false); }} title="Đăng ca lẻ">
          <form onSubmit={handleCreate} className="space-y-3 text-xs">
            <label className="block font-bold text-text-main">Vị trí cần người *
              <input required maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ví dụ: Phục vụ bàn" className={field} />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="block font-bold text-text-main col-span-3 sm:col-span-1">Ngày *
                <input required type="date" min={today()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={field} />
              </label>
              <label className="block font-bold text-text-main">Từ *
                <input required type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className={field} />
              </label>
              <label className="block font-bold text-text-main">Đến *
                <input required type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className={field} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block font-bold text-text-main">Số người *
                <input required type="number" min={1} max={20} value={form.headcount} onChange={(e) => setForm({ ...form, headcount: e.target.value })} className={field} />
              </label>
              <label className="block font-bold text-text-main">Lương (đ/giờ) *
                <input required type="number" min={10000} max={500000} step={1000} value={form.wageRate} onChange={(e) => setForm({ ...form, wageRate: e.target.value })} className={field} />
              </label>
            </div>
            <label className="block font-bold text-text-main">Ghi chú
              <textarea rows={2} maxLength={1000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Yêu cầu, trang phục, người liên hệ..." className={clsx(field, 'resize-none')} />
            </label>
            <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
              <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2.5 rounded-xl bg-gray-100 text-text-muted font-semibold inline-flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Hủy
              </button>
              <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-xl bg-green-main text-white font-bold hover:bg-green-dark disabled:opacity-50">
                {submitting ? 'Đang đăng...' : 'Đăng ca'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
