import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Search,
  Crosshair,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Navigation,
  HelpCircle,
} from 'lucide-react';
import { isValidCoordinate } from '@/utils';
import { geocodeAddress } from '@/services';

const DEFAULT_MAP_CENTER = [21.0128, 105.5255]; // Hoa Lac center for view only

function createPinIcon() {
  return L.divIcon({
    className: 'custom-picker-pin',
    html: `
      <div class="relative cursor-grab active:cursor-grabbing transform -translate-x-1/2 -translate-y-full animate-bounce-once">
        <div class="w-8 h-8 rounded-full bg-pink-600 text-white flex items-center justify-center shadow-lg border-2 border-white ring-4 ring-pink-200">
          <span style="font-size: 14px;">📍</span>
        </div>
        <div class="w-2.5 h-2.5 bg-pink-600 rotate-45 mx-auto -mt-1.5 shadow-sm"></div>
      </div>
    `,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
  });
}

export default function LocationPicker({
  value = { lat: null, lng: null, locationStatus: 'unconfirmed', locationSource: null },
  onChange,
  addressHint = '',
  className = '',
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showManualInputs, setShowManualInputs] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [tileError, setTileError] = useState(false);

  const hasConfirmedLocation = Boolean(
    value?.lat !== null &&
    value?.lat !== undefined &&
    value?.lng !== null &&
    value?.lng !== undefined &&
    isValidCoordinate(value.lat, value.lng) &&
    value?.locationStatus === 'confirmed'
  );

  const updateLocation = useCallback((lat, lng, source) => {
    if (!isValidCoordinate(lat, lng)) {
      setSearchError('Tọa độ không hợp lệ. Vĩ độ phải từ -90 đến 90, kinh độ từ -180 đến 180.');
      return;
    }
    setSearchError('');
    onChange?.({
      lat: Number(Number(lat).toFixed(6)),
      lng: Number(Number(lng).toFixed(6)),
      locationStatus: 'confirmed',
      locationSource: source,
    });
  }, [onChange]);

  const handleClearLocation = useCallback(() => {
    if (markerRef.current && mapInstanceRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    setSearchError('');
    onChange?.({
      lat: null,
      lng: null,
      locationStatus: 'unconfirmed',
      locationSource: null,
    });
  }, [onChange]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // Prevent double init

    const initialLat = isValidCoordinate(value?.lat, value?.lng) ? value.lat : DEFAULT_MAP_CENTER[0];
    const initialLng = isValidCoordinate(value?.lat, value?.lng) ? value.lng : DEFAULT_MAP_CENTER[1];
    const initialZoom = isValidCoordinate(value?.lat, value?.lng) ? 16 : 13;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: true,
      attributionControl: true,
    });

    const tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    });

    tileLayer.on('tileerror', () => {
      setTileError(true);
    });

    tileLayer.addTo(map);
    mapInstanceRef.current = map;

    // Click map to place/move pin
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      updateLocation(lat, lng, 'map_pin');
    });

    // Invalidate size once rendered inside dialog
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []); // Run once on mount

  // Sync marker with value props
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (hasConfirmedLocation) {
      const pos = [value.lat, value.lng];
      if (!markerRef.current) {
        const marker = L.marker(pos, {
          icon: createPinIcon(),
          draggable: true,
          title: 'Kéo thả để điều chỉnh vị trí',
        }).addTo(map);

        marker.on('dragend', (e) => {
          const newPos = e.target.getLatLng();
          updateLocation(newPos.lat, newPos.lng, 'map_pin');
        });

        marker.bindPopup(`
          <div style="font-size: 11px; font-weight: 600; text-align: center;">
            📍 Vị trí quán đã ghim<br/>
            <span style="color: #6b7280; font-weight: normal;">Kéo thả để chỉnh sửa</span>
          </div>
        `);

        markerRef.current = marker;
      } else {
        markerRef.current.setLatLng(pos);
      }
    } else {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    }
  }, [hasConfirmedLocation, value?.lat, value?.lng, updateLocation]);

  // Handle Backend Nominatim Geocoding Search
  async function handleSearch(e) {
    if (e) e.preventDefault();
    const query = searchQuery.trim() || addressHint.trim();
    if (!query) {
      setSearchError('Vui lòng nhập tên địa chỉ hoặc tên quán để tìm kiếm.');
      return;
    }

    try {
      setSearching(true);
      setSearchError('');

      const res = await geocodeAddress(query);
      if (res?.lat !== undefined && res?.lng !== undefined && isValidCoordinate(res.lat, res.lng)) {
        const lat = res.lat;
        const lng = res.lng;
        updateLocation(lat, lng, 'geocoded');

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 16, { duration: 1.2 });
        }
      } else {
        setSearchError('Không tìm thấy địa điểm trên bản đồ. Bạn có thể click trực tiếp lên bản đồ để ghim vị trí quán.');
      }
    } catch (err) {
      setSearchError(err?.message || 'Không thể tìm kiếm địa chỉ lúc này. Vui lòng click chọn trực tiếp trên bản đồ.');
    } finally {
      setSearching(false);
    }
  }

  // Handle Get Device GPS
  function handleGetDeviceGps() {
    if (!navigator.geolocation) {
      setSearchError('Trình duyệt không hỗ trợ Geolocation.');
      return;
    }

    setGpsLoading(true);
    setSearchError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        const { latitude, longitude } = pos.coords;
        if (isValidCoordinate(latitude, longitude)) {
          updateLocation(latitude, longitude, 'device');
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([latitude, longitude], 17, { duration: 1 });
          }
        } else {
          setSearchError('Tọa độ từ thiết bị không hợp lệ.');
        }
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1) {
          setSearchError('Bạn đã từ chối quyền truy cập vị trí trên trình duyệt.');
        } else if (err.code === 3) {
          setSearchError('Quá thời gian lấy tín hiệu GPS từ thiết bị.');
        } else {
          setSearchError('Không thể lấy tọa độ từ thiết bị của bạn.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  // Handle Manual Coordinates Apply
  function handleApplyManualCoords(e) {
    if (e) e.preventDefault();
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);

    if (!isValidCoordinate(lat, lng)) {
      setSearchError('Vui lòng nhập vĩ độ (-90 đến 90) và kinh độ (-180 đến 180) hợp lệ.');
      return;
    }

    updateLocation(lat, lng, 'manual_coordinates');
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], 16, { duration: 1 });
    }
    setShowManualInputs(false);
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Search Bar & Actions */}
      <div className="flex flex-col sm:flex-row gap-2">
        <form onSubmit={handleSearch} className="flex-1 flex gap-1.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={addressHint ? `Tìm: ${addressHint}` : 'Tìm kiếm địa chỉ, tên đường, thôn, xã...'}
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-pink-main font-medium"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="px-3 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs flex items-center gap-1 shrink-0 disabled:opacity-50 transition-all shadow-sm"
          >
            {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>Tìm</span>
          </button>
        </form>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleGetDeviceGps}
            disabled={gpsLoading}
            className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs border border-blue-200 flex items-center gap-1 transition-all disabled:opacity-50"
            title="Lấy GPS từ thiết bị nếu bạn đang có mặt tại quán"
          >
            {gpsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5 text-blue-600" />}
            <span>Lấy GPS tại quán</span>
          </button>

          <button
            type="button"
            onClick={() => setShowManualInputs((prev) => !prev)}
            className="px-2.5 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold text-xs border border-gray-200 flex items-center gap-1 transition-all"
            title="Nhập tọa độ vĩ độ / kinh độ trực tiếp"
          >
            <Navigation className="w-3.5 h-3.5 text-gray-500" />
            <span>Tọa độ</span>
          </button>

          {hasConfirmedLocation && (
            <button
              type="button"
              onClick={handleClearLocation}
              className="px-2.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-xs border border-red-200 flex items-center gap-1 transition-all"
              title="Xóa ghim vị trí"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Manual Coordinate Form Drawer */}
      {showManualInputs && (
        <form onSubmit={handleApplyManualCoords} className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2 animate-fade-in">
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-700">
            <span>Nhập tọa độ thủ công:</span>
            <span className="text-[10px] text-gray-500 font-normal">Ví dụ: Lat: 21.0128, Lng: 105.5255</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="any"
              placeholder="Vĩ độ (Lat, VD: 21.0128)"
              value={manualLat}
              onChange={(e) => setManualLat(e.target.value)}
              className="p-2 text-xs rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-1 focus:ring-pink-main font-mono"
            />
            <input
              type="number"
              step="any"
              placeholder="Kinh độ (Lng, VD: 105.5255)"
              value={manualLng}
              onChange={(e) => setManualLng(e.target.value)}
              className="p-2 text-xs rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-1 focus:ring-pink-main font-mono"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowManualInputs(false)}
              className="px-2.5 py-1 text-xs text-gray-600 hover:text-gray-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-3 py-1 rounded-lg bg-pink-600 text-white font-bold text-xs hover:bg-pink-700"
            >
              Ghim tọa độ này
            </button>
          </div>
        </form>
      )}

      {/* Error alert if any */}
      {searchError && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{searchError}</span>
        </div>
      )}

      {/* Interactive Map Container */}
      <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
        <div
          ref={mapContainerRef}
          style={{ height: '260px', width: '100%', zIndex: 1 }}
          className="bg-slate-100"
        />

        {/* Tile warning if offline/tile error */}
        {tileError && (
          <div className="absolute top-2 right-2 z-[500] px-2.5 py-1 rounded-lg bg-white/95 shadow border border-amber-200 text-[10px] text-amber-800 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-amber-600" />
            <span>Mạng chậm khi tải lớp bản đồ</span>
          </div>
        )}

        {/* Floating helper overlay */}
        <div className="absolute bottom-2 left-2 z-[500] bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-lg shadow-sm border border-gray-200 text-[11px] text-gray-600 flex items-center gap-1.5 pointer-events-none">
          <HelpCircle className="w-3.5 h-3.5 text-pink-600 shrink-0" />
          <span>Click bản đồ hoặc kéo thả ghim 📍 để chọn vị trí chính xác của quán</span>
        </div>
      </div>

      {/* Status Confirmation Badge */}
      {hasConfirmedLocation ? (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-emerald-950">✓ Đã xác nhận vị trí quán trên bản đồ</p>
              <p className="text-[11px] text-emerald-700 font-mono mt-0.5 truncate">
                Tọa độ: {value.lat.toFixed(5)}, {value.lng.toFixed(5)} • Nguồn: {
                  value.locationSource === 'device' ? 'GPS thiết bị' :
                  value.locationSource === 'geocoded' ? 'Tìm kiếm địa chỉ' :
                  value.locationSource === 'map_pin' ? 'Ghim trên bản đồ' :
                  value.locationSource === 'places' ? 'Google Places' : 'Tọa độ thủ công'
                }
              </p>
            </div>
          </div>
          <a
            href={`https://www.google.com/maps?q=${value.lat},${value.lng}`}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold underline shrink-0"
          >
            Mở xem
          </a>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <div>
            <p className="font-bold text-amber-950">Chưa xác nhận vị trí quán</p>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Bạn có thể click trực tiếp lên bản đồ, tìm kiếm hoặc bấm &ldquo;Lấy GPS tại quán&rdquo; để xác nhận vị trí chính xác. Vị trí xác nhận là bắt buộc để sinh viên có thể chấm công GPS.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
