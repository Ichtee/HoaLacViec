import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ShoppingBag,
  Package,
  Plus,
  Search,
  AlertTriangle,
  ShieldAlert,
  Filter,
  ChevronDown,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth.jsx';
import {
  getTasks,
  acceptTask,
  submitTaskCompletion,
  completeTask,
  disputeTask,
  cancelTask,
  createReview,
} from '@/services';

import { Toast } from '@/components/Feedback.jsx';
import { TASK_CATEGORIES, TASK_TABS } from './microtasks/constants.js';
import MicroTaskCard from './microtasks/MicroTaskCard.jsx';
import MicroTaskModals from './microtasks/MicroTaskModals.jsx';

export default function MicroTasksPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();

  const currentTab = searchParams.get('tab') || 'open';

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
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
      navigate('/login?redirect=/tasks/create');
      return;
    }
    navigate('/tasks/create');
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

    // Quick client-side check if user already has 2 active tasks in current state
    const currentUserId = user?._id || user?.id;
    const activeTasksCount = tasks.filter((t) => {
      const assId = t.assigneeId?._id || t.assigneeId;
      return (
        String(assId) === String(currentUserId) &&
        ['accepted', 'submitted_for_completion', 'disputed'].includes(t.status)
      );
    }).length;

    if (activeTasksCount >= 2) {
      setToast({
        type: 'warning',
        message: 'Bạn đang nhận 2 việc vặt. Mỗi người chỉ được làm tối đa 2 việc cùng một lúc. Vui lòng hoàn thành việc trước khi nhận thêm.',
      });
      return;
    }

    setAcceptModalTask(task);
    setAcceptPhone(user?.phone || '');
    setAcceptNote('');
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
      <div className="bg-gradient-to-r from-green-main to-green-dark rounded-3xl p-6 sm:p-8 text-white shadow-soft relative overflow-hidden">
        <div className="max-w-2xl relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold text-white">
            <ShoppingBag className="w-4 h-4" /> Chợ Việc Vặt Sinh Viên Hòa Lạc
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-tight text-balance">
            Thuê Việc Vặt — Giúp Nhau Mỗi Ngày
          </h1>
          <p className="text-green-50 text-sm sm:text-base leading-relaxed">
            Bạn bận học, đang ốm hay không có xe? Đăng việc nhờ người đi chợ hộ, xe ôm nội khu, chuyển đồ phòng trọ, lấy bưu phẩm... hoặc nhận việc để kiếm thêm tiền tiêu vặt ngay hôm nay!
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-green-dark font-bold text-sm hover:bg-amber-50 transition-all shadow-md active:scale-95"
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

      {/* Dropdown Filter Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* 1. Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo khu vực, mô tả, tên việc..."
              className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-green-main focus:bg-white focus:border-transparent transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 2. Dropdown: Chế độ xem / Trạng thái */}
          <div className="relative min-w-[210px] sm:min-w-[230px]">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-green-dark">
              <Filter className="w-4 h-4" />
            </div>
            <select
              value={currentTab}
              onChange={(e) => handleTabChange(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs sm:text-sm font-semibold text-gray-800 appearance-none focus:outline-none focus:ring-2 focus:ring-green-main focus:bg-white focus:border-transparent transition-all cursor-pointer"
            >
              {TASK_TABS.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>

          {/* 3. Dropdown: Phân loại danh mục */}
          <div className="relative min-w-[190px] sm:min-w-[210px]">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-green-dark">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs sm:text-sm font-semibold text-gray-800 appearance-none focus:outline-none focus:ring-2 focus:ring-green-main focus:bg-white focus:border-transparent transition-all cursor-pointer"
            >
              {TASK_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Active Filter Indicators & Reset button */}
        {(currentTab !== 'open' || category !== 'all' || search) && (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 text-xs text-gray-500 flex-wrap">
            <span className="font-medium text-gray-600">Đang lọc theo:</span>
            {currentTab !== 'open' && (
              <span className="inline-flex items-center gap-1 bg-green-50 text-green-dark px-2.5 py-1 rounded-lg font-medium border border-green-200/60">
                {TASK_TABS.find((t) => t.id === currentTab)?.label || currentTab}
              </span>
            )}
            {category !== 'all' && (
              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg font-medium border border-amber-200/60">
                {TASK_CATEGORIES.find((c) => c.id === category)?.label || category}
              </span>
            )}
            {search && (
              <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg font-medium">
                "{search}"
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                handleTabChange('open');
                setCategory('all');
                setSearch('');
              }}
              className="ml-auto text-green-dark hover:text-green-dark font-semibold cursor-pointer hover:underline text-xs"
            >
              Đặt lại mặc định
            </button>
          </div>
        )}
      </div>

      {/* When in Disputed Tab: Explanatory Context Banner */}
      {currentTab === 'disputed' && (
        <div className="bg-red-50/80 border border-red-200 rounded-2xl p-4 flex items-start gap-3 text-red-950 text-xs sm:text-sm animate-fade-in shadow-xs">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-red-900">Mục khiếu nại & hỗ trợ giải quyết sự cố (Dispute):</p>
            <p className="text-xs text-red-800 leading-relaxed">
              Trạng thái <strong>Tranh chấp (Disputed)</strong> diễn ra khi một trong hai bên (người nhờ hoặc người nhận) gặp sự cố trong quá trình thực hiện việc (ví dụ: bùng kèo, không trả tiền công, không liên lạc được, hàng hóa bị hư hỏng/thất lạc...).
            </p>
            <p className="text-xs text-red-800 leading-relaxed">
              Khi bạn bấm <em>"Khiếu nại / Báo cáo sự cố"</em>, hệ thống sẽ tạm đóng băng việc này và tự động gửi hồ sơ đến Ban quản trị (Admin). Admin sẽ đối chiếu bằng chứng (hình ảnh/tin nhắn) và liên hệ hai bên để xử lý công bằng (hoàn tiền, phạt điểm uy tín, hoặc khóa tài khoản vi phạm).
            </p>
          </div>
        </div>
      )}

      {/* Task List Grid */}
      {loading ? (
        <div className="text-center py-16 text-text-muted">Đang tải danh sách việc vặt...</div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-card space-y-4">
          <Package className="w-12 h-12 text-green-main/50 mx-auto" />
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
          {filteredTasks.map((task) => (
            <MicroTaskCard
              key={task._id || task.id}
              task={task}
              user={user}
              setSubmitCompletionTask={setSubmitCompletionTask}
              setCompletionProof={setCompletionProof}
              setCompletionNote={setCompletionNote}
              setDisputeModalTask={setDisputeModalTask}
              setCancelModalTask={setCancelModalTask}
              setReviewModalTask={setReviewModalTask}
              setReviewRating={setReviewRating}
              setReviewComment={setReviewComment}
              handleOpenAccept={handleOpenAccept}
              handleCompleteTask={handleCompleteTask}
            />
          ))}
        </div>
      )}

      <MicroTaskModals
        submitting={submitting}
        acceptModalTask={acceptModalTask}
        setAcceptModalTask={setAcceptModalTask}
        acceptPhone={acceptPhone}
        setAcceptPhone={setAcceptPhone}
        acceptNote={acceptNote}
        setAcceptNote={setAcceptNote}
        submitCompletionTask={submitCompletionTask}
        setSubmitCompletionTask={setSubmitCompletionTask}
        completionProof={completionProof}
        setCompletionProof={setCompletionProof}
        completionNote={completionNote}
        setCompletionNote={setCompletionNote}
        disputeModalTask={disputeModalTask}
        setDisputeModalTask={setDisputeModalTask}
        disputeReason={disputeReason}
        setDisputeReason={setDisputeReason}
        disputeContent={disputeContent}
        setDisputeContent={setDisputeContent}
        disputeEvidence={disputeEvidence}
        setDisputeEvidence={setDisputeEvidence}
        cancelModalTask={cancelModalTask}
        setCancelModalTask={setCancelModalTask}
        cancelReason={cancelReason}
        setCancelReason={setCancelReason}
        reviewModalTask={reviewModalTask}
        setReviewModalTask={setReviewModalTask}
        reviewRating={reviewRating}
        setReviewRating={setReviewRating}
        reviewComment={reviewComment}
        setReviewComment={setReviewComment}
        handleAcceptTask={handleAcceptTask}
        handleSubmitCompletion={handleSubmitCompletion}
        handleDisputeTask={handleDisputeTask}
        handleCancelTask={handleCancelTask}
        handleCreateReview={handleCreateReview}
      />
    </div>
  );
}
