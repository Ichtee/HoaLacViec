import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { JobCard } from '@/components/JobCard.jsx';
import { EmptyState, LoadingPage, ErrorAlert } from '@/components/Feedback.jsx';
import { Select } from '@/components/Form.jsx';
import { useAsync, useDebounce } from '@/hooks';
import { getJobs, toggleSaveJob, isSavedJob, getSavedJobs } from '@/services';
import { useAuth } from '@/hooks/useAuth.jsx';
import { JOB_TYPES, JOB_TYPE_LABELS, AREAS } from '@/constants';

const PAGE_SIZE = 9;

export default function JobListPage() {
  const [params, setParams] = useSearchParams();
  const { isAuthenticated, profileId } = useAuth();

  const [search, setSearch] = useState(params.get('search') || '');
  const [type, setType] = useState(params.get('type') || '');
  const [area, setArea] = useState(params.get('area') || '');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [savedJobIds, setSavedJobIds] = useState(new Set());

  const dSearch = useDebounce(search, 350);

  const { data: allJobs, loading, error, run } = useAsync(
    () => getJobs({ public: true, search: dSearch, type, area, verified: verifiedOnly || undefined }),
    [dSearch, type, area, verifiedOnly],
    { initialData: [] }
  );

  // Load saved job ids
  useEffect(() => {
    if (!isAuthenticated || !profileId) return;
    getSavedJobs(profileId).then((jobs) => {
      setSavedJobIds(new Set(jobs.map((j) => j.id)));
    });
  }, [isAuthenticated, profileId]);

  // Sort
  const sorted = [...(allJobs || [])].sort((a, b) => {
    if (sort === 'newest') return new Date(b.postedAt) - new Date(a.postedAt);
    if (sort === 'salary_desc') return b.salaryAmount - a.salaryAmount;
    return 0;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleSave(jobId) {
    if (!isAuthenticated) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    const result = await toggleSaveJob(profileId, jobId);
    setSavedJobIds((prev) => {
      const next = new Set(prev);
      result.saved ? next.add(jobId) : next.delete(jobId);
      return next;
    });
  }

  function clearFilters() {
    setSearch(''); setType(''); setArea(''); setVerifiedOnly(false); setPage(1);
  }

  const hasFilters = search || type || area || verifiedOnly;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="page-title mb-1">Tìm việc làm</h1>
        <p className="text-text-muted text-sm">{sorted.length > 0 ? `${sorted.length} việc làm tại Hòa Lạc` : 'Đang tải...'}</p>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <input
            id="job-search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Tìm theo tên việc, cửa hàng..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-green-100 bg-white text-sm focus:outline-none focus:border-green-main focus:ring-2 focus:ring-green-main/20"
          />
        </div>
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={clsx('btn btn-md flex items-center gap-2', filtersOpen || hasFilters ? 'btn-secondary' : 'btn-outline')}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Bộ lọc
          {hasFilters && <span className="w-2 h-2 rounded-full bg-green-main ml-1" />}
        </button>
        <Select
          id="sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="w-auto min-w-[160px]"
        >
          <option value="newest">Mới nhất</option>
          <option value="salary_desc">Lương cao nhất</option>
        </Select>
      </div>

      {/* Filters panel */}
      {filtersOpen && (
        <div className="card mb-4 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              id="filter-type"
              label="Loại việc"
              value={type}
              onChange={(e) => { setType(e.target.value); setPage(1); }}
            >
              <option value="">Tất cả loại</option>
              {Object.entries(JOB_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
            <Select
              id="filter-area"
              label="Khu vực"
              value={area}
              onChange={(e) => { setArea(e.target.value); setPage(1); }}
            >
              <option value="">Tất cả khu vực</option>
              {AREAS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </Select>
            <div className="flex flex-col gap-1">
              <p className="label">Tùy chọn</p>
              <label className="flex items-center gap-2 cursor-pointer mt-2">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => { setVerifiedOnly(e.target.checked); setPage(1); }}
                  className="w-4 h-4 accent-green-main"
                />
                <span className="text-sm text-text-main">Chỉ nhà tuyển dụng đã xác thực</span>
              </label>
            </div>
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="mt-4 flex items-center gap-1.5 text-sm text-red-500 hover:underline">
              <X className="w-4 h-4" /> Xóa bộ lọc
            </button>
          )}
        </div>
      )}

      {/* Active filter badges */}
      {hasFilters && (
        <div className="flex flex-wrap gap-2 mb-4">
          {search && <FilterTag label={`Tìm: "${search}"`} onRemove={() => setSearch('')} />}
          {type && <FilterTag label={JOB_TYPE_LABELS[type]} onRemove={() => setType('')} />}
          {area && <FilterTag label={AREAS.find((a) => a.value === area)?.label} onRemove={() => setArea('')} />}
          {verifiedOnly && <FilterTag label="Đã xác thực" onRemove={() => setVerifiedOnly(false)} />}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <LoadingPage />
      ) : error ? (
        <ErrorAlert message={error} onRetry={run} />
      ) : paginated.length === 0 ? (
        <EmptyState
          icon={<Search className="w-10 h-10" />}
          title="Không tìm thấy việc phù hợp"
          description="Thử điều chỉnh bộ lọc hoặc tìm kiếm với từ khóa khác."
          action={hasFilters && (
            <button onClick={clearFilters} className="btn-outline btn btn-sm">Xóa bộ lọc</button>
          )}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {paginated.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                isSaved={savedJobIds.has(job.id)}
                onSave={isAuthenticated ? handleSave : undefined}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-sm btn-outline"
              >
                ← Trước
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={clsx('w-9 h-9 rounded-xl text-sm font-medium transition-all', p === page ? 'bg-green-main text-white' : 'hover:bg-green-50 text-text-muted')}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn btn-sm btn-outline"
              >
                Tiếp →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilterTag({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-light text-green-dark rounded-full text-xs font-medium">
      {label}
      <button onClick={onRemove} aria-label="Xóa bộ lọc" className="hover:opacity-70">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
