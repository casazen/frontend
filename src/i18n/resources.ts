import it from './locales/it.json';
import en from './locales/en.json';
import ownerSetupIt from './locales/property-owner-it.json';
import ownerSetupEn from './locales/property-owner-en.json';

/** Complete host-language resources shared by runtime and translation validation. */
export const APP_RESOURCES = {
  it: { translation: { ...it, propertyWizard: { ...it.propertyWizard, ...ownerSetupIt.propertyWizard } } },
  en: { translation: { ...en, propertyWizard: { ...en.propertyWizard, ...ownerSetupEn.propertyWizard } } },
};
