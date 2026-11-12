import { useTranslation } from 'react-i18next';

/** A code of the channel manager read as a plain name: `hometogo_xml` is «Hometogo». For a channel this app has no name for yet. */
function humanizeChannel(code: string): string {
  const words = code.replace(/_xml$/, '').replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The name of a channel as the host knows it («Booking.com», «Airbnb», «Vrbo»), from the code of its portal. A code this app has no name
 * for (a channel the backend knows and the app does not yet) reads as a plain word, never as a raw key.
 */
export function useChannelName(): (code: string) => string {
  const { t, i18n } = useTranslation();
  return (code: string) => {
    const key = `listingStatus.channels.${code}`;
    return i18n.exists(key) ? t(key) : humanizeChannel(code);
  };
}
