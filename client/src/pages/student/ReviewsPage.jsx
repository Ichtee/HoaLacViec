import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getReviews, getShifts, createReview } from '@/services';
import { Modal } from '@/components/Modal.jsx';
import { Toast } from '@/components/Feedback.jsx';

const WORKER_CRITERIA = [
  ['punctuality', 'Đúng giờ'],
  ['attitude', 'Thái độ làm việc'],
  ['skill', 'Kỹ năng, hiệu quả'],
];

const CRITERIA = [
  ['jobAccuracy', 'Công việc đúng mô tả'],
  ['shiftManagement', 'Ca làm và hướng dẫn'],
  ['workEnvironment', 'Môi trường làm việc'],
  ['payment', 'Thanh toán đúng và đúng hẹn'],
];

function Stars({ label, value, onChange }) {
  return <div className="flex items-center justify-between gap-3">
    <span className="text-sm text-text-main">{label}</span>
    <div className="flex gap-1" role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" onClick={() => onChange(star)}
        aria-label={`${label}: ${star} sao`} aria-pressed={value === star} className="p-1">
        <Star className={clsx('w-5 h-5', star <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300')} />
      </button>)}
    </div>
  </div>;
}

export default function StudentReviewsPage() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [selectedShift, setSelectedShift] = useState(null);
  const [rating, setRating] = useState(0);
  const [criteria, setCriteria] = useState({});
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    Promise.all([getReviews({ studentId: user.id }), getShifts()])
      .then(([reviewData, shiftData]) => {
        if (!active) return;
        setReviews(Array.isArray(reviewData) ? reviewData : []);
        setShifts(Array.isArray(shiftData) ? shiftData : []);
      })
      .catch((err) => { if (active) setError(err.message || 'Không thể tải đánh giá.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id]);

  const sent = reviews.filter((review) => review.transactionType === 'shift' && review.type === 'given');
  const received = reviews.filter((review) => review.transactionType === 'shift' && review.type === 'received');
  const reviewedIds = new Set(sent.map((review) => String(review.transactionId)));
  const eligible = shifts.filter((shift) =>
    (shift.attendanceStatus ? shift.attendanceStatus === 'approved' : ['approved', 'completed', 'payroll_ready', 'paid'].includes(shift.status)) &&
    !reviewedIds.has(String(shift._id || shift.id))
  );

  function openReview(shift) {
    setSelectedShift(shift);
    setRating(0);
    setCriteria({});
    setComment('');
  }

  async function submitReview(event) {
    event.preventDefault();
    if (!rating || !selectedShift || submitting) return;
    setSubmitting(true);
    try {
      const result = await createReview({ transactionType: 'shift', transactionId: selectedShift._id || selectedShift.id,
        rating, criteria, comment: comment.trim() });
      setReviews((previous) => [{ ...result.review, id: result.review.id || result.review._id,
        type: 'given', date: new Date().toLocaleDateString('vi-VN') }, ...previous]);
      setSelectedShift(null);
      setToast({ type: 'success', message: 'Đã gửi đánh giá cửa hàng.' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Không thể gửi đánh giá.' });
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="space-y-6 max-w-5xl mx-auto pb-10">
    <div className="bg-white p-6 rounded-3xl border border-green-50 shadow-card">
      <h1 className="text-xl sm:text-2xl font-bold text-text-main flex items-center gap-2">
        <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" /> Đánh giá cửa hàng
      </h1>
      <p className="text-sm text-text-muted mt-2">Chia sẻ trải nghiệm làm việc sau khi ca của bạn được duyệt.</p>
    </div>

    {loading ? <p className="text-center text-text-muted py-10">Đang tải...</p> : error ?
      <p role="alert" className="text-red-700 bg-red-50 rounded-2xl p-4">{error}</p> : <>
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-text-main">Ca có thể đánh giá ({eligible.length})</h2>
          {eligible.length === 0 ? <p className="bg-white rounded-2xl p-5 text-sm text-text-muted">Không có ca làm đã duyệt nào đang chờ đánh giá.</p> :
            eligible.map((shift) => <div key={shift._id || shift.id} className="bg-white rounded-2xl p-5 border border-green-50 flex items-center justify-between gap-4">
              <div><p className="font-bold text-text-main">{shift.storeName || shift.workplaceName || 'Cửa hàng'}</p>
                <p className="text-sm text-text-muted">Ca ngày {shift.date} · {shift.startTime}–{shift.endTime}</p></div>
              <button onClick={() => openReview(shift)} className="shrink-0 px-4 py-2 rounded-xl bg-green-main text-white text-sm font-semibold">Đánh giá</button>
            </div>)}
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-text-main">Đánh giá từ cửa hàng ({received.length})</h2>
          {received.length === 0 ? <p className="bg-white rounded-2xl p-5 text-sm text-text-muted">Chưa có cửa hàng nào đánh giá bạn sau ca làm.</p> :
            received.map((review) => <div key={review.id || review._id} className="bg-white rounded-2xl p-5 border border-green-50 space-y-2">
              <div className="flex items-center justify-between gap-3"><p className="font-bold text-text-main">{review.storeName || review.authorName || 'Cửa hàng'}</p>
                <span className="text-sm text-text-muted">{review.date}</span></div>
              <p className="text-yellow-600 font-semibold">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</p>
              {review.comment && <p className="text-sm text-text-main">{review.comment}</p>}
              {WORKER_CRITERIA.filter(([key]) => review.criteria?.[key]).map(([key, label]) =>
                <p key={key} className="text-xs text-text-muted">{label}: {review.criteria[key]}/5</p>)}
            </div>)}
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-text-main">Đánh giá đã gửi ({sent.length})</h2>
          {sent.length === 0 ? <p className="bg-white rounded-2xl p-5 text-sm text-text-muted">Bạn chưa đánh giá cửa hàng nào.</p> :
            sent.map((review) => <div key={review.id || review._id} className="bg-white rounded-2xl p-5 border border-green-50 space-y-2">
              <div className="flex items-center justify-between gap-3"><p className="font-bold text-text-main">{review.storeName || 'Cửa hàng'}</p>
                <span className="text-sm text-text-muted">{review.date}</span></div>
              <p className="text-yellow-600 font-semibold">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</p>
              {review.comment && <p className="text-sm text-text-main">{review.comment}</p>}
              {CRITERIA.filter(([key]) => review.criteria?.[key]).map(([key, label]) =>
                <p key={key} className="text-xs text-text-muted">{label}: {review.criteria[key]}/5</p>)}
            </div>)}
        </section>
      </>}

    <Modal isOpen={Boolean(selectedShift)} onClose={() => { if (!submitting) setSelectedShift(null); }} title="Đánh giá cửa hàng">
      {selectedShift && <form onSubmit={submitReview} className="p-6 space-y-5 overflow-y-auto">
        <div><p className="font-bold text-text-main">{selectedShift.storeName || selectedShift.workplaceName || 'Cửa hàng'}</p>
          <p className="text-sm text-text-muted">Ca ngày {selectedShift.date}</p></div>
        <Stars label="Đánh giá tổng thể *" value={rating} onChange={setRating} />
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <p className="text-sm font-semibold text-text-main">Đánh giá chi tiết (không bắt buộc)</p>
          {CRITERIA.filter(([key]) => key !== 'payment' || selectedShift.payrollStatus === 'paid').map(([key, label]) =>
            <Stars key={key} label={label} value={criteria[key] || 0}
              onChange={(value) => setCriteria((previous) => ({ ...previous, [key]: value }))} />)}
          {selectedShift.payrollStatus !== 'paid' && <p className="text-xs text-text-muted">Nếu muốn chấm tiêu chí thanh toán, hãy đợi đến khi cửa hàng xác nhận trả lương rồi gửi đánh giá.</p>}
        </div>
        <label className="block text-sm font-semibold text-text-main">Nhận xét (không bắt buộc)
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} rows={3}
            placeholder="Chia sẻ trải nghiệm thực tế tại cửa hàng" className="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal" />
        </label>
        <button type="submit" disabled={!rating || submitting} className="w-full rounded-xl bg-green-main text-white py-3 font-semibold disabled:opacity-50">
          {submitting ? 'Đang gửi...' : 'Gửi đánh giá'}
        </button>
      </form>}
    </Modal>
    {toast && <Toast {...toast} onClose={() => setToast(null)} />}
  </div>;
}
