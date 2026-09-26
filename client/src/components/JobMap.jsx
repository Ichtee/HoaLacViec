import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, ExternalLink, Compass, Crosshair, AlertCircle, Target, Navigation } from 'lucide-react';
import {
  formatVND,
  isValidCoordinate,
  hasConfirmedCoordinates,
  getGoogleMapsDirectionsUrl,
  haversineDistance,
} from '@/utils';
import { SALARY_UNIT_LABELS } from '@/constants';

// Default center of map: Hoa Lac Area
export const DEFAULT_HOALAC_CENTER = [21.0128, 105.5255];

// Google Maps Layer Configurations (100% Google Maps, fast and reliable in Vietnam)
const MAP_LAYERS = {
  google_streets: {
    name: 'Bản đồ',
    url: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: '&copy; Google Maps',
  },
  google_satellite: {
    name: 'Vệ tinh',
    url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: '&copy; Google Maps',
  },
};

function createJobMarkerIcon(job, isSelected = false) {
  const isConfirmed = hasConfirmedCoordinates(job);
  return L.divIcon({
    className: 'custom-job-marker',
    html: `
      <div class="relative group cursor-pointer transform transition-all duration-200 ${
        isSelected ? 'scale-125 z-50' : 'hover:scale-110 z-20'
      }">
        <div class="flex items-center justify-center w-7 h-7 rounded-full shadow-lg border-2 ${
          isSelected
            ? 'bg-pink-600 text-white border-white ring-4 ring-pink-300'
            : isConfirmed
            ? 'bg-emerald-700 text-white border-white hover:bg-emerald-800'
            : 'bg-amber-600 text-white border-white hover:bg-amber-700'
        } text-xs">
          <span>${isConfirmed ? '💼' : '📍'}</span>
        </div>
        <div class="w-2 h-2 ${isSelected ? 'bg-pink-600' : isConfirmed ? 'bg-emerald-700' : 'bg-amber-600'} rotate-45 mx-auto -mt-1 shadow-sm"></div>
      </div>
    `,
    iconSize: [28, 32],
    iconAnchor: [14, 32],
  });
}

function createUserMarkerIcon(label = 'Vị trí GPS của bạn') {
  return L.divIcon({
    className: 'custom-user-marker',
    html: `
      <div class="relative flex items-center justify-center cursor-pointer z-40">
        <span class="animate-ping absolute inline-flex h-10 w-10 rounded-full bg-blue-500 opacity-60"></span>
        <div class="relative inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 border-2 border-white shadow-xl text-white text-xs font-bold">
          📍
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

export function JobMap({
  jobs = [],
  userLocation = null,
  onUserLocationChange = null,
  onRequestGps = null,
  isLocating = false,
  selectedJobId = null,
  onSelectJob = null,
  height = '520px',
  singleJob = null,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersMapRef = useRef(new Map());
  const userMarkerRef = useRef(null);
  const jobsBoundsRef = useRef(null);
  const hasInitialFitRef = useRef(false);

  const [activeJob, setActiveJob] = useState(singleJob || null);
  const [currentLayerKey, setCurrentLayerKey] = useState('google_streets');
  const [tileError, setTileError] = useState(false);
  const [confirmedCount, setConfirmedCount] = useState(0);

  // Initialize Map and cleanup on unmount
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Center selection: singleJob > valid userLocation near Hoa Lac > DEFAULT_HOALAC_CENTER
    let initialCenter = DEFAULT_HOALAC_CENTER;
    let initialZoom = 13;

    if (singleJob) {
      const sjLat = singleJob.location?.lat ?? singleJob.lat ?? singleJob.geoPoint?.coordinates?.[1];
      const sjLng = singleJob.location?.lng ?? singleJob.lng ?? singleJob.geoPoint?.coordinates?.[0];
      if (isValidCoordinate(sjLat, sjLng)) {
        initialCenter = [Number(sjLat), Number(sjLng)];
        initialZoom = 16;
      }
    } else if (userLocation && isValidCoordinate(userLocation.lat, userLocation.lng)) {
      const distToHoaLacM = haversineDistance(
        userLocation.lat,
        userLocation.lng,
        DEFAULT_HOALAC_CENTER[0],
        DEFAULT_HOALAC_CENTER[1]
      );
      // Only start centered on user GPS if within 15km of Hoa Lac, otherwise start on Hoa Lac
      if (distToHoaLacM !== null && distToHoaLacM <= 15000) {
        initialCenter = [Number(userLocation.lat), Number(userLocation.lng)];
        initialZoom = 14;
      }
    }

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: true,
      maxZoom: 19,
    });

    mapInstanceRef.current = map;

    // Attach Tile Layer with error fallback
    function attachTileLayer(layerKey) {
      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
      }
      const cfg = MAP_LAYERS[layerKey] || MAP_LAYERS.google_streets;
      const layer = L.tileLayer(cfg.url, {
        subdomains: cfg.subdomains || ['mt0', 'mt1', 'mt2', 'mt3'],
        maxZoom: cfg.maxZoom || 20,
        attribution: cfg.attribution,
      });

      layer.on('tileerror', () => {
        setTileError(true);
      });

      layer.on('tileload', () => {
        setTileError(false);
      });

      layer.addTo(map);
      tileLayerRef.current = layer;
    }

    attachTileLayer(currentLayerKey);

    // Initial resize trigger
    const initialResizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    // Continuous ResizeObserver to keep Leaflet aligned across tabs, modals, and container changes
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      clearTimeout(initialResizeTimer);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      markersMapRef.current.forEach((marker) => marker.remove());
      markersMapRef.current.clear();
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
    };
  }, []);

  // Switch Layer
  function switchLayer(layerKey) {
    const map = mapInstanceRef.current;
    if (!map || !MAP_LAYERS[layerKey] || layerKey === currentLayerKey) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const cfg = MAP_LAYERS[layerKey];
    const newLayer = L.tileLayer(cfg.url, {
      subdomains: cfg.subdomains || ['mt0', 'mt1', 'mt2', 'mt3'],
      maxZoom: cfg.maxZoom || 20,
      attribution: cfg.attribution,
    });

    newLayer.on('tileerror', () => setTileError(true));
    newLayer.on('tileload', () => setTileError(false));

    newLayer.addTo(map);
    tileLayerRef.current = newLayer;
    setCurrentLayerKey(layerKey);
  }

  // Update User Location Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (isValidCoordinate(userLocation?.lat, userLocation?.lng)) {
      const latLng = [Number(userLocation.lat), Number(userLocation.lng)];
      if (!userMarkerRef.current) {
        const marker = L.marker(latLng, {
          icon: createUserMarkerIcon(userLocation.label || 'Vị trí GPS của bạn'),
          zIndexOffset: 1000,
        }).addTo(map);

        marker.bindTooltip(userLocation.label || 'Vị trí GPS của bạn', {
          permanent: false,
          direction: 'top',
          className: 'bg-blue-900 text-white px-2 py-1 rounded-lg text-xs font-semibold shadow-md',
        });

        userMarkerRef.current = marker;
      } else {
        userMarkerRef.current.setLatLng(latLng);
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
    const bounds = L.latLngBounds([]);
    let validCount = 0;

    jobsToRender.forEach((job) => {
      const id = String(job._id || job.id);
      const lat = job.location?.lat ?? job.lat ?? job.geoPoint?.coordinates?.[1];
      const lng = job.location?.lng ?? job.lng ?? job.geoPoint?.coordinates?.[0];

      // Must have valid geographic coordinates
      if (!isValidCoordinate(lat, lng)) {
        return;
      }

      // Only skip jobs explicitly marked as unconfirmed (no pin selected)
      if (job.locationStatus === 'unconfirmed') {
        return;
      }

      const nLat = Number(lat);
      const nLng = Number(lng);
      bounds.extend([nLat, nLng]);
      validCount++;
      nextJobIds.add(id);

      const isSelected = id === String(selectedJobId);
      const existingMarker = currentMarkersMap.get(id);

      if (existingMarker) {
        const curPos = existingMarker.getLatLng();
        if (Math.abs(curPos.lat - nLat) > 0.00001 || Math.abs(curPos.lng - nLng) > 0.00001) {
          existingMarker.setLatLng([nLat, nLng]);
        }
        existingMarker.setIcon(createJobMarkerIcon(job, isSelected));
      } else {
        const marker = L.marker([nLat, nLng], {
          icon: createJobMarkerIcon(job, isSelected),
        }).addTo(map);

        marker.bindTooltip(job.storeName || job.title, {
          direction: 'top',
          offset: [0, -16],
        });

        marker.on('click', () => {
          setActiveJob(job);
          onSelectJob?.(job);
          map.panTo([nLat, nLng]);
        });

        currentMarkersMap.set(id, marker);
      }
    });

    // Remove markers that are no longer in jobsToRender
    for (const [id, marker] of currentMarkersMap.entries()) {
      if (!nextJobIds.has(id)) {
        marker.remove();
        currentMarkersMap.delete(id);
      }
    }

    setConfirmedCount(validCount);
    jobsBoundsRef.current = bounds.isValid() ? bounds : null;

    // Automatic Smart Viewport Fitting
    if (bounds.isValid() && validCount > 0) {
      if (singleJob) {
        const sjLat = singleJob.location?.lat ?? singleJob.lat ?? singleJob.geoPoint?.coordinates?.[1];
        const sjLng = singleJob.location?.lng ?? singleJob.lng ?? singleJob.geoPoint?.coordinates?.[0];
        if (isValidCoordinate(sjLat, sjLng)) {
          map.setView([Number(sjLat), Number(sjLng)], 16);
        }
      } else if (!hasInitialFitRef.current) {
        hasInitialFitRef.current = true;

        const performFit = () => {
          if (!mapInstanceRef.current || !bounds.isValid()) return;
          mapInstanceRef.current.invalidateSize();

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
            const fitBounds = L.latLngBounds(bounds.getSouthWest(), bounds.getNorthEast());
            fitBounds.extend([Number(userLocation.lat), Number(userLocation.lng)]);
            mapInstanceRef.current.fitBounds(fitBounds, { padding: [40, 40], maxZoom: 15 });
          } else {
            // Fit tightly on Hoa Lac jobs so all markers are centered and in full view!
            mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
          }
        };

        // Immediate fit + delayed layout safety retry
        performFit();
        setTimeout(performFit, 200);
      }
    }
  }, [jobsToRender, selectedJobId, onSelectJob, singleJob, userLocation]);

  // Pan to selected job when selectedJobId changes
  useEffect(() => {
    if (!selectedJobId || !mapInstanceRef.current) return;
    const selectedJob = jobsToRender.find((j) => String(j._id || j.id) === String(selectedJobId));
    if (selectedJob) {
      const lat = selectedJob.location?.lat ?? selectedJob.lat ?? selectedJob.geoPoint?.coordinates?.[1];
      const lng = selectedJob.location?.lng ?? selectedJob.lng ?? selectedJob.geoPoint?.coordinates?.[0];
      if (isValidCoordinate(lat, lng)) {
        mapInstanceRef.current.flyTo([Number(lat), Number(lng)], 16, { animate: true });
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
    if (jobsBoundsRef.current && jobsBoundsRef.current.isValid()) {
      map.fitBounds(jobsBoundsRef.current, { padding: [50, 50], maxZoom: 15 });
    } else {
      map.flyTo(DEFAULT_HOALAC_CENTER, 14, { animate: true });
    }
  }, []);

  const flyToUserLocation = useCallback(() => {
    const map = mapInstanceRef.current;
    if (map && hasRealUserLocation) {
      map.flyTo([Number(userLocation.lat), Number(userLocation.lng)], 15, { animate: true });
    }
  }, [hasRealUserLocation, userLocation]);

  const flyToHoaLacCenter = useCallback(() => {
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo(DEFAULT_HOALAC_CENTER, 14, { animate: true });
    }
  }, []);

  return (
    <div className="relative rounded-3xl overflow-hidden border-2 border-green-200 shadow-card bg-cream">
      {/* Map Canvas */}
      <div ref={mapContainerRef} style={{ height }} className="w-full z-0" />

      {/* Tile Loading Warning if offline or CDN blocked */}
      {tileError && (
        <div className="absolute top-16 left-4 z-20 bg-amber-50/95 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-xl text-xs flex items-center gap-2 shadow-sm">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Một số mảnh bản đồ đang tải chậm hoặc bị chặn. Hãy thử đổi lớp bản đồ.</span>
        </div>
      )}

      {/* Floating Controls Top-Right: Layer Switcher & GPS Request Button */}
      <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
        {/* Layer Switcher */}
        <div className="bg-white/95 backdrop-blur-md p-1 rounded-2xl border border-green-100 shadow-md flex items-center gap-1">
          {Object.entries(MAP_LAYERS).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              onClick={() => switchLayer(key)}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
                currentLayerKey === key
                  ? 'bg-green-main text-white shadow-sm'
                  : 'text-text-muted hover:text-green-dark hover:bg-green-50'
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
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-2xl shadow-md text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-75"
            title="Định vị vị trí GPS thật của thiết bị"
          >
            <Crosshair className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'Đang lấy GPS...' : hasRealUserLocation ? '📍 Đã có GPS vị trí thật' : '📍 Lấy vị trí GPS của tôi'}</span>
          </button>
        )}
      </div>

      {/* Floating Map Legend Top-Left */}
      <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-green-100 shadow-md text-xs space-y-1.5 max-w-[300px]">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full inline-block shadow-sm ${hasRealUserLocation ? 'bg-blue-600' : 'bg-gray-400'}`}></span>
          <span className="font-bold text-text-main truncate text-[11px]">
            {hasRealUserLocation
              ? userLocation?.label || 'Vị trí GPS của bạn'
              : 'Tâm bản đồ Hòa Lạc (chưa có GPS)'}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-700 inline-block shadow-sm"></span>
          <span className="text-text-muted font-medium">
            {confirmedCount > 0
              ? `${confirmedCount} việc làm đã ghim trên bản đồ`
              : 'Chưa có điểm việc làm nào phù hợp bộ lọc'}
          </span>
        </div>

        {userDistToHoaLacKm !== null && userDistToHoaLacKm > 15 && (
          <div className="pt-1 border-t border-gray-100 text-[10px] text-amber-700 flex items-start gap-1">
            <span>ℹ️</span>
            <span>Bạn đang cách Hòa Lạc ~{userDistToHoaLacKm}km. Bản đồ đang hiển thị cụm việc làm Hòa Lạc.</span>
          </div>
        )}
      </div>

      {/* Floating Action Buttons Bottom-Right: Fit Bounds & Recenter */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-2">
        {/* Fit All Jobs Button */}
        {confirmedCount > 0 && !singleJob && (
          <button
            type="button"
            onClick={fitAllJobs}
            className="px-3.5 py-2 bg-white/95 backdrop-blur-md hover:bg-green-50 text-green-dark rounded-2xl border border-green-200 shadow-md font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
            title="Thu phóng để xem tất cả việc làm trên bản đồ"
          >
            <Target className="w-4 h-4 text-green-main" />
            <span>Xem tất cả việc làm ({confirmedCount})</span>
          </button>
        )}

        <div className="flex items-center gap-2">
          {/* Back to Hoa Lac Center */}
          <button
            type="button"
            onClick={flyToHoaLacCenter}
            className="px-3 py-2 bg-white/95 backdrop-blur-md hover:bg-green-50 text-text-main rounded-2xl border border-green-200 shadow-md font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
            title="Về trung tâm khu Công nghệ cao Hòa Lạc"
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-700" />
            <span className="hidden sm:inline">Về Hòa Lạc</span>
          </button>

          {/* User Location Button */}
          {hasRealUserLocation && (
            <button
              type="button"
              onClick={flyToUserLocation}
              className="px-3 py-2 bg-white/95 backdrop-blur-md hover:bg-blue-50 text-blue-700 rounded-2xl border border-blue-200 shadow-md font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
              title="Quay về vị trí GPS của bạn"
            >
              <Compass className="w-4 h-4 text-blue-600" />
              <span className="hidden sm:inline">Vị trí của tôi</span>
            </button>
          )}
        </div>
      </div>

      {/* Selected Job Card Preview Popup at bottom */}
      {activeJob && !singleJob && (
        <div className="absolute bottom-4 left-4 right-16 sm:right-auto sm:max-w-sm z-10 bg-white/95 backdrop-blur-md p-4 rounded-3xl border border-green-200 shadow-modal animate-slide-up space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold text-green-dark bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                {activeJob.storeName}
              </span>
              <h4 className="font-bold text-sm text-text-main mt-1 line-clamp-1">
                {activeJob.title}
              </h4>
            </div>
            <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-xl shrink-0 border border-orange-100">
              {formatVND(activeJob.salaryAmount)}{SALARY_UNIT_LABELS[activeJob.salaryUnit] || '/h'}
            </span>
          </div>

          <p className="text-xs text-text-muted flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <span className="truncate">{activeJob.address || 'Hòa Lạc'}</span>
          </p>

          <div className="pt-1 flex items-center gap-2">
            <Link
              to={`/jobs/${activeJob._id || activeJob.id}`}
              className="flex-1 py-2 rounded-xl bg-green-main hover:bg-green-dark text-white font-bold text-xs text-center transition-colors shadow-sm"
            >
              Xem chi tiết việc làm
            </Link>
            {(() => {
              const directionsUrl = getGoogleMapsDirectionsUrl(activeJob);
              if (!directionsUrl) return null;

              return (
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl border border-green-200 text-text-muted hover:text-green-dark hover:bg-green-50 text-xs transition-colors flex items-center gap-1"
                  title="Chỉ đường trên Google Maps"
                >
                  <Navigation className="w-4 h-4 text-blue-600" />
                </a>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
