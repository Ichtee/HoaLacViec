import { useState, useEffect } from 'react';
import { Users, Lock, Unlock, Search, ShieldCheck, UserCheck, Filter } from 'lucide-react';
import { clsx } from 'clsx';
import { getAllUsers, apiAdminUpdateUserStatus, apiAdminUpdateUserRole } from '@/services';
import { useAuth } from '@/hooks/useAuth.jsx';
import { Badge } from '@/components/Badge.jsx';
import { Toast } from '@/components/Feedback.jsx';

export default function AdminUsersPage() {
  const { user: currentUser, updateUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

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
      setToast({
        type: 'success',
        message: `Đã đổi vai trò sang "${newRole === 'student' ? 'Sinh viên' : newRole === 'employer' ? 'Nhà tuyển dụng' : 'Quản trị viên (Admin)'}" thành công!`
      });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi cập nhật vai trò người dùng.' });
    }
  }

  const filtered = users.filter(u => {
    const matchesSearch = u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-green-dark" /> Quản lý danh sách tài khoản người dùng
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Theo dõi người dùng trên hệ thống. Bạn có thể phân quyền vai trò (Role) hoặc quản lý trạng thái khóa / kích hoạt.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-2xl border border-gray-100">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'student', label: 'Sinh viên' },
              { id: 'employer', label: 'Doanh nghiệp' },
              { id: 'admin', label: 'Admin' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRoleFilter(tab.id)}
                className={clsx(
                  'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
                  roleFilter === tab.id
                    ? 'bg-green-dark text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Tìm theo tên / email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="px-3.5 py-1.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-green-dark"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Đang tải danh sách tài khoản...</div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
          {filtered.map(userItem => (
            <div key={userItem._id || userItem.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={clsx(
                  'w-10 h-10 rounded-2xl font-bold text-sm flex items-center justify-center text-white shrink-0',
                  userItem.role === 'student' ? 'bg-green-dark' : userItem.role === 'employer' ? 'bg-pink-dark' : 'bg-purple-600'
                )}>
                  {userItem.name?.charAt(0) || 'U'}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-gray-900 text-sm">{userItem.name}</h4>
                    <Badge variant={userItem.role === 'student' ? 'info' : userItem.role === 'employer' ? 'primary' : 'warning'} size="sm">
                      {userItem.role === 'student' ? 'Sinh viên' : userItem.role === 'employer' ? 'Nhà tuyển dụng' : 'Admin'}
                    </Badge>
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
                    <option value="student">🎓 Sinh viên</option>
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
