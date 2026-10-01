import { describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import { describeDomainIssue, getDomainState } from '../domain-state';

describe('getDomainState (BK-17)', () => {
  it('getDomainState_Verified_IsVerifiedWhateverTheDetail', () => {
    expect(getDomainState('Verified', null)).toBe('verified');
    expect(getDomainState('Verified', 'vercel_unavailable')).toBe('verified');
  });

  it('getDomainState_Failed_IsFailed', () => {
    expect(getDomainState('Failed', 'domain_taken')).toBe('failed');
  });

  it.each(['ownership_txt_missing', 'dns_not_pointing', 'vercel_verification_pending', null, undefined])(
    'getDomainState_PendingOnDns_%s_IsWaitingForDns',
    (detail) => {
      expect(getDomainState('Pending', detail)).toBe('waitingDns');
    },
  );

  it.each(['vercel_not_configured', 'vercel_unauthorized', 'vercel_unavailable'])(
    'getDomainState_PendingOnThePlatform_%s_IsActivatingNotWaitingForDns',
    (detail) => {
      expect(getDomainState('Pending', detail)).toBe('activating');
    },
  );
});

describe('describeDomainIssue (BK-17)', () => {
  it('describeDomainIssue_KnownCode_IsTranslated', async () => {
    await i18n.changeLanguage('en');
    const text = describeDomainIssue('dns_not_pointing', 'testo del server', i18n.t.bind(i18n));
    expect(text).toBe(i18n.t('domain.issues.dns_not_pointing'));
    expect(text).not.toBe('testo del server');
  });

  it('describeDomainIssue_UnknownCode_FallsBackToTheServerMessage', () => {
    expect(describeDomainIssue('new_code', ' Messaggio del server ', i18n.t.bind(i18n))).toBe('Messaggio del server');
  });

  it('describeDomainIssue_NothingToExplain_IsUndefined', () => {
    expect(describeDomainIssue(null, null, i18n.t.bind(i18n))).toBeUndefined();
    expect(describeDomainIssue(undefined, '  ', i18n.t.bind(i18n))).toBeUndefined();
  });

  it('describeDomainIssue_EveryKnownCode_HasATextInBothLanguages', async () => {
    const codes = [
      'ownership_txt_missing',
      'dns_not_pointing',
      'vercel_verification_pending',
      'vercel_not_configured',
      'vercel_unauthorized',
      'vercel_unavailable',
      'domain_taken',
      'vercel_domain_in_use',
      'vercel_rejected',
    ];
    for (const lng of ['it', 'en']) {
      await i18n.changeLanguage(lng);
      for (const code of codes) {
        const key = `domain.issues.${code}`;
        expect(i18n.t(key), `${lng}:${key}`).not.toBe(key);
      }
    }
    await i18n.changeLanguage('it');
  });
});
