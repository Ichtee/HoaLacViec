import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  Search, Clock, Shield, Briefcase, ShieldCheck, Zap, ChevronRight, Coffee, ShoppingBag, Dumbbell, BookOpen, Leaf, ArrowRight, MapPin, Sparkles
} from 'lucide-react';

import { useAsync } from '@/hooks';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getJobs } from '@/services';
import { JobCard } from '@/components/JobCard.jsx';
import { LoadingPage } from '@/components/Feedback.jsx';
import { SALARY_UNIT_LABELS } from '@/constants';
import { formatVND } from '@/utils';
import { avatarColorClass, avatarInitial } from '@/utils/avatarColor.js';
import { clsx } from 'clsx';


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
    () => getJobs({ public: true, limit: 12, sort: 'featured' }),
    [],
    { initialData: [] }
  );

  const jobsList = Array.isArray(latestJobsData) ? latestJobsData : (latestJobsData?.jobs || []);
  const featured = jobsList.slice(0, 6);
  const totalOpenJobs = Number(latestJobsData?.total) || 0;

  function handleSearch(e) {
    e.preventDefault();
    navigate(`/jobs?search=${encodeURIComponent(search)}`);
  }

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-hero-gradient pt-14 pb-16 sm:pt-20 sm:pb-24">
        {/* Decorative leaves + soft rings */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full border border-green-200/60 pointer-events-none" aria-hidden="true" />
        <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full border border-pink-200/70 pointer-events-none" aria-hidden="true" />
        <Leaf className="absolute top-20 left-8 w-8 h-8 text-green-300/50 rotate-12 pointer-events-none" aria-hidden="true" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1.15fr_0.85fr] gap-12 items-center">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 backdrop-blur-sm ring-1 ring-green-200 text-green-dark text-sm font-semibold mb-6 shadow-sm">
              <Sparkles className="w-4 h-4 text-pink-500" />
              Nền tảng việc làm khu vực Hòa Lạc
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-green-dark leading-[1.1] mb-6 text-balance">
              Việc gần trường,{' '}
              <span className="relative whitespace-nowrap">
                <span className="gradient-text">vừa lịch học</span>
                <svg className="absolute -bottom-2 left-0 w-full h-2" viewBox="0 0 200 8" fill="none" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M2 6 Q50 2 100 5 Q150 8 198 4" stroke="#EF8FB0" strokeWidth="3" strokeLinecap="round" fill="none" />
                </svg>
              </span>
              .
            </h1>
            <p className="text-lg text-text-muted mb-9 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Kết nối sinh viên Hòa Lạc với việc làm bán thời gian, ca và thực tập tại các cửa hàng xung quanh trường.
            </p>

            {/* Search: one pill, button inside */}
            <form onSubmit={handleSearch} className="relative max-w-xl mx-auto lg:mx-0">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none" />
              <input
                id="hero-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm việc, cửa hàng..."
                aria-label="Tìm việc"
                className="w-full pl-12 pr-32 py-4 rounded-full border border-green-100 bg-white text-text-main placeholder:text-text-light focus:outline-none focus:border-green-main focus:ring-4 focus:ring-green-main/15 shadow-card-hover text-base"
              />
              <button type="submit" className="btn-primary btn absolute right-2 top-1/2 -translate-y-1/2 px-7 py-2.5">
                Tìm việc
              </button>
            </form>

            <div className="mt-5 flex flex-wrap justify-center lg:justify-start items-center gap-2 text-sm">
              <span className="text-text-muted">Phổ biến:</span>
              {['Pha chế', 'Thu ngân', 'Phục vụ', 'Gym PT', 'Sự kiện'].map((k) => (
                <button
                  key={k}
                  onClick={() => navigate(`/jobs?search=${encodeURIComponent(k)}`)}
                  className="px-3 py-1 rounded-full bg-white/80 ring-1 ring-green-100 text-green-dark font-medium hover:bg-green-light hover:ring-green-200 transition-colors"
                >
                  {k}
                </button>
              ))}
            </div>

            {/* Số liệu thật + lời hứa giá trị */}
            <ul className="mt-8 flex flex-wrap justify-center lg:justify-start gap-x-6 gap-y-2 text-sm font-medium text-green-dark">
              {totalOpenJobs > 0 && (
                <li className="inline-flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-green-main" /> {totalOpenJobs} việc đang tuyển
                </li>
              )}
              <li className="inline-flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-green-main" /> Cửa hàng được xác thực
              </li>
              <li className="inline-flex items-center gap-2">
                <Clock className="w-4 h-4 text-green-main" /> Ứng tuyển không cần CV
              </li>
            </ul>
          </div>

          {/* Hero visual: real jobs floating over a map-style panel (hidden until data loads) */}
          {featured.length > 0 && (
            <div className="relative hidden lg:block h-[420px]">
              <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-green-100 via-green-50 to-pink-100 ring-1 ring-green-200/70 shadow-card overflow-hidden" aria-hidden="true">
                <div
                  className="absolute inset-0 opacity-60"
                  style={{
                    backgroundImage:
                      'linear-gradient(rgba(62,122,80,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(62,122,80,0.10) 1px, transparent 1px)',
                    backgroundSize: '36px 36px',
                  }}
                />
                <div className="absolute left-[18%] top-[22%] w-4 h-4 rounded-full bg-pink-500 ring-8 ring-pink-300/40 animate-pulse" />
                <div className="absolute right-[22%] bottom-[24%] w-4 h-4 rounded-full bg-green-main ring-8 ring-green-300/40 animate-pulse" />
              </div>
              {featured.slice(0, 3).map((job, i) => (
                <Link
                  key={job._id || job.id}
                  to={`/jobs/${job._id || job.id}`}
                  className={clsx(
                    'absolute w-[17rem] glass rounded-2xl p-4 flex items-center gap-3 transition-transform duration-300 hover:-translate-y-1 hover:shadow-card-hover',
                    i === 0 && 'top-6 left-4',
                    i === 1 && 'top-[8.5rem] right-0',
                    i === 2 && 'bottom-6 left-10'
                  )}
                >
                  <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center font-bold shrink-0', avatarColorClass(job.storeName))}>
                    {avatarInitial(job.storeName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-text-main truncate">{job.title}</p>
                    <p className="text-xs text-text-muted truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-pink-600 shrink-0" /> {job.storeName || 'Hòa Lạc'}
                    </p>
                    <p className="text-xs font-bold text-green-dark mt-0.5">
                      {formatVND(job.salaryAmount)}
                      <span className="font-medium text-text-muted">{SALARY_UNIT_LABELS[job.salaryUnit] || ''}</span>
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Categories ───────────────────────────────────────── */}
      <section className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="eyebrow mb-1">Khám phá</p>
        <h2 className="section-title mb-6">Nhóm việc phổ biến</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {CATEGORIES.map((c) => (
            <Link
              key={c.label}
              to={c.to}
              className="group card-sm hover:shadow-card-hover hover:ring-green-200 transition-all duration-200 flex flex-col items-center gap-2 py-5 text-center hover:-translate-y-1"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3 ${c.color}`}>
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
          <div>
            <p className="eyebrow mb-1">Mới cập nhật</p>
            <h2 className="section-title">Việc nổi bật</h2>
          </div>
          <Link to="/jobs" className="flex items-center gap-1 px-4 py-2 rounded-full bg-green-light text-green-dark text-sm font-semibold hover:bg-green-100 transition-colors">
            Xem tất cả <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        {loading ? (
          <LoadingPage />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
            {featured.map((job) => (
              <div key={job._id || job.id} className="h-full flex flex-col">
                <JobCard job={job} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Features ──────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-b from-green-light to-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="eyebrow justify-center mb-2">Vì sao chọn chúng tôi</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-green-dark mb-3">Tại sao chọn Hoa Lạc Việc?</h2>
            <p className="text-text-muted">Được xây dựng riêng cho sinh viên khu vực Hòa Lạc.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="card text-center hover:shadow-card-hover hover:-translate-y-1 transition-all duration-200">
                <div className="w-14 h-14 rounded-2xl bg-brand-gradient shadow-brand flex items-center justify-center mx-auto mb-4">
                  <f.icon className="w-7 h-7 text-white" />
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
        <p className="eyebrow justify-center mb-2 w-full">Đơn giản</p>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-green-dark text-center mb-14">3 bước để có việc làm</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((s, i) => (
            <div key={s.num} className="relative flex flex-col items-center text-center">
              <div className="relative z-10 w-16 h-16 rounded-full bg-brand-gradient text-white text-2xl font-bold flex items-center justify-center mb-4 shadow-brand ring-4 ring-cream">
                {s.num}
              </div>
              {i < 2 && (
                <div className="hidden md:block absolute top-8 left-1/2 w-full border-t-2 border-dashed border-green-200" aria-hidden="true" />
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
      <section className="px-4 sm:px-6 lg:px-8 pb-20">
        <div className="relative overflow-hidden max-w-6xl mx-auto rounded-4xl bg-brand-gradient px-6 py-14 sm:px-14 text-center shadow-modal">
          <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full bg-pink-300/25 pointer-events-none" aria-hidden="true" />
          <div className="absolute -bottom-24 -left-10 w-64 h-64 rounded-full bg-white/10 pointer-events-none" aria-hidden="true" />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">Bạn có cửa hàng tại Hòa Lạc?</h2>
            <p className="text-green-50 mb-8 text-lg max-w-2xl mx-auto">
              Đăng tin tuyển dụng miễn phí và tiếp cận hàng nghìn sinh viên đang tìm việc bán thời gian.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isAuthenticated && role === 'employer' ? (
                <>
                  <Link to="/employer/jobs" className="btn btn-lg bg-white text-green-dark hover:bg-green-50 shadow-card-hover">
                    Đăng tin tuyển dụng mới
                  </Link>
                  <Link to="/employer" className="btn btn-lg border-2 border-white/70 text-white hover:bg-white/10">
                    Quản lý tin & Ứng viên
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/register?role=employer" className="btn btn-lg bg-white text-green-dark hover:bg-green-50 shadow-card-hover">
                    Đăng tin tuyển dụng ngay
                  </Link>
                  <Link to="/login" className="btn btn-lg border-2 border-white/70 text-white hover:bg-white/10">
                    Đăng nhập chủ quán
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
