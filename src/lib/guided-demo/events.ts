import { analyticsConfig } from '@/config/analytics.config';
import type { TourArea } from './scenario';

type TourEvent = 'demo_enter' | 'demo_first_task' | 'invitation_mail_open' | 'referral_mail_open';

export function trackTour(event: TourEvent, area: TourArea): void {
  if (typeof window === 'undefined' || !analyticsConfig.plausibleDomain || !window.plausible) return;
  // Deduplicate the first result per area and tab, including reopening the booking or refreshing the detail.
  const key = `casazen:demo-first-task:${area}`;
  try {
    if (event === 'demo_first_task' && sessionStorage.getItem(key)) return;
    window.plausible(event, { props: { area } });
    if (event === 'demo_first_task') sessionStorage.setItem(key, '1');
  } catch {
    // Measurement is optional. The tour and the commercial link work without storage or analytics.
  }
}
