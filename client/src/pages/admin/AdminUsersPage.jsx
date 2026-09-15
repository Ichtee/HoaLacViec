import { useState, useEffect } from 'react';
import { Users, Lock, Unlock, Search, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';
import { getAllUsers } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Toast } from '@/components/Feedback.jsx';

export default function AdminUsersPage() {
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

  function handleToggleLock(userId) {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: u.status === 'locked' ? 'active' : 'locked' } : u));
    setToast({ type: 'info', message: 'Đã thay đổi trạng thái tài khoản.' });
  }

  const filtered = users.filter(u => {
    const matchesSearch = u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-green-dark" /> Quản lý danh sách tài khoản người dùng
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Theo dõi sinh viên và nhà tuyển dụng trên hệ thống. Quản lý trạng thái khóa / kích hoạt.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Tìm theo tên/email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-green-dark"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Đang tải danh sách tài khoản...</div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
          {filtered.map(userItem => (
            <div key={userItem.id} className="p-4 sm:p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={clsx(
                  'w-10 h-10 rounded-2xl font-bold text-sm flex items-center justify-center text-white',
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

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleLock(userItem.id)}
                  className={clsx(
                    'p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors',
                    userItem.status === 'locked' ? 'bg-green-50 text-green-dark' : 'bg-red-50 text-red-600 hover:bg-red-100'
                  )}
                >
                  {userItem.status === 'locked' ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  {userItem.status === 'locked' ? 'Mở khóa' : 'Khóa'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
