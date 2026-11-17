import it from './locales/it.json';
import en from './locales/en.json';
import onboardingAccessIt from './locales/it-onboarding-access.json';
import onboardingAccessEn from './locales/en-onboarding-access.json';

/** The complete host-language resources shared by runtime and translation validation. */
export const APP_RESOURCES = {
  it: { translation: { ...it, ...onboardingAccessIt } },
  en: { translation: { ...en, ...onboardingAccessEn } },
};
