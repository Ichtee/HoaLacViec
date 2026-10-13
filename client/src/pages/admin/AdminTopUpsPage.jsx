import { useCallback, useEffect, useState } from 'react';
import { Coins } from 'lucide-react';
import { apiAdminListTopUps, apiAdminReconcileTopUp } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Toast, LoadingPage, EmptyState } from '@/components/Feedback.jsx';
import { DataTable } from '@/components/DataTable.jsx';
import { PageHeader } from '@/components/PageHeader.jsx';
import { Tabs } from '@/components/Tabs.jsx';

const STATUS_BADGES = {
  pending: { variant: 'yellow', label: 'Chờ thanh toán' },
  paid: { variant: 'green', label: 'Đã thanh toán' },
  failed: { variant: 'red', label: 'Lỗi' },
  cancelled: { variant: 'gray', label: 'Đã hủy' },
  voided: { variant: 'red', label: 'Đã hủy' },
};
const RESULT_MESSAGES = {
  granted: 'SePay xác nhận đã thanh toán, đã cộng credit cho nhà tuyển dụng.',
  already_paid: 'Giao dịch này đã được ghi nhận trước đó.',
  not_paid: 'SePay chưa ghi nhận thanh toán cho giao dịch này.',
  amount_mismatch: 'Số tiền SePay ghi nhận không khớp, giao dịch được đánh dấu lỗi.',
  not_pending: 'Giao dịch không còn ở trạng thái chờ thanh toán.',
  unknown: 'Không tìm thấy giao dịch.',
};
const TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'pending', label: 'Chờ thanh toán' },
  { id: 'paid', label: 'Đã thanh toán' },
  { id: 'failed', label: 'Lỗi' },
  { id: 'cancelled', label: 'Đã hủy' },
];

const vnd = (n) => `${Number(n).toLocaleString('vi-VN')}đ`;
const when = (d) => (d ? new Date(d).toLocaleString('vi-VN') : '—');

export default function AdminTopUpsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [busyId, setBusyId] = useState('');
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    try {
      const { topUps } = await apiAdminListTopUps();
      setRows(topUps || []);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không tải được danh sách nạp credit.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function reconcile(row) {
    setBusyId(row._id);
    try {
      const res = await apiAdminReconcileTopUp(row._id);
      setToast({ type: res.result === 'granted' ? 'success' : 'info', message: RESULT_MESSAGES[res.result] || 'Đã kiểm tra lại với SePay.' });
      await load();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không kiểm tra được giao dịch.' });
    } finally {
      setBusyId('');
    }
  }

  const attention = rows.filter((r) => r.status === 'pending' || r.status === 'voided').length;
  const shown = rows.filter((r) => tab === 'all'
    || r.status === tab
    || (tab === 'cancelled' && r.status === 'voided'));

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <PageHeader
        icon={Coins}
        title="Nạp credit"
        description="Theo dõi giao dịch nạp credit và kiểm tra lại với SePay khi cần."
        badge={attention > 0 ? <Badge variant="yellow" size="sm">{attention} cần xử lý</Badge> : null}
      />

      <Tabs variant="pill" ariaLabel="Lọc theo trạng thái" value={tab} onChange={setTab} items={TABS} />

      {rows.length === 100 && <p className="text-xs text-text-muted">Chỉ hiển thị 100 giao dịch gần nhất</p>}

      {loading ? (
        <LoadingPage />
      ) : (
        <DataTable
          caption="Danh sách giao dịch nạp credit"
          rows={shown}
          rowKey={(r) => r._id}
          emptyState={<EmptyState icon={<Coins />} title="Chưa có giao dịch nào" className="bg-white rounded-3xl border border-green-100" />}
          columns={[
            {
              key: 'store',
              label: 'Cửa hàng',
              primary: true,
              render: (r) => (
                <div className="min-w-0">
                  <p className="font-bold text-text-main text-sm truncate">{r.employer?.storeName || r.employer?.name || '—'}</p>
                  <p className="text-xs text-text-muted truncate">{r.employer?.email}</p>
                </div>
              ),
            },
            { key: 'pack', label: 'Credit', render: (r) => <span className="text-sm">{r.credits} credit{r.bonusCredits ? ` (gồm tặng ${r.bonusCredits})` : ''}</span> },
            { key: 'amount', label: 'Số tiền', sortValue: (r) => r.amountVnd, render: (r) => <span className="text-sm font-semibold">{vnd(r.amountVnd)}</span> },
            { key: 'invoice', label: 'Mã hóa đơn', render: (r) => <span className="text-xs font-mono">{r.invoiceNumber}</span> },
            {
              key: 'status',
              label: 'Trạng thái',
              render: (r) => {
                const b = STATUS_BADGES[r.status] || { variant: 'gray', label: r.status };
                return (
                  <div className="space-y-1">
                    <Badge variant={b.variant} size="sm">{b.label}</Badge>
                    {r.status === 'failed' && r.failureReason && (
                      <p className="text-xs font-semibold text-red-700">{r.failureReason === 'amount_mismatch' ? 'Số tiền không khớp với SePay' : r.failureReason}</p>
                    )}
                    {r.status === 'voided' && (
                      <p className="text-xs font-semibold text-red-700">Giao dịch bị hủy bên SePay - cần xử lý thủ công</p>
                    )}
                  </div>
                );
              },
            },
            {
              key: 'times',
              label: 'Thời gian',
              sortValue: (r) => r.createdAt,
              render: (r) => (
                <div className="text-xs text-text-muted">
                  <p>Tạo: {when(r.createdAt)}</p>
                  <p>Thanh toán: {when(r.paidAt)}</p>
                </div>
              ),
            },
            {
              key: 'actions',
              label: 'Thao tác',
              className: 'text-right',
              render: (r) => r.status === 'pending' && (
                <button
                  type="button"
                  disabled={busyId === r._id}
                  onClick={() => reconcile(r)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-green-50 text-green-dark hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busyId === r._id ? 'Đang kiểm tra...' : 'Kiểm tra lại với SePay'}
                </button>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
