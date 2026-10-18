import { describe, expect, it } from 'vitest';
import { hostInviteUrl, sanitizeCampaign, supplierInviteUrl } from '../invite-links';

const ORIGIN = 'https://app.casazen.test';

describe('invite links (QR codes)', () => {
  it('supplierInviteUrl_IsThePublicRegistrationWithoutAnyQuery', () => {
    expect(supplierInviteUrl(ORIGIN)).toBe(`${ORIGIN}/register`);
  });

  it('hostInviteUrl_CarriesTheRoleAndTheUtmOfThePrint', () => {
    const url = new URL(hostInviteUrl(ORIGIN, 'Volantino Roma Ottobre'));
    expect(url.origin + url.pathname).toBe(`${ORIGIN}/signup`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      role: 'host',
      utm_source: 'qr',
      utm_medium: 'print',
      utm_campaign: 'volantino-roma-ottobre',
    });
  });

  it('hostInviteUrl_WithoutACampaign_OmitsIt', () => {
    const url = new URL(hostInviteUrl(ORIGIN, '  '));
    expect(url.searchParams.has('utm_campaign')).toBe(false);
    expect(url.searchParams.get('utm_source')).toBe('qr');
  });

  it('sanitizeCampaign_KeepsOnlyLettersDigitsAndDashes_WithinTheLimit', () => {
    expect(sanitizeCampaign('  Èvento d’Autunno #1 !! ')).toBe('evento-d-autunno-1');
    expect(sanitizeCampaign('a'.repeat(100))).toHaveLength(60);
    expect(sanitizeCampaign('---')).toBe('');
  });

  it('theCampaignOfTheUrlIsAlwaysAcceptedByTheSignupAttributionRules', async () => {
    const { readUtm } = await import('@/lib/signup-attribution');
    const url = new URL(hostInviteUrl(ORIGIN, 'Fiera del Turismo 2026 / Stand 4'));
    expect(readUtm(url.search).utm_campaign).toBe('fiera-del-turismo-2026-stand-4');
  });
});
