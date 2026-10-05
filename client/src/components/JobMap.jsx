import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Compass, Crosshair, Target, Navigation, AlertCircle, X } from 'lucide-react';
import {
  formatVND,
  isValidCoordinate,
  hasConfirmedCoordinates,
  getGoogleMapsDirectionsUrl,
  haversineDistance,
} from '@/utils';
import {
  vietmapgl,
  VIETMAP_API_KEY,
  VIETMAP_STYLES,
  DEFAULT_HOALAC_CENTER_GL,
} from '@/utils/vietmapGLHelper.js';
import { SALARY_UNIT_LABELS } from '@/constants';

// Default center of map: Hoa Lac Area [lat, lng]
export const DEFAULT_HOALAC_CENTER = [21.0128, 105.5255];

function getJobMapCoordinates(job) {
  return {
    lat: job?.location?.lat ?? job?.lat ?? job?.geoPoint?.coordinates?.[1] ?? job?.mapDisplayLocation?.lat,
    lng: job?.location?.lng ?? job?.lng ?? job?.geoPoint?.coordinates?.[0] ?? job?.mapDisplayLocation?.lng,
  };
}

// Vietmap Style Configurations
const MAP_LAYERS = {
  vietmap_streets: {
    name: 'Đường phố',
    style: VIETMAP_STYLES.STREETS,
  },
  vietmap_dark: {
    name: 'Bản đồ tối',
    style: VIETMAP_STYLES.DARK,
  },
  vietmap_light: {
    name: 'Bản đồ sáng',
    style: VIETMAP_STYLES.LIGHT,
  },
};

function createJobMarkerElement(job, isSelected = false) {
  const isConfirmed = hasConfirmedCoordinates(job);
  const el = document.createElement('div');
  el.className = 'vietmap-job-marker';
  el.style.cursor = 'pointer';
  el.innerHTML = `
    <div style="position: relative; transition: transform 0.2s; transform: ${
      isSelected ? 'scale(1.25)' : 'scale(1)'
    };">
      <div style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 2px solid white; background: ${
        isSelected ? '#db2777' : isConfirmed ? '#047857' : '#d97706'
      }; color: white; font-size: 13px;">
        <span>${isConfirmed ? '💼' : '📍'}</span>
      </div>
      <div style="width: 8px; height: 8px; transform: rotate(45deg); margin: -4px auto 0; background: ${
        isSelected ? '#db2777' : isConfirmed ? '#047857' : '#d97706'
      }; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>
    </div>
  `;
  return el;
}

function createUserMarkerElement(label = 'Vị trí GPS của bạn') {
  const el = document.createElement('div');
  el.className = 'vietmap-user-marker';
  el.title = label;
  el.innerHTML = `
    <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;">
      <span style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background: rgba(59, 130, 246, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
      <div style="position: relative; width: 28px; height: 28px; border-radius: 50%; background: #2563eb; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); color: white; display: flex; align-items: center; justify-content: center; font-size: 13px;">
        📍
      </div>
    </div>
  `;
  return el;
}

export function JobMap({
  jobs = [],
  userLocation = null,
  onRequestGps = null,
  isLocating = false,
  selectedJobId = null,
  onSelectJob = null,
  height = '520px',
  singleJob = null,
  className = '',
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersMapRef = useRef(new Map());
  const userMarkerRef = useRef(null);
  const jobsBoundsRef = useRef(null);
  const hasInitialFitRef = useRef(false);
  const fitTimerRef = useRef(null);

  const [activeJob, setActiveJob] = useState(singleJob || null);
  const [currentLayerKey, setCurrentLayerKey] = useState('vietmap_streets');
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [tileLoadError, setTileLoadError] = useState(false);

  // Initialize Native Vietmap GL Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Center selection in Vietmap GL format: [lng, lat]
    let initialCenter = DEFAULT_HOALAC_CENTER_GL;
    let initialZoom = 13;

    if (singleJob) {
      const sjLat = singleJob.location?.lat ?? singleJob.lat ?? singleJob.geoPoint?.coordinates?.[1];
      const sjLng = singleJob.location?.lng ?? singleJob.lng ?? singleJob.geoPoint?.coordinates?.[0];
      if (isValidCoordinate(sjLat, sjLng)) {
        initialCenter = [Number(sjLng), Number(sjLat)];
        initialZoom = 16;
      }
    } else if (userLocation && isValidCoordinate(userLocation.lat, userLocation.lng)) {
      const distToHoaLacM = haversineDistance(
        userLocation.lat,
        userLocation.lng,
        DEFAULT_HOALAC_CENTER[0],
        DEFAULT_HOALAC_CENTER[1]
      );
      if (distToHoaLacM !== null && distToHoaLacM <= 15000) {
        initialCenter = [Number(userLocation.lng), Number(userLocation.lat)];
        initialZoom = 14;
      }
    }

    const map = new vietmapgl.Map({
      container: mapContainerRef.current,
      style: MAP_LAYERS[currentLayerKey]?.style || VIETMAP_STYLES.STREETS,
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: true,
    });

    map.on('error', (e) => {
      const status = e?.error?.status || e?.status;
      const msg = e?.error?.message || e?.message || '';
      if (status === 401 || status === 403 || msg.includes('401') || msg.includes('403')) {
        setTileLoadError(true);
      }
    });

    map.addControl(new vietmapgl.NavigationControl(), 'top-right');
    mapInstanceRef.current = map;

    // Close preview card when clicking on empty map area
    map.on('click', (e) => {
      // If clicking directly on map canvas
      if (e.originalEvent?.target === map.getCanvas()) {
        if (!singleJob) {
          setActiveJob(null);
        }
      }
    });

    // Continuous ResizeObserver to keep Vietmap GL canvas responsive
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        try {
          if (mapInstanceRef.current && mapContainerRef.current) {
            mapInstanceRef.current.resize();
          }
        } catch {
          // ignore layout change / unmount resize error
        }
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      if (resizeObserver) {
        try {
          resizeObserver.disconnect();
        } catch {}
        resizeObserver = null;
      }
      if (fitTimerRef.current) {
        clearTimeout(fitTimerRef.current);
        fitTimerRef.current = null;
      }
      markersMapRef.current.forEach((item) => {
        try {
          const marker = item?.marker || item;
          if (marker && typeof marker.remove === 'function') {
            marker.remove();
          }
        } catch {}
      });
      markersMapRef.current.clear();
      if (userMarkerRef.current) {
        try {
          userMarkerRef.current.remove();
        } catch {}
        userMarkerRef.current = null;
      }
      try {
        map.remove();
      } catch {}
      mapInstanceRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch Vietmap Style Layer
  function switchLayer(layerKey) {
    const map = mapInstanceRef.current;
    if (!map || !MAP_LAYERS[layerKey] || layerKey === currentLayerKey) return;
    map.setStyle(MAP_LAYERS[layerKey].style);
    setCurrentLayerKey(layerKey);
  }

  // Update User Location GPS Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (isValidCoordinate(userLocation?.lat, userLocation?.lng)) {
      const lngLat = [Number(userLocation.lng), Number(userLocation.lat)];
      if (!userMarkerRef.current) {
        const marker = new vietmapgl.Marker({
          element: createUserMarkerElement(userLocation.label || 'Vị trí GPS của bạn'),
        })
          .setLngLat(lngLat)
          .addTo(map);

        userMarkerRef.current = marker;
      } else {
        userMarkerRef.current.setLngLat(lngLat);
      }
    } else if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
  }, [userLocation]);

  // Efficient Marker Diffing & Auto-Fit Bounds
  const jobsToRender = useMemo(() => {
    return singleJob ? [singleJob] : jobs;
  }, [singleJob, jobs]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentMarkersMap = markersMapRef.current;
    const nextJobIds = new Set();
    const bounds = new vietmapgl.LngLatBounds();
    let validCount = 0;

    jobsToRender.forEach((job) => {
      const id = String(job._id || job.id);
      const { lat, lng } = getJobMapCoordinates(job);

      if (!isValidCoordinate(lat, lng)) {
        return;
      }

      const nLat = Number(lat);
      const nLng = Number(lng);
      bounds.extend([nLng, nLat]);
      validCount++;
      nextJobIds.add(id);

      const isSelected = id === String(selectedJobId);
      const existing = currentMarkersMap.get(id);

      if (existing) {
        try {
          existing.marker?.remove?.();
        } catch {}
      }

      const el = createJobMarkerElement(job, isSelected);
      el.addEventListener('click', () => {
        setActiveJob(job);
        onSelectJob?.(job);
        try {
          map.flyTo({ center: [nLng, nLat], zoom: 16 });
        } catch {}
      });

      const marker = new vietmapgl.Marker({ element: el })
        .setLngLat([nLng, nLat])
        .addTo(map);

      currentMarkersMap.set(id, { marker, job });
    });

    // Remove markers that are no longer in jobsToRender
    for (const [id, item] of currentMarkersMap.entries()) {
      if (!nextJobIds.has(id)) {
        try {
          item.marker?.remove?.();
        } catch {}
        currentMarkersMap.delete(id);
      }
    }

    setConfirmedCount(validCount);
    jobsBoundsRef.current = !bounds.isEmpty() ? bounds : null;

    // Automatic Smart Viewport Fitting
    if (!bounds.isEmpty() && validCount > 0) {
      if (singleJob) {
        const sjLat = singleJob.location?.lat ?? singleJob.lat ?? singleJob.geoPoint?.coordinates?.[1];
        const sjLng = singleJob.location?.lng ?? singleJob.lng ?? singleJob.geoPoint?.coordinates?.[0];
        if (isValidCoordinate(sjLat, sjLng)) {
          try {
            map.flyTo({ center: [Number(sjLng), Number(sjLat)], zoom: 16 });
          } catch {}
        }
      } else if (!hasInitialFitRef.current) {
        hasInitialFitRef.current = true;

        const performFit = () => {
          try {
            if (!mapInstanceRef.current || bounds.isEmpty()) return;
            mapInstanceRef.current.resize();

            let shouldIncludeUser = false;
            if (isValidCoordinate(userLocation?.lat, userLocation?.lng)) {
              const distToCenterM = haversineDistance(
                userLocation.lat,
                userLocation.lng,
                DEFAULT_HOALAC_CENTER[0],
                DEFAULT_HOALAC_CENTER[1]
              );
              if (distToCenterM !== null && distToCenterM <= 15000) {
                shouldIncludeUser = true;
              }
            }

            if (shouldIncludeUser) {
              const fitBounds = new vietmapgl.LngLatBounds(
                bounds.getSouthWest(),
                bounds.getNorthEast()
              );
              fitBounds.extend([Number(userLocation.lng), Number(userLocation.lat)]);
              mapInstanceRef.current.fitBounds(fitBounds, { padding: 45, maxZoom: 15 });
            } else {
              mapInstanceRef.current.fitBounds(bounds, { padding: 45, maxZoom: 15 });
            }
          } catch {}
        };

        performFit();
        if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
        fitTimerRef.current = setTimeout(performFit, 200);
      }
    }
  }, [jobsToRender, selectedJobId, onSelectJob, singleJob, userLocation]);

  // Pan to selected job when selectedJobId changes
  useEffect(() => {
    if (!selectedJobId || !mapInstanceRef.current) return;
    const selectedJob = jobsToRender.find((j) => String(j._id || j.id) === String(selectedJobId));
    if (selectedJob) {
      const { lat, lng } = getJobMapCoordinates(selectedJob);
      if (isValidCoordinate(lat, lng)) {
        try {
          mapInstanceRef.current.flyTo({ center: [Number(lng), Number(lat)], zoom: 16 });
        } catch {}
        setActiveJob(selectedJob);
      }
    }
  }, [selectedJobId, jobsToRender]);

  const hasRealUserLocation = isValidCoordinate(userLocation?.lat, userLocation?.lng);

  // Compute user distance to Hoa Lac for helpful UI context
  const userDistToHoaLacKm = useMemo(() => {
    if (!hasRealUserLocation) return null;
    const distM = haversineDistance(
      userLocation.lat,
      userLocation.lng,
      DEFAULT_HOALAC_CENTER[0],
      DEFAULT_HOALAC_CENTER[1]
    );
    return distM !== null ? Math.round((distM / 1000) * 10) / 10 : null;
  }, [hasRealUserLocation, userLocation]);

  const fitAllJobs = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (jobsBoundsRef.current && !jobsBoundsRef.current.isEmpty()) {
      map.fitBounds(jobsBoundsRef.current, { padding: 50, maxZoom: 15 });
    } else {
      map.flyTo({ center: DEFAULT_HOALAC_CENTER_GL, zoom: 14 });
    }
  }, []);

  const flyToUserLocation = useCallback(() => {
    const map = mapInstanceRef.current;
    if (map && hasRealUserLocation) {
      map.flyTo({ center: [Number(userLocation.lng), Number(userLocation.lat)], zoom: 15 });
    }
  }, [hasRealUserLocation, userLocation]);

  const flyToHoaLacCenter = useCallback(() => {
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo({ center: DEFAULT_HOALAC_CENTER_GL, zoom: 14 });
    }
  }, []);

  return (
    <div
      style={height ? { minHeight: height } : undefined}
      className={`relative rounded-xl overflow-hidden border border-gray-200/90 shadow-card bg-cream ${className}`}
    >
      {/* Vietmap GL Map Canvas Container */}
      <div
        ref={mapContainerRef}
        style={height ? { height, minHeight: height } : undefined}
        className="w-full h-full min-h-[inherit] z-0"
      />

      {/* Fallback banner if missing tile key or 401/403 error */}
      {(!VIETMAP_API_KEY || tileLoadError) && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-50/95 backdrop-blur-sm p-6 text-center">
          <AlertCircle className="w-10 h-10 text-amber-500 mb-2" />
          <h4 className="font-bold text-sm text-gray-800">
            {!VIETMAP_API_KEY ? 'Chưa cấu hình Vietmap Tile Key' : 'Không thể tải bản đồ Vietmap'}
          </h4>
          <p className="text-xs text-gray-600 mt-1.5 max-w-sm leading-relaxed">
            {!VIETMAP_API_KEY
              ? 'Vui lòng điền VITE_VIETMAP_TILE_API_KEY vào tệp client/.env và khởi động lại Vite dev server.'
              : 'Lỗi xác thực Tile Key (401/403). Vui lòng kiểm tra VITE_VIETMAP_TILE_API_KEY trong client/.env và khởi động lại dev server.'}
          </p>
        </div>
      )}

      {/* Floating Controls Top-Right: Layer Switcher & GPS Request Button */}
      <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5">
        {/* Layer Switcher */}
        <div className="bg-white/95 p-1 rounded-lg border border-gray-200/90 shadow-xs flex items-center gap-1">
          {Object.entries(MAP_LAYERS).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              onClick={() => switchLayer(key)}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                currentLayerKey === key
                  ? 'bg-green-main text-white shadow-xs'
                  : 'text-text-muted hover:text-green-dark hover:bg-gray-100'
              }`}
            >
              {cfg.name}
            </button>
          ))}
        </div>

        {/* GPS Button */}
        {onRequestGps && (
          <button
            type="button"
            onClick={onRequestGps}
            disabled={isLocating}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-75"
            title="Định vị vị trí GPS thật của thiết bị"
          >
            <Crosshair className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'Đang lấy GPS...' : hasRealUserLocation ? '📍 Đã có GPS' : '📍 Lấy GPS của tôi'}</span>
          </button>
        )}
      </div>

      {/* Floating Map Legend Top-Left */}
      <div className="absolute top-3 left-3 z-10 bg-white/95 px-3 py-2 rounded-lg border border-gray-200/90 shadow-xs text-xs space-y-1 max-w-[280px]">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full inline-block ${hasRealUserLocation ? 'bg-blue-600' : 'bg-gray-400'}`}></span>
          <span className="font-semibold text-text-main truncate text-[11px]">
            {hasRealUserLocation
              ? userLocation?.label || 'Vị trí GPS của bạn'
              : 'Tâm bản đồ Hòa Lạc'}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-emerald-700 inline-block"></span>
          <span className="text-text-muted font-medium">
            {confirmedCount > 0
              ? `${confirmedCount} việc làm trên bản đồ`
              : 'Chưa có việc làm nào phù hợp'}
          </span>
        </div>

        {jobsToRender.some(job => {
          const { lat, lng } = getJobMapCoordinates(job);
          return isValidCoordinate(lat, lng) && job.locationStatus !== 'confirmed';
        }) && (
          <div className="flex items-center gap-1.5 text-[10px] text-amber-700">
            <span className="w-2 h-2 rounded-full bg-amber-600 inline-block"></span>
            <span>Marker cam: tọa độ ước tính</span>
          </div>
        )}

        {userDistToHoaLacKm !== null && userDistToHoaLacKm > 15 && (
          <div className="pt-1 border-t border-gray-100 text-[10px] text-amber-700 flex items-start gap-1">
            <span>ℹ️</span>
            <span>Cách Hòa Lạc ~{userDistToHoaLacKm}km. Đang hiển thị cụm việc làm Hòa Lạc.</span>
          </div>
        )}
      </div>

      {/* Floating Action Buttons Bottom-Right: Fit Bounds & Recenter */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col items-end gap-1.5">
        {/* Fit All Jobs Button */}
        {confirmedCount > 0 && !singleJob && (
          <button
            type="button"
            onClick={fitAllJobs}
            className="px-3 py-1.5 bg-white/95 hover:bg-gray-50 text-green-dark rounded-lg border border-gray-200/90 shadow-xs font-semibold text-xs flex items-center gap-1.5 transition-colors"
            title="Thu phóng để xem tất cả việc làm trên bản đồ"
          >
            <Target className="w-3.5 h-3.5 text-green-main" />
            <span>Xem tất cả ({confirmedCount})</span>
          </button>
        )}

        <div className="flex items-center gap-1.5">
          {/* Back to Hoa Lac Center */}
          <button
            type="button"
            onClick={flyToHoaLacCenter}
            className="px-2.5 py-1.5 bg-white/95 hover:bg-gray-50 text-text-main rounded-lg border border-gray-200/90 shadow-xs font-medium text-xs flex items-center gap-1 transition-colors"
            title="Về trung tâm khu Công nghệ cao Hòa Lạc"
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-700" />
            <span className="hidden sm:inline">Hòa Lạc</span>
          </button>

          {/* User Location Button */}
          {hasRealUserLocation && (
            <button
              type="button"
              onClick={flyToUserLocation}
              className="px-2.5 py-1.5 bg-white/95 hover:bg-gray-50 text-blue-700 rounded-lg border border-gray-200/90 shadow-xs font-medium text-xs flex items-center gap-1 transition-colors"
              title="Quay về vị trí GPS của bạn"
            >
              <Compass className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Vị trí của tôi</span>
            </button>
          )}
        </div>
      </div>

      {/* Selected Job Card Preview Popup at bottom */}
      {activeJob && !singleJob && (
        <div className="absolute bottom-3 left-3 right-auto max-w-[calc(100%-4.5rem)] sm:max-w-sm z-20 bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-gray-200/90 shadow-card animate-slide-up space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] font-semibold text-green-dark bg-green-50 px-2 py-0.5 rounded-full border border-green-200/80 truncate max-w-[170px] inline-block">
                  {activeJob.storeName}
                </span>
              </div>
              <h4 className="font-bold text-sm text-text-main line-clamp-1 leading-snug" title={activeJob.title}>
                {activeJob.title}
              </h4>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200/80">
                {formatVND(activeJob.salaryAmount)}{SALARY_UNIT_LABELS[activeJob.salaryUnit] || '/h'}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectJob?.(null);
                }}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Đóng xem trước"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <p className="text-xs text-text-muted flex items-center gap-1.5 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <span className="truncate">{activeJob.address || 'Hòa Lạc'}</span>
          </p>

          <div className="pt-1 flex items-center gap-2">
            <Link
              to={`/jobs/${activeJob._id || activeJob.id}`}
              className="flex-1 py-1.5 px-3 rounded-xl bg-green-main hover:bg-green-dark text-white font-bold text-xs text-center transition-colors shadow-xs"
            >
              Xem chi tiết việc làm
            </Link>
            {(() => {
              const directionsUrl = getGoogleMapsDirectionsUrl(activeJob);
              if (!directionsUrl) return null;
              const hasExactDirections = activeJob.locationStatus === 'confirmed' && hasConfirmedCoordinates(activeJob);

              return (
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl border border-gray-200 text-text-muted hover:text-green-dark hover:bg-gray-50 text-xs transition-colors flex items-center justify-center shrink-0"
                  title={hasExactDirections ? 'Chỉ đường tới vị trí đã xác nhận' : 'Tìm địa chỉ trên Google Maps'}
                >
                  <Navigation className="w-3.5 h-3.5 text-blue-600" />
                </a>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
