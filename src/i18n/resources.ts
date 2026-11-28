import ross1000It from './locales/ross1000.it.json';
import ross1000En from './locales/ross1000.en.json';
import marketingIt from './locales/marketing.it.json';
import marketingEn from './locales/marketing.en.json';
import { askMessages } from './ask-messages';
import { ownerMandateWizardMessages } from './owner-mandate-messages';
import onboardingAccessIt from './locales/it-onboarding-access.json';
import onboardingAccessEn from './locales/en-onboarding-access.json';
import it from './locales/it.json';
import en from './locales/en.json';
import ownerSetupIt from './locales/property-owner-it.json';
import ownerSetupEn from './locales/property-owner-en.json';
import { listingAiIt, listingAiEn } from './listing-ai';
import propertySetupIt from './locales/property-setup.it.json';
import propertySetupEn from './locales/property-setup.en.json';
import { storefrontChatMessages } from './storefront-chat-messages';
import { userRemovalMessages } from './user-removal-messages';
import priceEstimateIt from './locales/price-estimate.it.json';
import priceEstimateEn from './locales/price-estimate.en.json';

export const APP_RESOURCES = {
  it: { translation: {
    ...onboardingAccessIt,
    ask: askMessages.it,
    ...it,
    marketingStudio: marketingIt,
    listingAi: listingAiIt,
    propertySetup: propertySetupIt,
    userRemoval: userRemovalMessages.it,
    storefrontChat: storefrontChatMessages.it,
    propertyWizard: { ...it.propertyWizard, ...ownerSetupIt.propertyWizard },
    apiErrors: { ...it.apiErrors, codes: {
      ...it.apiErrors.codes,
      auth0ManagementTokenFailed: userRemovalMessages.it.tokenFailed,
      auth0ManagementCredentialsRejected: userRemovalMessages.it.credentialsRejected,
      auth0DeleteNotAllowed: userRemovalMessages.it.deleteNotAllowed,
    } },
    ...priceEstimateIt,
    ross1000: ross1000It,
    ownerMandate: { ...it.ownerMandate, wizard: ownerMandateWizardMessages.it },
  } },
  en: { translation: {
    ...onboardingAccessEn,
    ask: askMessages.en,
    ...en,
    marketingStudio: marketingEn,
    listingAi: listingAiEn,
    propertySetup: propertySetupEn,
    userRemoval: userRemovalMessages.en,
    storefrontChat: storefrontChatMessages.en,
    propertyWizard: { ...en.propertyWizard, ...ownerSetupEn.propertyWizard },
    apiErrors: { ...en.apiErrors, codes: {
      ...en.apiErrors.codes,
      auth0ManagementTokenFailed: userRemovalMessages.en.tokenFailed,
      auth0ManagementCredentialsRejected: userRemovalMessages.en.credentialsRejected,
      auth0DeleteNotAllowed: userRemovalMessages.en.deleteNotAllowed,
    } },
    ...priceEstimateEn,
    ross1000: ross1000En,
    ownerMandate: { ...en.ownerMandate, wizard: ownerMandateWizardMessages.en },
  } },
};
