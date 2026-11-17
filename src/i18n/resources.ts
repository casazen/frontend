import it from './locales/it.json';
import en from './locales/en.json';
import propertySetupIt from './locales/property-setup.it.json';
import propertySetupEn from './locales/property-setup.en.json';

/** The complete host-language resources, shared by runtime and translation validation. Add feature bundles here so every key, placeholder and plural is checked. */
export const APP_RESOURCES = {
  it: { translation: { ...it, propertySetup: propertySetupIt } },
  en: { translation: { ...en, propertySetup: propertySetupEn } },
};
