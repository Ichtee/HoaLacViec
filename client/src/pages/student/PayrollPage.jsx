import { useState, useEffect } from 'react';
import {
  DollarSign, Clock, Calendar, CheckCircle, AlertTriangle, Download,
  Building2, ArrowUpRight, ShieldCheck
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getPayrollStatements } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Modal } from '@/components/Modal.jsx';
import { Toast } from '@/components/Feedback.jsx';

export default function StudentPayrollPage() {
  const { user } = useAuth();
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatement, setSelectedStatement] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadPayroll();
  }, [user]);

  async function loadPayroll() {
    try {
      setLoading(true);
      const data = await getPayrollStatements({ studentId: user?.id });
      setStatements(data || [
        {
          id: 'pay-01',
          month: 'Tháng 09/2026',
          storeName: 'Highland Coffee F-Ville 2',
          totalHours: 32,
          hourlyRate: 25000,
          bonus: 100000,
          totalAmount: 900000,
          status: 'paid',
          paidAt: '10/09/2026',
          shiftsCount: 8
        },
        {
          id: 'pay-02',
          month: 'Tháng 09/2026',
          storeName: 'Circle K Tân Xã',
          totalHours: 20,
          hourlyRate: 22000,
          bonus: 0,
          totalAmount: 440000,
          status: 'pending',
          paidAt: null,
          shiftsCount: 5
        },
        {
          id: 'pay-03',
          month: 'Tháng 08/2026',
          storeName: 'Highland Coffee F-Ville 2',
          totalHours: 48,
          hourlyRate: 25000,
          bonus: 150000,
          totalAmount: 1350000,
          status: 'paid',
          paidAt: '05/09/2026',
          shiftsCount: 12
        }
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const totalEarned = statements.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalHours = statements.reduce((sum, s) => sum + s.totalHours, 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Summary Banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-green-dark rounded-3xl p-6 sm:p-8 text-white shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5" /> Minh bạch & Bảo hộ lương Hoa Lạc
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Sổ Đối Soát Lương & Thu Nhập 💰</h1>
          <p className="mt-1 text-green-100 text-xs sm:text-sm">
            Tự động ghi nhận số giờ check-in GPS và đối soát công lương hàng tuần/tháng.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/20 flex items-center gap-6">
          <div>
            <p className="text-xs text-green-100">Tổng thu nhận</p>
            <p className="text-2xl font-bold">{totalEarned.toLocaleString('vi-VN')}đ</p>
          </div>
          <div className="w-px h-10 bg-white/20" />
          <div>
            <p className="text-xs text-green-100">Tổng giờ đã làm</p>
            <p className="text-2xl font-bold">{totalHours}h</p>
          </div>
        </div>
      </div>

      {/* Statements List */}
      <div className="bg-white rounded-3xl p-6 border border-green-50 shadow-card space-y-4">
        <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
          <Clock className="w-5 h-5 text-green-main" /> Bảng kê lương theo kỳ
        </h2>

        {loading ? (
          <div className="text-center py-8 text-text-muted">Đang tải công lương...</div>
        ) : (
          <div className="divide-y divide-green-50">
            {statements.map(item => (
              <div key={item.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-main text-base">{item.storeName}</span>
                    <Badge variant={item.status === 'paid' ? 'success' : 'warning'} size="sm">
                      {item.status === 'paid' ? 'Đã quyết toán' : 'Chờ đối soát'}
                    </Badge>
                  </div>
                  <p className="text-xs text-text-muted">
                    Kỳ: <strong>{item.month}</strong> • {item.shiftsCount} ca làm ({item.totalHours} giờ) • Đơn giá: {item.hourlyRate.toLocaleString('vi-VN')}đ/h
                  </p>
                </div>

                <div className="flex items-center gap-4 justify-between sm:justify-end">
                  <div className="text-right">
                    <p className="text-base font-bold text-green-dark">{item.totalAmount.toLocaleString('vi-VN')}đ</p>
                    {item.bonus > 0 && <p className="text-[10px] text-pink-main">+ Thưởng: {item.bonus.toLocaleString('vi-VN')}đ</p>}
                  </div>

                  <button
                    onClick={() => setSelectedStatement(item)}
                    className="px-3.5 py-2 rounded-xl bg-cream hover:bg-green-50 text-green-dark font-semibold text-xs transition-colors"
                  >
                    Chi tiết →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Statement Detail Modal */}
      {selectedStatement && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedStatement(null)}
          title={`Chi tiết bảng kê: ${selectedStatement.storeName}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-cream/60 space-y-2">
              <p className="flex justify-between"><span>Kỳ thanh toán:</span> <strong>{selectedStatement.month}</strong></p>
              <p className="flex justify-between"><span>Tổng số giờ tích lũy:</span> <strong>{selectedStatement.totalHours} giờ</strong></p>
              <p className="flex justify-between"><span>Mức lương ca:</span> <strong>{selectedStatement.hourlyRate.toLocaleString('vi-VN')}đ/h</strong></p>
              <p className="flex justify-between"><span>Thưởng / Phụ cấp:</span> <strong className="text-pink-main">+{selectedStatement.bonus.toLocaleString('vi-VN')}đ</strong></p>
              <hr className="border-green-100 my-1" />
              <p className="flex justify-between text-sm font-bold text-green-dark">
                <span>Thực nhận:</span> <span>{selectedStatement.totalAmount.toLocaleString('vi-VN')}đ</span>
              </p>
            </div>

            <p className="text-text-muted text-[11px] leading-relaxed">
              * Tiền lương sẽ được chuyển khoản trực tiếp vào tài khoản ngân hàng của bạn vào ngày 05 hoặc 10 hàng tháng. Nếu có thắc mắc sai lệch ca làm, bấm gửi yêu cầu hỗ trợ tới Admin.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedStatement(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-text-muted font-semibold"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  setToast({ type: 'info', message: 'Đã gửi yêu cầu đối soát tới bộ phận Admin.' });
                  setSelectedStatement(null);
                }}
                className="px-4 py-2 rounded-xl bg-green-main text-white font-semibold hover:bg-green-dark"
              >
                Gửi phản hồi sai lệch
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
