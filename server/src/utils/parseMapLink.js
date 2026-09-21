import dns from 'dns';
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

export function parseGoogleCoordinates(input) {
  if (!input || typeof input !== 'string') return null;
  const text = input.trim();

  // 1. Raw coordinates (e.g. "21.03752, 105.51203" or "21.03752,105.51203" or "21.03752 105.51203")
  const rawMatch = text.match(/^(-?\d+\.\d{3,})[,\s]+(-?\d+\.\d{3,})$/);
  if (rawMatch) {
    return { lat: parseFloat(rawMatch[1]), lng: parseFloat(rawMatch[2]) };
  }

  // 2. DMS coordinates: 21°02'15.0"N 105°30'44.3"E
  const dmsRegex = /(\d+)[°\s]+(\d+)['\s]+([\d.]+)"?\s*([NSEW])/gi;
  const dmsMatches = [...text.matchAll(dmsRegex)];
  if (dmsMatches.length >= 2) {
    const toDec = (deg, min, sec, dir) => {
      let d = parseFloat(deg) + parseFloat(min) / 60 + parseFloat(sec) / 3600;
      if (dir === 'S' || dir === 'W') d = -d;
      return Math.round(d * 100000) / 100000;
    };
    return {
      lat: toDec(dmsMatches[0][1], dmsMatches[0][2], dmsMatches[0][3], dmsMatches[0][4].toUpperCase()),
      lng: toDec(dmsMatches[1][1], dmsMatches[1][2], dmsMatches[1][3], dmsMatches[1][4].toUpperCase())
    };
  }

  // 3. URL with @lat,lng (e.g. /@21.03752,105.51203,17z)
  const atMatch = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }

  // 4. URL with query / q / destination / ll
  const qMatch = text.match(/[?&](?:q|query|destination|ll)=(-?\d+\.\d+)[,+](-?\d+\.\d+)/);
  if (qMatch) {
    return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  }

  // 5. Protobuf coordinates !3dlat!4dlng in Google Maps URLs
  const protoMatch = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (protoMatch) {
    return { lat: parseFloat(protoMatch[1]), lng: parseFloat(protoMatch[2]) };
  }

  return null;
}

function isSafeMapsUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    // Block IP addresses (IPv4 & IPv6), localhost, and local hostnames
    if (
      /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) ||
      hostname.startsWith('[') ||
      hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return false;
    }
    // Must belong to google.com or goo.gl domains
    return /^(.*\.)?(google\.com|goo\.gl)$/i.test(hostname);
  } catch {
    return false;
  }
}

export async function resolveGoogleMapInput(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // 1. Direct regex parsing (fastest, zero network call)
  const direct = parseGoogleCoordinates(trimmed);
  if (direct) return direct;

  // 2. Validate URL before making any network request (SSRF prevention)
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return null;
  }

  if (!isSafeMapsUrl(trimmed)) {
    console.warn('[SSRF Protection] Blocked unsafe or non-Google Maps URL:', trimmed);
    return null;
  }

  try {
    let currentUrl = trimmed;
    let redirects = 0;
    const maxRedirects = 5;

    while (redirects < maxRedirects) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'vi,en;q=0.9',
        },
      });
      clearTimeout(timeoutId);

      // Check if redirect
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) break;

        const nextUrl = new URL(location, currentUrl).toString();
        if (!isSafeMapsUrl(nextUrl)) {
          console.warn('[SSRF Protection] Blocked redirect to unsafe URL:', nextUrl);
          return null;
        }

        currentUrl = nextUrl;
        redirects++;

        // Test if coordinates are in URL query/path directly
        const parsedRedirect = parseGoogleCoordinates(currentUrl);
        if (parsedRedirect) return parsedRedirect;
        continue;
      }

      // If successful response, check final URL
      const parsedFromFinal = parseGoogleCoordinates(currentUrl);
      if (parsedFromFinal) return parsedFromFinal;

      // Extract coordinates from HTML (limit to first 256KB to avoid memory exhaustion)
      const text = await response.text();
      const limitedText = text.slice(0, 262144);

      const protoInHtml = limitedText.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
      if (protoInHtml) {
        return { lat: parseFloat(protoInHtml[1]), lng: parseFloat(protoInHtml[2]) };
      }
      const atInHtml = limitedText.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (atInHtml) {
        return { lat: parseFloat(atInHtml[1]), lng: parseFloat(atInHtml[2]) };
      }
      const previewMatch = limitedText.match(/google\.com\/maps\/preview\/place\/[^"]*@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (previewMatch) {
        return { lat: parseFloat(previewMatch[1]), lng: parseFloat(previewMatch[2]) };
      }

      break;
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      console.warn('Failed to resolve short map link:', e.message);
    }
  }

  return null;
}

