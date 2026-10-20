import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { apiAdminListTaskHistory } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Toast, LoadingPage, EmptyState } from '@/components/Feedback.jsx';
import { DataTable } from '@/components/DataTable.jsx';
import { PageHeader } from '@/components/PageHeader.jsx';
import { Tabs } from '@/components/Tabs.jsx';

const STATUS_BADGES = {
  accepted: { variant: 'blue', label: 'Đang làm' },
  submitted_for_completion: { variant: 'yellow', label: 'Chờ xác nhận' },
  completed: { variant: 'green', label: 'Hoàn thành' },
  disputed: { variant: 'red', label: 'Tranh chấp' },
  cancelled: { variant: 'gray', label: 'Đã hủy' },
  expired: { variant: 'gray', label: 'Hết hạn' },
  open: { variant: 'gray', label: 'Mở lại' },
};
const TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'accepted', label: 'Đang làm' },
  { id: 'submitted_for_completion', label: 'Chờ xác nhận' },
  { id: 'completed', label: 'Hoàn thành' },
  { id: 'disputed', label: 'Tranh chấp' },
  { id: 'cancelled', label: 'Đã hủy' },
];

const vnd = (n) => `${Number(n).toLocaleString('vi-VN')}đ`;
const when = (d) => (d ? new Date(d).toLocaleString('vi-VN') : '—');
const label = (s) => STATUS_BADGES[s]?.label || s;

export default function AdminTaskHistoryPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let stale = false;
    const timer = setTimeout(() => {
      apiAdminListTaskHistory(search.trim())
        .then(({ tasks }) => { if (!stale) setRows(tasks || []); })
        .catch((err) => { if (!stale) setToast({ type: 'error', message: err.message || 'Không tải được lịch sử nhận việc.' }); })
        .finally(() => { if (!stale) setLoading(false); });
    }, 300);
    return () => { stale = true; clearTimeout(timer); };
  }, [search]);

  const shown = rows.filter((r) => tab === 'all' || r.status === tab);

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <PageHeader
        icon={ClipboardList}
        title="Lịch sử nhận việc vặt"
        description="Các việc vặt đã có người nhận cùng dòng thời gian đổi trạng thái."
      />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <Tabs variant="pill" ariaLabel="Lọc theo trạng thái" value={tab} onChange={setTab} items={TABS} />
        <input
          type="search"
          placeholder="Tìm theo tên người nhận / người đăng / việc..."
          aria-label="Tìm lịch sử nhận việc"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input !py-2 lg:w-80"
        />
      </div>

      {rows.length === 200 && <p className="text-xs text-text-muted">Chỉ hiển thị 200 việc gần nhất</p>}

      {loading ? (
        <LoadingPage />
      ) : (
        <DataTable
          caption="Lịch sử nhận việc vặt"
          rows={shown}
          rowKey={(r) => r._id}
          emptyState={<EmptyState icon={<ClipboardList />} title="Chưa có việc nào được nhận" className="bg-white rounded-3xl border border-green-100" />}
          columns={[
            {
              key: 'task',
              label: 'Việc vặt',
              primary: true,
              render: (r) => (
                <div className="min-w-0">
                  <p className="font-bold text-text-main text-sm truncate">{r.title}</p>
                  <p className="text-xs text-text-muted">{vnd(r.reward)}</p>
                </div>
              ),
            },
            { key: 'requester', label: 'Người đăng', render: (r) => <span className="text-sm">{r.requesterName}</span> },
            {
              key: 'assignee',
              label: 'Người nhận',
              render: (r) => (
                <div className="text-sm">
                  <p className="font-semibold">{r.assigneeName || '—'}</p>
                  <p className="text-xs text-text-muted">{r.assigneePhone}</p>
                </div>
              ),
            },
            {
              key: 'status',
              label: 'Trạng thái',
              render: (r) => {
                const b = STATUS_BADGES[r.status] || { variant: 'gray', label: r.status };
                return <Badge variant={b.variant} size="sm">{b.label}</Badge>;
              },
            },
            {
              key: 'history',
              label: 'Lịch sử',
              sortValue: (r) => r.updatedAt,
              render: (r) => (
                <ul className="text-xs text-text-muted space-y-0.5">
                  {(r.history || []).map((h, i) => (
                    <li key={i}>
                      {when(h.timestamp)} · <span className="font-semibold">{label(h.status)}</span>
                      {h.changedBy?.name ? ` (${h.changedBy.name})` : ''}
                    </li>
                  ))}
                </ul>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
