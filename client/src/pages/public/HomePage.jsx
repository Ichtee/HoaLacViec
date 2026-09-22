import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  Search, MapPin, Clock, Shield, Zap, ChevronRight, Star,
  Coffee, ShoppingBag, Dumbbell, BookOpen, Music, Leaf, ArrowRight
} from 'lucide-react';
import { JOB_TYPES, JOB_TYPE_LABELS } from '@/constants';
import { useAsync } from '@/hooks';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getJobs } from '@/services';
import { JobCard } from '@/components/JobCard.jsx';
import { LoadingPage } from '@/components/Feedback.jsx';
import { formatVND } from '@/utils';

const CATEGORIES = [
  { icon: Coffee, label: 'Café & Trà sữa', to: '/jobs?search=Cafe', color: 'bg-amber-100 text-amber-700' },
  { icon: ShoppingBag, label: 'Bách hóa & Bán lẻ', to: '/jobs?search=Bán hàng', color: 'bg-blue-100 text-blue-700' },
  { icon: Clock, label: 'Việc theo ca', to: '/jobs?type=shift', color: 'bg-emerald-100 text-emerald-700' },
  { icon: Dumbbell, label: 'Gym & Thể thao', to: '/jobs?search=Gym', color: 'bg-green-light text-green-dark' },
  { icon: Zap, label: 'Chợ việc vặt SV', to: '/tasks', color: 'bg-purple-100 text-purple-700' },
  { icon: BookOpen, label: 'Cẩm nang & Kinh nghiệm', to: '/blogs', color: 'bg-pink-light text-pink-700' },
];

const FEATURES = [
  {
    icon: Clock,
    title: 'Ghép lịch học thông minh',
    desc: 'Hệ thống so sánh lịch học và thời gian rảnh của bạn với lịch làm của việc — chỉ gợi ý những việc thực sự phù hợp.',
  },
  {
    icon: Zap,
    title: 'Ứng tuyển nhanh, không cần CV',
    desc: 'Hoàn thiện hồ sơ một lần, ứng tuyển ngay bằng vài cú nhấp. Nhà tuyển dụng thấy thông tin bạn chọn chia sẻ.',
  },
  {
    icon: Shield,
    title: 'Nhà tuyển dụng xác thực',
    desc: 'Chúng tôi kiểm tra cửa hàng trước khi đăng tin. Huy hiệu xác thực giúp bạn biết đâu là nơi đáng tin cậy.',
  },
];

const STEPS = [
  { num: '01', title: 'Tạo hồ sơ', desc: 'Điền thông tin, kỹ năng và lịch rảnh của bạn.' },
  { num: '02', title: 'Tìm việc', desc: 'Duyệt danh sách hoặc để hệ thống gợi ý việc phù hợp.' },
  { num: '03', title: 'Ứng tuyển', desc: 'Gửi đơn và nhận phản hồi từ nhà tuyển dụng.' },
];

export default function HomePage() {
  const { isAuthenticated, role } = useAuth();
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const { data: latestJobsData, loading } = useAsync(
    () => getJobs({ public: true, limit: 12, sort: 'newest' }),
    [],
    { initialData: [] }
  );

  const jobsList = Array.isArray(latestJobsData) ? latestJobsData : (latestJobsData?.jobs || []);
  const featured = jobsList.slice(0, 4);

  function handleSearch(e) {
    e.preventDefault();
    navigate(`/jobs?search=${encodeURIComponent(search)}`);
  }

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-green-light via-cream to-pink-light py-20 sm:py-32">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-green-200 opacity-20 translate-x-1/3 -translate-y-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-pink-200 opacity-20 -translate-x-1/3 translate-y-1/3 pointer-events-none" />

        {/* Leaf decorations */}
        <div className="absolute top-16 left-10 text-green-300 opacity-40 pointer-events-none">
          <Leaf className="w-8 h-8 rotate-12" />
        </div>
        <div className="absolute top-32 right-20 text-green-200 opacity-30 pointer-events-none">
          <Leaf className="w-6 h-6 -rotate-20" />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 backdrop-blur-sm border border-green-200 text-green-dark text-sm font-medium mb-6">
            <Leaf className="w-4 h-4" />
            Nền tảng việc làm khu vực Hòa Lạc
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-green-dark leading-tight mb-6">
            Việc gần trường,{' '}
            <span className="relative">
              <span className="text-green-main">vừa lịch học</span>
              <svg className="absolute -bottom-2 left-0 w-full h-2" viewBox="0 0 200 8" fill="none" preserveAspectRatio="none">
                <path d="M2 6 Q50 2 100 5 Q150 8 198 4" stroke="#4D9363" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              </svg>
            </span>
            .
          </h1>
          <p className="text-lg sm:text-xl text-text-muted mb-10 max-w-2xl mx-auto leading-relaxed">
            Kết nối sinh viên Hòa Lạc với việc làm bán thời gian, ca và thực tập tại các cửa hàng xung quanh trường.
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none" />
              <input
                id="hero-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên việc, cửa hàng..."
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-green-100 bg-white text-text-main placeholder:text-text-light focus:outline-none focus:border-green-main focus:ring-2 focus:ring-green-main/20 shadow-card text-base"
              />
            </div>
            <button type="submit" className="btn-primary btn btn-lg flex-shrink-0 px-8">
              Tìm việc
            </button>
          </form>

          <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm text-text-muted">
            <span>Phổ biến:</span>
            {['Pha chế', 'Thu ngân', 'Phục vụ', 'Gym PT', 'Sự kiện'].map((k) => (
              <button
                key={k}
                onClick={() => navigate(`/jobs?search=${encodeURIComponent(k)}`)}
                className="hover:text-green-main hover:underline transition-colors"
              >
                {k}
              </button>
            ))}
          </div>


        </div>
      </section>

      {/* ── Categories ───────────────────────────────────────── */}
      <section className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="section-title mb-6">Nhóm việc phổ biến</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {CATEGORIES.map((c) => (
            <Link
              key={c.label}
              to={c.to}
              className="card-sm hover:shadow-card-hover transition-all duration-200 flex flex-col items-center gap-2 py-5 text-center hover:-translate-y-0.5"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${c.color}`}>
                <c.icon className="w-6 h-6" />
              </div>
              <span className="text-sm font-semibold text-text-main">{c.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Featured Jobs ─────────────────────────────────────── */}
      <section className="py-4 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="section-title">Việc nổi bật</h2>
          <Link to="/jobs" className="flex items-center gap-1 text-green-main text-sm font-semibold hover:underline">
            Xem tất cả <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        {loading ? (
          <LoadingPage />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featured.map((job) => (
              <JobCard key={job._id || job.id} job={job} />
            ))}
          </div>
        )}
      </section>

      {/* ── Features ──────────────────────────────────────────── */}
      <section className="py-16 bg-green-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-green-dark mb-3">Tại sao chọn Hoa Lạc Việc?</h2>
            <p className="text-text-muted">Được xây dựng riêng cho sinh viên khu vực Hòa Lạc.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="card text-center">
                <div className="w-14 h-14 rounded-2xl bg-green-main/10 flex items-center justify-center mx-auto mb-4">
                  <f.icon className="w-7 h-7 text-green-main" />
                </div>
                <h3 className="font-bold text-text-main mb-2">{f.title}</h3>
                <p className="text-text-muted text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────── */}
      <section className="py-20 max-w-5xl mx-auto px-4 sm:px-6">
        <h2 className="text-3xl font-bold text-green-dark text-center mb-14">3 bước để có việc làm</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((s, i) => (
            <div key={s.num} className="relative flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-green-main text-white text-2xl font-bold flex items-center justify-center mb-4 shadow-lg">
                {s.num}
              </div>
              {i < 2 && (
                <div className="hidden md:block absolute top-8 left-[calc(50%+32px)] right-[-calc(50%-32px)] border-t-2 border-dashed border-green-200 w-full" />
              )}
              <h3 className="font-bold text-text-main mb-2">{s.title}</h3>
              <p className="text-text-muted text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-12">
          <Link to="/jobs" className="btn-primary btn btn-lg inline-flex items-center gap-2">
            Khám phá việc làm ngay <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* ── Employer CTA ────────────────────────────────────────── */}
      <section className="py-16 bg-pink-light">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold text-text-main mb-4">Bạn có cửa hàng tại Hòa Lạc?</h2>
          <p className="text-text-muted mb-8 text-lg">
            Đăng tin tuyển dụng miễn phí và tiếp cận hàng nghìn sinh viên đang tìm việc bán thời gian.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated && role === 'employer' ? (
              <>
                <Link to="/employer/jobs" className="btn-primary btn btn-lg">
                  Đăng tin tuyển dụng mới
                </Link>
                <Link to="/employer" className="btn-outline btn btn-lg">
                  Quản lý tin & Ứng viên
                </Link>
              </>
            ) : (
              <>
                <Link to="/register?role=employer" className="btn-primary btn btn-lg">
                  Đăng tin tuyển dụng ngay
                </Link>
                <Link to="/login" className="btn-outline btn btn-lg">
                  Đăng nhập chủ quán
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
