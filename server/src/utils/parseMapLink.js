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

export async function resolveGoogleMapInput(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // First try direct regex parsing (fastest, no network call)
  const direct = parseGoogleCoordinates(trimmed);
  if (direct) return direct;

  // If it's a URL (http / https), follow redirects
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const response = await fetch(trimmed, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'vi,en;q=0.9'
        }
      });
      const finalUrl = response.url;
      const parsedFromFinal = parseGoogleCoordinates(finalUrl);
      if (parsedFromFinal) return parsedFromFinal;

      // Sometimes coordinates are inside page HTML meta/scripts
      const html = await response.text();
      const protoInHtml = html.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
      if (protoInHtml) {
        return { lat: parseFloat(protoInHtml[1]), lng: parseFloat(protoInHtml[2]) };
      }
      const atInHtml = html.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (atInHtml) {
        return { lat: parseFloat(atInHtml[1]), lng: parseFloat(atInHtml[2]) };
      }
      const previewMatch = html.match(/google\.com\/maps\/preview\/place\/[^"]*@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (previewMatch) {
        return { lat: parseFloat(previewMatch[1]), lng: parseFloat(previewMatch[2]) };
      }
    } catch (e) {
      console.warn('Failed to resolve short map link:', e.message);
    }
  }

  return null;
}

