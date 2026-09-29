import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  Search, MapPin, Clock, ShieldCheck, ChevronRight,
  Coffee, ShoppingBag, Utensils, Zap, BookOpen, ArrowRight, CheckCircle2
} from 'lucide-react';
import { useAsync } from '@/hooks';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getJobs } from '@/services';
import { JobCard } from '@/components/JobCard.jsx';
import { LoadingPage } from '@/components/Feedback.jsx';

const SHORTCUTS = [
  { label: 'Pha chế', query: 'Pha chế' },
  { label: 'Thu ngân', query: 'Thu ngân' },
  { label: 'Phục vụ', query: 'Phục vụ' },
  { label: 'Bán hàng', query: 'Bán hàng' },
  { label: 'Gần FPT / ĐHQG', query: 'Hòa Lạc' },
];

const CATEGORIES = [
  { icon: Coffee, label: 'Café & Trà sữa', to: '/jobs?search=Cafe' },
  { icon: Utensils, label: 'Quán ăn & Nhà hàng', to: '/jobs?search=Phục vụ' },
  { icon: ShoppingBag, label: 'Cửa hàng & Bán lẻ', to: '/jobs?search=Bán hàng' },
  { icon: Clock, label: 'Việc làm theo ca', to: '/jobs?type=shift' },
  { icon: Zap, label: 'Chợ việc vặt sinh viên', to: '/tasks' },
  { icon: BookOpen, label: 'Cẩm nang & Kinh nghiệm', to: '/blogs' },
];

export default function HomePage() {
  const { isAuthenticated, role } = useAuth();
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const { data: latestJobsData, loading } = useAsync(
    () => getJobs({ public: true, limit: 8, sort: 'newest' }),
    [],
    { initialData: [] }
  );

  const jobsList = Array.isArray(latestJobsData) ? latestJobsData : (latestJobsData?.jobs || []);
  const featured = jobsList.slice(0, 8);

  function handleSearch(e) {
    e.preventDefault();
    if (!search.trim()) {
      navigate('/jobs');
      return;
    }
    navigate(`/jobs?search=${encodeURIComponent(search.trim())}`);
  }

  return (
    <div>
      {/* ── Editorial Hero ─────────────────────────────────────── */}
      <section className="bg-white border-b border-gray-200 py-10 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="space-y-3 mb-6">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-dark">
              <span className="w-2 h-2 rounded-full bg-green-main"></span>
              Bảng tin việc làm sinh viên Hòa Lạc
            </div>

            <h1 className="text-2xl sm:text-4xl font-bold text-text-main tracking-tight leading-tight">
              Tìm việc theo ca, vừa lịch học quanh Hòa Lạc
            </h1>

            <p className="text-sm sm:text-base text-text-muted leading-relaxed max-w-2xl">
              Nền tảng kết nối sinh viên FPT, ĐHQG và khu Công nghệ cao với các cửa hàng, quán cà phê địa phương. Tìm việc theo ca rảnh, rõ địa chỉ và mức lương.
            </p>
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                id="hero-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo vị trí (pha chế, thu ngân, phục vụ) hoặc tên quán..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 bg-white text-text-main placeholder:text-gray-400 focus:outline-none focus:border-green-main focus:ring-1 focus:ring-green-main text-sm"
              />
            </div>
            <button type="submit" className="btn-primary btn btn-md shrink-0">
              Tìm việc làm
            </button>
          </form>

          {/* Shortcuts */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
            <span className="text-gray-400">Gợi ý tìm nhanh:</span>
            {SHORTCUTS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => navigate(`/jobs?search=${encodeURIComponent(s.query)}`)}
                className="px-2 py-0.5 rounded border border-gray-200 hover:border-gray-300 hover:text-green-dark transition-colors bg-gray-50/60"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Category Shortcuts ──────────────────────────────────── */}
      <section className="py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {CATEGORIES.map((c) => (
            <Link
              key={c.label}
              to={c.to}
              className="p-3 rounded-lg border border-gray-200/90 bg-white hover:border-gray-300 transition-colors flex items-center gap-2.5 text-text-main group"
            >
              <c.icon className="w-4 h-4 text-gray-500 group-hover:text-green-dark shrink-0 transition-colors" />
              <span className="text-xs font-medium truncate">{c.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Featured Jobs List ─────────────────────────────────── */}
      <section className="py-4 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
          <div>
            <h2 className="section-title">Việc làm mới đăng</h2>
            <p className="text-xs text-text-muted mt-0.5">Tuyển ca trực tiếp tại các cửa hàng khu vực Hòa Lạc</p>
          </div>
          <Link
            to="/jobs"
            className="inline-flex items-center gap-1 text-xs font-semibold text-green-dark hover:underline"
          >
            Xem tất cả tin tuyển dụng <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <LoadingPage />
        ) : jobsList.length === 0 ? (
          <div className="p-8 text-center bg-white border border-gray-200 rounded-xl text-xs text-text-muted">
            Hiện chưa có việc làm mới. Bạn có thể quay lại sau ít phút.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-stretch">
            {featured.map((job) => (
              <div key={job._id || job.id} className="h-full flex flex-col">
                <JobCard job={job} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Local Utility Notes (Editorial 3-row) ────────────────── */}
      <section className="py-12 bg-white border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-8">
            <h2 className="text-xl font-bold text-text-main tracking-tight">
              Quy trình tìm việc thực tế cho sinh viên Hòa Lạc
            </h2>
            <p className="text-xs sm:text-sm text-text-muted mt-1">
              Hệ thống được thiết kế tinh giản để bạn tìm được việc phù hợp mà không mất thời gian chuẩn bị CV rườm rà.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div className="space-y-1.5 p-4 rounded-xl border border-gray-100 bg-gray-50/50">
              <span className="text-xs font-bold text-green-dark">01. Tra cứu ca rảnh</span>
              <h3 className="font-semibold text-text-main text-sm">Xem giờ ca trước khi nộp</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Mỗi tin tuyển dụng đều ghi rõ khung ca sáng, chiều hoặc tối để bạn đối chiếu ngay với thời khóa biểu trên trường.
              </p>
            </div>

            <div className="space-y-1.5 p-4 rounded-xl border border-gray-100 bg-gray-50/50">
              <span className="text-xs font-bold text-green-dark">02. Xác nhận khoảng cách</span>
              <h3 className="font-semibold text-text-main text-sm">Biết chính xác vị trí quán</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Khoảng cách được ước tính trực tiếp đến các điểm quen thuộc như KTX FPT, KTX ĐHQG, ngã ba Hòa Lạc hoặc đường 21.
              </p>
            </div>

            <div className="space-y-1.5 p-4 rounded-xl border border-gray-100 bg-gray-50/50">
              <span className="text-xs font-bold text-green-dark">03. Đi làm & chấm công</span>
              <h3 className="font-semibold text-text-main text-sm">Duyệt ca và tính công minh bạch</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Sau khi được nhận, ca làm được xếp lịch trên hệ thống, có xác nhận và ghi nhận giờ công chi tiết từng buổi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Employer CTA ────────────────────────────────────────── */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Dành cho chủ quán & cơ sở kinh doanh
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-text-main tracking-tight">
              Cần tuyển nhân viên bán thời gian tại Hòa Lạc?
            </h2>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
              Đăng tin tuyển theo ca, nhận hồ sơ từ sinh viên gần quán, xếp lịch và duyệt công làm việc hàng ngày ngay trên nền tảng.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {isAuthenticated && role === 'employer' ? (
              <>
                <Link to="/employer/jobs" className="btn-primary btn btn-md">
                  Đăng tin mới
                </Link>
                <Link to="/employer" className="btn-outline btn btn-md">
                  Vào trang quản lý
                </Link>
              </>
            ) : (
              <>
                <Link to="/register?role=employer" className="btn-primary btn btn-md">
                  Đăng ký tuyển dụng
                </Link>
                <Link to="/login" className="btn-outline btn btn-md">
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
