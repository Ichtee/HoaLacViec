import { useEffect, useRef, useState, useCallback } from 'react';
import {
  MapPin,
  Search,
  Crosshair,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Check,
  X,
} from 'lucide-react';
import { isValidCoordinate } from '@/utils';
import {
  apiVietmapAutocomplete,
  apiVietmapPlace,
  apiVietmapReverse,
} from '@/services';
import {
  vietmapgl,
  VIETMAP_API_KEY,
  VIETMAP_STYLES,
  DEFAULT_HOALAC_CENTER_GL,
} from '@/utils/vietmapGLHelper.js';
import { useGeolocation } from '@/hooks/useGeolocation.js';

function createPickerPinElement() {
  const el = document.createElement('div');
  el.className = 'vietmap-picker-pin';
  el.style.cursor = 'grab';
  el.innerHTML = `
    <div style="position: relative; transform: translate(-50%, -100%);">
      <div style="width: 34px; height: 34px; border-radius: 50%; background: #db2777; color: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(219, 39, 119, 0.4); border: 2.5px solid white;">
        <span style="font-size: 16px;">📍</span>
      </div>
      <div style="width: 10px; height: 10px; background: #db2777; transform: rotate(45deg); margin: -5px auto 0; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>
    </div>
  `;
  return el;
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
  const searchAbortRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [showManualInputs, setShowManualInputs] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [accuracyWarning, setAccuracyWarning] = useState('');
  const [tileLoadError, setTileLoadError] = useState(false);

  // Use centralized useGeolocation hook
  const { requestLocation } = useGeolocation();
  const [gpsLoading, setGpsLoading] = useState(false);

  // Staged location holds current active coordinates on the map
  const [stagedLocation, setStagedLocation] = useState(
    isValidCoordinate(value?.lat, value?.lng)
      ? {
          lat: Number(value.lat),
          lng: Number(value.lng),
          source: value.locationSource || 'map_pin',
          status: value.locationStatus || 'unconfirmed',
          displayName: value.formattedAddress || '',
          provider: value.geocodingProvider || null,
          refId: value.providerPlaceId || null,
          addressComponents: value.addressComponents || null,
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
        displayName: value.formattedAddress || '',
        provider: value.geocodingProvider || null,
        refId: value.providerPlaceId || null,
        addressComponents: value.addressComponents || null,
      });
    } else if (value?.lat === null && value?.lng === null) {
      setStagedLocation(null);
    }
  }, [
    value?.lat,
    value?.lng,
    value?.locationSource,
    value?.locationStatus,
    value?.formattedAddress,
    value?.geocodingProvider,
    value?.providerPlaceId,
    value?.addressComponents,
  ]);

  const hasConfirmedLocation = Boolean(
    value?.lat !== null &&
    value?.lat !== undefined &&
    value?.lng !== null &&
    value?.lng !== undefined &&
    isValidCoordinate(value.lat, value.lng) &&
    value?.locationStatus === 'confirmed'
  );

  // Stage location with pending_confirmation (Never auto-confirm)
  const stageLocation = useCallback(
    (lat, lng, source, displayName = '', provider = 'vietmap', refId = null, addressComponents = null) => {
      if (!isValidCoordinate(lat, lng)) {
        setSearchError('Tọa độ không hợp lệ. Vĩ độ phải từ -90 đến 90, kinh độ từ -180 đến 180.');
        return;
      }
      setSearchError('');
      const newCoords = {
        lat: Number(Number(lat).toFixed(6)),
        lng: Number(Number(lng).toFixed(6)),
        source,
        provider,
        refId,
        status: 'pending_confirmation',
        displayName,
        addressComponents,
      };
      setStagedLocation(newCoords);
      onChange?.({
        lat: newCoords.lat,
        lng: newCoords.lng,
        locationStatus: 'pending_confirmation',
        locationSource: source,
        geocodingProvider: provider,
        providerPlaceId: refId,
        formattedAddress: displayName || undefined,
        addressComponents: addressComponents || undefined,
      });
    },
    [onChange]
  );

  // Reverse geocoding helper on map click, pin drag, or GPS
  const handleReverseLookup = useCallback(
    async (lat, lng, source) => {
      stageLocation(lat, lng, source);
      try {
        const res = await apiVietmapReverse(lat, lng);
        // New response shape: { success, provider, display, addressLine, lat, lng, addressComponents }
        if (res?.success && res.display) {
          stageLocation(
            lat,
            lng,
            source,
            res.display,
            'vietmap',
            res.refId || null,
            res.addressComponents || null,
          );
        }
      } catch (err) {
        console.warn('[VietmapReverse] Lookup failed:', err.message);
      }
    },
    [stageLocation]
  );

  // Explicit confirmation button action
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
      geocodingProvider: target.provider || target.geocodingProvider || 'vietmap',
      providerPlaceId: target.refId || target.providerPlaceId || null,
      formattedAddress: target.displayName || target.formattedAddress || undefined,
      addressComponents: target.addressComponents || undefined,
    });
  }, [stagedLocation, value, onChange]);

  const handleClearLocation = useCallback(() => {
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    setStagedLocation(null);
    setSearchError('');
    setAccuracyWarning('');
    setCandidates([]);
    setSearchQuery('');
    onChange?.({
      lat: null,
      lng: null,
      locationStatus: 'unconfirmed',
      locationSource: null,
      geocodingProvider: null,
      providerPlaceId: null,
      formattedAddress: '',
    });
  }, [onChange]);

  // Debounced Autocomplete Search (300ms, minLength=2, AbortController)
  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setCandidates([]);
      return;
    }

    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    const controller = new AbortController();
    searchAbortRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        setSearchError('');

        let focus = undefined;
        if (mapInstanceRef.current) {
          const center = mapInstanceRef.current.getCenter();
          focus = `${center.lat.toFixed(6)},${center.lng.toFixed(6)}`;
        }

        const res = await apiVietmapAutocomplete(query, focus, controller.signal);
        // New response shape returns 'items' (not 'suggestions')
        const items = res?.items || res?.suggestions || [];
        if (items.length > 0) {
          setCandidates(items.slice(0, 10));
        } else {
          setCandidates([]);
          setSearchError('Không tìm thấy địa điểm phù hợp trên Vietmap.');
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setSearchError('Không thể tìm kiếm lúc này. Vui lòng thử lại sau.');
        }
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  // Initialize Native Vietmap GL Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialCoords = isValidCoordinate(value?.lat, value?.lng)
      ? [Number(value.lng), Number(value.lat)] // [lng, lat] for Vietmap GL
      : DEFAULT_HOALAC_CENTER_GL;

    const map = new vietmapgl.Map({
      container: mapContainerRef.current,
      style: VIETMAP_STYLES.STREETS,
      center: initialCoords,
      zoom: isValidCoordinate(value?.lat, value?.lng) ? 15 : 13,
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

    // Click map to place/move pin and reverse-geocode address
    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      setAccuracyWarning('');
      setCandidates([]);
      handleReverseLookup(lat, lng, 'map_pin');
    });

    // ResizeObserver to keep Vietmap GL canvas properly sized
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        map.resize();
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync marker position with stagedLocation or value
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const activeLoc = stagedLocation || (isValidCoordinate(value?.lat, value?.lng) ? value : null);

    if (activeLoc && isValidCoordinate(activeLoc.lat, activeLoc.lng)) {
      const lngLat = [Number(activeLoc.lng), Number(activeLoc.lat)]; // [lng, lat]
      if (!markerRef.current) {
        const marker = new vietmapgl.Marker({
          element: createPickerPinElement(),
          draggable: true,
        })
          .setLngLat(lngLat)
          .addTo(map);

        marker.on('dragend', () => {
          const newPos = marker.getLngLat();
          setAccuracyWarning('');
          handleReverseLookup(newPos.lat, newPos.lng, 'map_pin');
        });

        markerRef.current = marker;
      } else {
        markerRef.current.setLngLat(lngLat);
      }
    } else {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    }
  }, [stagedLocation, value?.lat, value?.lng, handleReverseLookup]);

  // Handle manual submit search button
  async function handleSearch(e) {
    if (e) e.preventDefault();
    const query = searchQuery.trim() || addressHint.trim();
    if (query.length < 2) {
      setSearchError('Vui lòng nhập ít nhất 2 ký tự để tìm kiếm.');
      return;
    }

    try {
      setSearching(true);
      setSearchError('');
      setCandidates([]);

      let focus = undefined;
      if (mapInstanceRef.current) {
        const center = mapInstanceRef.current.getCenter();
        focus = `${center.lat.toFixed(6)},${center.lng.toFixed(6)}`;
      }

      const res = await apiVietmapAutocomplete(query, focus);
      const items = res?.items || res?.suggestions || [];
      if (items.length > 0) {
        setCandidates(items.slice(0, 10));
      } else {
        setCandidates([]);
        setSearchError('Không tìm thấy địa điểm phù hợp trên Vietmap.');
      }
    } catch (err) {
      setSearchError(err.message || 'Lỗi khi tìm kiếm trên Vietmap');
    } finally {
      setSearching(false);
    }
  }

  // Handle selecting candidate suggestion -> calls Place API
  async function handleSelectCandidate(candidate) {
    setCandidates([]);
    setSearchQuery(candidate.display || candidate.name || candidate.address || '');

    try {
      setSearching(true);
      // New response shape: { success, provider, display, addressLine, lat, lng, addressComponents }
      const place = await apiVietmapPlace(candidate.refId);
      if (place && place.success && isValidCoordinate(place.lat, place.lng)) {
        const nLat = Number(place.lat);
        const nLng = Number(place.lng);

        stageLocation(
          nLat,
          nLng,
          'places',
          place.display || candidate.display || '',
          'vietmap',
          candidate.refId,
          place.addressComponents || null,
        );

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo({
            center: [nLng, nLat],
            zoom: 16,
            duration: 1000,
          });
        }
      } else {
        setSearchError('Không thể lấy tọa độ chi tiết của địa điểm này.');
      }
    } catch (err) {
      setSearchError(err.message || 'Lỗi khi tải chi tiết địa điểm.');
    } finally {
      setSearching(false);
    }
  }

  // GPS Current Location Flow
  async function handleCurrentLocation() {
    setGpsLoading(true);
    setSearchError('');
    setAccuracyWarning('');

    const res = await requestLocation({ timeoutMs: 12000, highAccuracy: true });
    setGpsLoading(false);

    if (res.success && res.location) {
      const { lat, lng, accuracy } = res.location;
      if (isValidCoordinate(lat, lng)) {
        if (accuracy && accuracy > 100) {
          setAccuracyWarning(`Độ chính xác GPS là ±${Math.round(accuracy)}m (kém). Vui lòng kéo ghim đến đúng cửa hàng.`);
        }
        stageLocation(lat, lng, 'device');
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo({
            center: [Number(lng), Number(lat)],
            zoom: 16,
            duration: 1000,
          });
        }
        handleReverseLookup(lat, lng, 'device');
      } else {
        setSearchError('Tọa độ GPS nhận được không hợp lệ.');
      }
    } else {
      setSearchError(res.message || 'Không thể lấy vị trí GPS từ thiết bị của bạn.');
    }
  }

  // Apply manual lat/lng
  function handleApplyManual() {
    setSearchError('');
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (!isValidCoordinate(lat, lng)) {
      setSearchError('Tọa độ thủ công không hợp lệ. Vui lòng nhập số thực hợp lệ.');
      return;
    }
    stageLocation(lat, lng, 'manual_coordinates');
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo({
        center: [lng, lat],
        zoom: 16,
        duration: 1000,
      });
    }
    handleReverseLookup(lat, lng, 'manual_coordinates');
  }

  const currentDisplayStatus = stagedLocation?.status || value?.locationStatus || 'unconfirmed';

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Top Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2 relative">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={addressHint ? `Tìm trên Vietmap (gợi ý: ${addressHint})` : 'Tìm kiếm quán, đường phố trên Vietmap...'}
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-green-200 bg-white text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-green-main focus:border-transparent transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCandidates([]);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={searching}
            className="px-4 py-2 rounded-xl bg-green-main hover:bg-green-dark text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
          >
            {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>Tìm</span>
          </button>
        </form>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCurrentLocation}
            disabled={gpsLoading}
            className="px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 shrink-0"
            title="Lấy vị trí hiện tại của thiết bị"
          >
            {gpsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">GPS của tôi</span>
          </button>

          {(stagedLocation || isValidCoordinate(value?.lat, value?.lng)) && (
            <button
              type="button"
              onClick={handleClearLocation}
              className="p-2 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-all text-xs"
              title="Xóa ghim vị trí"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Autocomplete Suggestions Dropdown */}
      {candidates.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xl border border-green-100 p-2 max-h-56 overflow-y-auto space-y-1">
          <div className="text-[11px] font-semibold text-text-muted px-2 py-1 flex items-center justify-between border-b border-gray-100 mb-1">
            <span>Gợi ý địa điểm từ Vietmap ({candidates.length})</span>
            <span className="text-[10px] text-orange-600">Chọn địa điểm để xem vị trí</span>
          </div>
          {candidates.map((candidate, idx) => (
            <button
              key={candidate.refId || idx}
              type="button"
              onClick={() => handleSelectCandidate(candidate)}
              className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-green-50 transition-colors flex items-start gap-2 group"
            >
              <MapPin className="w-3.5 h-3.5 text-green-main shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-text-main group-hover:text-green-dark truncate">
                  {candidate.display || candidate.name}
                </p>
                {candidate.address && (
                  <p className="text-[11px] text-text-muted truncate">{candidate.address}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Errors and Warnings */}
      {searchError && (
        <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{searchError}</span>
        </div>
      )}
      {accuracyWarning && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>{accuracyWarning}</span>
        </div>
      )}

      {/* Vietmap GL Map Canvas Container */}
      <div className="relative rounded-2xl overflow-hidden border border-green-100 shadow-sm bg-gray-50">
        <div
          ref={mapContainerRef}
          style={{ width: '100%', height: '320px' }}
          className="relative z-0"
        />

        {/* Fallback banner if missing tile key or 401/403 error */}
        {(!VIETMAP_API_KEY || tileLoadError) && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-50/95 backdrop-blur-sm p-4 text-center">
            <AlertCircle className="w-8 h-8 text-amber-500 mb-1.5" />
            <p className="font-semibold text-xs text-gray-800">
              {!VIETMAP_API_KEY ? 'Chưa cấu hình Vietmap Tile Key' : 'Không thể tải bản đồ Vietmap'}
            </p>
            <p className="text-[11px] text-gray-600 mt-1 max-w-xs leading-relaxed">
              {!VIETMAP_API_KEY
                ? 'Vui lòng điền VITE_VIETMAP_TILE_API_KEY vào tệp client/.env và khởi động lại Vite dev server.'
                : 'Lỗi xác thực Tile Key (401/403). Vui lòng kiểm tra VITE_VIETMAP_TILE_API_KEY trong client/.env và khởi động lại dev server.'}
            </p>
          </div>
        )}

        {/* Floating Vietmap Attribution & Guide Badge */}
        <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
          <span className="px-2.5 py-1 rounded-lg bg-white/90 backdrop-blur-sm text-[11px] font-semibold text-gray-700 shadow-sm border border-gray-100 flex items-center gap-1.5">
            <span className="text-pink-600">📍</span>
            <span>Bản đồ Vietmap: Click hoặc kéo ghim để chọn</span>
          </span>
        </div>
      </div>

      {/* Bottom Confirmation & Address Panel */}
      <div className="p-3 bg-white rounded-2xl border border-green-100 shadow-sm space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-text-main">Trạng thái vị trí:</span>
            {hasConfirmedLocation ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Đã xác nhận trên Vietmap
              </span>
            ) : currentDisplayStatus === 'pending_confirmation' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 animate-pulse">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Chờ xác nhận vị trí ghim
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                Chưa ghim vị trí
              </span>
            )}
          </div>

          {/* Explicit Confirm Button */}
          {stagedLocation && currentDisplayStatus !== 'confirmed' && (
            <button
              type="button"
              onClick={handleConfirmLocation}
              className="w-full sm:w-auto px-4 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Xác nhận vị trí này</span>
            </button>
          )}
        </div>

        {/* Display Resolved Address & Coordinates */}
        {(stagedLocation || isValidCoordinate(value?.lat, value?.lng)) && (
          <div className="text-xs text-text-muted space-y-1 bg-gray-50/70 p-2.5 rounded-xl border border-gray-100">
            {(stagedLocation?.displayName || value?.formattedAddress) && (
              <p className="text-text-main font-medium flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-pink-600 shrink-0 mt-0.5" />
                <span className="line-clamp-2">
                  {stagedLocation?.displayName || value?.formattedAddress}
                </span>
              </p>
            )}
            <p className="text-[11px] text-gray-500 font-mono">
              Tọa độ: {(stagedLocation?.lat ?? value?.lat)?.toFixed(6)}, {(stagedLocation?.lng ?? value?.lng)?.toFixed(6)}
            </p>
          </div>
        )}

        {/* Manual Coordinates Toggle */}
        <div className="pt-1 border-t border-gray-100 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => setShowManualInputs(!showManualInputs)}
            className="text-[11px] text-green-700 hover:text-green-900 font-semibold"
          >
            {showManualInputs ? 'Ẩn nhập tọa độ thủ công' : 'Nhập tọa độ thủ công (kinh độ, vĩ độ)'}
          </button>
        </div>

        {showManualInputs && (
          <div className="pt-2 border-t border-dashed border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={manualLat}
              onChange={(e) => setManualLat(e.target.value)}
              placeholder="Vĩ độ (VD: 21.0128)"
              className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs"
            />
            <input
              type="text"
              value={manualLng}
              onChange={(e) => setManualLng(e.target.value)}
              placeholder="Kinh độ (VD: 105.5255)"
              className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs"
            />
            <button
              type="button"
              onClick={handleApplyManual}
              className="px-3 py-1.5 bg-gray-800 text-white rounded-xl text-xs font-semibold hover:bg-black transition-all"
            >
              Áp dụng
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
