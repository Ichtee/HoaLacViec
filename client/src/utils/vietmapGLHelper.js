import vietmapgl from '@vietmap/vietmap-gl-js/dist/vietmap-gl.js';
import '@vietmap/vietmap-gl-js/dist/vietmap-gl.css';

export { vietmapgl };

export const VIETMAP_API_KEY = typeof import.meta !== 'undefined' && import.meta.env
  ? import.meta.env.VITE_VIETMAP_TILE_API_KEY || ''
  : '';

export const VIETMAP_STYLES = {
  STREETS: `https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=${VIETMAP_API_KEY}`,
  DARK: `https://maps.vietmap.vn/maps/styles/dm/style.json?apikey=${VIETMAP_API_KEY}`,
  LIGHT: `https://maps.vietmap.vn/maps/styles/lm/style.json?apikey=${VIETMAP_API_KEY}`,
};

// Default center for Hoa Lac area in Vietmap GL format: [longitude, latitude]
export const DEFAULT_HOALAC_CENTER_GL = [105.5255, 21.0128];
