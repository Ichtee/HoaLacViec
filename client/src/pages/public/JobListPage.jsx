import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X, ChevronDown, Map, List, Navigation, MapPin, Compass, Loader2, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { JobCard } from '@/components/JobCard.jsx';
import { JobMap } from '@/components/JobMap.jsx';
import { EmptyState, LoadingPage, ErrorAlert } from '@/components/Feedback.jsx';
import { Select } from '@/components/Form.jsx';
import { useAsync, useDebounce, useGeolocation } from '@/hooks';
import { getJobs, toggleSaveJob, isSavedJob, getSavedJobs } from '@/services';
import { useAuth } from '@/hooks/useAuth.jsx';
import { JOB_TYPES, JOB_TYPE_LABELS, AREAS } from '@/constants';
import { haversineDistance, isValidCoordinate } from '@/utils';

const PAGE_SIZE = 9;

export default function JobListPage() {
  const [params, setParams] = useSearchParams();
  const { isAuthenticated } = useAuth();

  const [search, setSearch] = useState(params.get('search') || '');
  const [type, setType] = useState(params.get('type') || '');
  const [area, setArea] = useState(params.get('area') || '');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);
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

  // Standardized Geolocation Hook — never prompts automatically on mount!
  const {
    status: geoStatus,
    coords: geoCoords,
    error: geoError,
    requestLocation: requestGpsLocation,
    clearLocation: clearGpsLocation,
  } = useGeolocation();

  const userLocation = useMemo(() => {
    if (geoCoords && isValidCoordinate(geoCoords.lat, geoCoords.lng)) {
      return {
        lat: geoCoords.lat,
        lng: geoCoords.lng,
        accuracy: geoCoords.accuracy,
        label: `Vị trí GPS của bạn (±${geoCoords.accuracy}m)`,
      };
    }
    return null;
  }, [geoCoords]);

  async function handleTriggerGps() {
    if (geoStatus === 'denied') {
      alert('Trình duyệt đang chặn quyền vị trí đối với trang web này.\n\nCách bật lại:\n1. Nhấp vào biểu tượng ổ khóa 🔒 (hoặc biểu tượng điều chỉnh) bên trái thanh địa chỉ URL của trình duyệt.\n2. Chọn Vị trí (Location) -> Cho phép (Allow) hoặc "Đặt lại quyền" (Reset permissions).\n3. Tải lại trang (F5).');
      return;
    }
    const res = await requestGpsLocation({ enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    if (!res && geoStatus === 'denied') {
      alert('Trình duyệt đang chặn quyền vị trí đối với trang web này.\n\nCách bật lại:\n1. Nhấp vào biểu tượng ổ khóa 🔒 bên trái thanh địa chỉ URL.\n2. Chọn Vị trí (Location) -> Cho phép (Allow).\n3. Tải lại trang (F5).');
    }
  }

  function handleSortChange(newSort) {
    setSort(newSort);
    setPage(1);
    if (newSort === 'nearest' && !userLocation) {
      handleTriggerGps();
    }
  }

  const dSearch = useDebounce(search, 350);

  const { data: jobData, loading, error, run } = useAsync(
    () => getJobs({
      public: true,
      search: dSearch,
      type,
      area,
      verified: verifiedOnly || undefined,
      featured: featuredOnly ? 'true' : undefined,
      minSalary: minSalary || undefined,
      limit: 100,
      sort: sort !== 'nearest' ? sort : undefined,
    }),
    [dSearch, type, area, verifiedOnly, featuredOnly, minSalary, sort],
    { initialData: [] }
  );

  const allJobs = useMemo(() => {
    if (Array.isArray(jobData)) return jobData;
    return jobData?.items || jobData?.jobs || [];
  }, [jobData]);

  // Load saved job ids
  useEffect(() => {
    if (!isAuthenticated) return;
    getSavedJobs().then((jobs) => {
      setSavedJobIds(new Set(jobs.map((j) => j._id || j.id)));
    }).catch(() => {});
  }, [isAuthenticated]);

  // Compute real client-side distance without leaking user coordinates to the server
  const jobsWithDistance = useMemo(() => {
    return (allJobs || []).map((job) => {
      let distanceMeters = null;
      let distanceKm = null;
      if (userLocation && isValidCoordinate(job.location?.lat, job.location?.lng)) {
        distanceMeters = haversineDistance(
          userLocation.lat,
          userLocation.lng,
          job.location.lat,
          job.location.lng
        );
        if (distanceMeters !== null) {
          distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;
        }
      }
      return {
        ...job,
        distanceMeters,
        distanceKm,
      };
    });
  }, [allJobs, userLocation]);

  // Filter jobs by minimum salary & featuredOnly
  const filtered = jobsWithDistance.filter((j) => {
    if (minSalary && (j.salaryAmount || 0) < Number(minSalary)) return false;
    if (featuredOnly && !j.featured) return false;
    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'nearest') {
      if (a.distanceMeters !== null && b.distanceMeters !== null) {
        return a.distanceMeters - b.distanceMeters;
      }
      if (a.distanceMeters !== null) return -1;
      if (b.distanceMeters !== null) return 1;
      return 0;
    }
    if (sort === 'salary_desc') return (b.salaryAmount || 0) - (a.salaryAmount || 0);
    if (sort === 'salary_asc') return (a.salaryAmount || 0) - (b.salaryAmount || 0);
    if (sort === 'rating') {
      const rateB = b.rating || b.employer?.rating || 0;
      const rateA = a.rating || a.employer?.rating || 0;
      return rateB - rateA;
    }
    if (sort === 'featured') {
      if (Boolean(b.featured) !== Boolean(a.featured)) {
        return b.featured ? 1 : -1;
      }
      return new Date(b.createdAt || b.postedAt || 0) - new Date(a.createdAt || a.postedAt || 0);
    }
    if (sort === 'oldest') {
      return new Date(a.createdAt || a.postedAt || 0) - new Date(b.createdAt || b.postedAt || 0);
    }
    // Default newest
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
    const wasSaved = savedJobIds.has(jobId);
    // Optimistic update
    setSavedJobIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(jobId);
      else next.add(jobId);
      return next;
    });

    try {
      const result = await toggleSaveJob(jobId);
      setSavedJobIds((prev) => {
        const next = new Set(prev);
        if (result.saved) next.add(jobId);
        else next.delete(jobId);
        return next;
      });
    } catch (err) {
      // Rollback on failure
      setSavedJobIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(jobId);
        else next.delete(jobId);
        return next;
      });
      alert(err.message || 'Không thể lưu công việc. Vui lòng thử lại.');
    }
  }

  function clearFilters() {
    setSearch('');
    setType('');
    setArea('');
    setVerifiedOnly(false);
    setFeaturedOnly(false);
    setMinSalary('');
    setSort('newest');
    setPage(1);
  }

  const hasFilters = Boolean(search || type || area || verifiedOnly || featuredOnly || minSalary || sort !== 'newest');

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
            <Compass className={clsx('w-4 h-4', geoStatus === 'requesting' && 'animate-spin')} />
          </div>
          <div>
            <div className="font-bold text-text-main flex flex-wrap items-center gap-1.5">
              <span>Định vị vị trí của bạn:</span>
              {userLocation ? (
                <span className="text-blue-600 font-semibold text-[11px] bg-blue-50 px-2 py-0.5 rounded-md">
                  ✓ Đã nhận diện tọa độ thiết bị (sai số ±{geoCoords?.accuracy || 0}m)
                </span>
              ) : geoStatus === 'requesting' ? (
                <span className="text-amber-600 font-semibold text-[11px] bg-amber-50 px-2 py-0.5 rounded-md animate-pulse">
                  ⏳ Đang xin tọa độ GPS từ thiết bị...
                </span>
              ) : geoStatus === 'denied' ? (
                <span className="text-red-500 font-semibold text-[11px] bg-red-50 px-2 py-0.5 rounded-md">
                  Đã từ chối quyền vị trí
                </span>
              ) : geoStatus === 'insecure' ? (
                <span className="text-red-500 font-semibold text-[11px] bg-red-50 px-2 py-0.5 rounded-md">
                  Trình duyệt yêu cầu kết nối HTTPS để dùng GPS
                </span>
              ) : geoStatus === 'low_accuracy' ? (
                <span className="text-amber-600 font-semibold text-[11px] bg-amber-50 px-2 py-0.5 rounded-md">
                  Độ chính xác GPS thấp ({geoCoords?.accuracy}m)
                </span>
              ) : geoStatus === 'timeout' || geoStatus === 'unavailable' ? (
                <span className="text-amber-600 font-semibold text-[11px] bg-amber-50 px-2 py-0.5 rounded-md">
                  Không lấy được tín hiệu GPS
                </span>
              ) : (
                <span className="text-text-muted font-normal text-[11px] bg-gray-100 px-2 py-0.5 rounded-md">
                  Chưa kích hoạt GPS
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-muted mt-0.5">
              {userLocation
                ? `Tọa độ thiết bị: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)} • Đã tính khoảng cách thực tế tới các việc làm`
                : geoError
                ? geoError
                : 'Bật vị trí thiết bị để tự động tính khoảng cách và sắp xếp việc làm gần bạn nhất.'}
            </p>
          </div>
        </div>

        <button
          onClick={handleTriggerGps}
          disabled={geoStatus === 'requesting'}
          className="self-start sm:self-center inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-colors border border-blue-100 shrink-0 disabled:opacity-50"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>{userLocation ? 'Cập nhật lại GPS' : 'Kích hoạt định vị'}</span>
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
          onChange={(e) => handleSortChange(e.target.value)}
          className="w-auto min-w-[190px]"
        >
          <option value="newest">🕒 Mới nhất</option>
          <option value="nearest">📍 Gần tôi nhất</option>
          <option value="featured">⭐ Việc nổi bật</option>
          <option value="rating">🌟 Đánh giá cao nhất</option>
          <option value="salary_desc">💰 Lương cao nhất</option>
          <option value="salary_asc">💵 Lương thấp đến cao</option>
          <option value="oldest">⏳ Cũ nhất</option>
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

            <div className="flex flex-col sm:flex-row gap-2">
              <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-2xl bg-cream/70 hover:bg-green-50 border border-green-100 transition-colors flex-1">
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
                  🛡️ Quán xác thực
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-2xl bg-cream/70 hover:bg-pink-50 border border-pink-100 transition-colors flex-1">
                <input
                  type="checkbox"
                  checked={featuredOnly}
                  onChange={(e) => {
                    setFeaturedOnly(e.target.checked);
                    setPage(1);
                  }}
                  className="w-4 h-4 accent-pink-600 rounded"
                />
                <span className="text-xs font-bold text-text-main select-none">
                  ⭐ Việc nổi bật
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
        <div className="space-y-3">
          {!userLocation && (
            <div className={clsx(
              'flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 rounded-2xl border text-xs shadow-sm transition-all',
              geoStatus === 'denied'
                ? 'bg-rose-50/90 border-rose-200 text-rose-900'
                : geoStatus === 'timeout' || geoStatus === 'unavailable'
                ? 'bg-amber-50/90 border-amber-200 text-amber-900'
                : 'bg-amber-50/80 border-amber-200 text-amber-900'
            )}>
              <div className="flex items-start sm:items-center gap-2.5">
                <span className="text-base shrink-0">
                  {geoStatus === 'denied' ? '🚫' : geoStatus === 'timeout' || geoStatus === 'unavailable' ? '⚠️' : '🗺️'}
                </span>
                <div>
                  {geoStatus === 'denied' ? (
                    <div>
                      <strong className="text-rose-800">Trình duyệt đang chặn quyền truy cập vị trí.</strong>
                      <p className="text-[11px] text-rose-700 mt-0.5">
                        Để bật: Nhấp biểu tượng ổ khóa 🔒 (hoặc biểu tượng điều chỉnh) bên trái thanh URL &gt; Chọn <strong>Cho phép (Allow)</strong> vị trí.
                      </p>
                    </div>
                  ) : geoStatus === 'timeout' || geoStatus === 'unavailable' ? (
                    <div>
                      <strong className="text-amber-800">Không bắt được tín hiệu GPS từ thiết bị.</strong>
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        {geoError || 'Hãy kiểm tra Dịch vụ vị trí (Location Services) trên điện thoại / máy tính của bạn.'}
                      </p>
                    </div>
                  ) : (
                    <span>
                      <strong>Bản đồ đang lấy tâm khu vực Hòa Lạc</strong> (đây là tâm bản đồ chung, chưa phải vị trí GPS của bạn).
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={handleTriggerGps}
                disabled={geoStatus === 'requesting'}
                className={clsx(
                  'self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white font-bold text-[11px] shadow-sm transition-all shrink-0',
                  geoStatus === 'denied'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-amber-600 hover:bg-amber-700 disabled:opacity-50'
                )}
              >
                {geoStatus === 'requesting' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang định vị...</span>
                  </>
                ) : geoStatus === 'denied' ? (
                  <>
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Hướng dẫn mở quyền</span>
                  </>
                ) : (
                  <>
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Bật vị trí thiết bị</span>
                  </>
                )}
              </button>
            </div>
          )}

          <JobMap
            jobs={sorted}
            userLocation={userLocation}
            selectedJobId={selectedJobId}
            onSelectJob={(j) => setSelectedJobId(j._id || j.id)}
            height="460px"
          />
        </div>
      )}

      {/* Results Header */}
      <div className="flex items-center justify-between pt-2">
        <h3 className="font-bold text-sm text-text-main flex items-center gap-2">
          <span>Danh sách công việc {userLocation ? `(Đã tính khoảng cách thực tế từ vị trí của bạn)` : ''}</span>
          {loading && <Loader2 className="w-4 h-4 text-green-main animate-spin" />}
        </h3>
      </div>

      {/* Results Grid */}
      {loading && allJobs.length === 0 ? (
        <LoadingPage />
      ) : error && allJobs.length === 0 ? (
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
          <div className={clsx(
            "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 transition-opacity duration-150",
            loading && "opacity-60"
          )}>
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
