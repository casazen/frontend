import { describe, expect, it } from 'vitest';
import { REVEAL_VISIBLE_MS, credentialKindFits, isOpenAssist, isValidRevealReason, revealVisibleMs } from '@/lib/support-vault';
import type { AdminAssistRequest, SupportVaultCredentialKind } from '@/types/onboarding.types';

const PROPERTY = '77777777-0000-4000-8000-000000000001';

type Shape = Pick<AdminAssistRequest, 'part' | 'context' | 'propertyId'>;

const police: Shape = { part: 'compliance', context: 'panelPolice', propertyId: PROPERTY };
const istat: Shape = { part: 'compliance', context: 'panelIstat', propertyId: PROPERTY };
const channel: Shape = { part: 'channels', context: 'panelChannelAccess', propertyId: PROPERTY };
const wholePart: Shape = { part: 'compliance', context: 'part', propertyId: PROPERTY };
const wholeOrg: Shape = { part: 'compliance', context: 'part', propertyId: null };

function kindsOf(request: Shape): SupportVaultCredentialKind[] {
  return (['OctoratePanel', 'Police', 'RegionalIstat'] as const).filter((kind) => credentialKindFits(request, kind));
}

describe('credentialKindFits, which credential a request may open', () => {
  it('credentialKindFits_ARequestAboutThePolice_NeedsThePanelAndThePoliceCredentialsAndNotTheIstatOnes', () => {
    expect(kindsOf(police)).toEqual(['OctoratePanel', 'Police']);
  });

  it('credentialKindFits_ARequestAboutIstat_NeedsThePanelAndTheIstatCredentialsAndNotThePoliceOnes', () => {
    expect(kindsOf(istat)).toEqual(['OctoratePanel', 'RegionalIstat']);
  });

  it('credentialKindFits_ARequestAboutAChannel_NeverOpensThePoliceOrTheIstatCredentials', () => {
    expect(kindsOf(channel)).toEqual(['OctoratePanel']);
  });

  it('credentialKindFits_TheWholeComplianceOfAProperty_NeedsBothTheirCredentials', () => {
    expect(kindsOf(wholePart)).toEqual(['OctoratePanel', 'Police', 'RegionalIstat']);
    expect(kindsOf({ part: 'channels', context: 'part', propertyId: PROPERTY })).toEqual(['OctoratePanel']);
  });

  it('credentialKindFits_ARequestOfTheWholeOrganization_OpensNoCredentialOfAProperty', () => {
    expect(kindsOf(wholeOrg)).toEqual(['OctoratePanel']);
    expect(kindsOf({ ...police, propertyId: null })).toEqual(['OctoratePanel']);
  });

  it('credentialKindFits_AKindThisVersionDoesNotKnow_IsNeverOffered', () => {
    expect(credentialKindFits(police, 'Telepathy' as never)).toBe(false);
  });
});

describe('isOpenAssist, whether a credential can be opened for a request at all', () => {
  it.each([
    ['Requested', true],
    ['InProgress', true],
    ['Done', false],
    ['Cancelled', false],
    ['Quarantined', false],
  ])('isOpenAssist_%s_Is%s', (status, expected) => {
    expect(isOpenAssist({ status: status as AdminAssistRequest['status'] })).toBe(expected);
  });
});

describe('revealVisibleMs, how long the values of an opening are shown', () => {
  it('revealVisibleMs_TheMinuteTheServerMeant_IsAMinute', () => {
    expect(REVEAL_VISIBLE_MS).toBe(60_000);
    expect(revealVisibleMs({ openedAt: '2026-11-15T10:00:00Z', visibleUntil: '2026-11-15T10:01:00Z' })).toBe(60_000);
  });

  it('revealVisibleMs_ASpanOfTheServerOnItsOwnClock_DoesNotDependOnTheClockOfTheBrowser', () => {
    expect(revealVisibleMs({ openedAt: '2031-01-01T00:00:00Z', visibleUntil: '2031-01-01T00:00:30Z' })).toBe(30_000);
  });

  it('revealVisibleMs_NeverLongerThanAMinuteNorLessThanASecond', () => {
    expect(revealVisibleMs({ openedAt: '2026-11-15T10:00:00Z', visibleUntil: '2026-11-15T11:00:00Z' })).toBe(60_000);
    expect(revealVisibleMs({ openedAt: '2026-11-15T10:00:00.000Z', visibleUntil: '2026-11-15T10:00:00.100Z' })).toBe(1_000);
  });

  it('revealVisibleMs_ASpanThatIsNotOne_IsAMinute', () => {
    expect(revealVisibleMs({ openedAt: '2026-11-15T10:01:00Z', visibleUntil: '2026-11-15T10:00:00Z' })).toBe(60_000);
    expect(revealVisibleMs({ openedAt: 'yesterday', visibleUntil: 'tomorrow' })).toBe(60_000);
    expect(revealVisibleMs({ openedAt: '2026-11-15T10:00:00Z', visibleUntil: '2026-11-15T10:00:00Z' })).toBe(60_000);
  });
});

describe('isValidRevealReason, the reason of an opening as the server reads it', () => {
  it('isValidRevealReason_TenToThreeHundredCharactersTrimmed_IsValid', () => {
    expect(isValidRevealReason('x'.repeat(10))).toBe(true);
    expect(isValidRevealReason('x'.repeat(300))).toBe(true);
    expect(isValidRevealReason(`   ${'x'.repeat(10)}   `)).toBe(true);
  });

  it('isValidRevealReason_ShorterOrLongerOrOnlySpaces_IsNot', () => {
    expect(isValidRevealReason('x'.repeat(9))).toBe(false);
    expect(isValidRevealReason(`   ${'x'.repeat(9)}   `)).toBe(false);
    expect(isValidRevealReason('x'.repeat(301))).toBe(false);
    expect(isValidRevealReason(' '.repeat(40))).toBe(false);
    expect(isValidRevealReason('')).toBe(false);
  });
});
