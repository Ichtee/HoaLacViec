import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ShoppingBag, Utensils, Bike, Truck, Package, Printer, Plus, CheckCircle,
  Clock, MapPin, User, Search,
  AlertTriangle, ShieldAlert, Star, ExternalLink, Send
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth.jsx';
import {
  getTasks,
  createTask,
  acceptTask,
  submitTaskCompletion,
  completeTask,
  disputeTask,
  cancelTask,
  createReview,
  updateUserProfile,
} from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Modal } from '@/components/Modal.jsx';
import { Toast } from '@/components/Feedback.jsx';

const TASK_CATEGORIES = [
  { id: 'all', label: 'Tất cả việc vặt', icon: null },
  { id: 'di_cho', label: 'Đi chợ / Mua cơm', icon: ShoppingBag, color: 'text-amber-600 bg-amber-50' },
  { id: 'nau_an', label: 'Nấu ăn hộ', icon: Utensils, color: 'text-orange-600 bg-orange-50' },
  { id: 'xe_om', label: 'Xe ôm sinh viên', icon: Bike, color: 'text-blue-600 bg-blue-50' },
  { id: 'chuyen_do', label: 'Chuyển đồ / Dọn phòng', icon: Truck, color: 'text-indigo-600 bg-indigo-50' },
  { id: 'lay_ship', label: 'Nhận ship / Lấy hàng', icon: Package, color: 'text-purple-600 bg-purple-50' },
  { id: 'khac', label: 'Việc khác', icon: Printer, color: 'text-emerald-600 bg-emerald-50' },
];

const TASK_TABS = [
  { id: 'open', label: 'Đang mở nhận việc' },
  { id: 'my_posted', label: 'Việc tôi đăng' },
  { id: 'my_accepted', label: 'Việc tôi nhận' },
  { id: 'awaiting_approval', label: 'Chờ nghiệm thu' },
  { id: 'completed', label: 'Đã hoàn thành' },
  { id: 'disputed', label: 'Tranh chấp' },
];

export default function MicroTasksPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated, updateUser } = useAuth();

  const currentTab = searchParams.get('tab') || 'open';

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
    itemBudget: 0,
    paymentMethod: 'cash',
    location: '',
    pickupAddress: '',
    destinationAddress: '',
    deadlineDate: '',
    description: '',
    phone: user?.phone || '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Modal accept
  const [acceptModalTask, setAcceptModalTask] = useState(null);
  const [acceptPhone, setAcceptPhone] = useState(user?.phone || '');
  const [acceptNote, setAcceptNote] = useState('');

  // Modal submit completion
  const [submitCompletionTask, setSubmitCompletionTask] = useState(null);
  const [completionProof, setCompletionProof] = useState('');
  const [completionNote, setCompletionNote] = useState('');

  // Modal dispute
  const [disputeModalTask, setDisputeModalTask] = useState(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeContent, setDisputeContent] = useState('');
  const [disputeEvidence, setDisputeEvidence] = useState('');

  // Modal cancel
  const [cancelModalTask, setCancelModalTask] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  // Modal review
  const [reviewModalTask, setReviewModalTask] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');


  useEffect(() => {
    let mounted = true;
    getTasks({
      category: category !== 'all' ? category : undefined,
      tab: currentTab,
      search: search.trim() || undefined,
    })
      .then((res) => {
        if (!mounted) return;
        if (Array.isArray(res)) {
          setTasks(res);
        } else if (res && Array.isArray(res.tasks)) {
          setTasks(res.tasks);
        } else {
          setTasks([]);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        console.error(err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [category, currentTab, search]);

  function handleTabChange(tabId) {
    if (tabId !== 'open' && !isAuthenticated) {
      setToast({ type: 'warning', message: 'Vui lòng đăng nhập để xem mục này.' });
      navigate('/login', { state: { from: `/tasks?tab=${tabId}` } });
      return;
    }
    setSearchParams({ tab: tabId });
  }

  function handleOpenCreate() {
    if (!isAuthenticated) {
      setToast({ type: 'warning', message: 'Vui lòng đăng nhập tài khoản để đăng việc cần nhờ.' });
      navigate('/login', { state: { from: '/tasks' } });
      return;
    }

    const now = new Date();
    now.setHours(now.getHours() + 3);
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    setFormData((prev) => ({
      ...prev,
      phone: prev.phone || user?.phone || '',
      deadlineDate: localIso,
    }));
    setCreateModal(true);
  }

  function handleOpenAccept(task) {
    if (!isAuthenticated) {
      setToast({ type: 'warning', message: 'Vui lòng đăng nhập để nhận công việc.' });
      navigate('/login', { state: { from: '/tasks' } });
      return;
    }

    if (user?.role !== 'student') {
      setToast({
        type: 'error',
        message: 'Chỉ tài khoản sinh viên (student) mới có thể nhận việc vặt kiếm thu nhập.',
      });
      return;
    }

    setAcceptModalTask(task);
    setAcceptPhone(user?.phone || '');
    setAcceptNote('');
  }

  async function handleCreateTask(e) {
    e.preventDefault();
    if (!formData.title || !formData.reward || !formData.description) {
      setToast({ type: 'error', message: 'Vui lòng điền đủ thông tin tiêu đề, mô tả và tiền thù lao.' });
      return;
    }

    const isRouteCategory = ['xe_om', 'chuyen_do'].includes(formData.category);
    if (isRouteCategory && (!formData.pickupAddress || !formData.destinationAddress)) {
      setToast({ type: 'error', message: 'Vui lòng điền cả điểm đón/xuất phát và điểm đến.' });
      return;
    }
    if (!isRouteCategory && !formData.location) {
      setToast({ type: 'error', message: 'Vui lòng nhập địa chỉ / địa điểm thực hiện việc vặt.' });
      return;
    }

    if (!formData.deadlineDate) {
      setToast({ type: 'error', message: 'Vui lòng chọn thời hạn hoàn thành công việc.' });
      return;
    }

    if (new Date(formData.deadlineDate) <= new Date()) {
      setToast({ type: 'error', message: 'Thời hạn hoàn thành phải ở tương lai.' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await createTask({
        ...formData,
        reward: Number(formData.reward),
        itemBudget: Number(formData.itemBudget) || 0,
      });

      if (formData.phone && !user?.phone) {
        updateUserProfile({ phone: formData.phone.trim() }).catch(() => {});
        if (updateUser) updateUser({ ...user, phone: formData.phone.trim() });
      }

      setTasks((prev) => [res, ...prev]);
      setToast({ type: 'success', message: 'Đã đăng việc vặt lên chợ thành công!' });
      setCreateModal(false);
      setFormData({
        title: '',
        category: 'di_cho',
        reward: 30000,
        itemBudget: 0,
        paymentMethod: 'cash',
        location: '',
        pickupAddress: '',
        destinationAddress: '',
        deadlineDate: '',
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
      const res = await acceptTask(acceptModalTask._id || acceptModalTask.id, {
        assigneePhone: acceptPhone || user?.phone || '',
        note: acceptNote,
      });

      const updatedTask = res.task || res;
      setTasks((prev) =>
        prev.map((t) => (t._id === acceptModalTask._id || t.id === acceptModalTask.id ? updatedTask : t))
      );
      setToast({ type: 'success', message: 'Nhận việc thành công! Hãy liên hệ người nhờ để thực hiện.' });
      setAcceptModalTask(null);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Có lỗi khi nhận việc.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitCompletion() {
    if (!submitCompletionTask) return;
    try {
      setSubmitting(true);
      const res = await submitTaskCompletion(submitCompletionTask._id || submitCompletionTask.id, {
        proof: completionProof,
        note: completionNote,
      });

      const updatedTask = res.task || res;
      setTasks((prev) =>
        prev.map((t) => (t._id === submitCompletionTask._id || t.id === submitCompletionTask.id ? updatedTask : t))
      );
      setToast({ type: 'success', message: 'Đã gửi báo cáo kết quả hoàn thành! Chờ người nhờ nghiệm thu.' });
      setSubmitCompletionTask(null);
      setCompletionProof('');
      setCompletionNote('');
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi gửi báo cáo kết quả.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCompleteTask(taskId) {
    try {
      setSubmitting(true);
      const res = await completeTask(taskId);
      const updatedTask = res.task || res;
      setTasks((prev) => prev.map((t) => (t._id === taskId || t.id === taskId ? updatedTask : t)));
      setToast({ type: 'success', message: 'Đã nghiệm thu và xác nhận hoàn thành việc vặt!' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi xác nhận hoàn thành.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisputeTask() {
    if (!disputeModalTask) return;
    if (!disputeReason.trim()) {
      setToast({ type: 'error', message: 'Vui lòng nhập lý do khiếu nại tranh chấp.' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await disputeTask(disputeModalTask._id || disputeModalTask.id, {
        reason: disputeReason,
        content: disputeContent || disputeReason,
        evidenceUrl: disputeEvidence,
      });

      const updatedTask = res.task || res;
      setTasks((prev) =>
        prev.map((t) => (t._id === disputeModalTask._id || t.id === disputeModalTask.id ? updatedTask : t))
      );
      setToast({ type: 'warning', message: 'Đã gửi khiếu nại. Ban quản trị sẽ tiến hành đối soát và xử lý.' });
      setDisputeModalTask(null);
      setDisputeReason('');
      setDisputeContent('');
      setDisputeEvidence('');
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi gửi khiếu nại tranh chấp.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelTask() {
    if (!cancelModalTask) return;
    try {
      setSubmitting(true);
      const res = await cancelTask(cancelModalTask._id || cancelModalTask.id, {
        cancelReason: cancelReason || 'Người đăng hủy bài',
      });

      const updatedTask = res.task || res;
      setTasks((prev) =>
        prev.map((t) => (t._id === cancelModalTask._id || t.id === cancelModalTask.id ? updatedTask : t))
      );
      setToast({ type: 'success', message: 'Đã hủy bài đăng việc vặt.' });
      setCancelModalTask(null);
      setCancelReason('');
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi hủy việc.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateReview() {
    if (!reviewModalTask) return;
    if (!reviewComment.trim()) {
      setToast({ type: 'error', message: 'Vui lòng nhập nhận xét đánh giá.' });
      return;
    }

    try {
      setSubmitting(true);
      await createReview({
        transactionType: 'task',
        transactionId: reviewModalTask._id || reviewModalTask.id,
        rating: reviewRating,
        comment: reviewComment,
      });

      setToast({ type: 'success', message: 'Cảm ơn bạn đã gửi đánh giá!' });
      setReviewModalTask(null);
      setReviewComment('');
      setReviewRating(5);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi gửi đánh giá.' });
    } finally {
      setSubmitting(false);
    }
  }

  const filteredTasks = tasks.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.title?.toLowerCase().includes(q) ||
      t.location?.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.pickupAddress?.toLowerCase().includes(q) ||
      t.destinationAddress?.toLowerCase().includes(q)
    );
  });

  const isSafetyCategory = ['xe_om', 'chuyen_do'].includes(category);

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
            Bạn bận học, đang ốm hay không có xe? Đăng việc nhờ người đi chợ hộ, xe ôm nội khu, chuyển đồ phòng trọ, lấy bưu phẩm... hoặc nhận việc để kiếm thêm tiền tiêu vặt ngay hôm nay!
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-orange-600 font-bold text-sm hover:bg-amber-50 transition-all shadow-md active:scale-95"
            >
              <Plus className="w-4 h-4" /> Đăng việc cần nhờ ngay
            </button>
          </div>
        </div>
      </div>

      {/* Safety Advisory Banner */}
      {isSafetyCategory && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-800 text-xs sm:text-sm animate-fade-in">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Lưu ý an toàn khi di chuyển & chuyển đồ:</p>
            <p className="text-xs leading-relaxed text-amber-700">
              Đối với dịch vụ chở người hoặc chuyển đồ, các bạn sinh viên vui lòng đội mũ bảo hiểm đạt chuẩn, thỏa thuận rõ ràng điểm đón/trả và kiểm tra kỹ tình trạng đồ đạc trước khi khởi hành. Nền tảng đóng vai trò kết nối cộng đồng tương trợ.
            </p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-gray-100 pb-2">
        {TASK_TABS.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-white text-text-muted hover:bg-orange-50 hover:text-orange-600 border border-gray-100'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Categories */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1">
          {TASK_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                category === cat.id
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-white text-text-muted hover:bg-orange-50 hover:text-orange-600 border border-gray-100'
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
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-gray-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
      </div>

      {/* Task List Grid */}
      {loading ? (
        <div className="text-center py-16 text-text-muted">Đang tải danh sách việc vặt...</div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-card space-y-4">
          <Package className="w-12 h-12 text-orange-300 mx-auto" />
          <h3 className="text-base font-bold text-text-main">Chưa có việc vặt nào trong mục này</h3>
          <p className="text-xs text-text-muted">
            {currentTab === 'open'
              ? 'Hãy là người đầu tiên đăng nhờ việc để các bạn sinh viên khác giúp đỡ!'
              : 'Bạn chưa có việc nào trong danh sách này.'}
          </p>
          <button onClick={handleOpenCreate} className="btn btn-primary text-xs px-4 py-2">
            Đăng việc ngay
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTasks.map((task) => {
            const taskId = task._id || task.id;
            const status = task.status;

            const isOpen = status === 'open';
            const isAccepted = status === 'accepted';
            const isSubmitted = status === 'submitted_for_completion';
            const isCompleted = status === 'completed';
            const isDisputed = status === 'disputed';
            const isCancelled = status === 'cancelled';
            const isExpired = status === 'expired';

            const isRequester =
              task.isRequester ||
              (user?._id && task.requesterId && (task.requesterId._id || task.requesterId).toString() === user._id.toString());
            const isAssignee =
              task.isAssignee ||
              (user?._id && task.assigneeId && (task.assigneeId._id || task.assigneeId).toString() === user._id.toString());
            const isParticipant = isRequester || isAssignee || user?.role === 'admin';

            const hasRoute = Boolean(task.pickupAddress && task.destinationAddress);
            const directionsUrl = hasRoute
              ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(task.pickupAddress)}&destination=${encodeURIComponent(task.destinationAddress)}`
              : task.location
              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.location)}`
              : null;

            return (
              <div
                key={taskId}
                className="bg-white rounded-3xl p-6 border border-gray-100 hover:border-orange-300 shadow-card hover:shadow-modal transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Top: Status & Reward */}
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant={
                        isOpen
                          ? 'green'
                          : isAccepted
                          ? 'warning'
                          : isSubmitted
                          ? 'purple'
                          : isCompleted
                          ? 'success'
                          : isDisputed
                          ? 'danger'
                          : 'gray'
                      }
                      size="sm"
                    >
                      {isOpen && 'Đang tìm người'}
                      {isAccepted && 'Đang thực hiện'}
                      {isSubmitted && 'Chờ nghiệm thu'}
                      {isCompleted && 'Đã hoàn thành'}
                      {isDisputed && 'Đang tranh chấp'}
                      {isCancelled && 'Đã hủy'}
                      {isExpired && 'Đã hết hạn'}
                    </Badge>

                    <div className="text-right">
                      <span className="text-sm sm:text-base font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-100">
                        {Number(task.reward).toLocaleString('vi-VN')}đ
                      </span>
                      {task.itemBudget > 0 && (
                        <p className="text-[10px] text-gray-500 mt-1">
                          + Ứng mua {Number(task.itemBudget).toLocaleString('vi-VN')}đ ({task.paymentMethod === 'banking' ? 'CK' : 'Tiền mặt'})
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="font-bold text-base text-text-main leading-snug line-clamp-2">
                    {task.title}
                  </h3>

                  {/* Description */}
                  <p className="text-xs text-text-muted leading-relaxed line-clamp-3">
                    {task.description}
                  </p>

                  {/* Route or Location Info */}
                  <div className="space-y-1.5 pt-2 text-xs text-text-muted">
                    {hasRoute ? (
                      <div className="p-2.5 rounded-xl bg-orange-50/50 border border-orange-100 space-y-1 text-xs">
                        <div className="flex items-center gap-1.5 text-text-main font-medium">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <span className="truncate">Đón: {task.pickupAddress}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-text-main font-medium">
                          <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                          <span className="truncate">Đến: {task.destinationAddress}</span>
                        </div>
                        {directionsUrl && (
                          <a
                            href={directionsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 pt-0.5"
                          >
                            <ExternalLink className="w-3 h-3" /> Chỉ đường lộ trình trên Google Maps
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                          <span className="font-medium text-text-main truncate" title={task.location}>
                            {task.location}
                          </span>
                        </div>
                        {directionsUrl && (
                          <a
                            href={directionsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-lg shrink-0 transition-colors"
                            title="Tìm địa chỉ trên Google Maps"
                          >
                            Bản đồ ↗
                          </a>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span>
                        Hạn chót: <span className="font-semibold text-text-main">{task.deadline}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Người nhờ: <strong className="text-text-main">{task.requesterName}</strong></span>
                      </div>
                      {isParticipant && task.requesterPhone && (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                          {task.requesterPhone}
                        </span>
                      )}
                    </div>

                    {task.assigneeName && (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Bike className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>Người nhận: <strong className="text-text-main">{task.assigneeName}</strong></span>
                        </div>
                        {isParticipant && task.assigneePhone && (
                          <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                            {task.assigneePhone}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Sensitive Proof or Dispute Box (Participants only) */}
                  {isParticipant && task.completionProof && (
                    <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-xs space-y-1">
                      <p className="font-bold text-blue-900 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-blue-600" /> Minh chứng hoàn thành:
                      </p>
                      <p className="text-blue-800 break-words">{task.completionProof}</p>
                      {task.completionNote && <p className="text-blue-700 italic">Ghi chú: {task.completionNote}</p>}
                    </div>
                  )}

                  {isParticipant && isDisputed && task.disputeReason && (
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-100 text-xs space-y-1">
                      <p className="font-bold text-red-900 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> Lý do khiếu nại tranh chấp:
                      </p>
                      <p className="text-red-800">{task.disputeReason}</p>
                    </div>
                  )}
                </div>

                {/* Bottom Actions based strictly on Role & Status */}
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  {isOpen && (
                    <>
                      {isRequester ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-text-muted italic">Đang chờ bạn nhận việc...</span>
                          <button
                            onClick={() => setCancelModalTask(task)}
                            className="px-3 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold"
                          >
                            Hủy bài đăng
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleOpenAccept(task)}
                          className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <CheckCircle className="w-4 h-4" /> Nhận việc này ({Number(task.reward).toLocaleString('vi-VN')}đ)
                        </button>
                      )}
                    </>
                  )}

                  {isAccepted && (
                    <div className="flex flex-col gap-2">
                      {isAssignee ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSubmitCompletionTask(task);
                              setCompletionProof('');
                              setCompletionNote('');
                            }}
                            className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5"
                          >
                            <Send className="w-3.5 h-3.5" /> Gửi kết quả hoàn thành
                          </button>
                          <button
                            onClick={() => setDisputeModalTask(task)}
                            className="px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 text-xs font-medium"
                            title="Báo cáo sự cố hoặc tranh chấp"
                          >
                            Khiếu nại
                          </button>
                        </div>
                      ) : isRequester ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-amber-700 font-medium">
                            Đang thực hiện ({task.assigneeName})
                          </span>
                          <button
                            onClick={() => setDisputeModalTask(task)}
                            className="px-2.5 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold"
                          >
                            Báo sự cố
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500 text-center block">Đang có bạn thực hiện</span>
                      )}
                    </div>
                  )}

                  {isSubmitted && (
                    <div className="flex flex-col gap-2">
                      {isRequester ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCompleteTask(taskId)}
                            className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle className="w-4 h-4" /> Xác nhận nghiệm thu ✓
                          </button>
                          <button
                            onClick={() => setDisputeModalTask(task)}
                            className="px-3 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold"
                          >
                            Khiếu nại
                          </button>
                        </div>
                      ) : isAssignee ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-blue-700 font-medium">
                            Đã nộp kết quả — Đang chờ nghiệm thu
                          </span>
                          <button
                            onClick={() => setDisputeModalTask(task)}
                            className="px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 text-xs"
                          >
                            Khiếu nại
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500 text-center block">Chờ nghiệm thu hoàn thành</span>
                      )}
                    </div>
                  )}

                  {isCompleted && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-xl">
                        ✓ Đã hoàn thành
                      </span>
                      {isParticipant && (
                        <button
                          onClick={() => {
                            setReviewModalTask(task);
                            setReviewRating(5);
                            setReviewComment('');
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold transition-colors"
                        >
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> Đánh giá
                        </button>
                      )}
                    </div>
                  )}

                  {isDisputed && (
                    <div className="w-full text-center text-xs text-red-700 font-medium py-1.5 bg-red-50 rounded-xl">
                      ⚠️ Đang được Ban quản trị đối soát giải quyết
                    </div>
                  )}

                  {isCancelled && (
                    <div className="w-full text-center text-xs text-gray-500 py-1.5 bg-gray-50 rounded-xl">
                      Đã hủy bỏ công việc
                    </div>
                  )}

                  {isExpired && (
                    <div className="w-full text-center text-xs text-gray-400 py-1.5 bg-gray-50 rounded-xl">
                      Đã hết hạn hoàn thành
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Đăng việc vặt */}
      <Modal isOpen={createModal} onClose={() => setCreateModal(false)} title="Đăng việc vặt cần nhờ sinh viên" size="lg">
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-text-main mb-1">Tiêu đề việc cần nhờ *</label>
            <input
              type="text"
              required
              minLength={5}
              maxLength={120}
              placeholder="VD: Nhờ mua cơm trưa giao KTX Dom A, Xe ôm sang KTX ĐHQG..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Phân loại *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="di_cho">Đi chợ / Mua cơm</option>
                <option value="nau_an">Nấu ăn hộ</option>
                <option value="xe_om">Xe ôm sinh viên</option>
                <option value="chuyen_do">Chuyển đồ / Dọn phòng</option>
                <option value="lay_ship">Nhận ship / Lấy hàng</option>
                <option value="khac">Việc khác</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Tiền công thù lao (VNĐ) *</label>
              <input
                type="number"
                step="5000"
                min="5000"
                required
                value={formData.reward}
                onChange={(e) => setFormData({ ...formData, reward: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Tiền ứng trước (nếu có)</label>
              <input
                type="number"
                step="5000"
                min="0"
                value={formData.itemBudget}
                onChange={(e) => setFormData({ ...formData, itemBudget: e.target.value })}
                placeholder="Tiền mua đồ ứng trước"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>

          {['xe_om', 'chuyen_do'].includes(formData.category) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-orange-50/50 rounded-2xl border border-orange-100">
              <div>
                <label className="block text-xs font-bold text-text-main mb-1">Điểm đón / xuất phát *</label>
                <input
                  type="text"
                  required
                  value={formData.pickupAddress}
                  placeholder="VD: Cổng 1 ĐH FPT, KTX Dom E..."
                  onChange={(e) => setFormData({ ...formData, pickupAddress: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-main mb-1">Điểm đến *</label>
                <input
                  type="text"
                  required
                  value={formData.destinationAddress}
                  placeholder="VD: Chợ Tân Xã, KTX ĐHQG..."
                  onChange={(e) => setFormData({ ...formData, destinationAddress: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Địa điểm thực hiện / giao nhận *</label>
              <input
                type="text"
                required
                value={formData.location}
                placeholder="VD: KTX Dom A ĐH FPT, Thôn 3 Thạch Hòa..."
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Thời hạn cần xong (Hạn chót) *</label>
              <input
                type="datetime-local"
                required
                value={formData.deadlineDate}
                onChange={(e) => setFormData({ ...formData, deadlineDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Số điện thoại liên hệ *</label>
              <input
                type="tel"
                required
                value={formData.phone}
                placeholder="Nhập 10 số di động"
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-main mb-1">Mô tả chi tiết việc cần nhờ *</label>
            <textarea
              rows={3}
              required
              minLength={10}
              maxLength={2000}
              value={formData.description}
              placeholder="Chi tiết món đồ cần mua, số phòng nhận hàng, lưu ý giao tiếp..."
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
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
      <Modal isOpen={Boolean(acceptModalTask)} onClose={() => setAcceptModalTask(null)} title="Xác nhận nhận việc vặt" size="md">
        {acceptModalTask && (
          <div className="space-y-4">
            <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 space-y-1">
              <p className="font-bold text-text-main text-sm">{acceptModalTask.title}</p>
              <p className="text-xs text-orange-700 font-semibold">
                Thù lao nhận được: {Number(acceptModalTask.reward).toLocaleString('vi-VN')}đ
              </p>
              {acceptModalTask.itemBudget > 0 && (
                <p className="text-xs text-gray-600">
                  Tiền ứng mua hộ: <strong>{Number(acceptModalTask.itemBudget).toLocaleString('vi-VN')}đ</strong>
                </p>
              )}
              <p className="text-xs text-text-muted">
                Địa điểm: <strong className="text-text-main">{acceptModalTask.location}</strong> • Hạn chót: {acceptModalTask.deadline}
              </p>
              <p className="text-xs text-text-muted">
                Người nhờ: {acceptModalTask.requesterName} (SĐT sẽ mở khóa đầy đủ ngay sau khi bạn nhận việc)
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Số điện thoại liên hệ của bạn *</label>
              <input
                type="tel"
                required
                value={acceptPhone}
                placeholder="Nhập 10 số di động để người nhờ gọi cho bạn"
                onChange={(e) => setAcceptPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Lời nhắn (không bắt buộc)</label>
              <input
                type="text"
                value={acceptNote}
                placeholder="VD: Mình có xe máy, khoảng 15 phút nữa mình ghé..."
                onChange={(e) => setAcceptNote(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
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

      {/* Modal Báo cáo kết quả hoàn thành (Assignee) */}
      <Modal
        isOpen={Boolean(submitCompletionTask)}
        onClose={() => setSubmitCompletionTask(null)}
        title="Gửi báo cáo hoàn thành công việc"
        size="md"
      >
        {submitCompletionTask && (
          <div className="space-y-4">
            <p className="text-xs text-text-muted">
              Vui lòng cung cấp minh chứng (link ảnh, biên lai, ảnh giao hàng) và ghi chú hoàn tất để người nhờ kiểm tra và nghiệm thu thù lao.
            </p>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Link ảnh minh chứng hoặc biên nhận</label>
              <input
                type="text"
                value={completionProof}
                placeholder="VD: Link ảnh Google Drive, Imgur hoặc mô tả đã giao..."
                onChange={(e) => setCompletionProof(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Ghi chú cho người nhờ</label>
              <textarea
                rows={3}
                value={completionNote}
                placeholder="VD: Đã gửi đồ tại bàn lễ tân KTX Dom A cho bạn..."
                onChange={(e) => setCompletionNote(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSubmitCompletionTask(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmitCompletion}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
              >
                {submitting ? 'Đang gửi...' : 'Gửi báo cáo nghiệm thu'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Báo cáo tranh chấp / Khiếu nại */}
      <Modal
        isOpen={Boolean(disputeModalTask)}
        onClose={() => setDisputeModalTask(null)}
        title="Mở khiếu nại tranh chấp việc vặt"
        size="md"
      >
        {disputeModalTask && (
          <div className="space-y-4">
            <div className="p-3 bg-red-50 rounded-2xl border border-red-100 text-xs text-red-700">
              Khi bạn mở khiếu nại, công việc sẽ chuyển sang trạng thái đối soát. Ban quản trị sẽ liên hệ hai bên và xem xét minh chứng để xử lý công bằng.
            </div>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Lý do khiếu nại *</label>
              <input
                type="text"
                required
                value={disputeReason}
                placeholder="VD: Không liên lạc được, giao thiếu đồ, không trả tiền ứng..."
                onChange={(e) => setDisputeReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Nội dung giải trình chi tiết</label>
              <textarea
                rows={3}
                value={disputeContent}
                placeholder="Mô tả cụ thể sự việc, mốc thời gian và yêu cầu giải quyết..."
                onChange={(e) => setDisputeContent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Link bằng chứng (nếu có)</label>
              <input
                type="text"
                value={disputeEvidence}
                placeholder="Link ảnh chụp tin nhắn, cuộc gọi, hóa đơn..."
                onChange={(e) => setDisputeEvidence(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDisputeModalTask(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDisputeTask}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm"
              >
                {submitting ? 'Đang gửi...' : 'Gửi khiếu nại lên BQT'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Hủy bài đăng */}
      <Modal isOpen={Boolean(cancelModalTask)} onClose={() => setCancelModalTask(null)} title="Hủy bài đăng việc vặt" size="sm">
        {cancelModalTask && (
          <div className="space-y-4">
            <p className="text-xs text-text-muted">
              Bạn có chắc chắn muốn hủy bài đăng <strong>"{cancelModalTask.title}"</strong>?
            </p>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Lý do hủy (tùy chọn)</label>
              <input
                type="text"
                value={cancelReason}
                placeholder="VD: Đã tìm được người quen giúp, thay đổi kế hoạch..."
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelModalTask(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold"
              >
                Giữ lại
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleCancelTask}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm"
              >
                {submitting ? 'Đang hủy...' : 'Xác nhận hủy'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Đánh giá sau hoàn thành */}
      <Modal isOpen={Boolean(reviewModalTask)} onClose={() => setReviewModalTask(null)} title="Đánh giá dịch vụ việc vặt" size="md">
        {reviewModalTask && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-text-main mb-2">Số sao đánh giá</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        star <= reviewRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-sm font-bold text-text-main ml-2">{reviewRating} / 5 sao</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-main mb-1">Nhận xét chi tiết *</label>
              <textarea
                rows={3}
                required
                value={reviewComment}
                placeholder="Nhận xét về thái độ, độ đúng giờ, sự nhiệt tình..."
                onChange={(e) => setReviewComment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewModalTask(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleCreateReview}
                className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-sm"
              >
                {submitting ? 'Đang gửi...' : 'Gửi đánh giá'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
