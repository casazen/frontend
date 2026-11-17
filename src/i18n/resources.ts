import it from './locales/it.json';
import en from './locales/en.json';
import { listingAiIt, listingAiEn } from './listing-ai';
import { userRemovalMessages } from './user-removal-messages';

/** The complete host-language resources, shared by runtime and translation validation. Add feature bundles here so every key, placeholder and plural is checked. */
export const APP_RESOURCES = {
  it: { translation: {
    ...it, listingAi: listingAiIt,
    userRemoval: userRemovalMessages.it,
    apiErrors: { ...it.apiErrors, codes: {
      ...it.apiErrors.codes,
      auth0ManagementTokenFailed: userRemovalMessages.it.tokenFailed,
      auth0ManagementCredentialsRejected: userRemovalMessages.it.credentialsRejected,
      auth0DeleteNotAllowed: userRemovalMessages.it.deleteNotAllowed,
    } },
  } },
  en: { translation: {
    ...en, listingAi: listingAiEn,
    userRemoval: userRemovalMessages.en,
    apiErrors: { ...en.apiErrors, codes: {
      ...en.apiErrors.codes,
      auth0ManagementTokenFailed: userRemovalMessages.en.tokenFailed,
      auth0ManagementCredentialsRejected: userRemovalMessages.en.credentialsRejected,
      auth0DeleteNotAllowed: userRemovalMessages.en.deleteNotAllowed,
    } },
  } },
};
