/**
 * Vietmap Tile Layer Integration for Leaflet
 * Uses @vietmap/vietmap-gl-leaflet and @vietmap/vietmap-gl-js
 *
 * Keeps Leaflet API and all existing markers/popups/plugins intact,
 * while rendering Vietmap tiles with official attribution.
 */

import L from 'leaflet';
import '@vietmap/vietmap-gl-js/dist/vietmap-gl.css';
import '@vietmap/vietmap-gl-leaflet';

export const VIETMAP_ATTRIBUTION = '&copy; <a href="https://maps.vietmap.vn/" target="_blank" rel="noreferrer">Vietmap</a>';

/**
 * Creates and attaches a Vietmap layer to a Leaflet map.
 * Priority:
 * 1. Vietmap Vector GL layer via L.vietmapGL with VITE_VIETMAP_TILE_API_KEY
 * 2. Vietmap Raster tileLayer fallback if GL is not supported or errors
 * 3. OSM fallback if tile key is completely unset in dev
 *
 * @param {L.Map} map
 * @returns {L.Layer}
 */
export function createVietmapTileLayer(options = {}) {
  const tileApiKey = (import.meta.env.VITE_VIETMAP_TILE_API_KEY || '').trim();

  if (tileApiKey && typeof L.vietmapGL === 'function') {
    try {
      const glLayer = L.vietmapGL({
        style: `https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=${tileApiKey}`,
        pane: 'tilePane',
        ...options,
      });
      return glLayer;
    } catch (glErr) {
      console.warn('[VietmapGL] WebGL initialization fallback to raster:', glErr.message);
      // Fallback to Vietmap raster tiles
      return L.tileLayer(`https://maps.vietmap.vn/tm/{z}/{x}/{y}@2x.png?apikey=${tileApiKey}`, {
        maxZoom: 19,
        attribution: VIETMAP_ATTRIBUTION,
      });
    }
  }

  if (tileApiKey) {
    return L.tileLayer(`https://maps.vietmap.vn/tm/{z}/{x}/{y}@2x.png?apikey=${tileApiKey}`, {
      maxZoom: 19,
      attribution: VIETMAP_ATTRIBUTION,
    });
  }

  // Graceful fallback for local development before user adds VITE_VIETMAP_TILE_API_KEY
  return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors | Cấu hình VITE_VIETMAP_TILE_API_KEY để kích hoạt Vietmap',
  });
}
