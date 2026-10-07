import { useCallback, useEffect, useState } from 'react';
import { Zap, Clock, MapPin, Users, Wallet } from 'lucide-react';
import { getQuickShifts, getMyQuickShifts, claimQuickShift, withdrawQuickShift } from '@/services';
import { Toast } from '@/components/Feedback.jsx';
import { PageHeader } from '@/components/PageHeader.jsx';
import { LoadingPage, EmptyState } from '@/components/Feedback.jsx';
import { Link } from 'react-router-dom';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ/giờ`;

function ShiftCard({ shift, action }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-green-50 shadow-card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-text-main">{shift.title}</p>
          <p className="text-sm text-text-muted">{shift.storeName}</p>
        </div>
        <span className="text-sm font-bold text-green-dark flex items-center gap-1 shrink-0">
          <Wallet className="w-4 h-4" /> {money(shift.wageRate)}
        </span>
      </div>
      <div className="text-sm text-text-main space-y-1">
        <p className="flex items-center gap-2"><Clock className="w-4 h-4 text-text-muted" /> {shift.date} · {shift.startTime}–{shift.endTime}</p>
        {shift.address && <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-text-muted" /> {shift.address}</p>}
        <p className="flex items-center gap-2"><Users className="w-4 h-4 text-text-muted" /> Còn {shift.remaining}/{shift.headcount} chỗ</p>
      </div>
      {shift.description && <p className="text-sm text-text-muted">{shift.description}</p>}
      {action}
    </div>
  );
}

export default function StudentQuickShiftsPage() {
  const [open, setOpen] = useState([]);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    try {
      const [openRows, myRows] = await Promise.all([getQuickShifts(), getMyQuickShifts()]);
      setOpen(Array.isArray(openRows) ? openRows : []);
      setMine(Array.isArray(myRows) ? myRows : []);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không tải được danh sách ca lẻ.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function run(shift, fn, success) {
    setBusyId(shift.id);
    try {
      await fn(shift.id);
      setToast({ type: 'success', message: success });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Thao tác thất bại.' });
    } finally {
      setBusyId(null);
      load();
    }
  }

  const upcomingMine = mine.filter((s) => s.status !== 'cancelled' && new Date(s.startAt) > new Date());

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <PageHeader icon={Zap} title="Ca lẻ - nhận việc ngay" description="Cửa hàng cần người gấp trong vài ngày tới. Ai nhận trước được trước, ca sẽ tự thêm vào lịch làm của bạn." />

      {loading ? <LoadingPage /> : <>
        {upcomingMine.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-text-main">Ca bạn đã nhận ({upcomingMine.length})</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {upcomingMine.map((shift) => (
                <ShiftCard key={shift.id} shift={shift} action={
                  <button
                    disabled={busyId === shift.id}
                    onClick={() => run(shift, withdrawQuickShift, 'Đã trả ca.')}
                    className="w-full rounded-xl bg-gray-100 text-text-muted py-2 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50"
                  >
                    Trả ca (trước giờ làm ít nhất 1 giờ)
                  </button>
                } />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-text-main">Ca đang cần người ({open.length})</h2>
          {open.length === 0 ? (
            <EmptyState icon={<Zap />} title="Hiện chưa có ca lẻ nào đang mở" description="Cửa hàng đăng ca mới là bạn sẽ thấy ngay ở đây. Bật Thông báo việc mới để không bỏ lỡ." action={<Link to="/student/alerts" className="btn btn-outline btn-sm">Bật thông báo việc</Link>} className="bg-white rounded-3xl border border-green-100" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {open.map((shift) => (
                <ShiftCard key={shift.id} shift={shift} action={
                  shift.claimedByMe ? (
                    <p className="text-center text-sm font-semibold text-green-dark">✓ Bạn đã nhận ca này</p>
                  ) : (
                    <button
                      disabled={busyId === shift.id || shift.remaining <= 0}
                      onClick={() => run(shift, claimQuickShift, 'Nhận ca thành công! Ca đã có trong lịch làm của bạn.')}
                      className="w-full rounded-xl bg-green-main text-white py-2.5 text-sm font-bold hover:bg-green-dark disabled:opacity-50"
                    >
                      {busyId === shift.id ? 'Đang nhận...' : 'Nhận ca ngay'}
                    </button>
                  )
                } />
              ))}
            </div>
          )}
        </section>
      </>}
    </div>
  );
}
