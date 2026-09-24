import { useState, useEffect } from 'react';
import {
  ShoppingBag, Utensils, Bike, Package, Printer, Plus, CheckCircle,
  Clock, MapPin, Phone, User, DollarSign, Filter, Search, AlertCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getTasks, createTask, acceptTask, completeTask } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Modal } from '@/components/Modal.jsx';
import { Toast } from '@/components/Feedback.jsx';

const TASK_CATEGORIES = [
  { id: 'all', label: 'Tất cả việc vặt', icon: null },
  { id: 'di_cho', label: 'Đi chợ / Mua cơm', icon: ShoppingBag, color: 'text-amber-600 bg-amber-50' },
  { id: 'nau_an', label: 'Nấu ăn hộ', icon: Utensils, color: 'text-orange-600 bg-orange-50' },
  { id: 'xe_om', label: 'Xe ôm / Chở đồ', icon: Bike, color: 'text-blue-600 bg-blue-50' },
  { id: 'lay_ship', label: 'Nhận ship / Lấy hàng', icon: Package, color: 'text-purple-600 bg-purple-50' },
  { id: 'khac', label: 'Việc khác', icon: Printer, color: 'text-emerald-600 bg-emerald-50' },
];

export default function MicroTasksPage() {
  const { user, isAuthenticated } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  // Modal create
  const [createModal, setCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    category: 'di_cho',
    reward: 30000,
    location: '',
    deadline: 'Hôm nay',
    description: '',
    phone: user?.phone || '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Modal accept
  const [acceptModalTask, setAcceptModalTask] = useState(null);
  const [acceptPhone, setAcceptPhone] = useState(user?.phone || '');
  const [acceptNote, setAcceptNote] = useState('');

  useEffect(() => {
    loadTasks();
  }, [category]);

  async function loadTasks() {
    try {
      setLoading(true);
      const data = await getTasks({ category });
      setTasks(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTask(e) {
    e.preventDefault();
    if (!formData.title || !formData.reward) {
      setToast({ type: 'error', message: 'Vui lòng điền đủ thông tin tiêu đề và thù lao.' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await createTask({
        ...formData,
        requesterId: user?.id || user?._id,
        requesterName: user?.name || 'Thành viên Hòa Lạc',
        requesterPhone: formData.phone,
      });
      setTasks(prev => [res, ...prev]);
      setToast({ type: 'success', message: 'Đã đăng việc vặt lên chợ thành công!' });
      setCreateModal(false);
      setFormData({
        title: '',
        category: 'di_cho',
        reward: 30000,
        location: '',
        deadline: 'Hôm nay',
        description: '',
        phone: user?.phone || '',
      });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi đăng việc vặt.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAcceptTask() {
    if (!acceptModalTask) return;
    try {
      setSubmitting(true);
      await acceptTask(acceptModalTask._id || acceptModalTask.id, {
        assigneeId: user?.id || user?._id,
        assigneeName: user?.name || 'Thành viên nhận việc',
        assigneePhone: acceptPhone || user?.phone || '',
        note: acceptNote,
      });
      setTasks(prev => prev.map(t => (t._id === acceptModalTask._id || t.id === acceptModalTask.id)
        ? { ...t, status: 'accepted', assigneeName: user?.name || 'Bạn sinh viên' }
        : t
      ));
      setToast({ type: 'success', message: 'Nhận việc thành công! Hãy liên hệ người đăng để thực hiện.' });
      setAcceptModalTask(null);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Có lỗi khi nhận việc.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCompleteTask(taskId) {
    try {
      await completeTask(taskId);
      setTasks(prev => prev.map(t => (t._id === taskId || t.id === taskId) ? { ...t, status: 'completed' } : t));
      setToast({ type: 'success', message: 'Đã xác nhận hoàn thành việc vặt!' });
    } catch (err) {
      setToast({ type: 'error', message: 'Lỗi hoàn thành.' });
    }
  }

  const filteredTasks = tasks.filter(t => {
    if (!search) return true;
    return t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.location.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 rounded-3xl p-8 sm:p-12 text-white shadow-soft relative overflow-hidden">
        <div className="max-w-2xl relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold text-white">
            <ShoppingBag className="w-4 h-4" /> Chợ Việc Vặt Sinh Viên Hòa Lạc
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
            Thuê Việc Vặt — Giúp Nhau Mỗi Ngày 🛵
          </h1>
          <p className="text-amber-50 text-sm sm:text-base leading-relaxed">
            Bạn bận học, đang ốm hay không có xe? Đăng việc nhờ người đi chợ hộ, xe ôm nội khu, lấy bưu phẩm... hoặc nhận việc để kiếm thêm tiền tiêu vặt ngay hôm nay!
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setCreateModal(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-orange-600 font-bold text-sm hover:bg-amber-50 transition-all shadow-md"
            >
              <Plus className="w-4 h-4" /> Đăng việc cần nhờ ngay
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Categories */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1">
          {TASK_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                category === cat.id
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-white text-text-muted hover:bg-orange-50 hover:text-orange-600 border border-green-50'
              }`}
            >
              {cat.icon && <cat.icon className="w-3.5 h-3.5" />}
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo khu vực, tên việc..."
            className="w-full pl-10 pr-4 py-2 rounded-2xl bg-white border border-green-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
      </div>

      {/* Task List Grid */}
      {loading ? (
        <div className="text-center py-16 text-text-muted">Đang tải danh sách việc vặt...</div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-green-50 shadow-card space-y-4">
          <Package className="w-12 h-12 text-orange-300 mx-auto" />
          <h3 className="text-base font-bold text-text-main">Chưa có việc vặt nào trong mục này</h3>
          <p className="text-xs text-text-muted">Hãy là người đầu tiên đăng nhờ việc để các bạn sinh viên khác giúp đỡ!</p>
          <button
            onClick={() => setCreateModal(true)}
            className="btn btn-primary text-xs px-4 py-2"
          >
            Đăng việc ngay
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTasks.map(task => {
            const isCompleted = task.status === 'completed';
            const isAccepted = task.status === 'accepted';
            const isOpen = task.status === 'open';

            return (
              <div
                key={task._id || task.id}
                className="bg-white rounded-3xl p-6 border border-green-50 hover:border-orange-300 shadow-card hover:shadow-modal transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Top: Status & Reward */}
                  <div className="flex items-center justify-between">
                    <Badge variant={isOpen ? 'green' : isAccepted ? 'warning' : 'gray'} size="sm">
                      {isOpen ? 'Đang tìm người' : isAccepted ? 'Đã có bạn nhận' : 'Hoàn thành'}
                    </Badge>
                    <span className="text-base font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-100">
                      {Number(task.reward).toLocaleString('vi-VN')}đ
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-bold text-base text-text-main leading-snug">
                    {task.title}
                  </h3>

                  {/* Description */}
                  <p className="text-xs text-text-muted leading-relaxed line-clamp-3">
                    {task.description}
                  </p>

                  {/* Info points */}
                  <div className="space-y-1.5 pt-2 text-xs text-text-muted">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-2 truncate">
                        <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                        <span className="font-medium text-text-main truncate">{task.location}</span>
                      </div>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(task.location + ', Hòa Lạc, Thạch Thất, Hà Nội')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-lg shrink-0 transition-colors"
                        title="Mở chỉ đường trên Google Maps"
                      >
                        Bản đồ ↗
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span>Hạn chót: <span className="font-semibold text-text-main">{task.deadline}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-green-600 shrink-0" />
                      <span>Người nhờ: <span className="font-medium text-text-main">{task.requesterName}</span></span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-green-50 flex items-center justify-between">
                  {isOpen ? (
                    <button
                      onClick={() => setAcceptModalTask(task)}
                      className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" /> Nhận việc này ({Number(task.reward).toLocaleString('vi-VN')}đ)
                    </button>
                  ) : isAccepted ? (
                    <div className="w-full flex items-center justify-between gap-2">
                      <span className="text-xs text-amber-700 font-medium">
                        Đang thực hiện ({task.assigneeName})
                      </span>
                      <button
                        onClick={() => handleCompleteTask(task._id || task.id)}
                        className="px-3 py-1.5 rounded-lg bg-green-main hover:bg-green-dark text-white font-bold text-xs"
                      >
                        Đã xong ✓
                      </button>
                    </div>
                  ) : (
                    <div className="w-full text-center text-xs text-green-dark font-medium py-1.5 bg-green-50 rounded-xl">
                      ✓ Đã hoàn thành công việc
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Đăng việc vặt */}
      <Modal isOpen={createModal} onClose={() => setCreateModal(false)} title="Đăng việc vặt cần nhờ sinh viên" size="md">
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-text-main mb-1">Tiêu đề việc cần nhờ *</label>
            <input
              type="text"
              required
              placeholder="VD: Nhờ đi chợ mua đồ ăn, Cần xe ôm sang KTX ĐHQG..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-green-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Phân loại</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-green-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="di_cho">Đi chợ / Mua cơm</option>
                <option value="nau_an">Nấu ăn hộ</option>
                <option value="xe_om">Xe ôm / Chở đồ</option>
                <option value="lay_ship">Nhận ship / Lấy hàng</option>
                <option value="khac">Việc khác</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Mức thù lao (VNĐ) *</label>
              <input
                type="number"
                step="5000"
                min="10000"
                required
                value={formData.reward}
                onChange={(e) => setFormData({ ...formData, reward: e.target.value })}
                className="w-full px-3 py-2 border border-green-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Địa điểm giao nhận</label>
              <input
                type="text"
                value={formData.location}
                placeholder="VD: KTX Dom A, KTX ĐHQG..."
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-green-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Thời hạn cần xong</label>
              <input
                type="text"
                value={formData.deadline}
                placeholder="VD: Trước 12h trưa nay..."
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="w-full px-3 py-2 border border-green-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-main mb-1">Số điện thoại liên hệ *</label>
            <input
              type="text"
              required
              value={formData.phone}
              placeholder="Số điện thoại / Zalo để bạn nhận việc liên hệ"
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-green-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-text-main mb-1">Mô tả chi tiết việc cần nhờ</label>
            <textarea
              rows={3}
              value={formData.description}
              placeholder="Chi tiết món đồ cần mua, địa chỉ nhận hàng, lưu ý..."
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-green-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateModal(false)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-sm"
            >
              {submitting ? 'Đang đăng...' : 'Đăng việc ngay'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Nhận việc vặt */}
      <Modal isOpen={Boolean(acceptModalTask)} onClose={() => setAcceptModalTask(null)} title="Xác nhận nhận việc vặt" size="sm">
        {acceptModalTask && (
          <div className="space-y-4">
            <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 space-y-1">
              <p className="font-bold text-text-main text-sm">{acceptModalTask.title}</p>
              <p className="text-xs text-orange-700 font-semibold">
                Thù lao nhận được: {Number(acceptModalTask.reward).toLocaleString('vi-VN')}đ
              </p>
              <p className="text-xs text-text-muted flex items-center justify-between">
                <span>Địa điểm: <strong className="text-text-main">{acceptModalTask.location}</strong> • Hạn chót: {acceptModalTask.deadline}</span>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(acceptModalTask.location + ', Hòa Lạc, Thạch Thất, Hà Nội')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline font-semibold ml-2 shrink-0"
                  title="Mở chỉ đường Google Maps"
                >
                  Chỉ đường ↗
                </a>
              </p>
              <p className="text-xs text-text-muted">
                Người nhờ: {acceptModalTask.requesterName} (SĐT: <span className="font-bold text-text-main">{acceptModalTask.requesterPhone}</span>)
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Số điện thoại của bạn</label>
              <input
                type="text"
                value={acceptPhone}
                placeholder="Nhập số điện thoại để người đăng liên lạc"
                onChange={(e) => setAcceptPhone(e.target.value)}
                className="w-full px-3 py-2 border border-green-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Lời nhắn (không bắt buộc)</label>
              <input
                type="text"
                value={acceptNote}
                placeholder="VD: Mình có xe máy, 15 phút nữa mình qua..."
                onChange={(e) => setAcceptNote(e.target.value)}
                className="w-full px-3 py-2 border border-green-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAcceptModalTask(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold"
              >
                Để sau
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleAcceptTask}
                className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-sm"
              >
                {submitting ? 'Đang nhận...' : 'Đồng ý nhận việc'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

