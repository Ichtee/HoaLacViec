import { lazy, Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useMediaQuery } from '@/hooks/useMediaQuery.js';
import { Search, SlidersHorizontal, X, Map, List, Loader2, MapPin } from 'lucide-react';
import { clsx } from 'clsx';
import { JobRow } from '@/components/JobRow.jsx';
const JobMap = lazy(() => import('@/components/JobMap.jsx').then((m) => ({ default: m.JobMap })));
import { EmptyState, LoadingPage, ErrorAlert } from '@/components/Feedback.jsx';
import { Select } from '@/components/Form.jsx';
import { useAsync, useDebounce, useGeolocation } from '@/hooks';
import { getJobs, toggleSaveJob, getSavedJobs, apiVietmapMatrix, geocodeAddress } from '@/services';
import { useAuth } from '@/hooks/useAuth.jsx';
import { JOB_TYPE_LABELS, AREAS } from '@/constants';
import { getJobDistanceTarget, isCoarseLocation, pinFeatured } from '@/utils/jobLocation.js';
import { haversineDistance, isValidCoordinate } from '@/utils';

const PAGE_SIZE = 20;

export default function JobListPage() {
  const [params] = useSearchParams();
  const { isAuthenticated } = useAuth();

  const [search, setSearch] = useState(params.get('search') || '');
  const [type, setType] = useState(params.get('type') || '');
  const [area, setArea] = useState(params.get('area') || '');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [sort, setSort] = useState('newest'); // Default sort: Mới nhất
  // Desktop opens with the map next to the list (like a map search); phones start with the list.
  const [viewMode, setViewMode] = useState(() => (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches ? 'map' : 'list'));
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  // Inside the student layout the sidebar already takes width, so filters stay in the "Bộ lọc" panel.
  const inLayout = useLocation().pathname.startsWith('/student');
  const [page, setPage] = useState(1);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [savedJobIds, setSavedJobIds] = useState(new Set());
  const [minSalary, setMinSalary] = useState(''); // in VND/hour
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [matrixDistances, setMatrixDistances] = useState({});
  const [matrixStatus, setMatrixStatus] = useState('idle');
  const [geocodedMapLocations, setGeocodedMapLocations] = useState({});
  const geocodeAttemptedRef = useRef(new Set());

  useEffect(() => {
    setSearch(params.get('search') || '');
    setType(params.get('type') || '');
    setArea(params.get('area') || '');
  }, [params]);

  // Standardized Geolocation Hook — never prompts automatically on mount!
  const {
    status: geoStatus,
    coords: geoCoords,
    requestLocation: requestGpsLocation,
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

  // Location is read from global LocationContext (bootstrapped at App root)
  // No auto-request on mount to avoid duplicate prompt (Requirement 9)

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
    () => {
      const queryParams = {
        public: true,
        limit: 200,
      };
      if (dSearch) queryParams.search = dSearch;
      if (type) queryParams.type = type;
      if (area) queryParams.area = area;
      if (verifiedOnly) queryParams.verified = 'true';
      if (featuredOnly) queryParams.featured = 'true';
      if (minSalary && Number(minSalary) > 0) queryParams.minSalary = minSalary;
      if (sort && sort !== 'nearest') queryParams.sort = sort;

      return getJobs(queryParams);
    },
    [dSearch, type, area, verifiedOnly, featuredOnly, minSalary, sort],
    { initialData: [] }
  );

  const allJobs = useMemo(() => {
    if (Array.isArray(jobData)) return jobData;
    return jobData?.items || jobData?.jobs || [];
  }, [jobData]);

  // Older jobs may only contain a text address. Resolve a non-persistent,
  // approximate map position so they can still be displayed as amber markers.
  // Attendance and directions continue to require the stored confirmed location.
  useEffect(() => {
    // /jobs/geocode is login-only (rate-limited map quota); anonymous visitors keep approx coords from the server.
    if (!isAuthenticated) return undefined;
    let active = true;
    const unresolvedJobs = allJobs.filter((job) => {
      const id = String(job._id || job.id);
      const lat = job.location?.lat ?? job.geoPoint?.coordinates?.[1];
      const lng = job.location?.lng ?? job.geoPoint?.coordinates?.[0];
      return !isValidCoordinate(lat, lng) && !isValidCoordinate(job.approxLocation?.lat, job.approxLocation?.lng) && job.address && !geocodeAttemptedRef.current.has(id);
    });

    async function resolveMissingMapLocations() {
      for (const job of unresolvedJobs) {
        if (!active) return;
        const id = String(job._id || job.id);
        geocodeAttemptedRef.current.add(id);
        try {
          const result = await geocodeAddress(job.address);
          if (active && result?.success && isValidCoordinate(result.lat, result.lng)) {
            setGeocodedMapLocations(previous => ({
              ...previous,
              [id]: {
                lat: Number(result.lat),
                lng: Number(result.lng),
                formattedAddress: result.formattedAddress || result.displayName || job.address,
              },
            }));
          }
        } catch {
          // The job remains in the list and can be pinned manually by its owner.
        }
      }
    }

    resolveMissingMapLocations();
    return () => { active = false; };
  }, [allJobs, isAuthenticated]);

  const distanceTargets = useMemo(() => {
    const targets = {};
    for (const job of allJobs || []) {
      const id = String(job._id || job.id);
      const target = getJobDistanceTarget({ ...job, mapDisplayLocation: geocodedMapLocations[id] });
      if (target) targets[id] = target;
    }
    return targets;
  }, [allJobs, geocodedMapLocations]);

  const matrixDestinations = useMemo(
    () => Object.entries(distanceTargets).map(([id, t]) => ({ id, lat: t.lat, lng: t.lng })),
    [distanceTargets]
  );
  const coarseUserLocation = isCoarseLocation(userLocation);

  useEffect(() => {
    if (!isAuthenticated || !userLocation || matrixDestinations.length === 0) {
      setMatrixDistances({});
      setMatrixStatus('idle');
      return undefined;
    }

    let active = true;
    const controller = new AbortController();
    setMatrixDistances({});
    setMatrixStatus('loading');

    apiVietmapMatrix({
      origin: { lat: userLocation.lat, lng: userLocation.lng },
      destinations: matrixDestinations,
      vehicle: 'motorcycle',
    }, controller.signal)
      .then((result) => {
        if (!active) return;
        const nextDistances = {};
        (result?.entries || []).forEach((entry) => {
          if (Number.isFinite(entry.distanceMeters) && entry.distanceMeters >= 0) {
            nextDistances[String(entry.id)] = {
              distanceMeters: entry.distanceMeters,
              durationSeconds: Number.isFinite(entry.durationSeconds) ? entry.durationSeconds : null,
            };
          }
        });
        setMatrixDistances(nextDistances);
        setMatrixStatus('success');
      })
      .catch(() => {
        if (!active) return;
        setMatrixDistances({});
        setMatrixStatus('error');
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [isAuthenticated, userLocation, matrixDestinations]);

  // Load saved job ids
  useEffect(() => {
    if (!isAuthenticated) return;
    getSavedJobs().then((jobs) => {
      setSavedJobIds(new Set(jobs.map((j) => j._id || j.id)));
    }).catch(() => {});
  }, [isAuthenticated]);

  // Prefer Vietmap Matrix road distance. Haversine remains a resilient fallback.
  const jobsWithDistance = useMemo(() => {
    return (allJobs || []).map((job) => {
      let distanceMeters = null;
      let distanceKm = null;
      let distanceSource = null;
      let durationSeconds = null;
      const target = distanceTargets[String(job._id || job.id)];
      if (userLocation && target) {
        distanceMeters = haversineDistance(userLocation.lat, userLocation.lng, target.lat, target.lng);
        distanceSource = 'haversine';
        const matrixEntry = matrixDistances[String(job._id || job.id)];
        if (Number.isFinite(matrixEntry?.distanceMeters)) {
          distanceMeters = matrixEntry.distanceMeters;
          durationSeconds = matrixEntry.durationSeconds;
          distanceSource = 'vietmap_matrix';
        }
        if (distanceMeters !== null) {
          distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;
        }
      }
      return {
        ...job,
        distanceMeters,
        distanceKm,
        distanceSource,
        durationSeconds,
        distanceApproximate: distanceMeters !== null && (Boolean(target?.approximate) || coarseUserLocation),
      };
    });
  }, [allJobs, userLocation, matrixDistances, distanceTargets, coarseUserLocation]);

  // Filter jobs by minimum salary & featuredOnly
  const filtered = jobsWithDistance.filter((j) => {
    if (minSalary && (j.salaryUnit !== 'hour' || (j.salaryAmount || 0) < Number(minSalary))) return false;
    if (featuredOnly && !j.featured) return false;
    return true;
  });

  // Sort
  const ordered = [...filtered].sort((a, b) => {
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
  // Featured jobs are pinned only under the default order; an explicit distance/salary/date sort is respected.
  const sorted = ['newest', 'rating', 'featured'].includes(sort) ? pinFeatured(ordered) : ordered;

  const jobsForMap = useMemo(() => sorted.map((job) => {
    const id = String(job._id || job.id);
    const approximateLocation = geocodedMapLocations[id];
    return approximateLocation
      ? { ...job, mapDisplayLocation: approximateLocation }
      : job;
  }), [sorted, geocodedMapLocations]);

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

  const renderMap = (mapClassName) => (
      <Suspense fallback={<div className="h-[300px] rounded-2xl bg-stone-100 animate-pulse" />}>
      <JobMap
        jobs={jobsForMap}
        userLocation={userLocation}
        selectedJobId={selectedJobId}
        onSelectJob={(j) => {
          if (!j) {
            setSelectedJobId(null);
            return;
          }
          const id = j._id || j.id;
          setSelectedJobId(id);
          const el = document.getElementById(`job-card-${id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }}
                      className={mapClassName}
      />
      </Suspense>
    );

  const filterPanel = (
    <div className="space-y-5 text-sm">
      <label className="block sm:hidden">
        <span className="block font-bold text-text-main mb-2">Khu vực</span>
        <select value={area} onChange={(e) => { setArea(e.target.value); setPage(1); }} className="w-full h-11 px-3 rounded-xl border border-stone-300 bg-white">
          <option value="">Tất cả khu vực</option>
          {AREAS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <fieldset>
        <legend className="font-bold text-text-main mb-2">Hình thức</legend>
        {[{ value: '', label: 'Tất cả' }, ...Object.entries(JOB_TYPE_LABELS).map(([value, label]) => ({ value, label }))].map((opt) => (
          <label key={opt.value || 'all'} className="flex items-center gap-2 py-1.5 cursor-pointer">
            <input type="radio" name="filter-type" checked={type === opt.value} onChange={() => { setType(opt.value); setPage(1); }} className="w-4 h-4 accent-green-main" />
            {opt.label}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend className="font-bold text-text-main mb-2">Mức lương theo giờ</legend>
        {[['', 'Tất cả'], ['20000', 'Từ 20.000đ'], ['25000', 'Từ 25.000đ'], ['30000', 'Từ 30.000đ'], ['35000', 'Từ 35.000đ']].map(([value, label]) => (
          <label key={value || 'all'} className="flex items-center gap-2 py-1.5 cursor-pointer">
            <input type="radio" name="filter-salary" checked={minSalary === value} onChange={() => { setMinSalary(value); setPage(1); }} className="w-4 h-4 accent-green-main" />
            {label}
          </label>
        ))}
      </fieldset>
      <fieldset className="space-y-1">
        <legend className="font-bold text-text-main mb-2">Khác</legend>
        <label className="flex items-center gap-2 py-1.5 cursor-pointer">
          <input type="checkbox" checked={verifiedOnly} onChange={(e) => { setVerifiedOnly(e.target.checked); setPage(1); }} className="w-4 h-4 accent-green-main rounded" />
          Cửa hàng đã xác thực
        </label>
        <label className="flex items-center gap-2 py-1.5 cursor-pointer">
          <input type="checkbox" checked={featuredOnly} onChange={(e) => { setFeaturedOnly(e.target.checked); setPage(1); }} className="w-4 h-4 accent-green-main rounded" />
          Chỉ việc nổi bật
        </label>
      </fieldset>
      {hasFilters && (
        <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 text-xs font-bold text-red-700 hover:underline">
          <X className="w-3.5 h-3.5" /> Xóa bộ lọc
        </button>
      )}
    </div>
  );

  return (
    <div className="pb-10">
      {/* Dải tìm kiếm */}
      <div className={clsx('bg-green-dark', inLayout && 'rounded-2xl mb-4')}>
        <form
          role="search"
          onSubmit={(e) => { e.preventDefault(); setPage(1); }}
          className={clsx('mx-auto flex gap-2 py-3 sm:py-4', inLayout ? 'px-3 sm:px-4' : 'max-w-6xl px-4 sm:px-6')}
        >
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <input
              id="job-search"
              aria-label="Tìm việc"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Tên việc, quán cà phê, siêu thị..."
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-white/70"
            />
          </div>
          <select
            aria-label="Khu vực"
            value={area}
            onChange={(e) => { setArea(e.target.value); setPage(1); }}
            className="hidden sm:block h-11 sm:w-52 px-3 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-white/70"
          >
            <option value="">Tất cả khu vực</option>
            {AREAS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <button type="submit" className="hidden sm:block h-11 px-6 rounded-xl bg-white text-green-dark font-bold text-sm hover:bg-green-50">
            Tìm kiếm
          </button>
        </form>
      </div>

      <div className={clsx(!inLayout && 'mx-auto px-4 sm:px-6 pt-5', !inLayout && (viewMode === 'map' ? 'max-w-7xl' : 'max-w-6xl'))}>
        <div className="mb-4">
          <h1 className="text-lg sm:text-xl font-bold text-text-main">
            Việc làm quanh Hòa Lạc <span className="text-green-dark">({sorted.length})</span>
          </h1>
          <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1.5">
            {userLocation ? (
              <>Khoảng cách tính từ vị trí của bạn{matrixStatus === 'success' ? ' (quãng đường xe máy)' : ''}</>
            ) : geoStatus === 'requesting' ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang lấy vị trí...</>
            ) : (
              <button type="button" onClick={handleTriggerGps} className="text-green-dark font-semibold hover:underline inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Bật vị trí để xem khoảng cách
              </button>
            )}
          </p>
        </div>

        {coarseUserLocation && (
          <div role="status" className="mb-4 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-start gap-2">
            <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Vị trí của bạn đang được ước tính với sai số khoảng ±{(Number(userLocation.accuracy) / 1000).toFixed(1)} km, nên khoảng cách chỉ mang tính tham khảo.
            </span>
          </div>
        )}

        <div className={clsx(
          'items-start lg:grid lg:gap-6',
          viewMode === 'map' && isDesktop
            ? (inLayout ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_minmax(0,1fr)]')
            : (inLayout ? 'lg:grid-cols-1' : 'lg:grid-cols-[240px_minmax(0,1fr)]')
        )}>
          {!inLayout && (
            <aside className={clsx('hidden sticky top-20 bg-white rounded-2xl border border-stone-200 p-4', viewMode === 'map' ? 'xl:block' : 'lg:block')} aria-label="Bộ lọc">
              {filterPanel}
            </aside>
          )}

          <section className="min-w-0 space-y-3" aria-label="Kết quả tìm việc">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFiltersOpen(!filtersOpen)}
                aria-expanded={filtersOpen}
                className={clsx(
                  'shrink-0 whitespace-nowrap h-10 px-3.5 rounded-xl border text-sm font-medium flex items-center gap-2',
                  !inLayout && (viewMode === 'map' ? 'xl:hidden' : 'lg:hidden'),
                  hasFilters ? 'bg-green-50 border-green-main text-green-dark' : 'border-stone-300 bg-white text-text-main'
                )}
              >
                <SlidersHorizontal className="w-4 h-4" /> Bộ lọc
              </button>
              <div className="flex items-center gap-2 ml-auto min-w-0">
                <label htmlFor="sort-select" className="text-sm text-text-muted hidden 2xl:inline whitespace-nowrap">Sắp xếp theo</label>
                <Select
                  id="sort-select"
                  value={sort}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="!h-10 !py-0 !rounded-xl !border-stone-300 sm:min-w-[150px]"
                >
                  <option value="newest">Mới nhất</option>
                  <option value="nearest">Gần tôi nhất</option>
                  <option value="salary_desc">Lương cao nhất</option>
                  <option value="rating">Đánh giá cao nhất</option>
                  <option value="salary_asc">Lương thấp đến cao</option>
                  <option value="oldest">Cũ nhất</option>
                </Select>
                <div className="flex bg-stone-100 p-0.5 rounded-xl border border-stone-200" role="group" aria-label="Chế độ xem">
                  {[['list', List, 'Danh sách'], ['map', Map, 'Bản đồ']].map(([mode, Icon, label]) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={viewMode === mode}
                      aria-label={label}
                      onClick={() => setViewMode(mode)}
                      className={clsx(
                        'h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap',
                        viewMode === mode ? 'bg-white text-text-main shadow-xs' : 'text-text-muted hover:text-text-main'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" /> <span className="hidden 2xl:inline whitespace-nowrap">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {filtersOpen && (
              <div className={clsx('bg-white rounded-2xl border border-stone-200 p-4', !inLayout && (viewMode === 'map' ? 'xl:hidden' : 'lg:hidden'))}>{filterPanel}</div>
            )}

            {viewMode === 'map' && !isDesktop && renderMap('w-full h-[320px] sm:h-[420px] rounded-2xl overflow-hidden border border-stone-200')}

            {loading && allJobs.length === 0 ? (
              <LoadingPage />
            ) : error && allJobs.length === 0 ? (
              <ErrorAlert message={error} onRetry={run} />
            ) : sorted.length === 0 ? (
              <EmptyState
                icon={<Search className="w-10 h-10" />}
                title="Không tìm thấy việc phù hợp"
                description="Thử đổi từ khóa hoặc xóa bớt bộ lọc."
                action={hasFilters && (
                  <button onClick={clearFilters} className="btn-outline btn btn-sm">Xóa bộ lọc</button>
                )}
              />
            ) : (
              <>
                <ul className={clsx('space-y-3', loading && 'opacity-60')}>
                  {paginated.map((job) => (
                    <li
                      key={job._id || job.id}
                      id={`job-card-${job._id || job.id}`}
                      onMouseEnter={() => setSelectedJobId(job._id || job.id)}
                      className="scroll-mt-24"
                    >
                      <JobRow
                        job={job}
                        isSelected={viewMode === 'map' && String(selectedJobId) === String(job._id || job.id)}
                        isSaved={savedJobIds.has(job._id || job.id)}
                        onSave={isAuthenticated ? handleSave : undefined}
                      />
                    </li>
                  ))}
                </ul>

                {totalPages > 1 && (
                  <nav className="flex items-center justify-center gap-2 pt-4" aria-label="Phân trang">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-sm btn-outline">← Trước</button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        aria-current={p === page ? 'page' : undefined}
                        className={clsx('w-10 h-10 rounded-xl text-sm font-medium', p === page ? 'bg-green-main text-white' : 'hover:bg-stone-100 text-text-muted')}
                      >
                        {p}
                      </button>
                    ))}
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-sm btn-outline">Tiếp →</button>
                  </nav>
                )}
              </>
            )}
          </section>

          {viewMode === 'map' && isDesktop && (
            <aside className="sticky top-20 h-[calc(100vh-6rem)] min-w-0" aria-label="Bản đồ việc làm">
              {renderMap('w-full h-full rounded-2xl overflow-hidden border border-stone-200')}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
