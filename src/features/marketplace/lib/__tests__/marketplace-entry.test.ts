import { describe, expect, it } from 'vitest';
import { httpsUrlOrNull, initialsOf, marketplaceAction, marketplaceEntryValue, marketplaceReturnTarget, marketplaceWizardPath, parseMarketplaceEntry } from '../marketplace-entry';

describe('parseMarketplaceEntry', () => {
  it.each([
    ['Channel:AIRBNB', 'Channel', 'AIRBNB'],
    ['Tool:invoicer-1', 'Tool', 'invoicer-1'],
    ['LicensedFunction:fiscalPrinter', 'LicensedFunction', 'fiscalPrinter'],
    ['Partner:test.cleaners_2', 'Partner', 'test.cleaners_2'],
  ])('parseMarketplaceEntry_%s_IsRead', (value, kind, code) => {
    expect(parseMarketplaceEntry(value)).toEqual({ kind, code });
  });

  it('parseMarketplaceEntry_AnEntryValue_IsReadBackAsItWas', () => {
    const entry = { kind: 'Partner', code: 'test-cleaners' };

    expect(parseMarketplaceEntry(marketplaceEntryValue(entry))).toEqual(entry);
  });

  // The value is typed and shared, and its kind and code end up in the path of a request.
  it.each([null, undefined, '', 'Channel', ':AIRBNB', 'Channel:', 'Channel:../admin', 'Channel:a/b', 'Channel:a b', 'Channel:a?b=1', 'Chan1nel:AIRBNB', 'Channel:-x', `Channel:${'x'.repeat(101)}`])(
    'parseMarketplaceEntry_%j_IsNotAnEntry',
    (value) => {
      expect(parseMarketplaceEntry(value)).toBeNull();
    },
  );
});

describe('httpsUrlOrNull', () => {
  it('httpsUrlOrNull_HttpsAddress_IsKept', () => {
    expect(httpsUrlOrNull('https://example.com/logo.png')).toBe('https://example.com/logo.png');
  });

  it.each(['http://example.com/logo.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA', '//example.com/logo.png', '/logo.png', 'logo.png', '', null, undefined])(
    'httpsUrlOrNull_%j_IsNotUsed',
    (value) => {
      expect(httpsUrlOrNull(value)).toBeNull();
    },
  );
});

describe('initialsOf', () => {
  it.each([
    ['TEST Invoicer', 'TI'],
    ['Portal', 'P'],
    ['one two three', 'OT'],
    ['  spaced   out  ', 'SO'],
    ['', '?'],
    ['   ', '?'],
  ])('initialsOf_%j_Is_%s', (name, expected) => {
    expect(initialsOf(name)).toBe(expected);
  });
});

describe('marketplaceReturnTarget', () => {
  it('marketplaceReturnTarget_CardOpen_ComesBackToThePageWithoutTheCardAndKeepsTheRest', () => {
    expect(marketplaceReturnTarget({ pathname: '/app/short-rent/marketplace', search: '?propertyId=p1&entry=Channel%3AAIRBNB&q=abc', hash: '#top' })).toBe(
      '/app/short-rent/marketplace?propertyId=p1&q=abc#top',
    );
  });

  it('marketplaceReturnTarget_OnlyTheCard_ComesBackToThePathAlone', () => {
    expect(marketplaceReturnTarget({ pathname: '/app/short-rent/marketplace', search: '?entry=Channel%3AAIRBNB', hash: '' })).toBe('/app/short-rent/marketplace');
  });
});

describe('marketplaceWizardPath', () => {
  it.each([
    ['Channel', 'AIRBNB', '/app/short-rent/marketplace/activate/channel/AIRBNB'],
    ['channel', 'AIRBNB', '/app/short-rent/marketplace/activate/channel/AIRBNB'],
    ['Tool', 'invoicer-1', '/app/short-rent/marketplace/activate/tool/invoicer-1'],
    ['LicensedFunction', 'chat', '/app/short-rent/marketplace/request/chat'],
    ['licensedFunction', 'chat', '/app/short-rent/marketplace/request/chat'],
    ['Partner', 'test-cleaners', '/app/short-rent/marketplace/partners/test-cleaners/activate'],
  ])('marketplaceWizardPath_%s_%s_Leads_To_%s', (kind, code, expected) => {
    expect(marketplaceWizardPath(kind, code)).toBe(expected);
  });
});

describe('marketplaceAction', () => {
  const entry = { kind: 'Channel', code: 'AIRBNB', status: 'NotActive' as const, canActivate: true };
  const where = (to: string | undefined) => new URL(to ?? '', 'http://localhost');

  it('marketplaceAction_NotActive_StartsTheWizardOnTheProperty_AndComesBackToThePage', () => {
    const action = marketplaceAction(entry, 'p1', '/app/short-rent/marketplace?propertyId=p1');

    expect(action?.kind).toBe('activate');
    expect(where(action?.to).pathname).toBe('/app/short-rent/marketplace/activate/channel/AIRBNB');
    expect(where(action?.to).searchParams.get('propertyId')).toBe('p1');
    expect(where(action?.to).searchParams.get('returnTo')).toBe('/app/short-rent/marketplace?propertyId=p1');
  });

  it('marketplaceAction_ToFix_StartsTheSameWizardAsFix', () => {
    const action = marketplaceAction({ ...entry, status: 'ToFix' }, 'p1', null);

    expect(action?.kind).toBe('fix');
    expect(where(action?.to).pathname).toBe('/app/short-rent/marketplace/activate/channel/AIRBNB');
    expect(where(action?.to).searchParams.has('returnTo')).toBe(false);
  });

  it.each(['Active', 'Pending'] as const)('marketplaceAction_%s_IsManagedInTheActiveTab_EvenIfNoMoreCanBeActivated', (status) => {
    const action = marketplaceAction({ ...entry, status, canActivate: false }, 'p1', '/app/short-rent/marketplace');

    expect(action?.kind).toBe('manage');
    expect(where(action?.to).pathname).toBe('/app/short-rent/marketplace/mine');
    expect(where(action?.to).searchParams.get('propertyId')).toBe('p1');
  });

  it.each(['NotActive', 'ToFix'] as const)('marketplaceAction_%s_CannotBeActivated_HasNoAction', (status) => {
    expect(marketplaceAction({ ...entry, status, canActivate: false }, 'p1', null)).toBeNull();
  });

  it.each([
    ['api', 'Channel', 'AIRBNB', '/app/short-rent/marketplace/activate/channel/AIRBNB'],
    ['licenseRequest', 'LicensedFunction', 'chat', '/app/short-rent/marketplace/request/chat'],
    ['partnerSite', 'Partner', 'test-cleaners', '/app/short-rent/marketplace/partners/test-cleaners/activate'],
    ['something-new', 'Partner', 'test-cleaners', '/app/short-rent/marketplace/partners/test-cleaners/activate'],
  ])('marketplaceAction_ActivationType_%s_SaysWhereTheWizardIs', (type, kind, code, path) => {
    const action = marketplaceAction({ ...entry, kind, code }, undefined, null, type);

    expect(where(action?.to).pathname).toBe(path);
  });

  it('marketplaceAction_ReturnToThatLeavesTheApp_IsNotPutInTheLink', () => {
    const action = marketplaceAction(entry, 'p1', 'https://evil.example/app/x');

    expect(where(action?.to).searchParams.has('returnTo')).toBe(false);
  });
});
