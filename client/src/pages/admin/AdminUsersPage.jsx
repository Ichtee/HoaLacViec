import { useState, useEffect } from 'react';
import { Users, Lock, Unlock } from 'lucide-react';
import { clsx } from 'clsx';
import { getAllUsers, apiAdminUpdateUserStatus, apiAdminUpdateUserRole } from '@/services';
import { useAuth } from '@/hooks/useAuth.jsx';
import { Badge } from '@/components/Badge.jsx';
import { Toast, LoadingPage } from '@/components/Feedback.jsx';
import { PageHeader } from '@/components/PageHeader.jsx';
import { Tabs } from '@/components/Tabs.jsx';

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
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
          {filtered.map(userItem => (
            <div key={userItem._id || userItem.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={clsx(
                  'w-10 h-10 rounded-2xl font-bold text-sm flex items-center justify-center text-white shrink-0',
                  userItem.role === 'pending' ? 'bg-amber-500' : userItem.role === 'student' ? 'bg-green-dark' : userItem.role === 'worker' || userItem.role === 'freelancer' ? 'bg-blue-600' : userItem.role === 'employer' ? 'bg-pink-dark' : 'bg-purple-600'
                )}>
                  {userItem.name?.charAt(0) || 'U'}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-gray-900 text-sm">{userItem.name}</h4>
                    <Badge variant={userItem.role === 'pending' ? 'warning' : userItem.role === 'student' ? 'info' : userItem.role === 'worker' || userItem.role === 'freelancer' ? 'secondary' : userItem.role === 'employer' ? 'primary' : 'warning'} size="sm">
                      {userItem.role === 'pending' ? 'Chờ phân vai' : userItem.role === 'student' ? 'Sinh viên' : userItem.role === 'worker' || userItem.role === 'freelancer' ? 'Lao động tự do' : userItem.role === 'employer' ? 'Nhà tuyển dụng' : 'Admin'}
                    </Badge>
                    {userItem.status === 'pending' && userItem.role !== 'pending' && (
                      <Badge variant="warning" size="sm">Chờ xác minh</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{userItem.email} • {userItem.phone || '098xxx'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 justify-end">
                {/* Role Switcher */}
                <div className="flex items-center gap-1.5">
                  <label className="text-[11px] font-medium text-gray-400 hidden md:inline">Vai trò:</label>
                  <select
                    value={userItem.role}
                    onChange={(e) => handleRoleChange(userItem._id || userItem.id, e.target.value)}
                    className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-green-dark cursor-pointer transition-all"
                  >
                    {userItem.role === 'pending' && <option value="pending" disabled>⏳ Chờ phân vai</option>}
                    <option value="student">🎓 Sinh viên</option>
                    <option value="worker">💼 Lao động tự do</option>
                    <option value="employer">🏢 Nhà tuyển dụng</option>
                    <option value="admin">🛡️ Quản trị viên</option>
                  </select>
                </div>

                {/* Toggle Lock */}
                <button
                  onClick={() => handleToggleLock(userItem._id || userItem.id, userItem.status)}
                  className={clsx(
                    'p-2 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0',
                    userItem.status === 'locked' ? 'bg-green-50 text-green-dark hover:bg-green-100' : 'bg-red-50 text-red-600 hover:bg-red-100'
                  )}
                >
                  {userItem.status === 'locked' ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>{userItem.status === 'locked' ? 'Mở khóa' : 'Khóa'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
