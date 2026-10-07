import { useState, useEffect } from 'react';
import { Users, Lock, Unlock } from 'lucide-react';
import { clsx } from 'clsx';
import { getAllUsers, apiAdminUpdateUserStatus, apiAdminUpdateUserRole } from '@/services';
import { useAuth } from '@/hooks/useAuth.jsx';
import { Badge } from '@/components/Badge.jsx';
import { Toast, LoadingPage, EmptyState } from '@/components/Feedback.jsx';
import { DataTable } from '@/components/DataTable.jsx';
import { avatarColorClass, avatarInitial } from '@/utils/avatarColor.js';
import { PageHeader } from '@/components/PageHeader.jsx';
import { Tabs } from '@/components/Tabs.jsx';

const ROLE_LABELS = {
  pending: 'Chờ phân vai',
  student: 'Sinh viên',
  worker: 'Lao động tự do',
  freelancer: 'Lao động tự do',
  employer: 'Nhà tuyển dụng',
  admin: 'Quản trị viên',
};

const STATUS_BADGES = {
  active: { variant: 'green', label: 'Đang hoạt động' },
  pending: { variant: 'yellow', label: 'Chờ xác minh' },
  locked: { variant: 'red', label: 'Đã khóa' },
  suspended: { variant: 'red', label: 'Tạm ngưng' },
};

export default function AdminUsersPage() {
  const { user: currentUser, updateUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [toast, setToast] = useState(null);

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await getAllUsers();
      setUsers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleToggleLock(userId, currentStatus) {
    const newStatus = currentStatus === 'locked' ? 'active' : 'locked';
    try {
      await apiAdminUpdateUserStatus(userId, newStatus);
      setUsers(prev => prev.map(u => (u._id === userId || u.id === userId) ? { ...u, status: newStatus } : u));
      setToast({
        type: newStatus === 'locked' ? 'info' : 'success',
        message: newStatus === 'locked' ? 'Đã khóa tài khoản người dùng.' : 'Đã mở khóa tài khoản thành công.'
      });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi cập nhật trạng thái tài khoản.' });
    }
  }

  async function handleRoleChange(userId, newRole) {
    try {
      await apiAdminUpdateUserRole(userId, newRole);
      setUsers(prev => prev.map(u => (u._id === userId || u.id === userId) ? { ...u, role: newRole } : u));
      if (currentUser?._id === userId || currentUser?.id === userId) {
        updateUser({ role: newRole });
      }
      const roleNames = {
        student: 'Sinh viên',
        worker: 'Lao động tự do',
        freelancer: 'Lao động tự do',
        employer: 'Nhà tuyển dụng',
        admin: 'Quản trị viên (Admin)'
      };
      setToast({
        type: 'success',
        message: `Đã đổi vai trò sang "${roleNames[newRole] || newRole}" thành công!`
      });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi cập nhật vai trò người dùng.' });
    }
  }

  const filtered = users.filter(u => {
    const matchesSearch = u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all'
      || (roleFilter === 'pending'
        ? u.role === 'pending' || u.status === 'pending'
        : u.role === roleFilter);
    return matchesSearch && matchesRole;
  });

  const pendingCount = users.filter(u => u.role === 'pending' || u.status === 'pending').length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <PageHeader
        icon={Users}
        title="Tài khoản người dùng"
        description="Theo dõi người dùng, phân quyền vai trò và quản lý trạng thái khóa / kích hoạt."
      />

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <Tabs
          variant="pill"
          className="min-w-0 lg:flex-1"
          ariaLabel="Lọc theo vai trò"
          value={roleFilter}
          onChange={setRoleFilter}
          items={[
            { id: 'all', label: 'Tất cả' },
            { id: 'pending', label: 'Chờ xác minh', count: pendingCount },
            { id: 'student', label: 'Sinh viên' },
            { id: 'worker', label: 'Lao động tự do' },
            { id: 'employer', label: 'Doanh nghiệp' },
            { id: 'admin', label: 'Admin' },
          ]}
        />
        <input
          type="search"
          placeholder="Tìm theo tên / email..."
          aria-label="Tìm tài khoản"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input !py-2 lg:w-64"
        />
      </div>

      {loading ? (
        <LoadingPage />
      ) : (
        <DataTable
          caption="Danh sách tài khoản người dùng"
          rows={filtered}
          rowKey={(u) => u._id || u.id}
          initialSort={{ key: 'name', dir: 'asc' }}
          emptyState={
            <EmptyState
              icon={<Users />}
              title="Không tìm thấy tài khoản nào"
              description="Thử đổi bộ lọc vai trò hoặc từ khóa tìm kiếm."
              className="bg-white rounded-3xl border border-green-100"
            />
          }
          columns={[
            {
              key: 'name',
              label: 'Người dùng',
              primary: true,
              sortValue: (u) => u.name,
              render: (u) => (
                <div className="flex items-center gap-3 min-w-0">
                  <div className={clsx('w-10 h-10 rounded-2xl font-bold text-sm flex items-center justify-center shrink-0', avatarColorClass(u.name))}>
                    {avatarInitial(u.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-text-main text-sm truncate">{u.name}</p>
                    <p className="text-xs text-text-muted truncate">{u.email}</p>
                  </div>
                </div>
              ),
            },
            { key: 'phone', label: 'Điện thoại', render: (u) => <span className="text-sm text-text-main">{u.phone || '—'}</span> },
            {
              key: 'role',
              label: 'Vai trò',
              sortValue: (u) => ROLE_LABELS[u.role] || u.role,
              render: (u) => (
                <select
                  aria-label={`Vai trò của ${u.name}`}
                  value={u.role}
                  onChange={(e) => handleRoleChange(u._id || u.id, e.target.value)}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-green-100 bg-white hover:border-green-main focus:outline-none focus:ring-2 focus:ring-green-main/30 cursor-pointer"
                >
                  {u.role === 'pending' && <option value="pending" disabled>Chờ phân vai</option>}
                  <option value="student">Sinh viên</option>
                  <option value="worker">Lao động tự do</option>
                  <option value="employer">Nhà tuyển dụng</option>
                  <option value="admin">Quản trị viên</option>
                </select>
              ),
            },
            {
              key: 'status',
              label: 'Trạng thái',
              sortValue: (u) => u.status,
              render: (u) => {
                const badge = STATUS_BADGES[u.status] || { variant: 'gray', label: u.status || '—' };
                return <Badge variant={badge.variant} size="sm">{badge.label}</Badge>;
              },
            },
            {
              key: 'actions',
              label: 'Thao tác',
              className: 'text-right',
              render: (u) => (
                <button
                  onClick={() => handleToggleLock(u._id || u.id, u.status)}
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors',
                    u.status === 'locked' ? 'bg-green-50 text-green-dark hover:bg-green-100' : 'bg-red-50 text-red-700 hover:bg-red-100'
                  )}
                >
                  {u.status === 'locked' ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  {u.status === 'locked' ? 'Mở khóa' : 'Khóa'}
                </button>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
