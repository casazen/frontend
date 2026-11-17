import it from './locales/it.json';
import en from './locales/en.json';
import priceEstimateIt from './locales/price-estimate.it.json';
import priceEstimateEn from './locales/price-estimate.en.json';

/** The complete host-language resources, shared by runtime and translation validation. Add feature bundles here so every key, placeholder and plural is checked. */
export const APP_RESOURCES = {
  it: { translation: { ...it, ...priceEstimateIt } },
  en: { translation: { ...en, ...priceEstimateEn } },
};
