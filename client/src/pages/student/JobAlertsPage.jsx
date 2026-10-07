import { useCallback, useEffect, useState } from 'react';
import { BellRing, Trash2 } from 'lucide-react';
import { getJobAlerts, createJobAlert, deleteJobAlert } from '@/services';
import { Toast } from '@/components/Feedback.jsx';
import { PageHeader } from '@/components/PageHeader.jsx';
import { LoadingPage, EmptyState } from '@/components/Feedback.jsx';

const TYPE_LABELS = { part_time: 'Bán thời gian', shift: 'Theo ca', hourly: 'Theo giờ', event: 'Sự kiện' };

function describe(alert) {
  const parts = [];
  if (alert.keyword) parts.push(`Từ khóa "${alert.keyword}"`);
  if (alert.type) parts.push(TYPE_LABELS[alert.type] || alert.type);
  if (alert.minSalary) parts.push(`từ ${Number(alert.minSalary).toLocaleString('vi-VN')}đ`);
  if (alert.category) parts.push(`nhóm ${alert.category}`);
  return parts.join(' · ') || 'Mọi việc làm';
}

export default function JobAlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [form, setForm] = useState({ keyword: '', type: '', minSalary: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    try {
      const rows = await getJobAlerts();
      setAlerts(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không tải được danh sách bộ lọc.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await createJobAlert({ keyword: form.keyword.trim(), type: form.type, minSalary: Number(form.minSalary) || 0 });
      setForm({ keyword: '', type: '', minSalary: '' });
      setToast({ type: 'success', message: 'Đã lưu. Bạn sẽ nhận thông báo khi có tin phù hợp được duyệt.' });
      load();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể lưu bộ lọc.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteJobAlert(id);
      setAlerts((prev) => prev.filter((a) => a._id !== id));
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể xóa bộ lọc.' });
    }
  }

  const input = 'mt-1 w-full p-2.5 rounded-xl border border-stone-200 text-sm font-normal focus:ring-2 focus:ring-green-main focus:outline-none';

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <PageHeader icon={BellRing} title="Thông báo việc mới" description="Lưu tối đa 5 bộ lọc. Khi có tin phù hợp được duyệt, bạn nhận thông báo ngay trong ứng dụng." />

      <form onSubmit={handleCreate} className="bg-white p-5 rounded-3xl border border-green-50 shadow-card grid gap-3 sm:grid-cols-3 items-end">
        <label className="text-xs font-bold text-text-main sm:col-span-3">Từ khóa
          <input value={form.keyword} maxLength={60} onChange={(e) => setForm({ ...form, keyword: e.target.value })}
            placeholder="Ví dụ: pha chế, phục vụ, gia sư" className={input} />
        </label>
        <label className="text-xs font-bold text-text-main">Hình thức
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={input}>
            <option value="">Tất cả</option>
            {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-text-main">Lương tối thiểu (đ)
          <input type="number" min={0} step={1000} value={form.minSalary} onChange={(e) => setForm({ ...form, minSalary: e.target.value })} className={input} />
        </label>
        <button type="submit" disabled={saving} className="rounded-xl bg-green-main text-white py-2.5 text-sm font-bold hover:bg-green-dark disabled:opacity-50">
          {saving ? 'Đang lưu...' : 'Lưu bộ lọc'}
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-text-main">Bộ lọc của bạn ({alerts.length}/5)</h2>
        {loading ? <LoadingPage /> : alerts.length === 0 ? (
          <EmptyState icon={<BellRing />} title="Bạn chưa lưu bộ lọc nào" description="Nhập từ khóa ở trên, ví dụ “pha chế”, để nhận thông báo ngay khi có tin phù hợp." className="bg-white rounded-3xl border border-green-100" />
        ) : alerts.map((alert) => (
          <div key={alert._id} className="bg-white rounded-2xl p-4 border border-green-50 flex items-center justify-between gap-3">
            <p className="text-sm text-text-main">{describe(alert)}</p>
            <button onClick={() => handleDelete(alert._id)} aria-label="Xóa bộ lọc" className="p-2 rounded-xl text-red-700 hover:bg-red-50">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
