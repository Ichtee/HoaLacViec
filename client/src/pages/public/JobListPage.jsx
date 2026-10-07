import { lazy, Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X, Map, List, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { clsx } from 'clsx';
import { JobCard } from '@/components/JobCard.jsx';
const JobMap = lazy(() => import('@/components/JobMap.jsx').then((m) => ({ default: m.JobMap })));
import { EmptyState, LoadingPage, ErrorAlert } from '@/components/Feedback.jsx';
import { Select } from '@/components/Form.jsx';
import { useAsync, useDebounce, useGeolocation } from '@/hooks';
import { getJobs, toggleSaveJob, getSavedJobs, apiVietmapMatrix, geocodeAddress } from '@/services';
import { useAuth } from '@/hooks/useAuth.jsx';
import { JOB_TYPE_LABELS, AREAS } from '@/constants';
import { haversineDistance, isValidCoordinate } from '@/utils';

const PAGE_SIZE = 12;

export default function JobListPage() {
  const [params] = useSearchParams();
  const { isAuthenticated } = useAuth();

  const [search, setSearch] = useState(params.get('search') || '');
  const [type, setType] = useState(params.get('type') || '');
  const [area, setArea] = useState(params.get('area') || '');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [sort, setSort] = useState('newest'); // Default sort: Mới nhất
  const [viewMode, setViewMode] = useState('map'); // Keep map visible by default on top
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 80);
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
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
    let active = true;
    const unresolvedJobs = allJobs.filter((job) => {
      const id = String(job._id || job.id);
      const lat = job.location?.lat ?? job.geoPoint?.coordinates?.[1];
      const lng = job.location?.lng ?? job.geoPoint?.coordinates?.[0];
      return !isValidCoordinate(lat, lng) && job.address && !geocodeAttemptedRef.current.has(id);
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
  }, [allJobs]);

  const matrixDestinations = useMemo(() => (allJobs || [])
    .filter((job) => job.locationStatus === 'confirmed' && isValidCoordinate(job.location?.lat, job.location?.lng))
    .map((job) => ({
      id: String(job._id || job.id),
      lat: Number(job.location.lat),
      lng: Number(job.location.lng),
    })), [allJobs]);

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
          if (Number.isFinite(entry.distanceMeters)) {
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
      if (
        userLocation &&
        job.locationStatus === 'confirmed' &&
        isValidCoordinate(job.location?.lat, job.location?.lng)
      ) {
        distanceMeters = haversineDistance(
          userLocation.lat,
          userLocation.lng,
          job.location.lat,
          job.location.lng
        );
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
      };
    });
  }, [allJobs, userLocation, matrixDistances]);

  // Filter jobs by minimum salary & featuredOnly
  const filtered = jobsWithDistance.filter((j) => {
    if (minSalary && (j.salaryUnit !== 'hour' || (j.salaryAmount || 0) < Number(minSalary))) return false;
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header + View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main tracking-tight">
            Tìm việc làm quanh Hòa Lạc
          </h1>
          <p className="text-text-muted text-xs sm:text-sm mt-0.5 flex items-center gap-1.5 flex-wrap">
            {userLocation ? (
              <span className="text-green-dark font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-main"></span>
                Đang định vị quanh {userLocation.label} • {sorted.length} công việc có sẵn
              </span>
            ) : geoStatus === 'requesting' ? (
              <span className="text-blue-700 font-medium flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Đang lấy tọa độ trình duyệt... • {sorted.length} việc làm
              </span>
            ) : (
              <span>Khu vực Hòa Lạc • {sorted.length} việc làm</span>
            )}
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/80">
            <button
              onClick={() => setViewMode('map')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors',
                viewMode === 'map'
                  ? 'bg-white text-text-main shadow-xs font-semibold'
                  : 'text-text-muted hover:text-text-main'
              )}
            >
              <Map className="w-3.5 h-3.5" /> Bản đồ
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors',
                viewMode === 'list'
                  ? 'bg-white text-text-main shadow-xs font-semibold'
                  : 'text-text-muted hover:text-text-main'
              )}
            >
              <List className="w-3.5 h-3.5" /> Danh sách
            </button>
          </div>
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            id="job-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm theo tên việc, quán cà phê, siêu thị..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm focus:outline-none focus:border-green-main focus:ring-1 focus:ring-green-main"
          />
        </div>

        <button
          type="button"
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={clsx(
            'px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-2 transition-colors',
            filtersOpen || hasFilters
              ? 'bg-green-50 border-green-main text-green-dark'
              : 'border-gray-300 bg-white text-text-main hover:bg-gray-50'
          )}
        >
          <SlidersHorizontal className="w-4 h-4 text-gray-500" />
          <span>Bộ lọc</span>
          {hasFilters && <span className="w-1.5 h-1.5 rounded-full bg-green-main ml-0.5" />}
        </button>

        <Select
          id="sort-select"
          value={sort}
          onChange={(e) => handleSortChange(e.target.value)}
          className="w-auto min-w-[160px] !rounded-xl !border-gray-300 !py-2.5"
        >
          <option value="newest">Mới nhất</option>
          <option value="nearest">Gần tôi nhất</option>
          <option value="featured">Việc nổi bật</option>
          <option value="rating">Đánh giá cao nhất</option>
          <option value="salary_desc">Lương cao nhất</option>
          <option value="salary_asc">Lương thấp đến cao</option>
          <option value="oldest">Cũ nhất</option>
        </Select>
      </div>

      {/* Expanded Filters Panel */}
      {filtersOpen && (
        <div className="card mb-2 animate-fade-in bg-white border border-gray-200 p-4 rounded-xl shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
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
              id="filter-area"
              label="Khu vực"
              value={area}
              onChange={(e) => {
                setArea(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả khu vực</option>
              {AREAS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
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
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors flex-1">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => {
                    setVerifiedOnly(e.target.checked);
                    setPage(1);
                  }}
                  className="w-4 h-4 accent-green-main rounded"
                />
                <span className="text-xs font-medium text-text-main select-none">
                  Cửa hàng xác thực
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors flex-1">
                <input
                  type="checkbox"
                  checked={featuredOnly}
                  onChange={(e) => {
                    setFeaturedOnly(e.target.checked);
                    setPage(1);
                  }}
                  className="w-4 h-4 accent-green-main rounded"
                />
                <span className="text-xs font-medium text-text-main select-none">
                  Việc ưu tiên
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

      {/* MAP ON TOP (STICKY WHEN VIEW MODE === 'MAP') */}
      {viewMode === 'map' && (
        <div
          className={clsx(
            'sticky top-16 z-30 bg-[#FFFDF6]/95 backdrop-blur-md -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 border-b transition-all duration-300',
            isScrolled
              ? 'pt-1.5 pb-2 border-stone-200/80 shadow-sm'
              : 'pt-2 pb-3 border-stone-200/60 shadow-xs'
          )}
        >
          <div className="max-w-7xl mx-auto space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted flex items-center gap-1.5">
                <Map className="w-3.5 h-3.5 text-green-main" />
                <span>
                  Bản đồ vị trí việc làm ({jobsForMap.length} điểm)
                  {isScrolled && !isMapExpanded && (
                    <span className="text-[10px] text-green-dark font-normal ml-2 hidden sm:inline">
                      • Tự động thu gọn khi cuộn
                    </span>
                  )}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setIsMapExpanded((prev) => !prev)}
                className="text-xs font-medium text-text-muted hover:text-green-dark flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-xs"
                title={isMapExpanded ? 'Thu gọn bản đồ để xem nhiều việc hơn' : 'Mở rộng bản đồ'}
              >
                {isMapExpanded ? (
                  <>
                    <Minimize2 className="w-3 h-3" /> Thu gọn
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3 h-3" /> Mở rộng
                  </>
                )}
              </button>
            </div>

            <Suspense fallback={<div className="h-[300px] rounded-2xl bg-stone-100 animate-pulse" />}>
            <JobMap
              jobs={jobsForMap}
              userLocation={userLocation}
              selectedJobId={selectedJobId}
              onSelectJob={(j) => {
                const id = j._id || j.id;
                setSelectedJobId(id);
                const el = document.getElementById(`job-card-${id}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
              }}
              className={clsx(
                'w-full rounded-2xl overflow-hidden shadow-xs border border-stone-200/80 transition-all duration-300 ease-in-out',
                isMapExpanded
                  ? 'h-[380px] sm:h-[480px]'
                  : isScrolled
                    ? 'h-[170px] sm:h-[210px]'
                    : 'h-[300px] sm:h-[380px]'
              )}
            />
            </Suspense>

            {jobsForMap.some(j => !isValidCoordinate(
              j.location?.lat ?? j.geoPoint?.coordinates?.[1] ?? j.mapDisplayLocation?.lat,
              j.location?.lng ?? j.geoPoint?.coordinates?.[0] ?? j.mapDisplayLocation?.lng
            )) && (
              <p className="text-[11px] text-gray-600 bg-amber-50/90 border border-amber-200/80 p-1.5 rounded-lg flex items-center gap-1.5">
                <span>📍</span>
                Một số tin chưa lưu tọa độ nên chưa thể đánh dấu trên bản đồ. Hãy chỉnh sửa tin và chọn vị trí trên bản đồ.
              </p>
            )}
          </div>
        </div>
      )}

      {/* JOBS SECTION BELOW MAP */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between pb-1 border-b border-gray-100">
          <h3 className="font-semibold text-xs sm:text-sm text-text-muted flex items-center gap-1.5">
            <span>
              Danh sách công việc ({sorted.length} việc làm)
              {userLocation && matrixStatus === 'success'
                ? ' • quãng đường xe máy'
                : userLocation && matrixStatus === 'loading'
                  ? ' • đang tính quãng đường...'
                  : userLocation
                    ? ' • khoảng cách ước tính'
                    : ''}
            </span>
            {loading && <Loader2 className="w-3.5 h-3.5 text-green-main animate-spin" />}
          </h3>
          {viewMode === 'map' && (
            <span className="text-[11px] text-text-muted hidden sm:inline">
              Rê chuột vào tin để ghim vị trí trên bản đồ
            </span>
          )}
        </div>

        {loading && allJobs.length === 0 ? (
          <LoadingPage />
        ) : error && allJobs.length === 0 ? (
          <ErrorAlert message={error} onRetry={run} />
        ) : sorted.length === 0 ? (
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
              "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 transition-opacity duration-150 items-stretch",
              loading && "opacity-60"
            )}>
              {paginated.map((job) => (
                <div
                  key={job._id || job.id}
                  id={`job-card-${job._id || job.id}`}
                  onMouseEnter={() => setSelectedJobId(job._id || job.id)}
                  className="h-full flex flex-col scroll-mt-[360px] sm:scroll-mt-[440px]"
                >
                  <JobCard
                    job={job}
                    isSelected={String(selectedJobId) === String(job._id || job.id)}
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
                      'w-9 h-9 rounded-xl text-sm font-medium transition-colors',
                      p === page ? 'bg-green-main text-white' : 'hover:bg-gray-100 text-text-muted'
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
    </div>
  );
}
