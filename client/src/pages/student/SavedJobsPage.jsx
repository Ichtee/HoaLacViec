import { useState, useEffect } from 'react';
import { Bookmark, Search, Trash2 } from 'lucide-react';
import { getSavedJobs, getJobs, toggleSaveJob } from '@/services';
import { JobCard } from '@/components/JobCard.jsx';
import { Toast } from '@/components/Feedback.jsx';

export default function SavedJobsPage() {
  const [savedJobs, setSavedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadSavedJobs();
  }, []);

  async function loadSavedJobs() {
    try {
      setLoading(true);
      const res = await getSavedJobs();
      if (Array.isArray(res)) {
        if (res.length > 0 && typeof res[0] === 'object' && res[0].title) {
          // Backend returned full populated job items
          setSavedJobs(res.map(j => ({ ...j, id: j._id || j.id })));
        } else {
          // Returned list of IDs
          const allJobsRes = await getJobs({ limit: 100 });
          const allJobs = allJobsRes?.jobs || (Array.isArray(allJobsRes) ? allJobsRes : []);
          const filtered = allJobs.filter(j => res.includes(j._id || j.id));
          setSavedJobs(filtered);
        }
      } else {
        setSavedJobs([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleSave(jobId) {
    const res = await toggleSaveJob(jobId);
    const isNowSaved = typeof res === 'object' ? res.saved : Boolean(res);
    if (!isNowSaved) {
      setSavedJobs(prev => prev.filter(j => j.id !== jobId));
      setToast({ type: 'info', message: 'Đã xóa công việc khỏi danh sách lưu.' });
    }
  }

  const displayedJobs = savedJobs.filter(j =>
    j.title.toLowerCase().includes(search.toLowerCase()) ||
    j.storeName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-green-50 shadow-card">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main flex items-center gap-2">
            <Bookmark className="w-6 h-6 text-pink-main fill-pink-main" /> Công việc đã lưu
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Danh sách các bài tuyển dụng tại Hòa Lạc bạn đang quan tâm.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Tìm trong công việc đã lưu..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-2xl border border-green-100 text-xs focus:outline-none focus:ring-2 focus:ring-green-main bg-cream/40"
          />
          <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-2.5" />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-text-muted">Đang tải công việc đã lưu...</div>
      ) : displayedJobs.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-green-50 shadow-card space-y-3">
          <Bookmark className="w-12 h-12 text-pink-300 mx-auto opacity-60" />
          <h3 className="text-base font-bold text-text-main">Chưa có công việc lưu nào</h3>
          <p className="text-xs text-text-muted max-w-md mx-auto">
            Khi duyệt tin tuyển dụng, hãy bấm biểu tượng Bookmark để lưu vết những việc phù hợp để ứng tuyển sau.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedJobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              isSaved={true}
              onToggleSave={handleToggleSave}
            />
          ))}
        </div>
      )}
    </div>
  );
}
