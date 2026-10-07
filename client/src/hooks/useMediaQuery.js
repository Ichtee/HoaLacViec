import { useSyncExternalStore } from 'react';

/** Theo dõi một media query (ví dụ '(min-width: 1024px)'); an toàn khi render phía máy chủ/kiểm thử. */
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (notify) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', notify);
      return () => mql.removeEventListener('change', notify);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}
