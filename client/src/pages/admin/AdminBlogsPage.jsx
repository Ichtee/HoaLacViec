import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Plus,
  Search,
  Eye,
  Edit3,
  Trash2,
  Star,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { clsx } from 'clsx';
import { getBlogs, createBlog, updateBlog, deleteBlog } from '@/services';
import { Modal } from '@/components/Modal.jsx';
import { Input, Textarea, Select } from '@/components/Form.jsx';
import { Button } from '@/components/Button.jsx';
import { Toast } from '@/components/Feedback.jsx';

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

const SAMPLE_COVERS = [
  { label: 'Cảnh báo an toàn', url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&auto=format&fit=crop&q=60' },
  { label: 'Sinh viên học tập', url: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&auto=format&fit=crop&q=60' },
  { label: 'Cà phê & Việc làm', url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&auto=format&fit=crop&q=60' },
  { label: 'Phỏng vấn & Kỹ năng', url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&auto=format&fit=crop&q=60' },
];

const INITIAL_FORM_DATA = {
  title: '',
  slug: '',
  summary: '',
  content: '',
  category: 'kinh_nghiem',
  coverImage: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&auto=format&fit=crop&q=60',
  tags: 'hoa_lac, sinh_vien',
  authorName: 'Ban Biên Tập Hoa Lạc Việc',
  featured: false,
};

export default function AdminBlogsPage() {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBlog, setEditingBlog] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

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

  function handleOpenCreate() {
    setEditingBlog(null);
    setFormData(INITIAL_FORM_DATA);
    setFormError('');
    setIsModalOpen(true);
  }

  function handleOpenEdit(blog) {
    setEditingBlog(blog);
    setFormData({
      title: blog.title || '',
      slug: blog.slug || '',
      summary: blog.summary || '',
      content: blog.content || '',
      category: blog.category || 'kinh_nghiem',
      coverImage: blog.coverImage || '',
      tags: Array.isArray(blog.tags) ? blog.tags.join(', ') : (blog.tags || ''),
      authorName: blog.author?.name || 'Ban Biên Tập Hoa Lạc Việc',
      featured: Boolean(blog.featured),
    });
    setFormError('');
    setIsModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError('Vui lòng nhập tiêu đề bài viết.');
      return;
    }
    if (!formData.summary.trim()) {
      setFormError('Vui lòng nhập tóm tắt ngắn.');
      return;
    }
    if (!formData.content.trim()) {
      setFormError('Vui lòng nhập nội dung bài viết.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');

      const payload = {
        title: formData.title.trim(),
        slug: formData.slug.trim() || undefined,
        summary: formData.summary.trim(),
        content: formData.content.trim(),
        category: formData.category,
        coverImage: formData.coverImage.trim(),
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        featured: formData.featured,
        author: {
          name: formData.authorName.trim(),
        },
      };

      if (editingBlog) {
        const updated = await updateBlog(editingBlog._id || editingBlog.id, payload);
        setBlogs(prev => prev.map(b => (b._id === updated._id ? updated : b)));
        setToast({ type: 'success', message: 'Cập nhật bài viết thành công!' });
      } else {
        const created = await createBlog(payload);
        setBlogs(prev => [created, ...prev]);
        setToast({ type: 'success', message: 'Đăng bài viết mới thành công!' });
      }

      setIsModalOpen(false);
    } catch (err) {
      setFormError(err.message || 'Lỗi khi lưu bài viết.');
    } finally {
      setSubmitting(false);
    }
  }

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
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-800">
              {blogs.length} bài viết hiện có
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-green-dark" /> Quản lý Blog Cẩm nang & Cảnh giác
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Đăng tải cẩm nang việc làm, cảnh báo lừa đảo và tin tức chia sẻ kinh nghiệm cho sinh viên Hòa Lạc.
          </p>
        </div>

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
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-3">
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
                  'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5',
                  isSelected
                    ? 'bg-green-dark text-white shadow-sm'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                )}
              >
                <span>{cat.label}</span>
                <span className={clsx('text-[10px] px-1.5 py-0.2 rounded-full', isSelected ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700')}>
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
            type="text"
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
          {filteredBlogs.map((blog) => {
            const catInfo = CATEGORY_MAP[blog.category] || { label: 'Bài viết', color: 'bg-gray-50 text-gray-700 border-gray-200' };
            const blogSlug = blog.slug || blog._id;

            return (
              <div
                key={blog._id || blog.slug}
                className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow flex flex-col justify-between gap-3 group relative overflow-hidden"
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
                      <span className={clsx('px-2.5 py-0.5 rounded-full text-[10px] font-bold border backdrop-blur-md shadow-xs', catInfo.color)}>
                        {catInfo.label}
                      </span>
                      {blog.featured && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white flex items-center gap-0.5 shadow-xs">
                          <Star className="w-3 h-3 fill-white" /> Nổi bật
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-lg bg-black/60 text-white text-[10px] font-medium flex items-center gap-1">
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
                    <span className="text-[11px]">{new Date(blog.createdAt || Date.now()).toLocaleDateString('vi-VN')}</span>
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
        </div>
      )}

      {/* Create / Edit Modal Form */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingBlog ? 'Chỉnh sửa bài viết blog' : 'Đăng bài viết mới cho Blog'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <Input
            id="blog-title"
            label="Tiêu đề bài viết"
            required
            placeholder="Ví dụ: Cảnh báo chiêu trò lừa cọc việc làm tại khu công nghệ cao"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              id="blog-category"
              label="Danh mục cẩm nang"
              required
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              options={[
                { value: 'canh_bao', label: '🚨 Cảnh báo lừa đảo' },
                { value: 'cam_nang', label: '📘 Cẩm nang sinh viên' },
                { value: 'kinh_nghiem', label: '💼 Kinh nghiệm đi làm' },
                { value: 'phong_van', label: '🎯 Kỹ năng phỏng vấn' },
                { value: 'doi_song', label: '🏡 Đời sống Hòa Lạc' },
              ]}
            />

            <Input
              id="blog-author"
              label="Tác giả / Ban biên tập"
              placeholder="Ban Biên Tập Hoa Lạc Việc"
              value={formData.authorName}
              onChange={(e) => setFormData({ ...formData, authorName: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Input
              id="blog-cover"
              label="Đường dẫn ảnh bìa (Cover Image URL)"
              placeholder="https://images.unsplash.com/..."
              value={formData.coverImage}
              onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
            />

            {/* Quick cover suggestions */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-gray-500">Gợi ý ảnh mẫu:</span>
              {SAMPLE_COVERS.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setFormData({ ...formData, coverImage: sample.url })}
                  className="text-[10px] px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-600 transition-colors"
                >
                  {sample.label}
                </button>
              ))}
            </div>

            {formData.coverImage && (
              <div className="mt-2 rounded-2xl overflow-hidden border border-gray-200 aspect-[21/9] max-h-36 bg-gray-50">
                <img
                  src={formData.coverImage}
                  alt="Ảnh xem trước"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="blog-tags"
              label="Thẻ tag (cách nhau bởi dấu phẩy)"
              placeholder="canh_bao, sinh_vien, lua_dao"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            />

            <Input
              id="blog-slug"
              label="Đường dẫn tĩnh / Slug (tùy chọn)"
              placeholder="canh-bao-lua-dao-hoa-lac"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              hint="Để trống hệ thống sẽ tự động tạo từ tiêu đề"
            />
          </div>

          <div className="flex items-center gap-2 p-3 bg-amber-50/60 rounded-2xl border border-amber-100">
            <input
              type="checkbox"
              id="blog-featured"
              checked={formData.featured}
              onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
              className="w-4 h-4 text-green-dark rounded border-gray-300 focus:ring-green-main cursor-pointer"
            />
            <label htmlFor="blog-featured" className="text-xs font-semibold text-gray-800 cursor-pointer">
              ⭐ Ghim bài viết này lên vị trí nổi bật nhất (Featured)
            </label>
          </div>

          <Textarea
            id="blog-summary"
            label="Tóm tắt ngắn gọn"
            required
            rows={3}
            placeholder="Tóm tắt 1-2 câu ngắn để thu hút người đọc trên danh sách bài viết..."
            value={formData.summary}
            onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
          />

          <Textarea
            id="blog-content"
            label="Nội dung bài viết đầy đủ"
            required
            rows={10}
            placeholder="Nhập nội dung bài viết chi tiết..."
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          />

          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={submitting}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              className="shadow-sm"
            >
              {editingBlog ? 'Lưu thay đổi' : 'Đăng bài viết ngay'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
