import { createContext, useContext, useState, useCallback, useRef } from 'react';

/**
 * Global Location Context for Hoa Lac Viec
 * Holds geolocation state in memory (never writes raw GPS coordinates to localStorage without consent).
 */
export const LocationContext = createContext(null);

export const DEFAULT_LOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 12000,
  maximumAge: 60000,
};

/**
 * Checks whether the current window environment is a secure context.
 * HTTPS and localhost/127.0.0.1 are secure; LAN HTTP (192.168.x.x) is not.
 */
export function isSecureContextEnvironment() {
  if (typeof window === 'undefined') return true;
  if (typeof window.isSecureContext === 'boolean') {
    return window.isSecureContext;
  }
  const hostname = window.location?.hostname || '';
  const protocol = window.location?.protocol || '';
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
  return protocol === 'https:' || isLocal;
}

export function LocationProvider({ children }) {
  const [status, setStatus] = useState('idle');
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const [permissionState, setPermissionState] = useState(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const requestSeqRef = useRef(0);

  const requestLocation = useCallback((options = {}) => {
    const finalOptions = {
      ...DEFAULT_LOCATION_OPTIONS,
      ...options,
    };
    const seq = ++requestSeqRef.current;

    return new Promise((resolve) => {
      // 1. Insecure context check (HTTP on LAN or non-secure origins)
      if (!isSecureContextEnvironment()) {
        const errMsg = 'Định vị GPS yêu cầu kết nối bảo mật HTTPS (hoặc localhost khi phát triển). Kết nối qua HTTP không an toàn (ví dụ địa chỉ LAN 192.168.x.x) bị trình duyệt chặn.';
        setStatus('insecure');
        setError(errMsg);
        setCoords(null);
        return resolve(null);
      }

      // 2. Browser Geolocation API availability check
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        const errMsg = 'Trình duyệt của bạn không hỗ trợ Geolocation API.';
        setStatus('unavailable');
        setError(errMsg);
        setCoords(null);
        return resolve(null);
      }

      setStatus('requesting');
      setError(null);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (seq !== requestSeqRef.current) return resolve(null);

          const lat = position?.coords?.latitude;
          const lng = position?.coords?.longitude;
          const accuracy = Math.round(position?.coords?.accuracy || 0);
          const timestamp = position?.timestamp || Date.now();

          // Validate coordinates bounds strictly
          if (
            typeof lat !== 'number' ||
            typeof lng !== 'number' ||
            !Number.isFinite(lat) ||
            !Number.isFinite(lng) ||
            lat < -90 ||
            lat > 90 ||
            lng < -180 ||
            lng > 180
          ) {
            setStatus('unavailable');
            setError('Tọa độ GPS nhận được từ thiết bị không hợp lệ.');
            setCoords(null);
            return resolve(null);
          }

          const parsedCoords = { lat, lng, accuracy, timestamp };

          if (finalOptions.maxAccuracy && accuracy > finalOptions.maxAccuracy) {
            setStatus('low_accuracy');
            setError(`Sai số GPS khá lớn (±${accuracy}m). Vui lòng di chuyển ra nơi thoáng để cải thiện.`);
            setCoords(parsedCoords);
            return resolve(parsedCoords);
          }

          setStatus('success');
          setPermissionState('granted');
          setError(null);
          setErrorCode(null);
          setCoords(parsedCoords);
          return resolve(parsedCoords);
        },
        (err) => {
          if (seq !== requestSeqRef.current) return resolve(null);

          let newStatus = 'unavailable';
          let msg = 'Không thể xác định vị trí hiện tại của thiết bị.';

          switch (err?.code) {
            case 1: // PERMISSION_DENIED
              newStatus = 'denied';
              setPermissionState('denied');
              msg = 'Quyền vị trí đang bị chặn. Bấm biểu tượng bên trái thanh địa chỉ → Cài đặt trang web → Vị trí → Cho phép, sau đó tải lại trang.';
              break;
            case 2: // POSITION_UNAVAILABLE
              newStatus = 'unavailable';
              msg = 'Thiết bị không bắt được sóng GPS. Hãy thử bật vị trí (Location Services) trên thiết bị.';
              break;
            case 3: // TIMEOUT
              newStatus = 'timeout';
              msg = 'Hết thời gian chờ phản hồi GPS (timeout). Vui lòng thử lại.';
              break;
            default:
              newStatus = 'unavailable';
              msg = err?.message || 'Lỗi không xác định khi lấy vị trí GPS.';
              break;
          }

          setStatus(newStatus);
          setError(msg);
          setErrorCode(err?.code || 'UNAVAILABLE');
          setCoords(null);
          return resolve(null);
        },
        finalOptions
      );
    });
  }, []);

  const [errorCode, setErrorCode] = useState(null);

  const clearLocation = useCallback(() => {
    requestSeqRef.current++;
    setStatus('idle');
    setCoords(null);
    setError(null);
    setErrorCode(null);
  }, []);

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
  }, []);

  const value = {
    // Canonical contract names (Requirement 8)
    permissionStatus: permissionState,
    locationStatus: status,
    coords,
    accuracy: coords?.accuracy || null,
    error,
    requestLocation,
    clearLocation,

    // Aliases and state helpers for backwards compatibility
    status,
    setStatus,
    setCoords,
    timestamp: coords?.timestamp || null,
    setError,
    errorCode,
    setErrorCode,
    errorMessage: error,
    permissionState,
    setPermissionState,
    bannerDismissed,
    setBannerDismissed,
    dismissBanner,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}
