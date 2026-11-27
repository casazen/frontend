import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { welcomeApi } from '@/api/welcome.api';
import { getHttpStatus } from '@/lib/api-errors';
import type { WelcomeConsentPayload, WelcomeConsentResult, WelcomeLink } from '@/types/welcome.types';

const WELCOME_LINK_QUERY = 'welcome-link';
const WELCOME_PAGE_QUERY = 'welcome-page';

const welcomeLinkKey = (propertyId: string) => [WELCOME_LINK_QUERY, propertyId] as const;
const welcomePageKey = (token: string) => [WELCOME_PAGE_QUERY, token] as const;

/**
 * The welcome link of a property, for the host (E07/F04/US02/T02): `{ active, url, createdAt }`, `active: false` when it has none. Read again
 * whenever the page of the property opens: the link is made and replaced from here only, but on other devices too.
 */
export function useWelcomeLink(propertyId: string) {
  return useQuery({
    queryKey: welcomeLinkKey(propertyId),
    queryFn: () => welcomeApi.getLink(propertyId),
    enabled: propertyId !== '',
    refetchOnMount: true,
  });
}

/** Makes the link of the property when it has none; the answer replaces the one on screen. */
export function useCreateWelcomeLink(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation<WelcomeLink, unknown, void>({
    mutationFn: () => welcomeApi.createLink(propertyId),
    onSuccess: (link) => queryClient.setQueryData(welcomeLinkKey(propertyId), link),
  });
}

/** Replaces the code: the QR printed with the old one stops working at once. The new link replaces the one on screen. */
export function useRotateWelcomeLink(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation<WelcomeLink, unknown, void>({
    mutationFn: () => welcomeApi.rotateLink(propertyId),
    onSuccess: (link) => queryClient.setQueryData(welcomeLinkKey(propertyId), link),
  });
}

/**
 * What the public welcome page shows (anonymous: no access token, the token of the link is the proof). A 404 `welcome_link_invalid` means the
 * link is unknown or revoked: the page says it is not active. Read once when the page opens, and again after an answer that says what it shows
 * is out of date (see {@link useSubmitWelcomeConsent}), never at every return to the tab.
 */
export function useWelcomePage(token: string) {
  return useQuery({
    queryKey: welcomePageKey(token),
    queryFn: () => welcomeApi.getPage(token),
    enabled: token !== '',
    refetchOnWindowFocus: false,
  });
}

/**
 * The guest's consent, sent once per press: a mutation never retries by itself (`queryClient`), and it is dropped from the cache as soon as
 * the page closes (`gcTime: 0`). When the answer says the text changed (409) or the link was revoked in the meantime (404) the page is read
 * again, so it shows what is true now (the new version of the text, or that the page is not active).
 */
export function useSubmitWelcomeConsent(token: string) {
  const queryClient = useQueryClient();
  return useMutation<WelcomeConsentResult, unknown, WelcomeConsentPayload>({
    mutationFn: (payload) => welcomeApi.submitConsent(token, payload),
    gcTime: 0,
    onError: (error) => {
      const status = getHttpStatus(error);
      if (status === 404 || status === 409) void queryClient.invalidateQueries({ queryKey: welcomePageKey(token) });
    },
  });
}
