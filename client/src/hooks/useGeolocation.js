import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Standardized Geolocation Hook for Hoa Lac Viec
 *
 * Status states:
 * - 'idle': Initial state, user hasn't requested location
 * - 'requesting': Actively fetching GPS coordinates from device
 * - 'success': High-confidence real device coordinates acquired
 * - 'denied': User explicitly denied location permission (code 1)
 * - 'unavailable': Device cannot acquire position (code 2) or browser lacks API
 * - 'timeout': Device GPS took too long to resolve (code 3)
 * - 'insecure': Page is not running in HTTPS / secure context
 * - 'low_accuracy': Acquired coordinates but accuracy radius exceeds max allowed threshold
 */

export function useGeolocation() {
  const [status, setStatus] = useState('idle');
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);

  const mountedRef = useRef(true);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;

    // Detect if browser already blocked location permission so UI can adapt immediately
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' })
        .then((perm) => {
          if (!mountedRef.current) return;
          if (perm.state === 'denied') {
            setStatus('denied');
            setError('Trình duyệt đang chặn quyền vị trí. Vui lòng mở quyền tại biểu tượng ổ khóa 🔒 trên thanh địa chỉ URL.');
          }
          perm.onchange = () => {
            if (!mountedRef.current) return;
            if (perm.state === 'denied') {
              setStatus('denied');
              setError('Trình duyệt đang chặn quyền vị trí. Vui lòng mở quyền tại biểu tượng ổ khóa 🔒 trên thanh địa chỉ URL.');
            } else if (perm.state === 'prompt') {
              setStatus('idle');
              setError(null);
            }
          };
        })
        .catch(() => {});
    }

    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Explicitly requests the user's location.
   *
   * @param {Object} [options]
   * @param {boolean} [options.enableHighAccuracy=true] - High precision GPS
   * @param {number} [options.timeout=12000] - Timeout in milliseconds
   * @param {number} [options.maximumAge=0] - Cache age (0 for attendance, >0 for job browsing)
   * @param {number} [options.maxAccuracy=150] - Threshold for warning about poor GPS drift
   * @returns {Promise<{ lat: number, lng: number, accuracy: number, timestamp: number } | null>}
   */
  const requestLocation = useCallback((options = {}) => {
    const {
      enableHighAccuracy = true,
      timeout = 12000,
      maximumAge = 0,
      maxAccuracy = null,
    } = options;

    const seq = ++requestSeqRef.current;

    return new Promise((resolve) => {
      // 1. Check secure context (HTTPS / localhost)
      if (typeof window !== 'undefined' && window.isSecureContext === false) {
        const errMsg = 'Định vị GPS yêu cầu kết nối bảo mật HTTPS.';
        if (mountedRef.current && seq === requestSeqRef.current) {
          setStatus('insecure');
          setError(errMsg);
          setCoords(null);
        }
        return resolve(null);
      }

      // 2. Check browser support
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        const errMsg = 'Trình duyệt của bạn không hỗ trợ Geolocation.';
        if (mountedRef.current && seq === requestSeqRef.current) {
          setStatus('unavailable');
          setError(errMsg);
          setCoords(null);
        }
        return resolve(null);
      }

      if (mountedRef.current && seq === requestSeqRef.current) {
        setStatus('requesting');
        setError(null);
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!mountedRef.current || seq !== requestSeqRef.current) return;

          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = Math.round(position.coords.accuracy || 0);
          const timestamp = position.timestamp || Date.now();

          // Coordinate bounds validation
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            setStatus('unavailable');
            setError('Tọa độ GPS nhận được từ thiết bị không hợp lệ.');
            setCoords(null);
            return resolve(null);
          }

          const parsedCoords = { lat, lng, accuracy, timestamp };

          if (maxAccuracy && accuracy > maxAccuracy) {
            setStatus('low_accuracy');
            setError(`Sai số GPS khá lớn (±${accuracy}m). Vui lòng di chuyển ra nơi thoáng để cải thiện độ chính xác.`);
            setCoords(parsedCoords);
            return resolve(parsedCoords);
          }

          setStatus('success');
          setError(null);
          setCoords(parsedCoords);
          return resolve(parsedCoords);
        },
        (err) => {
          if (!mountedRef.current || seq !== requestSeqRef.current) return;

          let newStatus = 'unavailable';
          let msg = 'Không thể xác định vị trí hiện tại của thiết bị.';

          switch (err.code) {
            case 1: // PERMISSION_DENIED
              newStatus = 'denied';
              msg = 'Bạn đã từ chối quyền truy cập vị trí trên trình duyệt. Vui lòng cho phép quyền để tiếp tục.';
              break;
            case 2: // POSITION_UNAVAILABLE
              newStatus = 'unavailable';
              msg = 'Thiết bị không bắt được sóng GPS. Hãy thử bật vị trí (Location Services) trên điện thoại/máy tính.';
              break;
            case 3: // TIMEOUT
              newStatus = 'timeout';
              msg = 'Quá thời gian lấy vị trí GPS (timeout). Vui lòng thử lại.';
              break;
            default:
              newStatus = 'unavailable';
              msg = err.message || 'Lỗi không xác định khi lấy vị trí GPS.';
              break;
          }

          setStatus(newStatus);
          setError(msg);
          setCoords(null);
          return resolve(null);
        },
        { enableHighAccuracy, timeout, maximumAge }
      );
    });
  }, []);

  const clearLocation = useCallback(() => {
    requestSeqRef.current++;
    setStatus('idle');
    setCoords(null);
    setError(null);
  }, []);

  return {
    status,
    coords,
    error,
    requestLocation,
    clearLocation,
  };
}
