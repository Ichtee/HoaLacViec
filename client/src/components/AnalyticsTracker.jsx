import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth.jsx';

const GA_ID = import.meta.env.VITE_GA_ID;

/**
 * AnalyticsTracker (mounted once inside the Router, renders nothing)
 *
 * GA4 page views are sent by hand with the pathname only: URLs such as /reset-password?token=...
 * must never reach Google. Needs "page changes based on browser history" turned off in the GA4 stream.
 * No id/email is sent; only the role, as a user property.
 */
export function AnalyticsTracker() {
  const { pathname } = useLocation();
  const { role } = useAuth();

  useEffect(() => {
    if (!GA_ID || window.gtag) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { send_page_view: false });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!window.gtag) return;
    window.gtag('set', 'user_properties', { role: role || 'guest' });
  }, [role]);

  useEffect(() => {
    if (!window.gtag) return;
    window.gtag('event', 'page_view', {
      page_path: pathname,
      page_location: window.location.origin + pathname,
      page_title: document.title,
    });
  }, [pathname]);

  return null;
}
