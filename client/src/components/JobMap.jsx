import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, MapPin, DollarSign, Clock, ExternalLink, Compass, Layers, Crosshair } from 'lucide-react';
import { formatVND } from '@/utils';
import { SALARY_UNIT_LABELS } from '@/constants';

// Default center: Khu Công nghệ cao Hòa Lạc / ĐH FPT
const DEFAULT_CENTER = [21.0128, 105.5255];

// Map Layer Configurations
const MAP_LAYERS = {
  google_roadmap: {
    name: 'Google Maps',
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
    attribution: '&copy; Google Maps',
  },
  google_hybrid: {
    name: 'Google Vệ Tinh',
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
    attribution: '&copy; Google Maps Satellite',
  },
};

// Custom Marker HTML for jobs (clean pin without money/price labels)
function createJobMarkerIcon(job, isSelected = false) {
  return L.divIcon({
    className: 'custom-job-marker',
    html: `
      <div class="relative group cursor-pointer transform transition-all duration-200 ${
        isSelected ? 'scale-125 z-50' : 'hover:scale-110 z-20'
      }">
        <div class="flex items-center justify-center w-7 h-7 rounded-full shadow-lg border-2 ${
          isSelected
            ? 'bg-pink-600 text-white border-white ring-4 ring-pink-300'
            : 'bg-emerald-700 text-white border-white hover:bg-emerald-800'
        } text-xs">
          <span>💼</span>
        </div>
        <div class="w-2 h-2 ${isSelected ? 'bg-pink-600' : 'bg-emerald-700'} rotate-45 mx-auto -mt-1 shadow-sm"></div>
      </div>
    `,
    iconSize: [28, 32],
    iconAnchor: [14, 32],
  });
}

function createUserMarkerIcon(label = 'Bạn đang ở đây') {
  return L.divIcon({
    className: 'custom-user-marker',
    html: `
      <div class="relative flex items-center justify-center cursor-pointer z-30">
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
  selectedJobId = null,
  onSelectJob = null,
  height = '520px',
  singleJob = null,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersRef = useRef({});
  const [activeJob, setActiveJob] = useState(singleJob || null);
  const [currentLayerKey, setCurrentLayerKey] = useState('google_roadmap');
  const [geoLocating, setGeoLocating] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const center = singleJob?.location?.lat
        ? [singleJob.location.lat, singleJob.location.lng]
        : userLocation?.lat
        ? [userLocation.lat, userLocation.lng]
        : DEFAULT_CENTER;

      const map = L.map(mapContainerRef.current, {
        center,
        zoom: singleJob ? 16 : 14,
        zoomControl: true,
      });

      // Default: Google Maps Tiles (Roadmap)
      const layerConfig = MAP_LAYERS.google_roadmap;
      const tileLayer = L.tileLayer(layerConfig.url, {
        subdomains: layerConfig.subdomains,
        maxZoom: layerConfig.maxZoom,
        attribution: layerConfig.attribution,
      }).addTo(map);

      tileLayerRef.current = tileLayer;
      mapInstanceRef.current = map;

      // Fix tile loading & sizing issues
      setTimeout(() => {
        map.invalidateSize();
      }, 150);
    }
  }, []);

  // Switch Layer
  function switchLayer(layerKey) {
    const map = mapInstanceRef.current;
    if (!map || !MAP_LAYERS[layerKey]) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const cfg = MAP_LAYERS[layerKey];
    const newLayer = L.tileLayer(cfg.url, {
      subdomains: cfg.subdomains,
      maxZoom: cfg.maxZoom,
      attribution: cfg.attribution,
    }).addTo(map);

    tileLayerRef.current = newLayer;
    setCurrentLayerKey(layerKey);
  }

  // HTML5 Geolocation API (GeoAPI)
  function handleUseGeoAPI() {
    if (!navigator.geolocation) {
      alert('Trình duyệt của bạn không hỗ trợ định vị GPS.');
      return;
    }

    setGeoLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLocating(false);
        const { latitude, longitude } = pos.coords;
        const newLoc = {
          lat: latitude,
          lng: longitude,
          label: 'Vị trí GPS thực tế của bạn',
        };

        if (onUserLocationChange) {
          onUserLocationChange(newLoc);
        }

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], 15, { animate: true });
        }
      },
      (err) => {
        setGeoLocating(false);
        console.warn('Geolocation error:', err);
        alert('Không thể lấy vị trí GPS (vui lòng cho phép quyền truy cập vị trí trên trình duyệt).');
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }

  // Update Markers & Radius Circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous markers
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    // 1. User Location Marker
    if (userLocation?.lat && userLocation?.lng) {
      const userMarker = L.marker([userLocation.lat, userLocation.lng], {
        icon: createUserMarkerIcon(userLocation.label),
      }).addTo(map);

      userMarker.bindTooltip(userLocation.label || 'Vị trí của bạn', {
        permanent: false,
        direction: 'top',
        className: 'bg-blue-900 text-white px-2 py-1 rounded-lg text-xs font-semibold shadow-md',
      });

      markersRef.current['user'] = userMarker;
    }

    // 2. Job Markers
    const jobsToRender = singleJob ? [singleJob] : jobs;

    jobsToRender.forEach((job) => {
      const lat = job.location?.lat;
      const lng = job.location?.lng;
      if (!lat || !lng) return;

      const isSelected = job._id === selectedJobId || job.id === selectedJobId;
      const marker = L.marker([lat, lng], {
        icon: createJobMarkerIcon(job, isSelected),
      }).addTo(map);

      marker.bindTooltip(job.storeName || job.title, {
        direction: 'top',
        offset: [0, -16],
      });

      marker.on('click', () => {
        setActiveJob(job);
        onSelectJob?.(job);
        map.panTo([lat, lng]);
      });

      markersRef.current[job._id || job.id] = marker;
    });

    // Invalidate size in case tab or layout just rendered
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [jobs, singleJob, selectedJobId, userLocation]);

  return (
    <div className="relative rounded-3xl overflow-hidden border-2 border-green-200 shadow-card bg-cream">
      {/* Map Canvas */}
      <div ref={mapContainerRef} style={{ height }} className="w-full z-0" />

      {/* Floating Controls Top-Right: Layer Switcher & GPS GeoAPI Button */}
      <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
        {/* Layer Switcher */}
        <div className="bg-white/95 backdrop-blur-md p-1 rounded-2xl border border-green-100 shadow-md flex items-center gap-1">
          {Object.entries(MAP_LAYERS).map(([key, cfg]) => (
            <button
              key={key}
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
        <button
          onClick={handleUseGeoAPI}
          disabled={geoLocating}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-md text-xs font-bold flex items-center gap-1.5 transition-all"
          title="Sử dụng GPS thiết bị để định vị vị trí thật"
        >
          <Crosshair className={`w-3.5 h-3.5 ${geoLocating ? 'animate-spin' : ''}`} />
          <span>{geoLocating ? 'Đang định vị GPS...' : '📍 GPS vị trí thật'}</span>
        </button>
      </div>

      {/* Floating Map Legend Top-Left */}
      <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-green-100 shadow-md text-xs space-y-1 max-w-[240px]">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-600 inline-block shadow-sm"></span>
          <span className="font-bold text-text-main truncate">
            {userLocation?.label?.split('-')[0] || 'Vị trí của bạn'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-700 inline-block shadow-sm"></span>
          <span className="text-text-muted">Điểm quán ({jobs.length} địa điểm)</span>
        </div>
      </div>

      {/* Recenter Button Bottom-Right */}
      <button
        onClick={() => {
          if (userLocation?.lat && mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([userLocation.lat, userLocation.lng], 15, { animate: true });
          }
        }}
        className="absolute bottom-4 right-4 z-10 p-3 bg-white hover:bg-green-50 text-green-dark rounded-2xl border border-green-100 shadow-md font-bold text-xs flex items-center gap-1.5 transition-all"
        title="Quay về vị trí của bạn"
      >
        <Compass className="w-4 h-4 text-blue-600" />
        <span className="hidden sm:inline">Vị trí của tôi</span>
      </button>

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
              const dest = activeJob.address
                || (activeJob.storeName ? `${activeJob.storeName}, Hòa Lạc, Thạch Thất, Hà Nội` : '')
                || (activeJob.location?.lat && activeJob.location?.lng ? `${activeJob.location.lat},${activeJob.location.lng}` : 'Hòa Lạc, Thạch Thất, Hà Nội');
              return (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl border border-green-200 text-text-muted hover:text-green-dark hover:bg-green-50 text-xs transition-colors flex items-center gap-1"
                  title="Chỉ đường trên Google Maps đến vị trí này"
                >
                  <ExternalLink className="w-4 h-4 text-blue-600" />
                </a>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
