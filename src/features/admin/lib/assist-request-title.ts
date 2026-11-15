import type { TFunction } from 'i18next';
import type { AdminAssistRequest } from '@/types/onboarding.types';

/** The contexts of a request this version has words for (backend `OnboardingAssistContexts`); anything else reads as a neutral word. */
const CONTEXTS: ReadonlySet<string> = new Set(['panelPolice', 'panelIstat', 'panelChannelAccess', 'part']);

/** What help is asked with, in words («Collegamento Questura», «Collegamento ISTAT»...), or a neutral word for a context this version does not know. */
function assistContextWords(context: string, t: TFunction): string {
  return t(`onboardingPlan.assist.contexts.${CONTEXTS.has(context) ? context : 'unknown'}`);
}

/** The request in one line: what help is asked with and for which structure (and comune), or for the whole organization. */
export function assistRequestTitle(request: Pick<AdminAssistRequest, 'context' | 'propertyName' | 'comune'>, t: TFunction): string {
  const context = assistContextWords(request.context, t);
  if (!request.propertyName) return t('onboardingPlan.assist.row.org', { context });
  return request.comune
    ? t('onboardingPlan.assist.row.propertyComune', { context, property: request.propertyName, comune: request.comune })
    : t('onboardingPlan.assist.row.property', { context, property: request.propertyName });
}
