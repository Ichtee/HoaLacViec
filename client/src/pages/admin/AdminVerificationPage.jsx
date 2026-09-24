import { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  FileText,
  Building2,
  GraduationCap,
  MapPin,
  Eye,
  X,
  Filter,
  RefreshCw,
  Search,
  ExternalLink,
} from 'lucide-react';
import { getVerificationRequests, reviewVerification } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Toast } from '@/components/Feedback.jsx';
import { clsx } from 'clsx';

export default function AdminVerificationPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'student' | 'employer'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected'
  const [searchQuery, setSearchQuery] = useState('');
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      setLoading(true);
      const data = await getVerificationRequests();
      setRequests(data || []);
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: 'Lỗi khi tải danh sách xác thực: ' + (err.message || 'Lỗi server') });
    } finally {
      setLoading(false);
    }
  }

  async function handleReview(id, status, targetType) {
    let reason = '';
    if (status === 'rejected') {
      const defaultMsg = targetType === 'student'
        ? 'Ảnh thẻ sinh viên bị mờ hoặc thông tin mã số sinh viên không trùng khớp.'
        : 'Giấy tờ hoặc thông tin cửa hàng chưa đạt tiêu chuẩn quy định.';
      const userReason = prompt('Nhập lý do từ chối hồ sơ xác minh này:', defaultMsg);
      if (userReason === null) return;
      reason = userReason;
    }

    try {
      await reviewVerification(id, status, reason);
      setRequests(prev =>
        prev.map(r =>
          (r._id === id || r.id === id)
            ? { ...r, status, verified: status === 'approved', rejectionReason: reason }
            : r
        )
      );

      const isStudent = targetType === 'student';
      if (status === 'approved') {
        setToast({
          type: 'success',
          message: isStudent
            ? 'Đã duyệt thẻ sinh viên và kích hoạt tài khoản thành công!'
            : 'Đã phê duyệt và kích hoạt tài khoản Nhà tuyển dụng!',
        });
      } else {
        setToast({
          type: 'info',
          message: isStudent ? 'Đã từ chối thẻ sinh viên.' : 'Đã từ chối hồ sơ doanh nghiệp.',
        });
      }
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi xử lý duyệt hồ sơ.' });
    }
  }

  // Filtered requests based on tab, status, and search query
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      // Type match
      const reqType = req.verificationType || (req.studentCode ? 'student' : 'employer');
      if (activeTab !== 'all' && reqType !== activeTab) return false;

      // Status match
      const isApproved = req.status === 'approved' || req.verified === true;
      const isRejected = req.status === 'rejected';
      const isPending = req.status === 'pending' || (!req.verified && !isRejected);

      if (statusFilter === 'pending' && !isPending) return false;
      if (statusFilter === 'approved' && !isApproved) return false;
      if (statusFilter === 'rejected' && !isRejected) return false;

      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const searchPool = [
          req.storeName,
          req.legalName,
          req.studentCode,
          req.university,
          req.major,
          req.user?.name,
          req.user?.email,
          req.contactPhone,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!searchPool.includes(q)) return false;
      }

      return true;
    });
  }, [requests, activeTab, statusFilter, searchQuery]);

  // Counts
  const counts = useMemo(() => {
    const total = requests.length;
    let student = 0;
    let employer = 0;
    let pending = 0;

    requests.forEach(r => {
      const isStu = r.verificationType === 'student' || !!r.studentCode;
      if (isStu) student++;
      else employer++;

      const isPend = r.status === 'pending' || (!r.verified && r.status !== 'rejected');
      if (isPend) pending++;
    });

    return { total, student, employer, pending };
  }, [requests]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-12">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
              {counts.pending} hồ sơ đang chờ xét duyệt
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-green-dark" /> Duyệt hồ sơ Thẻ sinh viên & Đối tác cửa hàng
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Đối soát danh tính thẻ sinh viên và giấy phép đối tác trước khi kích hoạt tài khoản chính thức.
          </p>
        </div>
        <button
          onClick={loadRequests}
          disabled={loading}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} /> Làm mới
        </button>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-3">
        {/* Primary Type Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-3">
          <button
            onClick={() => setActiveTab('all')}
            className={clsx(
              'px-4 py-2 rounded-2xl text-xs font-bold transition-colors flex items-center gap-1.5',
              activeTab === 'all'
                ? 'bg-green-dark text-white shadow-sm'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            )}
          >
            Tất cả hồ sơ ({counts.total})
          </button>
          <button
            onClick={() => setActiveTab('student')}
            className={clsx(
              'px-4 py-2 rounded-2xl text-xs font-bold transition-colors flex items-center gap-1.5',
              activeTab === 'student'
                ? 'bg-green-dark text-white shadow-sm'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            )}
          >
            <GraduationCap className="w-4 h-4" /> Thẻ sinh viên ({counts.student})
          </button>
          <button
            onClick={() => setActiveTab('employer')}
            className={clsx(
              'px-4 py-2 rounded-2xl text-xs font-bold transition-colors flex items-center gap-1.5',
              activeTab === 'employer'
                ? 'bg-purple-700 text-white shadow-sm'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            )}
          >
            <Building2 className="w-4 h-4" /> Đối tác Cửa hàng ({counts.employer})
          </button>
        </div>

        {/* Sub-Filters: Status & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <span className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider mr-1">
              Trạng thái:
            </span>
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'pending', label: '⏳ Chờ duyệt' },
              { id: 'approved', label: '✓ Đã duyệt' },
              { id: 'rejected', label: '✕ Đã từ chối' },
            ].map(st => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={clsx(
                  'px-3 py-1.5 rounded-xl font-medium transition-colors text-xs whitespace-nowrap',
                  statusFilter === st.id
                    ? 'bg-gray-900 text-white font-bold'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên, MSSV, trường..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-green-dark placeholder-gray-400"
            />
          </div>
        </div>
      </div>

      {/* Verification Cards List */}
      {loading ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-gray-100 text-gray-400 text-xs flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> Đang tải danh sách hồ sơ...
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-gray-100 text-gray-400 text-xs">
          Không có hồ sơ xác minh nào phù hợp bộ lọc hiện tại.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map(req => {
            const targetId = req._id || req.id;
            const isStudent = req.verificationType === 'student' || !!req.studentCode;
            const isApproved = req.status === 'approved' || req.verified === true;
            const isPending = req.status === 'pending' || (!req.verified && req.status !== 'rejected');
            const isRejected = req.status === 'rejected';

            return (
              <div
                key={targetId}
                className={clsx(
                  'bg-white p-6 rounded-3xl border shadow-sm transition-all flex flex-col md:flex-row md:items-start justify-between gap-5',
                  isPending
                    ? 'border-amber-200/80 bg-gradient-to-r from-white via-white to-amber-50/20'
                    : 'border-gray-100'
                )}
              >
                {/* Left: Info */}
                <div className="space-y-2.5 text-xs flex-1">
                  {/* Badges row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={clsx(
                        'px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1',
                        isStudent ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                      )}
                    >
                      {isStudent ? (
                        <>
                          <GraduationCap className="w-3.5 h-3.5" /> Thẻ Sinh Viên
                        </>
                      ) : (
                        <>
                          <Building2 className="w-3.5 h-3.5" /> Đối Tác Cửa Hàng
                        </>
                      )}
                    </span>

                    <Badge variant={isApproved ? 'success' : isRejected ? 'danger' : 'warning'} size="sm">
                      {isApproved ? '✓ Đã kích hoạt' : isRejected ? '✕ Đã từ chối' : '⏳ Chờ Admin duyệt'}
                    </Badge>

                    {req.createdAt && (
                      <span className="text-[11px] text-gray-400">
                        {new Date(req.createdAt).toLocaleDateString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>

                  {/* Title & Core Subject */}
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      {isStudent
                        ? `${req.user?.name || 'Sinh viên'} — MSSV: ${req.studentCode || 'Chưa có'}`
                        : req.storeName || 'Cửa hàng tuyển dụng'}
                    </h3>
                    <p className="text-gray-500 mt-0.5">
                      {isStudent ? (
                        <span>
                          Trường: <strong className="text-gray-800">{req.university || 'Đại học FPT'}</strong> • Chuyên ngành: <strong className="text-gray-800">{req.major || 'Chưa cập nhật'}</strong>
                        </span>
                      ) : (
                        <span>
                          Người đại diện: <strong className="text-gray-800">{req.legalName || req.contactName || 'Chưa cập nhật'}</strong>
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-gray-600 bg-gray-50/70 p-3 rounded-2xl border border-gray-100">
                    <p>
                      📧 Email: <strong className="text-gray-900">{req.user?.email || 'Chưa có'}</strong>
                    </p>
                    <p>
                      📞 SĐT: <strong className="text-gray-900">{req.contactPhone || req.user?.phone || 'Chưa có'}</strong>
                    </p>
                    {isStudent ? (
                      <p>
                        🛵 Phương tiện:{' '}
                        <strong className="text-gray-900">
                          {req.transport === 'xe_may'
                            ? 'Xe máy'
                            : req.transport === 'di_bo'
                            ? 'Đi bộ'
                            : req.transport === 'xe_buyt'
                            ? 'Xe buýt'
                            : req.transport === 'xe_dap'
                            ? 'Xe đạp'
                            : req.transport === 'xe_dap_dien'
                            ? 'Xe đạp điện'
                            : req.transport === 'o_to'
                            ? 'Ô tô'
                            : req.transport || 'Xe máy'}
                        </strong>
                      </p>
                    ) : (
                      <>
                        <p>
                          📍 Địa chỉ:{' '}
                          <strong className="text-gray-900">{req.businessAddress || req.address || 'Hòa Lạc'}</strong>
                        </p>
                        {(req.taxCode || req.idCardNumber) && (
                          <p>
                            Mã số thuế / CCCD: <strong className="text-gray-900">{req.taxCode || req.idCardNumber}</strong>
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Rejection Note */}
                  {req.rejectionReason && (
                    <div className="text-red-700 bg-red-50 p-2.5 rounded-2xl border border-red-100 text-xs">
                      <strong>Lý do từ chối trước đó:</strong> {req.rejectionReason}
                    </div>
                  )}
                </div>

                {/* Right: Photo Preview & Action Buttons */}
                <div className="flex flex-col sm:items-end justify-between gap-3 shrink-0">
                  {/* Photo thumbnail */}
                  {isStudent && req.studentCardPhoto && (
                    <div
                      onClick={() => setPreviewImage({ url: req.studentCardPhoto, title: `Thẻ SV: ${req.user?.name || req.studentCode}` })}
                      className="cursor-pointer group relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 w-32 h-20 shadow-sm"
                    >
                      <img
                        src={req.studentCardPhoto}
                        alt="Ảnh thẻ SV"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-bold gap-1">
                        <Eye className="w-3.5 h-3.5" /> Xem to
                      </div>
                    </div>
                  )}

                  {!isStudent && req.documents?.[0]?.url && (
                    <div
                      onClick={() => setPreviewImage({ url: req.documents[0].url, title: `Cơ sở: ${req.storeName}` })}
                      className="cursor-pointer group relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 w-32 h-20 shadow-sm"
                    >
                      <img
                        src={req.documents[0].url}
                        alt="Ảnh cửa hàng"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-bold gap-1">
                        <Eye className="w-3.5 h-3.5" /> Xem to
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {isPending && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleReview(targetId, 'rejected', isStudent ? 'student' : 'employer')}
                        className="px-3.5 py-2 rounded-xl bg-red-50 text-red-600 font-bold text-xs hover:bg-red-100 transition-colors"
                      >
                        Từ chối
                      </button>
                      <button
                        onClick={() => handleReview(targetId, 'approved', isStudent ? 'student' : 'employer')}
                        className={clsx(
                          'px-4 py-2 rounded-xl text-white font-bold text-xs shadow-sm transition-colors',
                          isStudent
                            ? 'bg-emerald-600 hover:bg-emerald-700'
                            : 'bg-purple-700 hover:bg-purple-800'
                        )}
                      >
                        {isStudent ? '✓ Duyệt thẻ & Kích hoạt' : '✓ Phê duyệt đối tác'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full p-4 overflow-hidden shadow-2xl relative animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
              <h3 className="font-bold text-sm text-gray-900 truncate pr-4">{previewImage.title}</h3>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 max-h-[75vh] flex items-center justify-center">
              <img
                src={previewImage.url}
                alt="Ảnh xác minh"
                className="max-h-[70vh] w-auto object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

