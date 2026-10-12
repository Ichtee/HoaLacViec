import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { apiGetMyCredits } from '@/services';
import { useAuth } from './useAuth.jsx';

export const CREDITS_CHANGED_EVENT = 'credits:changed';

// One shared balance for the header chip, the profile dropdown and the sidebar card.
let balance = null;
const listeners = new Set();
let inflight = null;

function load() {
  if (!inflight) {
    inflight = apiGetMyCredits()
      .then((me) => { balance = me.balance; listeners.forEach((fn) => fn(balance)); })
      .catch(() => {}) // keep the last known balance; the chip just stays as is
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/** Employer credit balance (null until loaded or for other roles). Refreshes on navigation, focus and any credit-affecting request. */
export function useCredits() {
  const { role } = useAuth();
  const { pathname } = useLocation();
  const enabled = role === 'employer';
  const [value, setValue] = useState(balance);

  useEffect(() => {
    if (!enabled) return undefined;
    listeners.add(setValue);
    const refresh = () => load();
    window.addEventListener(CREDITS_CHANGED_EVENT, refresh);
    window.addEventListener('focus', refresh);
    return () => {
      listeners.delete(setValue);
      window.removeEventListener(CREDITS_CHANGED_EVENT, refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [enabled]);

  useEffect(() => { if (enabled) load(); }, [enabled, pathname]);

  return enabled ? value : null;
}
