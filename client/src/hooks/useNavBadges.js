import { useEffect, useState } from 'react';
import { getChatUnreadCount } from '@/services';

const POLL_MS = 30000;

/** Số đếm hiển thị trên menu (hiện tại: tin nhắn chưa đọc). Chỉ hỏi máy chủ khi tab đang mở. */
export function useNavBadges(enabled = true) {
  const [badges, setBadges] = useState({ messages: 0 });

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    async function refresh() {
      if (document.visibilityState === 'hidden') return;
      try {
        const res = await getChatUnreadCount();
        if (!cancelled) setBadges({ messages: Number(res?.count) || 0 });
      } catch {
        // Không có số đếm cũng không sao: menu vẫn dùng được
      }
    }

    refresh();
    const timer = setInterval(refresh, POLL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [enabled]);

  return badges;
}
