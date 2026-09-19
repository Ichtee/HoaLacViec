import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, Calendar, User, Eye, ArrowRight, Search, ShieldAlert,
  Sparkles, Tag, Clock, ChevronRight
} from 'lucide-react';
import { getBlogs } from '@/services';
import { Badge } from '@/components/Badge.jsx';

const CATEGORIES = [
  { id: 'all', label: 'Tất cả bài viết' },
  { id: 'kinh_nghiem', label: 'Kinh nghiệm làm thêm' },
  { id: 'canh_bao', label: 'Cảnh báo lừa đảo' },
  { id: 'cam_nang', label: 'Cẩm nang Hòa Lạc' },
];

export default function BlogListPage() {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await getBlogs({ category, search });
        setBlogs(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [category, search]);

  const featured = blogs.find(b => b.featured) || blogs[0];
  const regular = blogs.filter(b => b !== featured);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-green-dark via-green-800 to-emerald-900 rounded-3xl p-8 sm:p-12 text-white shadow-soft relative overflow-hidden">
        <div className="max-w-2xl relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold text-green-100">
            <BookOpen className="w-4 h-4 text-green-300" />
            Góc chia sẻ & Cẩm nang việc làm sinh viên
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
            Kinh nghiệm làm thêm & Sống tại Hòa Lạc 📖
          </h1>
          <p className="text-green-100 text-sm sm:text-base leading-relaxed">
            Tổng hợp mẹo phỏng vấn, cẩm nang cân bằng lịch học và các bài viết cảnh báo bẫy lừa đảo thực tế dành riêng cho sinh viên FPT, ĐHQGHN và BKHN.
          </p>

          {/* Search bar */}
          <div className="pt-2 max-w-md">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm bài viết, chủ đề, kinh nghiệm..."
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 shadow-md placeholder-gray-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Categories filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-green-50">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              category === cat.id
                ? 'bg-green-main text-white shadow-sm'
                : 'bg-white text-text-muted hover:bg-green-50 hover:text-green-dark border border-green-100'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Featured post */}
      {featured && !search && category === 'all' && (
        <div className="bg-white rounded-3xl border border-green-100 overflow-hidden shadow-card hover:shadow-modal transition-all grid grid-cols-1 lg:grid-cols-2">
          <div className="h-64 sm:h-80 lg:h-full relative overflow-hidden">
            <img
              src={featured.coverImage || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&auto=format&fit=crop&q=60'}
              alt={featured.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute top-4 left-4">
              <span className="px-3 py-1 rounded-full bg-pink-main text-white text-xs font-bold shadow-md">
                ⭐ Bài viết nổi bật
              </span>
            </div>
          </div>
          <div className="p-6 sm:p-8 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs text-text-muted">
                <span className="font-semibold text-green-dark bg-green-50 px-2.5 py-1 rounded-lg">
                  {featured.category === 'canh_bao' ? 'Cảnh báo lừa đảo' : 'Cẩm nang việc làm'}
                </span>
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> 5 phút đọc</span>
                <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {featured.views || 300} lượt xem</span>
              </div>
              <Link to={`/blogs/${featured.slug || featured._id}`}>
                <h2 className="text-xl sm:text-2xl font-bold text-text-main hover:text-green-main transition-colors leading-snug">
                  {featured.title}
                </h2>
              </Link>
              <p className="text-text-muted text-sm line-clamp-3 leading-relaxed">
                {featured.summary}
              </p>
            </div>

            <div className="pt-4 border-t border-green-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-dark font-bold text-xs">
                  {featured.author?.name?.[0] || 'A'}
                </div>
                <div>
                  <p className="text-xs font-semibold text-text-main">{featured.author?.name || 'Ban Biên Tập'}</p>
                  <p className="text-[10px] text-text-muted">{featured.author?.role || 'Admin'}</p>
                </div>
              </div>
              <Link
                to={`/blogs/${featured.slug || featured._id}`}
                className="inline-flex items-center gap-1 text-xs font-bold text-green-main hover:text-green-dark"
              >
                Đọc bài viết <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Post Grid */}
      {loading ? (
        <div className="text-center py-16 text-text-muted">Đang tải danh sách bài viết...</div>
      ) : blogs.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-green-50 shadow-card space-y-3">
          <BookOpen className="w-12 h-12 text-text-muted mx-auto opacity-50" />
          <h3 className="text-base font-bold text-text-main">Không tìm thấy bài viết nào</h3>
          <p className="text-xs text-text-muted">Hãy thử tìm kiếm với từ khóa khác hoặc chuyển danh mục.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(search || category !== 'all' ? blogs : regular).map((blog) => (
            <article
              key={blog._id || blog.slug}
              className="bg-white rounded-3xl border border-green-50 hover:border-green-300 shadow-card hover:shadow-modal transition-all overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="h-48 relative overflow-hidden bg-green-50">
                  <img
                    src={blog.coverImage || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&auto=format&fit=crop&q=60'}
                    alt={blog.title}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-0.5 rounded-full bg-white/90 backdrop-blur-md text-[11px] font-bold text-green-dark shadow-sm">
                      {blog.category === 'canh_bao' ? 'Cảnh báo' : 'Kinh nghiệm'}
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-2.5">
                  <div className="flex items-center gap-2 text-[11px] text-text-muted">
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {blog.views || 120}</span>
                    <span>•</span>
                    <span>{new Date(blog.createdAt || Date.now()).toLocaleDateString('vi-VN')}</span>
                  </div>

                  <Link to={`/blogs/${blog.slug || blog._id}`}>
                    <h3 className="font-bold text-base text-text-main hover:text-green-main transition-colors line-clamp-2 leading-snug">
                      {blog.title}
                    </h3>
                  </Link>

                  <p className="text-text-muted text-xs line-clamp-2 leading-relaxed">
                    {blog.summary}
                  </p>
                </div>
              </div>

              <div className="px-5 pb-5 pt-3 border-t border-green-50 flex items-center justify-between">
                <span className="text-[11px] font-medium text-text-muted">
                  Bởi {blog.author?.name || 'Ban biên tập'}
                </span>
                <Link
                  to={`/blogs/${blog.slug || blog._id}`}
                  className="text-xs font-bold text-green-main hover:text-green-dark flex items-center gap-1"
                >
                  Xem thêm <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

