import { useState, useEffect } from 'react';
import {
  DollarSign, Clock, Users, CheckCircle, Download, Plus, Building2, ShieldCheck
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getPayrollStatements, finalizePayroll } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Toast } from '@/components/Feedback.jsx';

export default function EmployerPayrollPage() {
  const { user } = useAuth();
  const [payrollList, setPayrollList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadPayroll();
  }, [user]);

  async function loadPayroll() {
    try {
      setLoading(true);
      const data = await getPayrollStatements({ storeId: user?.id });
      setPayrollList(data || [
        {
          id: 'p1',
          studentName: 'Nguyễn Văn A',
          month: 'Tháng 09/2026',
          totalHours: 32,
          hourlyRate: 25000,
          bonus: 100000,
          totalAmount: 900000,
          status: 'pending'
        },
        {
          id: 'p2',
          studentName: 'Trần Thị B',
          month: 'Tháng 09/2026',
          totalHours: 40,
          hourlyRate: 25000,
          bonus: 50000,
          totalAmount: 1050000,
          status: 'paid'
        },
        {
          id: 'p3',
          studentName: 'Lê Hoàng C',
          month: 'Tháng 09/2026',
          totalHours: 16,
          hourlyRate: 22000,
          bonus: 0,
          totalAmount: 352000,
          status: 'pending'
        }
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleFinalize(id) {
    await finalizePayroll(id);
    setPayrollList(prev => prev.map(p => p.id === id ? { ...p, status: 'paid' } : p));
    setToast({ type: 'success', message: 'Đã chốt lương và xác nhận quyết toán!' });
  }

  const grandTotal = payrollList.reduce((sum, p) => sum + p.totalAmount, 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Banner */}
      <div className="bg-gradient-to-r from-pink-main to-purple-700 rounded-3xl p-6 sm:p-8 text-white shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5" /> Quản lý Quỹ Lương & Đối Soát Công
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">Bảng Lương Nhân Viên Sinh Viên 💳</h1>
          <p className="mt-1 text-pink-100 text-xs sm:text-sm">
            Tự động tính toán tổng số giờ check-in và chi trả minh bạch cho nhân viên.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-right">
          <p className="text-xs text-pink-100">Tổng quỹ lương kỳ này</p>
          <p className="text-2xl font-bold">{grandTotal.toLocaleString('vi-VN')}đ</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl p-6 border border-green-50 shadow-card space-y-4">
        <h2 className="text-base font-bold text-text-main flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-pink-main" /> Chi tiết lương từng nhân viên
        </h2>

        {loading ? (
          <div className="text-center py-8 text-text-muted">Đang tải bảng lương...</div>
        ) : (
          <div className="divide-y divide-green-50">
            {payrollList.map(item => (
              <div key={item.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-text-main text-sm">{item.studentName}</h4>
                    <Badge variant={item.status === 'paid' ? 'success' : 'warning'} size="sm">
                      {item.status === 'paid' ? 'Đã quyết toán' : 'Chờ chốt lương'}
                    </Badge>
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    Tổng giờ: <strong>{item.totalHours}h</strong> • Đơn giá: {item.hourlyRate.toLocaleString('vi-VN')}đ/h • Thưởng: +{item.bonus.toLocaleString('vi-VN')}đ
                  </p>
                </div>

                <div className="flex items-center gap-4 justify-between sm:justify-end">
                  <span className="text-base font-bold text-pink-main">
                    {item.totalAmount.toLocaleString('vi-VN')}đ
                  </span>

                  {item.status !== 'paid' && (
                    <button
                      onClick={() => handleFinalize(item.id)}
                      className="px-4 py-2 rounded-xl bg-green-main text-white font-semibold text-xs hover:bg-green-dark transition-all"
                    >
                      Duyệt chi trả
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
