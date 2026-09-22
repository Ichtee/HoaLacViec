import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X, ChevronDown, Map, List, Navigation, MapPin, Compass } from 'lucide-react';
import { clsx } from 'clsx';
import { JobCard } from '@/components/JobCard.jsx';
import { JobMap } from '@/components/JobMap.jsx';
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
  const [sort, setSort] = useState('newest'); // Default sort: Mới nhất
  const [viewMode, setViewMode] = useState('map'); // Default map view or list view
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [savedJobIds, setSavedJobIds] = useState(new Set());
  const [minSalary, setMinSalary] = useState(''); // in VND/hour
  const [selectedJobId, setSelectedJobId] = useState(null);

  useEffect(() => {
    setSearch(params.get('search') || '');
    setType(params.get('type') || '');
    setArea(params.get('area') || '');
  }, [params]);

  // GPS User Location State (No default preset location!)
  const [userLocation, setUserLocation] = useState(null);
  const [geoStatus, setGeoStatus] = useState('loading'); // 'loading' | 'granted' | 'denied' | 'unavailable'

  function requestUserLocation() {
    if (!navigator.geolocation) {
      setGeoStatus('unavailable');
      return;
    }
    setGeoStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation({
          lat: latitude,
          lng: longitude,
          label: 'Vị trí GPS thực tế của bạn',
        });
        setGeoStatus('granted');
      },
      (err) => {
        console.warn('Geolocation error / denied:', err);
        setGeoStatus('denied');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  // Request location immediately when entering the page
  useEffect(() => {
    requestUserLocation();
  }, []);

  const dSearch = useDebounce(search, 350);

  const { data: allJobs, loading, error, run } = useAsync(
    () => getJobs({ public: true, search: dSearch, type, area, verified: verifiedOnly || undefined, limit: 100, sort: 'newest' }),
    [dSearch, type, area, verifiedOnly],
    { initialData: [] }
  );

  // Load saved job ids
  useEffect(() => {
    if (!isAuthenticated || !profileId) return;
    getSavedJobs(profileId).then((jobs) => {
      setSavedJobIds(new Set(jobs.map((j) => j._id || j.id)));
    });
  }, [isAuthenticated, profileId]);

  // Filter jobs by minimum salary
  const filtered = (allJobs || []).filter((j) => {
    if (minSalary && (j.salaryAmount || 0) < Number(minSalary)) return false;
    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'salary_desc') return (b.salaryAmount || 0) - (a.salaryAmount || 0);
    const dateB = new Date(b.createdAt || b.postedAt || 0).getTime();
    const dateA = new Date(a.createdAt || a.postedAt || 0).getTime();
    return dateB - dateA;
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
    setSearch('');
    setType('');
    setArea('');
    setVerifiedOnly(false);
    setMinSalary('');
    setPage(1);
  }

  const hasFilters = Boolean(search || type || area || verifiedOnly || minSalary);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      {/* Page Header + View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-main flex items-center gap-2">
            Tìm việc quanh Hòa Lạc 📍
          </h1>
          <p className="text-text-muted text-xs sm:text-sm mt-1">
            {userLocation ? (
              <>Đang định vị quanh <strong className="text-blue-600">{userLocation.label}</strong> • </>
            ) : (
              <>Định vị theo GPS thực tế của bạn • </>
            )}
            {sorted.length} công việc có sẵn
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="flex bg-white p-1 rounded-2xl border border-green-100 shadow-sm">
            <button
              onClick={() => setViewMode('map')}
              className={clsx(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all',
                viewMode === 'map'
                  ? 'bg-green-main text-white shadow-sm'
                  : 'text-text-muted hover:text-green-dark'
              )}
            >
              <Map className="w-4 h-4" /> Bản đồ & Vị trí
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={clsx(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all',
                viewMode === 'list'
                  ? 'bg-green-main text-white shadow-sm'
                  : 'text-text-muted hover:text-green-dark'
              )}
            >
              <List className="w-4 h-4" /> Danh sách
            </button>
          </div>
        </div>
      </div>

      {/* GPS Location Status Bar */}
      <div className="p-3.5 sm:p-4 bg-white rounded-3xl border border-green-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-xs">
          <div className={clsx(
            'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm',
            userLocation ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
          )}>
            <Compass className={clsx('w-4 h-4', geoStatus === 'loading' && 'animate-spin')} />
          </div>
          <div>
            <p className="font-bold text-text-main flex items-center gap-1.5">
              <span>Định vị vị trí của bạn:</span>
              {userLocation ? (
                <span className="text-blue-600 font-semibold text-[11px] bg-blue-50 px-2 py-0.5 rounded-md">
                  ✓ Đã định vị chính xác qua GPS
                </span>
              ) : geoStatus === 'loading' ? (
                <span className="text-amber-600 font-semibold text-[11px] bg-amber-50 px-2 py-0.5 rounded-md animate-pulse">
                  ⏳ Đang tìm vị trí GPS...
                </span>
              ) : (
                <span className="text-red-500 font-semibold text-[11px] bg-red-50 px-2 py-0.5 rounded-md">
                  Chưa cấp quyền vị trí
                </span>
              )}
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">
              {userLocation
                ? `Tọa độ GPS: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`
                : 'Vui lòng cho phép quyền vị trí trên trình duyệt để kích hoạt bản đồ & tính khoảng cách'}
            </p>
          </div>
        </div>

        <button
          onClick={requestUserLocation}
          disabled={geoStatus === 'loading'}
          className="self-start sm:self-center inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-colors border border-blue-100 shrink-0"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>{userLocation ? 'Cập nhật lại GPS' : 'Cấp quyền vị trí'}</span>
        </button>
      </div>

      {/* Search + Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <input
            id="job-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm theo tên việc, quán cà phê, siêu thị..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-green-100 bg-white text-sm focus:outline-none focus:border-green-main focus:ring-2 focus:ring-green-main/20"
          />
        </div>

        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={clsx(
            'btn btn-md flex items-center gap-2 font-bold',
            filtersOpen || hasFilters ? 'btn-secondary' : 'btn-outline'
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Bộ lọc tìm kiếm
          {hasFilters && <span className="w-2 h-2 rounded-full bg-green-main ml-1" />}
        </button>

        <Select
          id="sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="w-auto min-w-[170px]"
        >
          <option value="newest">🕒 Mới nhất</option>
          <option value="salary_desc">💰 Lương cao nhất</option>
        </Select>
      </div>

      {/* Expanded Filters Panel */}
      {filtersOpen && (
        <div className="card mb-2 animate-fade-in bg-white border border-green-100 p-5 rounded-3xl shadow-card space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <Select
              id="filter-salary"
              label="Mức lương tối thiểu"
              value={minSalary}
              onChange={(e) => {
                setMinSalary(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả mức lương</option>
              <option value="20000">Từ 20.000đ/giờ</option>
              <option value="25000">Từ 25.000đ/giờ</option>
              <option value="30000">Từ 30.000đ/giờ</option>
              <option value="35000">Từ 35.000đ/giờ</option>
            </Select>

            <Select
              id="filter-type"
              label="Hình thức việc"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả hình thức</option>
              {Object.entries(JOB_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>

            <div className="flex flex-col gap-1 pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-2xl bg-cream/70 hover:bg-green-50 border border-green-100 transition-colors">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => {
                    setVerifiedOnly(e.target.checked);
                    setPage(1);
                  }}
                  className="w-4 h-4 accent-green-main rounded"
                />
                <span className="text-xs font-bold text-text-main select-none">
                  🛡️ Quán đã xác thực
                </span>
              </label>
            </div>
          </div>

          {hasFilters && (
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-text-muted">
                Đang áp dụng bộ lọc • Tìm thấy <strong className="text-green-dark">{sorted.length}</strong> công việc
              </span>
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-bold hover:underline"
              >
                <X className="w-3.5 h-3.5" /> Xóa tất cả bộ lọc
              </button>
            </div>
          )}
        </div>
      )}

      {/* MAP VIEW SECTION */}
      {viewMode === 'map' && (
        <div className="space-y-4">
          {userLocation ? (
            <JobMap
              jobs={sorted}
              userLocation={userLocation}
              onUserLocationChange={(newLoc) => setUserLocation(newLoc)}
              selectedJobId={selectedJobId}
              onSelectJob={(j) => setSelectedJobId(j._id || j.id)}
              height="460px"
            />
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-green-200 bg-white p-8 sm:p-12 text-center shadow-card space-y-4 animate-fade-in">
              <div className="w-16 h-16 rounded-3xl bg-pink-50 text-pink-main flex items-center justify-center mx-auto text-3xl shadow-sm animate-bounce">
                📍
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-base sm:text-lg font-bold text-text-main">
                  Cần quyền vị trí GPS để mở Bản đồ
                </h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  {geoStatus === 'loading'
                    ? 'Đang gửi yêu cầu vị trí GPS tới trình duyệt của bạn...'
                    : geoStatus === 'denied'
                    ? 'Bạn đã từ chối cấp quyền vị trí. Vui lòng nhấn vào biểu tượng Ổ khóa / Cài đặt trang web trên thanh địa chỉ, bật "Vị trí", rồi bấm thử lại bên dưới.'
                    : 'Bản đồ chỉ mở khi có vị trí thực tế của bạn để ghim tâm bản đồ và tính khoảng cách chính xác đến các quán xung quanh.'}
                </p>
              </div>
              <div>
                <button
                  onClick={requestUserLocation}
                  disabled={geoStatus === 'loading'}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-green-main hover:bg-green-dark text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  <Navigation className="w-4 h-4" />
                  <span>{geoStatus === 'loading' ? 'Đang lấy vị trí GPS...' : 'Cho phép vị trí & Xem bản đồ'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Header */}
      <div className="flex items-center justify-between pt-2">
        <h3 className="font-bold text-sm text-text-main">
          Danh sách công việc {userLocation ? `(Khoảng cách tính từ vị trí GPS của bạn)` : ''}
        </h3>
      </div>

      {/* Results Grid */}
      {loading ? (
        <LoadingPage />
      ) : error ? (
        <ErrorAlert message={error} onRetry={run} />
      ) : paginated.length === 0 ? (
        <EmptyState
          icon={<Search className="w-10 h-10" />}
          title="Không tìm thấy việc phù hợp"
          description="Thử mở rộng bán kính tìm kiếm hoặc xóa các bộ lọc."
          action={hasFilters && (
            <button onClick={clearFilters} className="btn-outline btn btn-sm">
              Xóa bộ lọc
            </button>
          )}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginated.map((job) => (
              <div
                key={job._id || job.id}
                onMouseEnter={() => setSelectedJobId(job._id || job.id)}
                className="transition-transform"
              >
                <JobCard
                  job={job}
                  isSaved={savedJobIds.has(job._id || job.id)}
                  onSave={isAuthenticated ? handleSave : undefined}
                />
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6">
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
                  className={clsx(
                    'w-9 h-9 rounded-xl text-sm font-medium transition-all',
                    p === page ? 'bg-green-main text-white' : 'hover:bg-green-50 text-text-muted'
                  )}
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
