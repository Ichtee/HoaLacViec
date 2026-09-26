import { useEffect, useRef, useState, useCallback } from 'react';
import { ShieldAlert, MapPin, Loader2, X, RotateCcw, AlertTriangle } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation.js';
import { DEFAULT_LOCATION_OPTIONS, isSecureContextEnvironment } from '@/context/LocationContext.jsx';

/**
 * LocationPermissionBootstrap
 *
 * Mounts exactly once at App root.
 * Automatically checks and prompts for Geolocation permission upon load/refresh:
 * - Insecure context (!window.isSecureContext): sets status='insecure', never calls GPS.
 * - Geolocation missing: sets status='unavailable'.
 * - Permissions API supported:
 *     * prompt: calls getCurrentPosition immediately to trigger the native browser permission dialog.
 *     * granted: acquires position silently.
 *     * denied: does NOT poll or re-request; displays guidance banner to reset permission in Site Settings.
 * - Permissions API not supported: falls back to direct getCurrentPosition.
 * - Listens to permission.onchange:
 *     * prompt -> granted: fetches coordinates.
 *     * granted -> denied: wipes coordinates from state.
 *     * denied -> prompt: displays "Yêu cầu lại vị trí" button.
 * - Always provides manual fallback button "Cho phép truy cập vị trí" for quiet permission prompt support.
 * - Prevents double requests in React StrictMode using didRequestRef.
 */
export function LocationPermissionBootstrap() {
  const {
    status,
    setStatus,
    coords,
    setError,
    permissionState,
    setPermissionState,
    requestLocation,
    clearLocation,
  } = useGeolocation();

  const [dismissed, setDismissed] = useState(false);
  const didRequestRef = useRef(false);

  // Manual fallback button callback (Requirement 8)
  const handleManualAllow = useCallback(async () => {
    setDismissed(false);
    await requestLocation(DEFAULT_LOCATION_OPTIONS);
  }, [requestLocation]);

  useEffect(() => {
    // Prevent double invocation in React StrictMode (Requirement 2)
    if (didRequestRef.current) return;
    didRequestRef.current = true;

    let activePermission = null;

    async function bootstrapLocation() {
      // 1. Insecure context check (Requirement 3 & 12)
      if (!isSecureContextEnvironment()) {
        setStatus('insecure');
        setError('Tính năng định vị GPS yêu cầu kết nối bảo mật HTTPS (hoặc localhost khi phát triển). Kết nối qua HTTP không an toàn (như địa chỉ LAN 192.168.x.x) không được trình duyệt coi là Secure Context.');
        return;
      }

      // 2. Geolocation API presence check (Requirement 3)
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setStatus('unavailable');
        setError('Trình duyệt của bạn không hỗ trợ Geolocation API.');
        return;
      }

      // 3. Permissions API check (Requirement 3 & 6)
      if (typeof navigator.permissions?.query === 'function') {
        try {
          const perm = await navigator.permissions.query({ name: 'geolocation' });
          activePermission = perm;
          setPermissionState(perm.state);

          // Handle initial state
          if (perm.state === 'prompt') {
            // Trigger native permission dialog immediately
            requestLocation(DEFAULT_LOCATION_OPTIONS);
          } else if (perm.state === 'granted') {
            // Acquire position silently without dialog
            requestLocation(DEFAULT_LOCATION_OPTIONS);
          } else if (perm.state === 'denied') {
            // Do NOT call repeatedly; show guidance banner
            setStatus('denied');
            setError('Quyền vị trí đang bị chặn. Bấm biểu tượng bên trái thanh địa chỉ → Cài đặt trang web → Vị trí → Cho phép, sau đó tải lại trang.');
          }

          // Listen for permission state changes (Requirement 6)
          perm.onchange = () => {
            const nextState = perm.state;
            setPermissionState(nextState);

            if (nextState === 'granted') {
              // prompt -> granted: acquire location
              requestLocation(DEFAULT_LOCATION_OPTIONS);
            } else if (nextState === 'denied') {
              // granted -> denied: wipe coordinates from state
              clearLocation();
              setStatus('denied');
              setError('Quyền vị trí đang bị chặn. Bấm biểu tượng bên trái thanh địa chỉ → Cài đặt trang web → Vị trí → Cho phép, sau đó tải lại trang.');
            } else if (nextState === 'prompt') {
              // denied -> prompt: show re-request button
              setStatus('idle');
              setError(null);
            }
          };
          return;
        } catch {
          // Permissions API unsupported or failed for 'geolocation', proceed to fallback
        }
      }

      // 4. Fallback if Permissions API is not supported (Requirement 3)
      requestLocation(DEFAULT_LOCATION_OPTIONS);
    }

    bootstrapLocation();

    return () => {
      if (activePermission) {
        activePermission.onchange = null;
      }
    };
  }, [clearLocation, requestLocation, setError, setPermissionState, setStatus]);

  // If user explicitly dismissed or location is successfully acquired, hide intrusive banner
  if (dismissed || status === 'success' || status === 'granted') {
    return null;
  }

  // Render UI according to status (Requirement 7, 8, 13)
  if (status === 'denied') {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-3 text-xs sm:text-sm shadow-sm transition-all animate-fade-in"
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 flex-1">
            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-950">
                Quyền vị trí đang bị chặn trên trình duyệt.
              </p>
              <p className="text-amber-800 mt-0.5 leading-relaxed">
                Bấm biểu tượng bên trái thanh địa chỉ URL 🔒 → Cài đặt trang web → Vị trí → Cho phép, sau đó tải lại trang để tự động tính khoảng cách tới các quán việc làm.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0">
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-xl text-xs flex items-center gap-1 shadow-sm transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Tải lại trang
            </button>
            <button
              onClick={handleManualAllow}
              className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 font-medium rounded-xl border border-amber-300 text-xs flex items-center gap-1 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-amber-600" />
              Cho phép truy cập vị trí
            </button>
            <button
              onClick={() => setDismissed(true)}
              aria-label="Đóng thông báo"
              className="p-1.5 text-amber-600 hover:text-amber-900 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'insecure') {
    return (
      <div
        role="alert"
        className="bg-red-50 border-b border-red-200 text-red-900 px-4 py-3 text-xs sm:text-sm shadow-sm animate-fade-in"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span>
              <strong>Cảnh báo bảo mật:</strong> Định vị GPS yêu cầu kết nối bảo mật HTTPS (hoặc localhost). Kết nối HTTP (như IP LAN 192.168.x.x) không được hỗ trợ bởi trình duyệt.
            </span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Đóng thông báo"
            className="p-1 text-red-600 hover:text-red-900 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (status === 'requesting') {
    return (
      <div className="bg-blue-50 border-b border-blue-200 text-blue-900 px-4 py-2.5 text-xs sm:text-sm shadow-sm animate-fade-in">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
            <span>Đang yêu cầu quyền vị trí từ trình duyệt để định vị quanh Hòa Lạc...</span>
          </div>
          <button
            onClick={handleManualAllow}
            className="px-2.5 py-1 bg-white hover:bg-blue-100 text-blue-800 font-semibold rounded-lg border border-blue-200 text-xs flex items-center gap-1 shadow-sm transition-colors"
          >
            <MapPin className="w-3.5 h-3.5 text-blue-600" />
            Cho phép truy cập vị trí
          </button>
        </div>
      </div>
    );
  }

  if (status === 'timeout') {
    return (
      <div className="bg-orange-50 border-b border-orange-200 text-orange-900 px-4 py-2.5 text-xs sm:text-sm shadow-sm animate-fade-in">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0" />
            <span>Hết thời gian chờ phản hồi GPS (timeout). Vui lòng thử lại.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleManualAllow}
              className="px-2.5 py-1 bg-white hover:bg-orange-100 text-orange-800 font-semibold rounded-lg border border-orange-200 text-xs flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5 text-orange-600" />
              Cho phép truy cập vị trí
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="p-1 text-orange-600 hover:text-orange-900"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'unavailable') {
    return (
      <div className="bg-gray-50 border-b border-gray-200 text-gray-800 px-4 py-2.5 text-xs sm:text-sm shadow-sm animate-fade-in">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span>Không thể xác định vị trí hiện tại hoặc trình duyệt chưa bật dịch vụ định vị.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleManualAllow}
              className="px-2.5 py-1 bg-white hover:bg-gray-100 text-gray-800 font-medium rounded-lg border border-gray-300 text-xs"
            >
              Thử lại
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="p-1 text-gray-500 hover:text-gray-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'low_accuracy') {
    return (
      <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2 text-xs sm:text-sm animate-fade-in">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <span>Sai số GPS khá lớn (±{coords?.accuracy || '??'}m). Vui lòng di chuyển ra nơi thoáng hơn để cải thiện.</span>
          <button
            onClick={handleManualAllow}
            className="px-2 py-1 bg-white hover:bg-amber-100 text-amber-800 font-medium rounded-lg border border-amber-200 text-xs"
          >
            Lấy lại vị trí
          </button>
        </div>
      </div>
    );
  }

  // When permission was reset from denied -> prompt, provide quick "Yêu cầu lại vị trí" button
  if (permissionState === 'prompt' && status === 'idle') {
    return (
      <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-950 px-4 py-2.5 text-xs sm:text-sm shadow-sm animate-fade-in">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Cho phép định vị để tự động sắp xếp các việc làm gần bạn nhất quanh Hòa Lạc.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleManualAllow}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1 shadow-sm transition-colors"
            >
              Yêu cầu lại vị trí
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="p-1 text-emerald-700 hover:text-emerald-900"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
