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
 * - "prompt" still unanswered after the first tap or key press: asks again (a gesture-backed request shows the full dialog).
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
    const retryOnGesture = () => {
      // Chrome may show only a quiet icon for a request made without a gesture; asking again on the first tap or key press shows the full dialog.
      document.removeEventListener('pointerdown', retryOnGesture);
      document.removeEventListener('keydown', retryOnGesture);
      if (perm?.state === 'prompt') requestLocation(DEFAULT_LOCATION_OPTIONS);
    };
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((p) => {
        perm = p;
        setPermissionState(p.state);
        if (p.state !== 'denied') requestLocation(DEFAULT_LOCATION_OPTIONS);
        if (p.state === 'prompt') {
          document.addEventListener('pointerdown', retryOnGesture, { once: true });
          document.addEventListener('keydown', retryOnGesture, { once: true });
        }
        p.onchange = () => {
          setPermissionState(p.state);
          if (p.state === 'granted') requestLocation(DEFAULT_LOCATION_OPTIONS);
          else if (p.state === 'denied') clearLocation();
        };
      })
      .catch(() => {});

    return () => {
      document.removeEventListener('pointerdown', retryOnGesture);
      document.removeEventListener('keydown', retryOnGesture);
      if (perm) perm.onchange = null;
    };
  }, [clearLocation, requestLocation, setPermissionState]);

  return null;
}
