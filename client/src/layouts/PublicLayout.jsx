import { Outlet } from 'react-router-dom';
import { Navbar, Footer } from '@/components/Nav.jsx';

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-cream">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
