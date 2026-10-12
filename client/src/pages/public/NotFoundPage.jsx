import { Link } from 'react-router-dom';
import { ArrowLeft, MapPinOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth.jsx';

export default function NotFoundPage() {
  const { isAuthenticated, role, user } = useAuth();
  const isPending = user?.status === 'pending' || role === 'pending';
  const homePath = isPending
    ? '/verify-account'
    : isAuthenticated
    ? { student: '/student', employer: '/employer', admin: '/admin' }[role] || '/student'
    : '/';

  return (
    <div className="relative min-h-screen overflow-hidden bg-hero-gradient flex flex-col items-center justify-center p-6 text-center">
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full border border-green-200/60 pointer-events-none" aria-hidden="true" />
      <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full border border-pink-200/70 pointer-events-none" aria-hidden="true" />
      <img src="/logo.png" alt="Hoa Lạc Việc" className="relative h-20 w-auto mx-auto object-contain mb-8" />
      <div className="relative">
        <h1 className="text-8xl sm:text-9xl font-extrabold tracking-tight gradient-text leading-none">404</h1>
        <MapPinOff className="absolute -right-8 -top-3 w-9 h-9 text-pink-500" aria-hidden="true" />
      </div>
      <h2 className="relative text-2xl sm:text-3xl font-extrabold text-text-main mt-4">Trang không tồn tại</h2>
      <p className="relative text-text-muted max-w-md mt-3">
        Đường dẫn bạn truy cập không nằm trên hệ thống Hoa Lạc Việc hoặc đã bị di chuyển.
      </p>
      <Link to={homePath} className="relative btn-primary btn btn-lg mt-8">
        <ArrowLeft className="w-4 h-4" /> Trở về Trang chủ
      </Link>
    </div>
  );
}
