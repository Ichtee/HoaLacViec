import { useContext } from 'react';
import { LocationContext } from '@/context/LocationContext.jsx';

/**
 * Standardized Geolocation Hook for Hoa Lac Viec
 * Accesses the global location state provided by LocationProvider.
 *
 * Status states:
 * - 'idle': Initial state, user hasn't requested location
 * - 'requesting': Actively fetching GPS coordinates from device
 * - 'success' / 'granted': High-confidence real device coordinates acquired
 * - 'denied': User explicitly denied location permission (code 1)
 * - 'unavailable': Device cannot acquire position (code 2) or browser lacks API
 * - 'timeout': Device GPS took too long to resolve (code 3)
 * - 'insecure': Page is not running in HTTPS / secure context
 * - 'low_accuracy': Acquired coordinates but accuracy radius exceeds max allowed threshold
 */
export function useGeolocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useGeolocation must be used within a LocationProvider');
  }
  return context;
}
