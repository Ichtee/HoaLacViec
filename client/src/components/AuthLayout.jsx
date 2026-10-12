import { Link } from 'react-router-dom';
import { ShieldCheck, Clock, MapPin } from 'lucide-react';

const POINTS = [
  { icon: Clock, text: 'Ghép việc theo lịch học của bạn' },
  { icon: ShieldCheck, text: 'Cửa hàng được xác thực trước khi đăng tin' },
  { icon: MapPin, text: 'Việc làm ngay quanh khu vực Hòa Lạc' },
];

/**
 * Khung dùng chung cho đăng nhập / đăng ký: bảng thương hiệu bên trái (ẩn trên điện thoại),
 * form nằm bên phải.
 */
export function AuthLayout({ children }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] grid lg:grid-cols-[0.9fr_1.1fr]">
      <aside className="hidden lg:flex relative overflow-hidden bg-brand-gradient text-white p-12 xl:p-16 flex-col justify-between">
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-pink-300/25" aria-hidden="true" />
        <div className="absolute -bottom-32 -left-16 w-96 h-96 rounded-full bg-white/10" aria-hidden="true" />
        <div className="absolute right-16 bottom-24 w-4 h-4 rounded-full bg-pink-300 ring-8 ring-pink-300/30 animate-pulse" aria-hidden="true" />

        <Link to="/" className="relative inline-flex w-fit rounded-2xl bg-white p-2.5 shadow-card-hover">
          <img src="/logo.png" alt="Hoa Lạc Việc" className="h-12 w-auto object-contain" />
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-4xl xl:text-5xl font-extrabold leading-[1.1] text-balance">
            Việc gần trường, <span className="text-pink-200">vừa lịch học.</span>
          </h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-green-50">
                <span className="w-10 h-10 rounded-xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-green-100/80">Nền tảng việc làm & việc vặt sinh viên Hòa Lạc</p>
      </aside>

      <main className="flex items-center justify-center p-4 sm:p-8 bg-hero-gradient">{children}</main>
    </div>
  );
}
