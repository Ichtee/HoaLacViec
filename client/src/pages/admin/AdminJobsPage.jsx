import { useState, useEffect } from 'react';
import { Briefcase, MapPin, CheckCircle, XCircle } from 'lucide-react';
import { adminGetJobs, apiApproveJob, apiRejectJob } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Toast, LoadingPage, EmptyState } from '@/components/Feedback.jsx';
import { PageHeader } from '@/components/PageHeader.jsx';
import { Tabs } from '@/components/Tabs.jsx';
import { DataTable } from '@/components/DataTable.jsx';
import { formatVND } from '@/utils';

const JOB_STATUS_BADGES = {
  pending: { variant: 'yellow', label: 'Chờ duyệt' },
  approved: { variant: 'green', label: 'Đang hoạt động' },
  rejected: { variant: 'red', label: 'Bị từ chối / Đã gỡ' },
  closed: { variant: 'gray', label: 'Đã đóng' },
};

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState('all'); // 'all', 'pending', 'approved', 'rejected'

  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    try {
      setLoading(true);
      setFetchError(null);
      const data = await adminGetJobs();
      const list = Array.isArray(data) ? data : (data?.jobs || []);
      setJobs(list);
    } catch (err) {
      console.error(err);
      setFetchError(err.message || 'Không thể kết nối máy chủ để tải danh sách.');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(job) {
    try {
      const targetId = job._id || job.id;
      await apiApproveJob(targetId);
      setJobs(prev => prev.map(j => (j._id === targetId || j.id === targetId) ? { ...j, status: 'approved', rejectionReason: '' } : j));
      setToast({ type: 'success', message: 'Đã duyệt bài đăng! Tin tuyển dụng đã chuyển sang mục "Đang hiển thị".' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi duyệt bài đăng.' });
    }
  }

  async function handleReject(job) {
    const reason = prompt('Nhập lý do từ chối / gỡ bỏ tin tuyển dụng này:', 'Thông tin việc làm chưa rõ ràng hoặc không phù hợp tiêu chuẩn.');
    if (reason === null) return; // User cancelled prompt

    try {
      const targetId = job._id || job.id;
      await apiRejectJob(targetId, reason);
      setJobs(prev => prev.map(j => (j._id === targetId || j.id === targetId) ? { ...j, status: 'rejected', rejectionReason: reason } : j));
      setToast({ type: 'info', message: 'Đã từ chối / gỡ bỏ bài đăng tuyển dụng.' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi từ chối bài đăng.' });
    }
  }

  const pendingCount = jobs.filter(j => j.status === 'pending').length;
  const approvedCount = jobs.filter(j => j.status === 'approved').length;
  const rejectedCount = jobs.filter(j => j.status === 'rejected' || j.status === 'closed').length;

  const filteredJobs = jobs.filter(job => {
    if (tab === 'pending') return job.status === 'pending';
    if (tab === 'approved') return job.status === 'approved';
    if (tab === 'rejected') return job.status === 'rejected' || job.status === 'closed';
    return true;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <PageHeader
        icon={Briefcase}
        title="Kiểm duyệt tin tuyển dụng"
        description="Duyệt bài đăng mới và gỡ bỏ các bài vi phạm tiêu chuẩn an toàn việc làm sinh viên Hòa Lạc."
      />
      <Tabs
        variant="pill"
        ariaLabel="Lọc tin theo trạng thái"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'all', label: 'Tất cả', count: jobs.length },
          { id: 'pending', label: 'Chờ duyệt', count: pendingCount },
          { id: 'approved', label: 'Đang hiển thị', count: approvedCount },
          { id: 'rejected', label: 'Từ chối / Gỡ', count: rejectedCount },
        ]}
      />

      {loading ? (
        <LoadingPage />
      ) : fetchError ? (
        <div className="text-center py-8 p-6 bg-red-50 rounded-3xl border border-red-100 space-y-3">
          <p className="text-sm font-semibold text-red-700">{fetchError}</p>
          <button onClick={loadJobs} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-all">
            Thử lại
          </button>
        </div>
      ) : (
        <DataTable
          caption="Danh sách tin tuyển dụng"
          rows={filteredJobs}
          rowKey={(job) => job._id || job.id}
          emptyState={
            <EmptyState
              icon={<Briefcase />}
              title="Không có bài đăng nào trong mục này"
              description={tab === 'pending' && approvedCount > 0 ? `Có ${approvedCount} bài đã được duyệt đang hoạt động.` : undefined}
              action={tab !== 'all' ? <button onClick={() => setTab('all')} className="btn btn-outline btn-sm">Xem tất cả ({jobs.length} tin)</button> : undefined}
              className="bg-white rounded-3xl border border-green-100"
            />
          }
          columns={[
            {
              key: 'title',
              label: 'Tin tuyển dụng',
              primary: true,
              sortValue: (job) => job.title,
              render: (job) => (
                <div className="min-w-0">
                  <p className="font-bold text-text-main text-sm">{job.title}</p>
                  <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span className="truncate">{job.address || (typeof job.location === 'string' ? job.location : 'Hòa Lạc')}</span>
                  </p>
                  {job.rejectionReason && (
                    <p className="mt-1.5 text-xs text-red-700 bg-red-50 p-2 rounded-xl border border-red-100">
                      <strong>Lý do từ chối:</strong> {job.rejectionReason}
                    </p>
                  )}
                </div>
              ),
            },
            { key: 'store', label: 'Cửa hàng', sortValue: (job) => job.storeName, render: (job) => <span className="text-sm font-semibold text-text-main">{job.storeName || '—'}</span> },
            {
              key: 'salary',
              label: 'Mức lương',
              sortValue: (job) => Number(job.salaryAmount) || 0,
              render: (job) => <span className="text-sm text-text-main whitespace-nowrap">{job.salaryAmount ? `${formatVND(job.salaryAmount)}/giờ` : (job.salaryText || 'Thỏa thuận')}</span>,
            },
            {
              key: 'status',
              label: 'Trạng thái',
              sortValue: (job) => job.status,
              render: (job) => {
                const badge = JOB_STATUS_BADGES[job.status] || { variant: 'gray', label: job.status };
                return <Badge variant={badge.variant} size="sm">{badge.label}</Badge>;
              },
            },
            {
              key: 'actions',
              label: 'Thao tác',
              className: 'text-right',
              render: (job) => {
                const isPending = job.status === 'pending';
                const isApproved = job.status === 'approved';
                return (
                  <div className="flex items-center gap-2 justify-end flex-wrap">
                    {isPending ? (
                      <>
                        <button onClick={() => handleReject(job)} className="px-3 py-1.5 rounded-xl bg-red-50 text-red-700 font-semibold text-xs hover:bg-red-100 transition-colors inline-flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Từ chối
                        </button>
                        <button onClick={() => handleApprove(job)} className="btn btn-primary btn-sm">
                          <CheckCircle className="w-3.5 h-3.5" /> Phê duyệt
                        </button>
                      </>
                    ) : isApproved ? (
                      <button onClick={() => handleReject(job)} className="px-3 py-1.5 rounded-xl bg-red-50 text-red-700 font-semibold text-xs hover:bg-red-100 transition-colors">
                        Gỡ bỏ bài đăng
                      </button>
                    ) : (
                      <button onClick={() => handleApprove(job)} className="btn btn-outline btn-sm">
                        Duyệt lại bài này
                      </button>
                    )}
                  </div>
                );
              },
            },
          ]}
        />
      )}
    </div>
  );
}
