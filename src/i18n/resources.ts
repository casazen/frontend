import onboardingAccessIt from './locales/it-onboarding-access.json';
import onboardingAccessEn from './locales/en-onboarding-access.json';
import it from './locales/it.json';
import en from './locales/en.json';
import ownerSetupIt from './locales/property-owner-it.json';
import ownerSetupEn from './locales/property-owner-en.json';
import { listingAiIt, listingAiEn } from './listing-ai';
import { userRemovalMessages } from './user-removal-messages';

/** The complete host-language resources, shared by runtime and translation validation. Add feature bundles here so every key, placeholder and plural is checked. */
export const APP_RESOURCES = {
  it: { translation: {
    ...onboardingAccessIt,
    ...it,
    listingAi: listingAiIt,
    userRemoval: userRemovalMessages.it,
    propertyWizard: { ...it.propertyWizard, ...ownerSetupIt.propertyWizard },
    apiErrors: { ...it.apiErrors, codes: {
      ...it.apiErrors.codes,
      auth0ManagementTokenFailed: userRemovalMessages.it.tokenFailed,
      auth0ManagementCredentialsRejected: userRemovalMessages.it.credentialsRejected,
      auth0DeleteNotAllowed: userRemovalMessages.it.deleteNotAllowed,
    } },
  } },
  en: { translation: {
    ...onboardingAccessEn,
    ...en,
    listingAi: listingAiEn,
    userRemoval: userRemovalMessages.en,
    propertyWizard: { ...en.propertyWizard, ...ownerSetupEn.propertyWizard },
    apiErrors: { ...en.apiErrors, codes: {
      ...en.apiErrors.codes,
      auth0ManagementTokenFailed: userRemovalMessages.en.tokenFailed,
      auth0ManagementCredentialsRejected: userRemovalMessages.en.credentialsRejected,
      auth0DeleteNotAllowed: userRemovalMessages.en.deleteNotAllowed,
    } },
  } },
};
