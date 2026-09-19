import dns from 'dns';
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

// In-memory cache to save SerpApi requests (queries cached indefinitely during runtime)
const placesCache = new Map();

/**
 * Searches Google Maps places using SerpApi
 * @param {string} query - The place name or address to search (e.g. "Xôi Bánh Mỳ cô Hà" or "Café Xanh Hòa Lạc")
 * @param {object} centerCoords - Optional { lat, lng } to bias the search (defaults to Hòa Lạc: 21.0128, 105.5255)
 * @returns {Promise<Array>} List of matching places with exact Google Maps coordinates
 */
export async function searchGoogleMapsPlaces(query, centerCoords = null) {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    throw new Error('Chưa cấu hình SERPAPI_API_KEY trong file server/.env');
  }

  if (!query || typeof query !== 'string' || !query.trim()) {
    return [];
  }

  const normalizedQuery = query.trim().toLowerCase();
  const cacheKey = `${normalizedQuery}_${centerCoords?.lat || 21.0128}_${centerCoords?.lng || 105.5255}`;
  if (placesCache.has(cacheKey)) {
    console.log(`[SerpApi] Serving from CACHE (0 quota used): "${query.trim()}"`);
    return placesCache.get(cacheKey);
  }

  const lat = centerCoords?.lat || 21.0128;
  const lng = centerCoords?.lng || 105.5255;
  const zoom = 14;

  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_maps');
  url.searchParams.set('q', query.trim());
  url.searchParams.set('ll', `@${lat},${lng},${zoom}z`);
  url.searchParams.set('hl', 'vi');
  url.searchParams.set('gl', 'vn');
  url.searchParams.set('api_key', apiKey);

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SerpApi error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // If a single place was directly matched (place_results)
  if (data.place_results) {
    const p = data.place_results;
    return [{
      title: p.title || query,
      address: p.address || '',
      lat: p.gps_coordinates?.latitude || null,
      lng: p.gps_coordinates?.longitude || null,
      rating: p.rating || null,
      reviews: p.reviews || null,
      type: p.type || '',
      place_id: p.place_id || '',
      thumbnail: p.thumbnail || '',
    }].filter(item => item.lat && item.lng);
  }

  // If multiple local results were returned (local_results)
  const results = data.local_results || [];
  const finalPlaces = results.map(r => ({
    title: r.title,
    address: r.address || '',
    lat: r.gps_coordinates?.latitude || null,
    lng: r.gps_coordinates?.longitude || null,
    rating: r.rating || null,
    reviews: r.reviews || null,
    type: r.type || '',
    place_id: r.place_id || '',
    thumbnail: r.thumbnail || '',
  })).filter(item => item.lat && item.lng);

  placesCache.set(cacheKey, finalPlaces);
  return finalPlaces;
}

