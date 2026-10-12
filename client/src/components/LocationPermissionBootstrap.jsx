import { useEffect, useRef } from 'react';
import { useGeolocation } from '@/hooks/useGeolocation.js';
import { DEFAULT_LOCATION_OPTIONS, isSecureContextEnvironment } from '@/context/LocationContext.jsx';

/**
 * LocationPermissionBootstrap (mounted once at the App root, renders nothing)
 *
 * Never triggers the browser's permission dialog and shows no banner.
 * - permission already "granted": reads the position silently so distances work.
 * - "prompt" / "denied" / Permissions API unavailable: does nothing; location is only
 *   requested when the user clicks a GPS button (job list, location picker).
 * - permission revoked later: clears the stored coordinates.
 */
export function LocationPermissionBootstrap() {
  const { requestLocation, clearLocation, setPermissionState } = useGeolocation();
  const didRunRef = useRef(false);

  useEffect(() => {
    if (didRunRef.current) return undefined; // React StrictMode double-mount
    didRunRef.current = true;

    if (!isSecureContextEnvironment() || !navigator.geolocation) return undefined;
    if (typeof navigator.permissions?.query !== 'function') return undefined;

    let perm = null;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((p) => {
        perm = p;
        setPermissionState(p.state);
        if (p.state === 'granted') requestLocation(DEFAULT_LOCATION_OPTIONS);
        p.onchange = () => {
          setPermissionState(p.state);
          if (p.state === 'granted') requestLocation(DEFAULT_LOCATION_OPTIONS);
          else if (p.state === 'denied') clearLocation();
        };
      })
      .catch(() => {});

    return () => {
      if (perm) perm.onchange = null;
    };
  }, [clearLocation, requestLocation, setPermissionState]);

  return null;
}
