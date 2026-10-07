import { useEffect, useState } from 'react';
import { getPushState, enablePush, disablePush } from '@/utils/pwa.js';

/** Bật/tắt thông báo đẩy cho thiết bị hiện tại. Ẩn khi trình duyệt hoặc máy chủ không hỗ trợ. */
export function PushToggle() {
  const [state, setState] = useState('unsupported');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getPushState().then((value) => { if (active) setState(value); });
    return () => { active = false; };
  }, []);

  if (state === 'unsupported') return null;

  async function toggle() {
    setBusy(true);
    setError('');
    try {
      if (state === 'on') await disablePush();
      else await enablePush();
      setState(await getPushState());
    } catch (err) {
      setError(err.message || 'Không thể thay đổi cài đặt thông báo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-2.5 border-t border-green-50 bg-white flex items-center justify-between gap-3">
      <p className="text-[11px] text-text-muted">
        {state === 'blocked'
          ? 'Thông báo đang bị chặn trong cài đặt trình duyệt.'
          : error || 'Nhận thông báo ngay cả khi không mở ứng dụng.'}
      </p>
      {state !== 'blocked' && (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className="shrink-0 text-xs font-semibold text-green-dark hover:text-green-main disabled:opacity-50"
        >
          {state === 'on' ? 'Tắt' : 'Bật'}
        </button>
      )}
    </div>
  );
}
