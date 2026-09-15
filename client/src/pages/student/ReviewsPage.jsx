import { useState, useEffect } from 'react';
import { Star, MessageSquare, ThumbsUp, ShieldCheck, Building2, User } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { getReviews, createReview } from '@/services';
import { Badge } from '@/components/Badge.jsx';
import { Toast } from '@/components/Feedback.jsx';

export default function StudentReviewsPage() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('received'); // received | given

  useEffect(() => {
    async function loadReviews() {
      setLoading(true);
      const data = await getReviews({ studentId: user?.id });
      setReviews(data || [
        {
          id: 'r1',
          storeName: 'Highland Coffee F-Ville 2',
          rating: 5,
          comment: 'Bạn làm việc rất đúng giờ, pha chế nhanh nhẹn và hỗ trợ dọn dẹp cuối ca rất sạch sẽ.',
          tags: ['Đúng giờ', 'Chăm chỉ', 'Giao tiếp tốt'],
          date: '10/09/2026',
          type: 'received',
          authorName: 'Quản lý Anh Tuấn'
        },
        {
          id: 'r2',
          storeName: 'Circle K Tân Xã',
          rating: 5,
          comment: 'Sinh viên ngoan ngoãn, chủ động hỗ trợ khách hàng lúc cao điểm.',
          tags: ['Tự giác', 'Trung thực'],
          date: '02/09/2026',
          type: 'received',
          authorName: 'Quản lý Chị Linh'
        },
        {
          id: 'r3',
          storeName: 'Mixue Tân Xã',
          rating: 4,
          comment: 'Cửa hàng trả lương đúng hẹn, môi trường làm việc vui vẻ thân thiện.',
          tags: ['Trả lương chuẩn', 'Môi trường tốt'],
          date: '28/08/2026',
          type: 'given',
          authorName: user?.name
        }
      ]);
      setLoading(false);
    }
    loadReviews();
  }, [user]);

  const displayedReviews = reviews.filter(r => r.type === activeTab);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-10">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-green-50 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main flex items-center gap-2">
            <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" /> Đánh giá & Uy tín làm việc
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Tổng hợp nhận xét từ quản lý cửa hàng và đánh giá của bạn dành cho nơi làm việc.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-cream rounded-2xl border border-green-50 self-start sm:self-center">
          <button
            onClick={() => setActiveTab('received')}
            className={clsx(
              'px-4 py-2 rounded-xl text-xs font-semibold transition-all',
              activeTab === 'received' ? 'bg-white text-green-dark shadow-sm' : 'text-text-muted'
            )}
          >
            Đánh giá nhận được ({reviews.filter(r => r.type === 'received').length})
          </button>
          <button
            onClick={() => setActiveTab('given')}
            className={clsx(
              'px-4 py-2 rounded-xl text-xs font-semibold transition-all',
              activeTab === 'given' ? 'bg-white text-green-dark shadow-sm' : 'text-text-muted'
            )}
          >
            Đánh giá đã gửi ({reviews.filter(r => r.type === 'given').length})
          </button>
        </div>
      </div>

      {/* Review List */}
      <div className="space-y-4">
        {displayedReviews.map((review) => (
          <div key={review.id} className="bg-white p-6 rounded-3xl border border-green-50 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-green-50 text-green-main flex items-center justify-center font-bold">
                  {review.type === 'received' ? <Building2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-text-main">
                    {review.type === 'received' ? review.storeName : `Đánh giá ${review.storeName}`}
                  </h4>
                  <p className="text-xs text-text-muted">Bởi {review.authorName} • {review.date}</p>
                </div>
              </div>

              {/* Stars */}
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={clsx(
                      'w-4 h-4',
                      s <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'
                    )}
                  />
                ))}
              </div>
            </div>

            <p className="text-xs sm:text-sm text-text-main leading-relaxed pl-1">
              "{review.comment}"
            </p>

            {review.tags && review.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {review.tags.map((tag) => (
                  <span key={tag} className="px-2.5 py-1 rounded-lg bg-green-50 text-green-dark text-[11px] font-medium border border-green-100">
                    👍 {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
