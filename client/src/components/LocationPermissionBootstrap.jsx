import { useEffect, useRef } from 'react';
import { useGeolocation } from '@/hooks/useGeolocation.js';
import { DEFAULT_LOCATION_OPTIONS, isSecureContextEnvironment } from '@/context/LocationContext.jsx';

/**
 * LocationPermissionBootstrap (mounted once at the App root, renders nothing)
 *
 * Like Google Maps: asks for the position as soon as the site opens, using the browser's own
 * permission dialog. Shows no banner of its own.
 * - "prompt": requests the position, which opens the native dialog (the browser asks again on a
 *   later visit if the user closed it without choosing).
 * - "granted": reads the position silently so distances work.
 * - "denied": does nothing (the browser blocks the dialog anyway); GPS buttons still explain how to unblock.
 * - permission revoked later: clears the stored coordinates.
 */
export function LocationPermissionBootstrap() {
  const { requestLocation, clearLocation, setPermissionState } = useGeolocation();
  const didRunRef = useRef(false);

  useEffect(() => {
    if (didRunRef.current) return undefined; // React StrictMode double-mount
    didRunRef.current = true;

    if (!isSecureContextEnvironment() || !navigator.geolocation) return undefined;
    if (typeof navigator.permissions?.query !== 'function') {
      requestLocation(DEFAULT_LOCATION_OPTIONS); // no Permissions API: ask directly
      return undefined;
    }

    let perm = null;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((p) => {
        perm = p;
        setPermissionState(p.state);
        if (p.state !== 'denied') requestLocation(DEFAULT_LOCATION_OPTIONS);
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
