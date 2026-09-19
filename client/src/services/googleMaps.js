let loadPromise = null;

/**
 * Dynamically loads the official Google Maps JavaScript API script.
 * Supports libraries: places (for autocomplete), geometry, marker.
 */
export function loadGoogleMapsScript(apiKey) {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window not found'));

  // Already loaded
  if (window.google && window.google.maps) {
    return Promise.resolve(window.google.maps);
  }

  // Already loading
  if (loadPromise) {
    return loadPromise;
  }

  const key = apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!key) {
    return Promise.reject(new Error('Vui lòng cấu hình VITE_GOOGLE_MAPS_API_KEY trong file client/.env'));
  }

  loadPromise = new Promise((resolve, reject) => {
    // Check if script element already exists in document
    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.google.maps));
      existingScript.addEventListener('error', (err) => reject(err));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places,geometry&loading=async&language=vi&region=VN`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (window.google && window.google.maps) {
        resolve(window.google.maps);
      } else {
        reject(new Error('Google Maps script loaded but google.maps is not available'));
      }
    };

    script.onerror = (err) => {
      loadPromise = null;
      reject(new Error('Không thể tải Google Maps API. Kiểm tra kết nối mạng hoặc API key.'));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

