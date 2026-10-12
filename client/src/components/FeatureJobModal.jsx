import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { apiFeatureJob } from '@/services';
import { Modal } from '@/components/Modal.jsx';

const OPTIONS = [3, 7];

export default function FeatureJobModal({ job, prices, balance, onClose, onDone }) {
  const [busyDays, setBusyDays] = useState(0);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const anyShort = OPTIONS.some((d) => balance < prices[`featured_${d}d`]);

  async function buy(days) {
    setBusyDays(days);
    setError('');
    setErrorCode('');
    try {
      onDone(await apiFeatureJob(job._id || job.id, days));
    } catch (err) {
      setError(err.message || 'Không thể mua tin nổi bật.');
      setErrorCode(err.code || '');
    } finally {
      setBusyDays(0);
    }
  }

  return (
    <Modal isOpen onClose={() => { if (!busyDays) onClose(); }} title="Làm nổi bật tin tuyển dụng">
      <div className="space-y-3 text-xs">
        <p className="text-text-muted">
          <strong className="text-text-main">{job.title}</strong> sẽ được ghim lên đầu danh sách việc làm, tô nổi bật, hiện ngôi sao trên bản đồ và gửi thông báo tới sinh viên ở gần quán (3 km).
          {job.status === 'pending' && ' Thời gian nổi bật bắt đầu tính từ lúc tin được duyệt.'}
          {' '}Số dư hiện tại: <strong className="text-text-main">{balance} credit</strong>.
        </p>
        {OPTIONS.map((days) => {
          const price = prices[`featured_${days}d`];
          return (
            <div key={days} className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-green-100 bg-green-50/30">
              <div className="min-w-0">
                <p className="font-bold text-text-main flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-amber-500" /> {days} ngày</p>
                <p className="text-text-muted">{price} credit</p>
              </div>
              <button
                type="button"
                disabled={Boolean(busyDays) || balance < price}
                onClick={() => buy(days)}
                className="px-4 py-2 rounded-xl bg-green-main text-white font-bold hover:bg-green-dark disabled:opacity-50 shrink-0"
              >
                {busyDays === days ? 'Đang xử lý...' : 'Mua'}
              </button>
            </div>
          );
        })}
        {(anyShort || errorCode === 'INSUFFICIENT_CREDITS') && (
          <Link to="/employer/credits" className="inline-block font-bold text-green-dark hover:underline">Nạp thêm credit</Link>
        )}
        {error && <p role="alert" className="p-2 rounded-xl bg-red-50 border border-red-200 text-red-700">{error}</p>}
      </div>
    </Modal>
  );
}
