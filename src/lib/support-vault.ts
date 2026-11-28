import { SUPPORT_VAULT_REASON_LENGTH, type AdminAssistRequest, type SupportVaultCredentialKind, type SupportVaultReveal } from '@/types/onboarding.types';

/**
 * The support vault as the staff screens use it (E20/F03/US02/T01, decision O5): which credential a request may open, whether a request can open one at all, how long the
 * values stay on screen and what the reason of an opening has to be. The server decides every one of these again (the controlled opening answers 409, 422 or 429): this
 * is what the screen offers, so that staff is not shown a button that can only be refused.
 */

export function isOpenAssist(request: Pick<AdminAssistRequest, 'status'>): boolean {
  return request.status === 'Requested' || request.status === 'InProgress';
}

/**
 * Whether a request needs a kind of credential (backend `SupportVaultRules.KindFits`): the user of the panel of the structure serves every request; the police credentials
 * serve the police connection (or the whole compliance part) of a property, the ISTAT credentials the ISTAT connection (or the whole compliance part) of a property. The least
 * the work needs, never more: a request about a channel never opens the police credentials, and a request of the whole org opens no credential of a property.
 */
export function credentialKindFits(request: Pick<AdminAssistRequest, 'part' | 'context' | 'propertyId'>, kind: SupportVaultCredentialKind): boolean {
  const ofCompliance = request.context === 'part' && request.part === 'compliance';
  switch (kind) {
    case 'OctoratePanel':
      return true;
    case 'Police':
      return request.propertyId !== null && (request.context === 'panelPolice' || ofCompliance);
    case 'RegionalIstat':
      return request.propertyId !== null && (request.context === 'panelIstat' || ofCompliance);
    default:
      return false;
  }
}

export const REVEAL_VISIBLE_MS = 60_000;

/**
 * How long the values of an opening are shown, from the moment they arrive: the minute the server meant (`visibleUntil` minus `openedAt`, both on the server's clock, so a
 * clock of the browser that is wrong does not change it), never longer than a minute and never less than a second. An answer that does not say, or that says something that is
 * not a span of time, gets the minute.
 */
export function revealVisibleMs(values: Pick<SupportVaultReveal, 'openedAt' | 'visibleUntil'>): number {
  const span = Date.parse(values.visibleUntil) - Date.parse(values.openedAt);
  return Number.isFinite(span) && span > 0 ? Math.min(Math.max(span, 1_000), REVEAL_VISIBLE_MS) : REVEAL_VISIBLE_MS;
}

export function isValidRevealReason(reason: string): boolean {
  const length = reason.trim().length;
  return length >= SUPPORT_VAULT_REASON_LENGTH.min && length <= SUPPORT_VAULT_REASON_LENGTH.max;
}
