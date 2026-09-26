/**
 * Authoritative Geolocation Bootstrap & Permission State Machine
 * Shared logic between LocationPermissionBootstrap and automated test runner.
 */

export const BOOTSTRAP_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 12000,
  maximumAge: 60000,
};

export const DENIED_GUIDANCE_MESSAGE =
  'Quyền vị trí đang bị chặn. Bấm biểu tượng bên trái thanh địa chỉ → Cài đặt trang web → Vị trí → Cho phép, sau đó tải lại trang.';

export const INSECURE_CONTEXT_MESSAGE =
  'Tính năng định vị GPS yêu cầu kết nối bảo mật HTTPS (hoặc localhost khi phát triển). Kết nối qua HTTP không an toàn (như địa chỉ LAN 192.168.x.x) không được trình duyệt coi là Secure Context.';

/**
 * Checks whether an environment is considered secure (HTTPS or localhost).
 */
export function checkIsSecureContext(win) {
  if (!win) return true;
  if (typeof win.isSecureContext === 'boolean') {
    return win.isSecureContext;
  }
  const hostname = win.location?.hostname || '';
  const protocol = win.location?.protocol || '';
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.localhost');
  return protocol === 'https:' || isLocal;
}

/**
 * Executes the Geolocation Bootstrap Lifecycle according to specification:
 * 1. Checks isSecureContext -> if false: status='insecure', does not call GPS.
 * 2. Checks navigator.geolocation -> if missing: status='unavailable'.
 * 3. Checks navigator.permissions.query:
 *    - prompt: calls getCurrentPosition immediately to show native prompt dialog.
 *    - granted: calls getCurrentPosition silently.
 *    - denied: does NOT call GPS repeatedly, sets guidance message.
 *    - attaches permission.onchange handler.
 * 4. Fallback if permissions.query is not supported: calls getCurrentPosition directly.
 */
export async function executeLocationBootstrap({
  isSecure = true,
  navigatorObj,
  didRequestRef,
  callbacks = {},
  options = BOOTSTRAP_OPTIONS,
}) {
  const {
    onStatusChange = () => {},
    onError = () => {},
    onCoordsChange = () => {},
    onPermissionChange = () => {},
  } = callbacks;

  // Prevent double invocation in React StrictMode
  if (didRequestRef && didRequestRef.current) {
    return { executed: false, reason: 'STRICT_MODE_GUARD' };
  }
  if (didRequestRef) {
    didRequestRef.current = true;
  }

  // 1. Insecure context check
  if (!isSecure) {
    onStatusChange('insecure');
    onError(INSECURE_CONTEXT_MESSAGE);
    return { executed: true, status: 'insecure', gpsInvoked: false };
  }

  // 2. Geolocation API presence check
  if (!navigatorObj || !navigatorObj.geolocation) {
    onStatusChange('unavailable');
    onError('Trình duyệt của bạn không hỗ trợ Geolocation API.');
    return { executed: true, status: 'unavailable', gpsInvoked: false };
  }

  let gpsInvoked = false;

  const triggerGps = (source = 'auto') => {
    gpsInvoked = true;
    onStatusChange('requesting');
    navigatorObj.geolocation.getCurrentPosition(
      (position) => {
        onCoordsChange(position?.coords || null);
        onStatusChange('success');
        onPermissionChange('granted');
      },
      (err) => {
        const code = err?.code;
        const newStatus = code === 1 ? 'denied' : code === 3 ? 'timeout' : 'unavailable';
        onStatusChange(newStatus);
        if (code === 1) {
          onPermissionChange('denied');
          onError(DENIED_GUIDANCE_MESSAGE);
        } else {
          onError(err?.message || 'Lỗi GPS');
        }
      },
      options
    );
  };

  // 3. Permissions API
  if (typeof navigatorObj.permissions?.query === 'function') {
    try {
      const perm = await navigatorObj.permissions.query({ name: 'geolocation' });
      onPermissionChange(perm.state);

      if (perm.state === 'prompt') {
        // Native prompt requested
        triggerGps('prompt');
      } else if (perm.state === 'granted') {
        // Silent acquisition
        triggerGps('granted');
      } else if (perm.state === 'denied') {
        // DO NOT call getCurrentPosition repeatedly
        onStatusChange('denied');
        onError(DENIED_GUIDANCE_MESSAGE);
      }

      // 6. Listen to permission.onchange
      perm.onchange = () => {
        const nextState = perm.state;
        onPermissionChange(nextState);

        if (nextState === 'granted') {
          // prompt -> granted: acquire location
          triggerGps('onchange_granted');
        } else if (nextState === 'denied') {
          // granted -> denied: wipe coordinates
          onCoordsChange(null);
          onStatusChange('denied');
          onError(DENIED_GUIDANCE_MESSAGE);
        } else if (nextState === 'prompt') {
          // denied -> prompt: show re-request button
          onStatusChange('idle');
          onError(null);
        }
      };

      return { executed: true, status: perm.state, gpsInvoked, perm };
    } catch {
      // Proceed to fallback
    }
  }

  // 4. Permissions API not supported fallback
  triggerGps('fallback_no_permissions_api');
  return { executed: true, status: 'fallback', gpsInvoked };
}
