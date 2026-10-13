import { useUnreadSummary } from './useUnreadSummary.js';

/** Số đếm hiển thị trên menu (hiện tại: tin nhắn chưa đọc), dùng chung một lượt hỏi máy chủ với chuông thông báo. */
export function useNavBadges(enabled = true) {
  const { messages } = useUnreadSummary(enabled);
  return { messages };
}
