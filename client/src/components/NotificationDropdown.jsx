import { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  apiGetNotifications,
  apiGetUnreadNotificationCount,
  apiMarkNotificationRead,
  apiMarkAllNotificationsRead,
  apiDeleteNotification,
} from '@/services';

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Fetch unread count on mount & every 30 seconds
  const fetchCount = async () => {
    try {
      const res = await apiGetUnreadNotificationCount();
      if (typeof res?.unreadCount === 'number') {
        setUnreadCount(res.unreadCount);
      }
    } catch {
      // ignore
    }
  };

  const fetchList = async () => {
    try {
      setLoading(true);
      const data = await apiGetNotifications({ limit: 20 });
      if (Array.isArray(data)) {
        setNotifications(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCount();
    const timer = setInterval(fetchCount, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (open) {
      fetchList();
      fetchCount();
    }
  }, [open]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleMarkAsRead = async (id, e) => {
    e?.stopPropagation();
    try {
      await apiMarkNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiMarkAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id, e) => {
    e?.stopPropagation();
    try {
      await apiDeleteNotification(id);
      const deleted = notifications.find((n) => n._id === id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      if (deleted && !deleted.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClickItem = (item) => {
    if (!item.read) {
      handleMarkAsRead(item._id);
    }
    setOpen(false);
    if (item.link) {
      navigate(item.link);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString('vi-VN');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 rounded-xl text-text-muted hover:text-green-dark hover:bg-green-50 transition-colors focus:outline-none"
        title="Thông báo"
        aria-label="Xem thông báo"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full ring-2 ring-white animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-green-100 overflow-hidden z-50 animate-scale-in">
          {/* Header */}
          <div className="px-4 py-3 bg-white border-b border-green-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-text-main text-sm">Thông báo</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-green-light text-green-dark rounded-full">
                  {unreadCount} mới
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-green-dark hover:text-green-main font-medium transition-colors"
              >
                Đã đọc tất cả
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-green-50/60">
            {loading && notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-text-muted">
                Đang tải thông báo...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-green-50 text-green-dark flex items-center justify-center mx-auto mb-2">
                  <Bell className="w-6 h-6 opacity-60" />
                </div>
                <p className="text-sm font-medium text-text-main">Không có thông báo mới</p>
                <p className="text-xs text-text-muted mt-0.5">
                  Bạn sẽ nhận được thông báo khi có cập nhật tuyển dụng hoặc tin nhắn mới
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item._id}
                  onClick={() => handleClickItem(item)}
                  className={clsx(
                    'p-3.5 flex items-start gap-3 cursor-pointer transition-colors group relative',
                    item.read ? 'bg-white hover:bg-green-50/40' : 'bg-green-50/50 hover:bg-green-50/80'
                  )}
                >
                  {/* Unread indicator */}
                  <div className="mt-1 flex-shrink-0">
                    {!item.read ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-green-main inline-block" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-transparent inline-block" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pr-6">
                    <p
                      className={clsx(
                        'text-xs leading-snug line-clamp-1',
                        item.read ? 'font-medium text-text-main' : 'font-bold text-text-main'
                      )}
                    >
                      {item.title}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>
                    <p className="text-[10px] text-text-muted/80 mt-1">
                      {formatTime(item.createdAt)}
                    </p>
                  </div>

                  {/* Actions on hover */}
                  <div className="absolute right-2 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!item.read && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(item._id, e)}
                        className="p-1 text-text-muted hover:text-green-dark hover:bg-white rounded-md transition-colors"
                        title="Đánh dấu đã đọc"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDelete(item._id, e)}
                      className="p-1 text-text-muted hover:text-red-500 hover:bg-white rounded-md transition-colors"
                      title="Xóa thông báo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationDropdown;
