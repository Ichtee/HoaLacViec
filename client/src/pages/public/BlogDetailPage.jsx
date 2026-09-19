import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Eye, User, Share2, Tag, BookOpen, Clock, ChevronRight
} from 'lucide-react';
import { getBlog } from '@/services';
import { Badge } from '@/components/Badge.jsx';

export default function BlogDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [blog, setBlog] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await getBlog(id);
        if (res && res.blog) {
          setBlog(res.blog);
          setRelated(res.related || []);
        } else if (res) {
          setBlog(res);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
    window.scrollTo(0, 0);
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center text-text-muted">
        Đang tải nội dung bài viết...
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center space-y-4">
        <h2 className="text-2xl font-bold">Không tìm thấy bài viết</h2>
        <Link to="/blogs" className="btn btn-primary inline-flex">Quay lại danh sách bài viết</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-fade-in">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-xs font-semibold text-text-muted hover:text-green-dark transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
      </button>

      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="green" size="sm">
            {blog.category === 'canh_bao' ? 'Cảnh báo lừa đảo' : 'Cẩm nang việc làm'}
          </Badge>
          <span className="text-xs text-text-muted">•</span>
          <span className="text-xs text-text-muted flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> 5 phút đọc
          </span>
          <span className="text-xs text-text-muted">•</span>
          <span className="text-xs text-text-muted flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" /> {blog.views || 350} lượt xem
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-text-main leading-tight">
          {blog.title}
        </h1>

        {/* Author info */}
        <div className="flex items-center justify-between pt-2 border-t border-green-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-green-light flex items-center justify-center text-green-dark font-bold text-sm">
              {blog.author?.name?.[0] || 'A'}
            </div>
            <div>
              <p className="text-sm font-bold text-text-main">{blog.author?.name || 'Ban Biên Tập'}</p>
              <p className="text-xs text-text-muted">{blog.author?.role || 'Admin'} • {new Date(blog.createdAt || Date.now()).toLocaleDateString('vi-VN')}</p>
            </div>
          </div>

          <button
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
                alert('Đã copy link bài viết vào clipboard!');
              }
            }}
            className="p-2.5 rounded-xl border border-green-100 hover:bg-green-50 text-text-muted hover:text-green-dark transition-colors"
            title="Chia sẻ bài viết"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cover Image */}
      {blog.coverImage && (
        <div className="rounded-3xl overflow-hidden max-h-[420px] shadow-card">
          <img
            src={blog.coverImage}
            alt={blog.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Summary highlight box */}
      <div className="p-6 bg-green-50 rounded-3xl border border-green-100 text-green-dark font-medium text-sm sm:text-base leading-relaxed italic">
        "{blog.summary}"
      </div>

      {/* Main Content */}
      <div className="prose max-w-none text-text-main leading-relaxed text-sm sm:text-base space-y-4 whitespace-pre-line">
        {blog.content}
      </div>

      {/* Tags */}
      {blog.tags && blog.tags.length > 0 && (
        <div className="pt-6 border-t border-green-50 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-text-muted flex items-center gap-1">
            <Tag className="w-3.5 h-3.5" /> Từ khóa:
          </span>
          {blog.tags.map((t, idx) => (
            <span key={idx} className="px-3 py-1 bg-gray-100 text-text-muted rounded-full text-xs font-medium">
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Related blogs */}
      {related && related.length > 0 && (
        <div className="pt-10 border-t border-green-100 space-y-4">
          <h3 className="text-lg font-bold text-text-main">Bài viết liên quan</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {related.map(r => (
              <Link
                key={r._id || r.slug}
                to={`/blogs/${r.slug || r._id}`}
                className="bg-white p-4 rounded-2xl border border-green-50 hover:border-green-300 shadow-sm hover:shadow-card transition-all space-y-2"
              >
                <h4 className="font-bold text-xs text-text-main hover:text-green-main line-clamp-2">
                  {r.title}
                </h4>
                <p className="text-[11px] text-text-muted line-clamp-2">{r.summary}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

