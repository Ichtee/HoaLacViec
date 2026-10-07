import { apiGetPushPublicKey, apiSubscribePush, apiUnsubscribePush } from '@/services';

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Không đăng ký được service worker:', err));
  });
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function urlBase64ToUint8Array(base64) {
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function getRegistration() {
  return navigator.serviceWorker.ready;
}

/** Trạng thái hiện tại: 'unsupported' | 'blocked' | 'on' | 'off'. */
export async function getPushState() {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  try {
    const subscription = await (await getRegistration()).pushManager.getSubscription();
    return subscription ? 'on' : 'off';
  } catch {
    return 'unsupported';
  }
}

export async function enablePush() {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Bạn chưa cho phép thông báo trên trình duyệt này.');
  const { publicKey } = await apiGetPushPublicKey();
  const registration = await getRegistration();
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  await apiSubscribePush(subscription.toJSON());
}

export async function disablePush() {
  const subscription = await (await getRegistration()).pushManager.getSubscription();
  if (!subscription) return;
  await apiUnsubscribePush(subscription.endpoint);
  await subscription.unsubscribe();
}
