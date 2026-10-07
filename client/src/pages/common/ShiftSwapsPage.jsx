import { useCallback, useEffect, useState } from 'react';
import { Repeat } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import {
  getShifts, getShiftSwaps, getSwapColleagues, createShiftSwap, actOnShiftSwap,
} from '@/services';
import { Toast } from '@/components/Feedback.jsx';
import { PageHeader } from '@/components/PageHeader.jsx';
import { LoadingPage, EmptyState } from '@/components/Feedback.jsx';

const STATUS = {
  pending_peer: ['Chờ đồng nghiệp trả lời', 'bg-amber-50 text-amber-700'],
  pending_employer: ['Chờ cửa hàng duyệt', 'bg-blue-50 text-blue-700'],
  approved: ['Đã duyệt', 'bg-green-50 text-green-700'],
  declined: ['Đồng nghiệp từ chối', 'bg-gray-100 text-gray-600'],
  rejected: ['Cửa hàng từ chối', 'bg-red-50 text-red-600'],
  cancelled: ['Đã rút lại', 'bg-gray-100 text-gray-600'],
  expired: ['Hết hạn', 'bg-gray-100 text-gray-600'],
};

const shiftLabel = (shift) => (shift ? `${shift.date} · ${shift.startTime}–${shift.endTime} · ${shift.storeName || ''}` : 'Ca làm');

/** Đổi ca / nhờ làm thay: dùng chung cho nhân viên (tạo, trả lời) và cửa hàng (duyệt). */
export default function ShiftSwapsPage() {
  const { user } = useAuth();
  const isEmployer = user?.role === 'employer';
  const [swaps, setSwaps] = useState([]);
  const [myShifts, setMyShifts] = useState([]);
  const [colleagues, setColleagues] = useState([]);
  const [form, setForm] = useState({ shiftId: '', targetUserId: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    try {
      const rows = await getShiftSwaps();
      setSwaps(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không tải được danh sách đổi ca.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isEmployer || !user?.id) return;
    getShifts().then((rows) => {
      const now = Date.now();
      setMyShifts((Array.isArray(rows) ? rows : []).filter((s) =>
        s.scheduleStatus === 'published' && s.attendanceStatus === 'not_started' && new Date(s.startAt).getTime() > now));
    }).catch(() => {});
  }, [isEmployer, user?.id]);

  useEffect(() => {
    if (!form.shiftId) return;
    getSwapColleagues(form.shiftId)
      .then((rows) => setColleagues(Array.isArray(rows) ? rows : []))
      .catch(() => setColleagues([]));
  }, [form.shiftId]);

  async function run(fn, success) {
    setBusy(true);
    try {
      await fn();
      setToast({ type: 'success', message: success });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Thao tác thất bại.' });
    } finally {
      setBusy(false);
      load();
    }
  }

  const input = 'mt-1 w-full p-2.5 rounded-xl border border-stone-200 text-sm font-normal focus:ring-2 focus:ring-green-main focus:outline-none';
  const me = String(user?.id || '');

  function actions(swap) {
    const buttons = [];
    const act = (label, action, tone, success) => buttons.push(
      <button key={action} disabled={busy} onClick={() => run(() => actOnShiftSwap(swap.id, action), success)}
        className={clsx('px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-50', tone)}>{label}</button>
    );
    if (swap.status === 'pending_peer' && String(swap.targetUserId) === me) {
      act('Đồng ý làm thay', 'peer-accept', 'bg-green-main text-white', 'Đã đồng ý.');
      act('Từ chối', 'peer-decline', 'bg-gray-100 text-text-muted', 'Đã từ chối.');
    }
    if (swap.status === 'pending_employer' && isEmployer) {
      act('Duyệt', 'approve', 'bg-green-main text-white', 'Đã chuyển ca.');
      act('Từ chối', 'reject', 'bg-red-50 text-red-600', 'Đã từ chối.');
    }
    if (['pending_peer', 'pending_employer'].includes(swap.status) && String(swap.requesterUserId) === me) {
      act('Rút lại', 'cancel', 'bg-gray-100 text-text-muted', 'Đã rút lại đề nghị.');
    }
    return buttons;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <PageHeader icon={Repeat} title="Đổi ca" description={isEmployer
            ? 'Duyệt các đề nghị nhờ đồng nghiệp làm thay sau khi người nhận đã đồng ý.'
            : 'Bận đột xuất? Nhờ đồng nghiệp cùng cửa hàng làm thay. Cần đồng nghiệp đồng ý và cửa hàng duyệt.'} />

      {!isEmployer && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await createShiftSwap(form);
              setForm({ shiftId: '', targetUserId: '', message: '' });
            }, 'Đã gửi đề nghị cho đồng nghiệp.');
          }}
          className="bg-white p-5 rounded-3xl border border-stone-200 shadow-card grid gap-3 sm:grid-cols-2"
        >
          <label className="text-xs font-bold text-text-main sm:col-span-2">Ca cần nhờ làm thay
            <select required value={form.shiftId} onChange={(e) => setForm({ ...form, shiftId: e.target.value, targetUserId: '' })} className={input}>
              <option value="">Chọn ca sắp tới</option>
              {myShifts.map((s) => <option key={s._id || s.id} value={s._id || s.id}>{shiftLabel(s)}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-text-main">Đồng nghiệp
            <select required value={form.targetUserId} onChange={(e) => setForm({ ...form, targetUserId: e.target.value })} className={input} disabled={!form.shiftId}>
              <option value="">{form.shiftId ? 'Chọn đồng nghiệp' : 'Chọn ca trước'}</option>
              {colleagues.map((c) => <option key={c.userId} value={c.userId}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-text-main">Lời nhắn
            <input value={form.message} maxLength={300} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Lý do (không bắt buộc)" className={input} />
          </label>
          <button type="submit" disabled={busy || !form.shiftId || !form.targetUserId}
            className="sm:col-span-2 rounded-xl bg-green-main text-white py-2.5 text-sm font-bold hover:bg-green-dark disabled:opacity-50">
            Gửi đề nghị
          </button>
        </form>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-text-main">Đề nghị đổi ca ({swaps.length})</h2>
        {loading ? <LoadingPage /> : swaps.length === 0 ? (
          <EmptyState icon={<Repeat />} title="Chưa có đề nghị đổi ca nào" description="Khi bạn gửi hoặc nhận đề nghị đổi ca, chúng sẽ hiện ở đây." className="bg-white rounded-3xl border border-green-100" />
        ) : swaps.map((swap) => {
          const [label, tone] = STATUS[swap.status] || [swap.status, 'bg-gray-100 text-gray-600'];
          return (
            <div key={swap.id} className="bg-white rounded-2xl p-4 border border-stone-200 shadow-card space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-sm text-text-main">{shiftLabel(swap.shift)}</p>
                  <p className="text-xs text-text-muted">{swap.requesterName} → {swap.targetName}</p>
                </div>
                <span className={clsx('text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0', tone)}>{label}</span>
              </div>
              {swap.message && <p className="text-xs text-text-main">"{swap.message}"</p>}
              {swap.responseNote && <p className="text-xs text-text-muted">Phản hồi: {swap.responseNote}</p>}
              <div className="flex flex-wrap gap-2">{actions(swap)}</div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
