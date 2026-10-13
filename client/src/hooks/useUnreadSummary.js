import { useEffect, useState } from 'react';
import { getUnreadSummary } from '@/services';

const POLL_MS = 30000;
let summary = { unreadCount: 0, messages: 0 };
const subscribers = new Set();
let timer = null;
let inflight = null;

/** Làm mới số chưa đọc (chuông thông báo + tin nhắn) bằng MỘT request; các lời gọi đồng thời dùng chung kết quả. */
export function refreshUnreadSummary() {
  if (document.visibilityState === 'hidden') return Promise.resolve(summary);
  if (!inflight) {
    inflight = getUnreadSummary()
      .then((res) => {
        summary = { unreadCount: Number(res?.unreadCount) || 0, messages: Number(res?.messages) || 0 };
        subscribers.forEach((fn) => fn(summary));
        return summary;
      })
      .catch(() => summary) // không có số đếm cũng không sao: menu vẫn dùng được
      .finally(() => { inflight = null; });
  }
  return inflight;
}

function start() {
  refreshUnreadSummary();
  timer = setInterval(refreshUnreadSummary, POLL_MS);
  document.addEventListener('visibilitychange', refreshUnreadSummary);
}

function stop() {
  clearInterval(timer);
  timer = null;
  document.removeEventListener('visibilitychange', refreshUnreadSummary);
}

/** { unreadCount, messages }: chỉ một vòng hỏi máy chủ cho toàn bộ ứng dụng, dừng khi không còn nơi nào dùng. */
export function useUnreadSummary(enabled = true) {
  const [value, setValue] = useState(summary);
  useEffect(() => {
    if (!enabled) return undefined;
    subscribers.add(setValue);
    setValue(summary);
    if (subscribers.size === 1) start();
    return () => {
      subscribers.delete(setValue);
      if (subscribers.size === 0) stop();
    };
  }, [enabled]);
  return value;
}
