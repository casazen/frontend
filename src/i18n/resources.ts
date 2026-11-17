import { ownerMandateWizardMessages } from './owner-mandate-messages';
import onboardingAccessIt from './locales/it-onboarding-access.json';
import onboardingAccessEn from './locales/en-onboarding-access.json';
import it from './locales/it.json';
import en from './locales/en.json';
import { listingAiIt, listingAiEn } from './listing-ai';
import propertySetupIt from './locales/property-setup.it.json';
import propertySetupEn from './locales/property-setup.en.json';
import { userRemovalMessages } from './user-removal-messages';
import priceEstimateIt from './locales/price-estimate.it.json';
import priceEstimateEn from './locales/price-estimate.en.json';

/** The complete host-language resources, shared by runtime and translation validation. Add feature bundles here so every key, placeholder and plural is checked. */
export const APP_RESOURCES = {
  it: { translation: {
    ...onboardingAccessIt,
    ...it,
    listingAi: listingAiIt,
    propertySetup: propertySetupIt,
    userRemoval: userRemovalMessages.it,
    apiErrors: { ...it.apiErrors, codes: {
      ...it.apiErrors.codes,
      auth0ManagementTokenFailed: userRemovalMessages.it.tokenFailed,
      auth0ManagementCredentialsRejected: userRemovalMessages.it.credentialsRejected,
      auth0DeleteNotAllowed: userRemovalMessages.it.deleteNotAllowed,
    } },
    ...priceEstimateIt,
    ownerMandate: { ...it.ownerMandate, wizard: ownerMandateWizardMessages.it },
  } },
  en: { translation: {
    ...onboardingAccessEn,
    ...en,
    listingAi: listingAiEn,
    propertySetup: propertySetupEn,
    userRemoval: userRemovalMessages.en,
    apiErrors: { ...en.apiErrors, codes: {
      ...en.apiErrors.codes,
      auth0ManagementTokenFailed: userRemovalMessages.en.tokenFailed,
      auth0ManagementCredentialsRejected: userRemovalMessages.en.credentialsRejected,
      auth0DeleteNotAllowed: userRemovalMessages.en.deleteNotAllowed,
    } },
    ...priceEstimateEn,
    ownerMandate: { ...en.ownerMandate, wizard: ownerMandateWizardMessages.en },
  } },
};
