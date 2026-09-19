import { Link } from 'react-router-dom';
import { Leaf, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-6 text-center">
      <div className="mb-6 animate-bounce">
        <img src="/logo.png" alt="Hoa Lạc Việc" className="h-24 w-auto mx-auto object-contain" />
      </div>
      <h1 className="text-6xl font-extrabold text-green-dark tracking-tight">404</h1>
      <h2 className="text-2xl font-bold text-text-main mt-2">Trang không tồn tại</h2>
      <p className="text-text-muted text-sm max-w-md mt-2">
        Đường dẫn bạn truy cập không nằm trên hệ thống Hoa Lạc Việc hoặc đã bị di chuyển.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-green-main text-white font-bold text-sm hover:bg-green-dark transition-all shadow-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Trở về Trang chủ
      </Link>
    </div>
  );
}
