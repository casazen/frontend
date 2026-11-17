import it from './locales/it.json';
import en from './locales/en.json';
import { listingAiIt, listingAiEn } from './listing-ai';

/** The complete runtime resources also validated by the translation suite. */
export const APP_RESOURCES = {
  it: { translation: { ...it, listingAi: listingAiIt } },
  en: { translation: { ...en, listingAi: listingAiEn } },
};
