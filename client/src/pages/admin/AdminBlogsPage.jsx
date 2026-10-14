import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  BookOpen,
  Plus,
  Search,
  Eye,
  Edit3,
  Trash2,
  Star,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { clsx } from 'clsx';
import { getBlogs, deleteBlog } from '@/services';
import { Button } from '@/components/Button.jsx';
import { Toast } from '@/components/Feedback.jsx';
import { PageHeader } from '@/components/PageHeader.jsx';
import { Pagination, usePagination } from '@/components/Pagination.jsx';

const BLOG_CATEGORIES = [
  { value: 'all', label: 'Tất cả bài viết' },
  { value: 'canh_bao', label: 'Cảnh báo lừa đảo' },
  { value: 'cam_nang', label: 'Cẩm nang việc làm' },
  { value: 'kinh_nghiem', label: 'Kinh nghiệm đi làm' },
  { value: 'phong_van', label: 'Kỹ năng phỏng vấn' },
  { value: 'doi_song', label: 'Đời sống Hòa Lạc' },
];

const CATEGORY_MAP = {
  canh_bao: { label: 'Cảnh báo', color: 'bg-red-50 text-red-700 border-red-200' },
  cam_nang: { label: 'Cẩm nang', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  kinh_nghiem: { label: 'Kinh nghiệm', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  phong_van: { label: 'Phỏng vấn', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  doi_song: { label: 'Đời sống', color: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export default function AdminBlogsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(location.state?.notice ? { type: 'success', message: location.state.notice } : null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    loadBlogs();
  }, []);

  async function loadBlogs() {
    try {
      setLoading(true);
      const data = await getBlogs({ limit: 100 });
      setBlogs(Array.isArray(data) ? data : []);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi tải danh sách bài viết.' });
    } finally {
      setLoading(false);
    }
  }

  const handleOpenCreate = () => navigate('/admin/blogs/new');
  const handleOpenEdit = (blog) => navigate(`/admin/blogs/${blog._id || blog.id}/edit`, { state: { blog } });

  async function handleDelete(blog) {
    const ok = window.confirm(`Bạn có chắc chắn muốn xóa bài viết "${blog.title}"? Thao tác này không thể hoàn tác.`);
    if (!ok) return;

    try {
      await deleteBlog(blog._id || blog.id);
      setBlogs(prev => prev.filter(b => b._id !== blog._id && b.id !== blog.id));
      setToast({ type: 'info', message: 'Đã xóa bài viết khỏi hệ thống.' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Lỗi khi xóa bài viết.' });
    }
  }

  const filteredBlogs = useMemo(() => {
    return blogs.filter(b => {
      if (categoryFilter !== 'all' && b.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const titleMatch = (b.title || '').toLowerCase().includes(q);
        const summaryMatch = (b.summary || '').toLowerCase().includes(q);
        const tagMatch = Array.isArray(b.tags) && b.tags.some(t => t.toLowerCase().includes(q));
        if (!titleMatch && !summaryMatch && !tagMatch) return false;
      }
      return true;
    });
  }, [blogs, categoryFilter, search]);

  const pager = usePagination(filteredBlogs, 10);

  const countByCategory = useMemo(() => {
    const counts = { all: blogs.length };
    blogs.forEach(b => {
      counts[b.category] = (counts[b.category] || 0) + 1;
    });
    return counts;
  }, [blogs]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-12">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Top Header */}
      <PageHeader
        icon={BookOpen}
        title="Quản lý Blog Cẩm nang & Cảnh giác"
        description="Đăng tải cẩm nang việc làm, cảnh báo lừa đảo và tin tức chia sẻ kinh nghiệm cho sinh viên Hòa Lạc."
        badge={<span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800"> {blogs.length} bài viết hiện có </span>}
        actions={
          <>
            <div className="flex items-center gap-3">
              <button
                onClick={loadBlogs}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} /> Làm mới
              </button>
              <Button
                type="button"
                variant="primary"
                onClick={handleOpenCreate}
                className="flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Viết bài mới
              </Button>
            </div>
          </>
        }
      />

      {/* Filter Tabs & Search Controls */}
      <div className="bg-white p-4 rounded-3xl ring-1 ring-green-100/70 shadow-card space-y-3">
        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-3">
          {BLOG_CATEGORIES.map(cat => {
            const isSelected = categoryFilter === cat.value;
            const count = countByCategory[cat.value] || 0;
            return (
              <button
                key={cat.value}
                onClick={() => setCategoryFilter(cat.value)}
                className={clsx(
                  'px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5',
                  isSelected
                    ? 'bg-green-dark text-white shadow-sm'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                )}
              >
                <span>{cat.label}</span>
                <span className={clsx('text-xs px-1.5 py-0.2 rounded-full', isSelected ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700')}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            aria-label="Tìm bài viết"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tiêu đề, nội dung tóm tắt hoặc thẻ tag..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-green-main focus:border-transparent bg-gray-50/50"
          />
        </div>
      </div>

      {/* Blog Cards / List */}
      {loading ? (
        <div className="p-12 text-center text-gray-500 text-xs bg-white rounded-3xl border border-gray-100">
          ⏳ Đang tải danh sách bài viết...
        </div>
      ) : filteredBlogs.length === 0 ? (
        <div className="p-12 text-center text-gray-500 text-xs bg-white rounded-3xl border border-gray-100 space-y-2">
          <BookOpen className="w-8 h-8 text-gray-300 mx-auto" />
          <p>Không tìm thấy bài viết nào phù hợp.</p>
          <Button variant="ghost" size="sm" onClick={handleOpenCreate} className="text-green-dark">
            + Đăng bài viết đầu tiên ngay
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pager.pageItems.map((blog) => {
            const catInfo = CATEGORY_MAP[blog.category] || { label: 'Bài viết', color: 'bg-gray-50 text-gray-700 border-gray-200' };
            const blogSlug = blog.slug || blog._id;

            return (
              <div
                key={blog._id || blog.slug}
                className="bg-white rounded-3xl ring-1 ring-green-100/70 shadow-card p-4 hover:shadow-md transition-shadow flex flex-col justify-between gap-3 group relative overflow-hidden"
              >
                <div>
                  {/* Thumbnail & Badges */}
                  <div className="relative rounded-2xl overflow-hidden aspect-[16/9] mb-3 bg-gray-100">
                    <img
                      src={blog.coverImage || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&auto=format&fit=crop&q=60'}
                      alt={blog.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span className={clsx('px-2.5 py-0.5 rounded-full text-xs font-bold border backdrop-blur-md shadow-xs', catInfo.color)}>
                        {catInfo.label}
                      </span>
                      {blog.featured && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white flex items-center gap-0.5 shadow-xs">
                          <Star className="w-3 h-3 fill-white" /> Nổi bật
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-lg bg-black/60 text-white text-xs font-medium flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {blog.views || 0}
                    </div>
                  </div>

                  {/* Title & Summary */}
                  <h3 className="font-bold text-sm text-gray-900 group-hover:text-green-dark transition-colors line-clamp-2">
                    {blog.title}
                  </h3>
                  <p className="text-xs text-gray-500 line-clamp-2 mt-1 leading-relaxed">
                    {blog.summary}
                  </p>
                </div>

                {/* Metadata & Actions */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="font-semibold text-gray-700 truncate">{blog.author?.name || 'Admin'}</span>
                    <span>•</span>
                    <span className="text-xs">{new Date(blog.createdAt || Date.now()).toLocaleDateString('vi-VN')}</span>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Link
                      to={`/blogs/${blogSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Xem bài đăng công khai"
                      className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(blog)}
                      title="Chỉnh sửa bài viết"
                      className="p-1.5 rounded-xl hover:bg-blue-50 text-blue-600 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(blog)}
                      title="Xóa bài viết"
                      className="p-1.5 rounded-xl hover:bg-red-50 text-red-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <Pagination page={pager.page} totalPages={pager.totalPages} total={pager.total} pageSize={pager.pageSize} onPageChange={pager.setPage} className="md:col-span-2 rounded-2xl bg-white border border-green-100" />
        </div>
      )}
    </div>
  );
}
