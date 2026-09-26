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
  Check,
} from 'lucide-react';
import { isValidCoordinate } from '@/utils';
import { geocodeAddress } from '@/services';
import { useGeolocation } from '@/hooks/useGeolocation.js';

const DEFAULT_MAP_CENTER = [21.0128, 105.5255]; // Hoa Lac center for view only

function createPinIcon() {
  return L.divIcon({
    className: 'custom-picker-pin',
    html: `
      <div class="relative cursor-grab active:cursor-grabbing transform -translate-x-1/2 -translate-y-full">
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
  const [candidates, setCandidates] = useState([]);
  const [showManualInputs, setShowManualInputs] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [accuracyWarning, setAccuracyWarning] = useState('');

  // Use centralized useGeolocation hook (Requirement Phase 6 item 1)
  const { requestLocation, status: gpsStatus, coords: gpsCoords } = useGeolocation();
  const [gpsLoading, setGpsLoading] = useState(false);

  // Staged location holds current active coordinates on the map
  const [stagedLocation, setStagedLocation] = useState(
    isValidCoordinate(value?.lat, value?.lng)
      ? {
          lat: Number(value.lat),
          lng: Number(value.lng),
          source: value.locationSource || 'map_pin',
          status: value.locationStatus || 'unconfirmed',
          displayName: '',
        }
      : null
  );

  // Sync staged location when external value changes
  useEffect(() => {
    if (isValidCoordinate(value?.lat, value?.lng)) {
      setStagedLocation({
        lat: Number(value.lat),
        lng: Number(value.lng),
        source: value.locationSource || 'map_pin',
        status: value.locationStatus || 'unconfirmed',
      });
    } else if (value?.lat === null && value?.lng === null) {
      setStagedLocation(null);
    }
  }, [value?.lat, value?.lng, value?.locationSource, value?.locationStatus]);

  const hasConfirmedLocation = Boolean(
    value?.lat !== null &&
    value?.lat !== undefined &&
    value?.lng !== null &&
    value?.lng !== undefined &&
    isValidCoordinate(value.lat, value.lng) &&
    value?.locationStatus === 'confirmed'
  );

  // Stage location with pending_confirmation (Phase 3 item 2)
  const stageLocation = useCallback((lat, lng, source, displayName = '') => {
    if (!isValidCoordinate(lat, lng)) {
      setSearchError('Tọa độ không hợp lệ. Vĩ độ phải từ -90 đến 90, kinh độ từ -180 đến 180.');
      return;
    }
    setSearchError('');
    const newCoords = {
      lat: Number(Number(lat).toFixed(6)),
      lng: Number(Number(lng).toFixed(6)),
      source,
      status: 'pending_confirmation',
      displayName,
    };
    setStagedLocation(newCoords);
    onChange?.({
      lat: newCoords.lat,
      lng: newCoords.lng,
      locationStatus: 'pending_confirmation',
      locationSource: source,
      formattedAddress: displayName || undefined,
    });
  }, [onChange]);

  // Explicit confirmation button action (Phase 3 item 2)
  const handleConfirmLocation = useCallback(() => {
    const target = stagedLocation || (isValidCoordinate(value?.lat, value?.lng) ? value : null);
    if (!target || !isValidCoordinate(target.lat, target.lng)) {
      setSearchError('Chưa có vị trí hợp lệ để xác nhận. Vui lòng click lên bản đồ để chọn vị trí quán.');
      return;
    }
    setSearchError('');
    onChange?.({
      lat: Number(Number(target.lat).toFixed(6)),
      lng: Number(Number(target.lng).toFixed(6)),
      locationStatus: 'confirmed',
      locationSource: target.source || target.locationSource || 'map_pin',
      formattedAddress: target.displayName || undefined,
    });
  }, [stagedLocation, value, onChange]);

  const handleClearLocation = useCallback(() => {
    if (markerRef.current && mapInstanceRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    setStagedLocation(null);
    setSearchError('');
    setAccuracyWarning('');
    setCandidates([]);
    onChange?.({
      lat: null,
      lng: null,
      locationStatus: 'unconfirmed',
      locationSource: null,
    });
  }, [onChange]);

  // Initialize Leaflet Map with valid OpenStreetMap tiles (Phase 1 item 3)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialLat = isValidCoordinate(value?.lat, value?.lng) ? value.lat : DEFAULT_MAP_CENTER[0];
    const initialLng = isValidCoordinate(value?.lat, value?.lng) ? value.lng : DEFAULT_MAP_CENTER[1];
    const initialZoom = isValidCoordinate(value?.lat, value?.lng) ? 16 : 13;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: true,
      attributionControl: true,
    });

    // Google Maps Tile Layer (Fast, reliable and not blocked by Vietnamese ISPs)
    const tileLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      maxZoom: 20,
      attribution: '&copy; Google Maps',
    });

    tileLayer.addTo(map);
    mapInstanceRef.current = map;

    // Click map to place/move pin
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      setAccuracyWarning('');
      setCandidates([]);
      stageLocation(lat, lng, 'map_pin');
    });

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
  }, [stageLocation]);

  // Sync marker with stagedLocation or value
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const activeLoc = stagedLocation || (isValidCoordinate(value?.lat, value?.lng) ? value : null);

    if (activeLoc && isValidCoordinate(activeLoc.lat, activeLoc.lng)) {
      const pos = [Number(activeLoc.lat), Number(activeLoc.lng)];
      if (!markerRef.current) {
        const marker = L.marker(pos, {
          icon: createPinIcon(),
          draggable: true,
          title: 'Kéo thả để điều chỉnh vị trí',
        }).addTo(map);

        marker.on('dragend', (e) => {
          const newPos = e.target.getLatLng();
          setAccuracyWarning('');
          stageLocation(newPos.lat, newPos.lng, 'map_pin');
        });

        marker.bindPopup(`
          <div style="font-size: 11px; font-weight: 600; text-align: center;">
            📍 Vị trí ghim quán<br/>
            <span style="color: #6b7280; font-weight: normal;">Bấm "Xác nhận vị trí này" bên dưới bản đồ</span>
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
  }, [stagedLocation, value?.lat, value?.lng, stageLocation]);

  // Handle Backend Nominatim Geocoding Search: displays 3-5 candidates (Phase 1 item 6)
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
      setCandidates([]);

      const res = await geocodeAddress(query);
      const list = res?.candidates || res?.results || [];

      if (Array.isArray(list) && list.length > 0) {
        setCandidates(list.slice(0, 5));
      } else if (res?.lat !== undefined && res?.lng !== undefined && isValidCoordinate(res.lat, res.lng)) {
        setCandidates([{ lat: res.lat, lng: res.lng, displayName: res.displayName || query }]);
      } else {
        setSearchError('Không tìm thấy địa điểm trên bản đồ. Bạn có thể click trực tiếp lên bản đồ để ghim vị trí quán.');
      }
    } catch (err) {
      setSearchError(err?.message || 'Không thể tìm kiếm địa chỉ lúc này. Vui lòng click chọn trực tiếp trên bản đồ.');
    } finally {
      setSearching(false);
    }
  }

  // Handle choosing a specific geocoded candidate (Phase 1 item 6)
  function handleSelectCandidate(cand) {
    setAccuracyWarning('');
    stageLocation(cand.lat, cand.lng, 'geocoded', cand.displayName);
    setCandidates([]);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([cand.lat, cand.lng], 16, { duration: 1.2 });
    }
  }

  // Handle Get Device GPS via centralized useGeolocation (Phase 3 item 4 & Phase 6 item 1)
  async function handleGetDeviceGps() {
    setGpsLoading(true);
    setSearchError('');
    setAccuracyWarning('');
    setCandidates([]);

    try {
      const res = await requestLocation({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
      if (res && isValidCoordinate(res.lat, res.lng)) {
        // Phase 3 item 4: if accuracy > 100m, warn clearly, do not auto confirm
        if (res.accuracy && res.accuracy > 100) {
          setAccuracyWarning(`Độ sai số GPS của thiết bị khá lớn (±${Math.round(res.accuracy)}m > 100m). Vui lòng kéo pin trên bản đồ đến vị trí chính xác của quán trước khi bấm xác nhận.`);
        }
        stageLocation(res.lat, res.lng, 'device');
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([res.lat, res.lng], 17, { duration: 1 });
        }
      } else {
        setSearchError('Không lấy được tọa độ GPS từ thiết bị. Hãy chắc chắn bạn đã cấp quyền và bật định vị.');
      }
    } catch {
      setSearchError('Lỗi khi lấy vị trí thiết bị.');
    } finally {
      setGpsLoading(false);
    }
  }

  // Handle Manual Coordinates Apply (Phase 3 item 3: manual coordinates require user to view pin & confirm)
  function handleApplyManualCoords(e) {
    if (e) e.preventDefault();
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);

    if (!isValidCoordinate(lat, lng)) {
      setSearchError('Vui lòng nhập vĩ độ (-90 đến 90) và kinh độ (-180 đến 180) hợp lệ.');
      return;
    }

    setAccuracyWarning('');
    setCandidates([]);
    stageLocation(lat, lng, 'manual_coordinates');
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], 16, { duration: 1 });
    }
    setShowManualInputs(false);
  }

  const isConfirmed = value?.locationStatus === 'confirmed';
  const isPending = stagedLocation?.status === 'pending_confirmation' || value?.locationStatus === 'pending_confirmation';
  const isUnconfirmed = !isConfirmed && !isPending;

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

          {(hasConfirmedLocation || stagedLocation) && (
            <button
              type="button"
              onClick={handleClearLocation}
              className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-all"
              title="Xóa ghim vị trí"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Geocoding Candidate List (Phase 1 item 6: Never auto-select result 0, show 3-5 candidates) */}
      {candidates.length > 0 && (
        <div className="p-2.5 rounded-2xl bg-white border border-pink-200 shadow-md space-y-1.5 animate-fade-in">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold text-gray-700">
              Chọn địa điểm phù hợp nhất ({candidates.length} kết quả tìm được):
            </span>
            <button
              type="button"
              onClick={() => setCandidates([])}
              className="text-[10px] text-gray-400 hover:text-gray-600"
            >
              Đóng
            </button>
          </div>
          <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
            {candidates.map((cand, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectCandidate(cand)}
                className="w-full text-left p-2 rounded-xl hover:bg-pink-50 text-xs transition-colors flex items-start gap-2"
              >
                <MapPin className="w-3.5 h-3.5 text-pink-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 line-clamp-1">{cand.displayName}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {cand.lat.toFixed(5)}, {cand.lng.toFixed(5)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Manual Coordinates Input Form */}
      {showManualInputs && (
        <form onSubmit={handleApplyManualCoords} className="p-3 bg-gray-50 rounded-2xl border border-gray-200 flex flex-wrap gap-2 items-center text-xs animate-fade-in">
          <div className="flex items-center gap-1">
            <span className="text-gray-500 font-medium">Vĩ độ:</span>
            <input
              type="number"
              step="any"
              placeholder="VD: 21.0128"
              value={manualLat}
              onChange={(e) => setManualLat(e.target.value)}
              className="w-28 px-2 py-1 bg-white border border-gray-300 rounded-lg text-xs"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500 font-medium">Kinh độ:</span>
            <input
              type="number"
              step="any"
              placeholder="VD: 105.5255"
              value={manualLng}
              onChange={(e) => setManualLng(e.target.value)}
              className="w-28 px-2 py-1 bg-white border border-gray-300 rounded-lg text-xs"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1 bg-gray-800 hover:bg-black text-white font-bold rounded-lg text-xs"
          >
            Xem trên bản đồ
          </button>
        </form>
      )}

      {/* Warnings & Errors */}
      {searchError && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-1.5 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{searchError}</span>
        </div>
      )}

      {accuracyWarning && (
        <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-950 text-xs flex items-center gap-1.5 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-orange-600 shrink-0" />
          <span>{accuracyWarning}</span>
        </div>
      )}

      {/* Map Container */}
      <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-inner">
        <div ref={mapContainerRef} style={{ height: '300px', width: '100%' }} />

        {/* Floating Controls Overlay */}
        <div className="absolute top-2 right-2 z-[400] flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (mapInstanceRef.current) {
                mapInstanceRef.current.setView(DEFAULT_MAP_CENTER, 14);
              }
            }}
            className="bg-white/95 hover:bg-white p-1.5 rounded-lg shadow border border-gray-200 text-gray-700 text-[10px] font-bold"
            title="Đưa bản đồ về trung tâm Hòa Lạc"
          >
            Hòa Lạc
          </button>
        </div>

        {/* Map Click Helper Banner */}
        <div className="absolute bottom-2 left-2 right-2 z-[400] pointer-events-none">
          <div className="bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-xl text-[11px] text-center pointer-events-auto">
            💡 Click hoặc kéo thả chiếc ghim đỏ 📍 để chọn đúng vị trí quán của bạn
          </div>
        </div>
      </div>

      {/* Confirmation & Status Bar (Phase 3 items 1, 2) */}
      <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          {isConfirmed ? (
            <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Đã xác nhận vị trí trên bản đồ ({value.lat.toFixed(5)}, {value.lng.toFixed(5)})</span>
            </div>
          ) : isPending ? (
            <div className="flex items-center gap-1.5 text-amber-700 font-bold">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Đang chọn tọa độ ({stagedLocation.lat.toFixed(5)}, {stagedLocation.lng.toFixed(5)}) — Cần xác nhận lại</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-gray-600 font-medium">
              <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
              <span>Chưa có vị trí bản đồ (Tin tuyển dụng sẽ chỉ hiển thị địa chỉ text)</span>
            </div>
          )}
        </div>

        {/* Action Button: Confirm this location */}
        {(stagedLocation || (isValidCoordinate(value?.lat, value?.lng) && !isConfirmed)) && (
          <button
            type="button"
            onClick={handleConfirmLocation}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all shrink-0"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Xác nhận vị trí này</span>
          </button>
        )}
      </div>
    </div>
  );
}
