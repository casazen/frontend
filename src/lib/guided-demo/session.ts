import { isDemoMode } from '@/config/demo.config';
import { SAMPLE_LONG_ID, type TourArea } from './scenario';

const TOUR_KEY = 'casazen:guided-demo';
let activeInMemory = false;

/** A build with real authentication never reads or creates a guided session. */
export function isGuidedDemo(): boolean {
  if (!isDemoMode || typeof window === 'undefined' || !window.location.pathname.startsWith('/app/')) return false;
  const params = new URLSearchParams(window.location.search);
  const tour = params.get('demoTour');
  try {
    if (tour === '1') {
      activeInMemory = true;
      sessionStorage.setItem(TOUR_KEY, '1');
    } else if (tour === '0' || params.has('demoProfile')) {
      activeInMemory = false;
      sessionStorage.removeItem(TOUR_KEY);
    }
    return sessionStorage.getItem(TOUR_KEY) === '1';
  } catch {
    return activeInMemory;
  }
}

/** Public visitors see the standalone example. Only the separate demo build can enter the synthetic PMS. */
export function tourEntry(area: TourArea): string {
  if (!isDemoMode) return (area === 'short' ? '/affitti-brevi' : '/affitti-lunghi') + '#demo';
  return area === 'short'
    ? '/app/short-rent?today=arrivals&demoProfile=short-stay&demoTour=1'
    : `/app/long-rent/properties/${SAMPLE_LONG_ID}?demoProfile=long-term&demoTour=1`;
}
