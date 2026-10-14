import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, BookOpen, FileText, Loader2, AlertTriangle, Save } from 'lucide-react';
import { getBlog, createBlog, updateBlog, uploadImage } from '@/services';
import { parseDocx } from '@/utils/docxImport.js';
import { Input, Textarea, Select } from '@/components/Form.jsx';
import { Button } from '@/components/Button.jsx';
import { Toast } from '@/components/Feedback.jsx';
import { PageHeader } from '@/components/PageHeader.jsx';
import { ImageUploadField } from '@/components/ImageUploadField.jsx';

const CATEGORY_OPTIONS = [
  { value: 'canh_bao', label: 'Cảnh báo lừa đảo' },
  { value: 'cam_nang', label: 'Cẩm nang sinh viên' },
  { value: 'kinh_nghiem', label: 'Kinh nghiệm đi làm' },
  { value: 'phong_van', label: 'Kỹ năng phỏng vấn' },
  { value: 'doi_song', label: 'Đời sống Hòa Lạc' },
];

const EMPTY_FORM = {
  title: '',
  slug: '',
  summary: '',
  content: '',
  category: 'kinh_nghiem',
  coverImage: '',
  tags: 'hoa_lac, sinh_vien',
  authorName: 'Ban Biên Tập Hoa Lạc Việc',
  featured: false,
};

function toForm(blog) {
  return {
    title: blog.title || '',
    slug: blog.slug || '',
    summary: blog.summary || '',
    content: blog.content || '',
    category: blog.category || 'kinh_nghiem',
    coverImage: blog.coverImage || '',
    tags: Array.isArray(blog.tags) ? blog.tags.join(', ') : (blog.tags || ''),
    authorName: blog.author?.name || EMPTY_FORM.authorName,
    featured: Boolean(blog.featured),
  };
}

export default function AdminBlogFormPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState(null);
  const summaryRef = useRef(null);

  // Mở từ danh sách thì đã có sẵn bài (không gọi API, tránh tăng lượt xem); tải lại trang thì mới gọi
  useEffect(() => {
    if (!isEditing) return;
    const fromList = location.state?.blog;
    if (fromList) {
      setFormData(toForm(fromList));
      setLoading(false);
      return;
    }
    getBlog(id)
      .then(res => setFormData(toForm(res.blog || res)))
      .catch(err => setFormError(err.message || 'Không tải được bài viết.'))
      .finally(() => setLoading(false));
  }, [id, isEditing]);

  // Lỗi sau khi bấm lưu: đưa focus tới khung tóm tắt lỗi để bàn phím / trình đọc màn hình thấy ngay
  useEffect(() => {
    if (Object.keys(errors).length) summaryRef.current?.focus();
  }, [errors]);

  const set = (field) => (e) => setFormData(prev => ({ ...prev, [field]: e.target.value }));

  async function handleDocx(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFormError('');
    setImporting(true);
    try {
      const { title, summary, html } = await parseDocx(file, (dataUrl) => uploadImage(dataUrl, 'blogs'));
      setFormData(prev => ({ ...prev, title, summary, content: html }));
      setErrors({});
      setToast({ type: 'success', message: 'Đã lấy tiêu đề và nội dung từ file Word.' });
    } catch (err) {
      setFormError(err.message || 'Không đọc được file Word.');
    } finally {
      setImporting(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const found = {};
    if (!formData.title.trim()) found['blog-title'] = 'Vui lòng nhập tiêu đề bài viết.';
    if (!formData.summary.trim()) found['blog-summary'] = 'Vui lòng nhập tóm tắt ngắn.';
    if (!formData.content.trim()) found['blog-content'] = 'Vui lòng nhập nội dung bài viết.';
    setErrors(found);
    if (Object.keys(found).length) return;

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
        author: { name: formData.authorName.trim() },
      };
      if (isEditing) await updateBlog(id, payload);
      else await createBlog(payload);
      navigate('/admin/blogs', { state: { notice: isEditing ? 'Cập nhật bài viết thành công!' : 'Đăng bài viết mới thành công!' } });
    } catch (err) {
      setFormError(err.message || 'Lỗi khi lưu bài viết.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="p-12 text-center text-gray-500 text-xs">Đang tải bài viết...</div>;
  }

  const errorEntries = Object.entries(errors);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 animate-fade-in">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <Link to="/admin/blogs" className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-green-dark transition-colors">
        <ArrowLeft className="w-4 h-4" /> Quay lại danh sách bài viết
      </Link>

      <PageHeader
        icon={BookOpen}
        title={isEditing ? 'Chỉnh sửa bài viết blog' : 'Đăng bài viết mới cho Blog'}
        description="Tải file Word để tự điền tiêu đề và nội dung, hoặc nhập thủ công."
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => navigate('/admin/blogs')} disabled={submitting}>Hủy</Button>
            <Button type="submit" form="blog-form" variant="primary" loading={submitting} className="flex items-center gap-1.5 shadow-sm">
              <Save className="w-4 h-4" /> {isEditing ? 'Lưu thay đổi' : 'Đăng bài viết ngay'}
            </Button>
          </>
        }
      />

      <form id="blog-form" onSubmit={handleSubmit} noValidate className="space-y-5">
        {(formError || errorEntries.length > 0) && (
          <div ref={summaryRef} tabIndex={-1} role="alert" className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 space-y-1.5 focus:outline-none focus:ring-2 focus:ring-red-300">
            <p className="flex items-center gap-2 font-bold"><AlertTriangle className="w-4 h-4 shrink-0" /> {formError || 'Cần bổ sung trước khi đăng:'}</p>
            {errorEntries.length > 0 && (
              <ul className="list-disc pl-10">
                {errorEntries.map(([field, msg]) => (
                  <li key={field}><a href={`#${field}`} className="underline font-semibold">{msg}</a></li>
                ))}
              </ul>
            )}
          </div>
        )}

        <label className="flex items-center gap-3 p-4 rounded-3xl border-2 border-dashed border-green-200 bg-green-50/40 text-xs font-semibold text-gray-700 cursor-pointer hover:border-green-main focus-within:ring-2 focus-within:ring-green-main">
          {importing ? <Loader2 className="w-5 h-5 text-green-dark shrink-0 animate-spin" /> : <FileText className="w-5 h-5 text-green-dark shrink-0" />}
          <span>
            {importing ? 'Đang đọc file Word...' : 'Tải file Word (.docx) để tự điền tiêu đề và nội dung'}
            <span className="block font-normal text-gray-500 mt-0.5">Giữ nguyên định dạng, ảnh nằm đúng vị trí. Chỉ hỗ trợ .docx, tối đa 10MB.</span>
          </span>
          <input
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleDocx}
            disabled={importing}
            className="sr-only"
          />
        </label>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* Cột nội dung chính */}
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl ring-1 ring-green-100/70 shadow-card space-y-4">
            <Input
              id="blog-title"
              label="Tiêu đề bài viết"
              required
              placeholder="Ví dụ: Cảnh báo chiêu trò lừa cọc việc làm tại khu công nghệ cao"
              value={formData.title}
              onChange={set('title')}
              error={errors['blog-title']}
            />
            <Textarea
              id="blog-summary"
              label="Tóm tắt ngắn gọn"
              required
              rows={3}
              placeholder="Tóm tắt 1-2 câu ngắn để thu hút người đọc trên danh sách bài viết..."
              value={formData.summary}
              onChange={set('summary')}
              error={errors['blog-summary']}
            />
            <Textarea
              id="blog-content"
              label="Nội dung bài viết (HTML, tự sinh khi tải file Word)"
              required
              rows={18}
              placeholder="Nhập nội dung bài viết chi tiết..."
              value={formData.content}
              onChange={set('content')}
              error={errors['blog-content']}
              className="font-mono text-xs"
            />
          </div>

          {/* Cột thiết lập */}
          <div className="bg-white p-6 rounded-3xl ring-1 ring-green-100/70 shadow-card space-y-4 lg:sticky lg:top-24">
            <ImageUploadField
              label="Ảnh bìa bài viết"
              hint="Chọn tệp ảnh từ máy tính."
              folder="blogs"
              value={formData.coverImage}
              onChange={(url) => setFormData(prev => ({ ...prev, coverImage: url }))}
            />
            <Select id="blog-category" label="Danh mục cẩm nang" required value={formData.category} onChange={set('category')} options={CATEGORY_OPTIONS} />
            <Input id="blog-author" label="Tác giả / Ban biên tập" placeholder="Ban Biên Tập Hoa Lạc Việc" value={formData.authorName} onChange={set('authorName')} />
            <Input id="blog-tags" label="Thẻ tag (cách nhau bởi dấu phẩy)" placeholder="canh_bao, sinh_vien, lua_dao" value={formData.tags} onChange={set('tags')} />
            <Input id="blog-slug" label="Đường dẫn tĩnh / Slug (tùy chọn)" placeholder="canh-bao-lua-dao-hoa-lac" value={formData.slug} onChange={set('slug')} hint="Để trống hệ thống sẽ tự tạo từ tiêu đề" />
            <label htmlFor="blog-featured" className="flex items-center gap-2 p-3 bg-amber-50/60 rounded-2xl border border-amber-100 text-xs font-semibold text-gray-800 cursor-pointer">
              <input
                type="checkbox"
                id="blog-featured"
                checked={formData.featured}
                onChange={(e) => setFormData(prev => ({ ...prev, featured: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 cursor-pointer"
              />
              Ghim bài viết lên vị trí nổi bật nhất
            </label>
          </div>
        </div>
      </form>
    </div>
  );
}
