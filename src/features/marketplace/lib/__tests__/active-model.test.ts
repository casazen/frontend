import { describe, expect, it } from 'vitest';
import type { MarketplaceActiveIntegration, MarketplaceHealthItem } from '@/types';
import {
  activationKeyOf,
  buildActiveRows,
  fixPathOf,
  formatDeclaredDay,
  formatInstant,
  groupHealthByProperty,
  itemHasProblem,
  mayManageKind,
  quotaOf,
  quotaPercent,
  rowHasProblem,
} from '../active-model';

const ROSA = { id: 'prop-1', name: 'Villa Rosa' };
const BLU = { id: 'prop-2', name: 'Casa Blu' };

const integration = (over: Partial<MarketplaceActiveIntegration> = {}): MarketplaceActiveIntegration => ({
  kind: 'Channel',
  code: 'PORTAL1',
  name: 'TEST Portal',
  property: ROSA,
  status: 'Active',
  isDeclared: false,
  lastSyncedAt: null,
  declaredAt: null,
  verifiedAt: null,
  ...over,
});

const item = (over: Partial<MarketplaceHealthItem> = {}): MarketplaceHealthItem => ({
  activationId: 'act-1',
  propertyId: 'prop-1',
  propertyName: 'Villa Rosa',
  kind: 'Channel',
  code: 'PORTAL1',
  name: 'TEST Portal',
  status: 'Active',
  isDeclared: false,
  lastSyncedAt: null,
  error: null,
  quota: null,
  changeRequestedAt: null,
  ...over,
});

describe('buildActiveRows', () => {
  it('buildActiveRows_HealthRowOfTheSameActivation_GivesTheIdTheErrorAndTheWordOfTheHealth', () => {
    const rows = buildActiveRows(
      [integration({ kind: 'LicensedFunction', code: 'chat', status: 'Pending' })],
      [item({ kind: 'LicensedFunction', code: 'chat', status: 'Requested', activationId: 'act-9' })],
    );

    expect(rows).toHaveLength(1);
    // The health row tells `Requested` from `Pending`, and is the only place the id of the activation is.
    expect(rows[0]).toMatchObject({ status: 'Requested', activationId: 'act-9' });
    expect(rows[0].health?.activationId).toBe('act-9');
  });

  it('buildActiveRows_CodeAndKindInAnotherCase_StillMatch_ButAnotherPropertyDoesNot', () => {
    const rows = buildActiveRows(
      [integration({ code: 'Portal1' }), integration({ property: BLU })],
      [item({ code: 'PORTAL1', kind: 'Channel', propertyId: 'prop-1' })],
    );

    expect(rows.find((row) => row.property?.id === 'prop-1')?.activationId).toBe('act-1');
    // The same portal on another property is another activation: it takes nothing of the first one's health.
    expect(rows.find((row) => row.property?.id === 'prop-2')?.activationId).toBeNull();
    expect(rows.find((row) => row.property?.id === 'prop-2')?.health).toBeNull();
  });

  it('buildActiveRows_HealthNotRead_SaysNothingOfProblemsAndKnowsNoId', () => {
    const rows = buildActiveRows([integration({ status: 'ToFix' })], null);

    expect(rows[0]).toMatchObject({ status: 'ToFix', health: null, activationId: null });
    // The badge of the list still says it is to fix.
    expect(rowHasProblem(rows[0])).toBe(true);
  });

  it('buildActiveRows_HealthRowsOfNoActiveRow_AreNotRowsOfTheTab', () => {
    expect(buildActiveRows([], [item()])).toEqual([]);
  });

  it('buildActiveRows_Order_WholeOrganizationFirstThenPropertiesByNameAndKinds', () => {
    const rows = buildActiveRows(
      [
        integration({ code: 'B', name: 'B', property: BLU }),
        integration({ kind: 'Partner', code: 'P', name: 'P', property: null }),
        integration({ kind: 'Tool', code: 'T', name: 'T', property: ROSA }),
        integration({ code: 'A', name: 'A', property: ROSA }),
      ],
      null,
    );

    expect(rows.map((row) => row.name)).toEqual(['P', 'B', 'A', 'T']);
  });

  it('buildActiveRows_LastSync_IsTheListsOrTheHealthRows', () => {
    const rows = buildActiveRows([integration({ lastSyncedAt: null })], [item({ lastSyncedAt: '2026-11-12T14:05:00Z' })]);

    expect(rows[0].lastSyncedAt).toBe('2026-11-12T14:05:00Z');
  });
});

describe('activationKeyOf', () => {
  it('activationKeyOf_NoProperty_IsTheKeyOfTheOrganization', () => {
    expect(activationKeyOf('Partner', 'BEDS', null)).toBe(activationKeyOf('partner', 'beds', undefined));
    expect(activationKeyOf('Partner', 'beds', 'prop-1')).not.toBe(activationKeyOf('Partner', 'beds', null));
  });
});

describe('problems', () => {
  it('itemHasProblem_ToFixOrAnErrorIsAProblem_WaitingIsNot', () => {
    expect(itemHasProblem({ status: 'ToFix', error: null })).toBe(true);
    expect(itemHasProblem({ status: 'Active', error: { code: 'x', message: '' } })).toBe(true);
    expect(itemHasProblem({ status: 'Pending', error: null })).toBe(false);
    expect(itemHasProblem({ status: 'Requested', error: null })).toBe(false);
    expect(itemHasProblem({ status: 'Active', error: null })).toBe(false);
  });
});

describe('groupHealthByProperty', () => {
  it('groupHealthByProperty_ProblemsFirst_ThenByName_AndTheWholeOrganizationLast', () => {
    const groups = groupHealthByProperty([
      item({ activationId: 'a', propertyId: 'prop-2', propertyName: 'Casa Blu' }),
      item({ activationId: 'b', propertyId: null, propertyName: null, kind: 'LicensedFunction', code: 'chat' }),
      item({ activationId: 'c', propertyId: 'prop-3', propertyName: 'Albergo Verde', status: 'ToFix' }),
      item({ activationId: 'd', propertyId: 'prop-4', propertyName: 'Zeta', status: 'Pending' }),
    ]);

    expect(groups.map((group) => group.key)).toEqual(['prop-3', 'prop-2', 'prop-4', 'org']);
  });

  it('groupHealthByProperty_SplitsProblemsFromWaitingFromActive_ToFixFirst', () => {
    const [group] = groupHealthByProperty([
      item({ activationId: 'a', name: 'Zed', status: 'Active' }),
      item({ activationId: 'b', name: 'Beta', error: { code: 'connection_missing', message: 'x' } }),
      item({ activationId: 'c', name: 'Gamma', status: 'ToFix' }),
      item({ activationId: 'd', name: 'Delta', status: 'Requested' }),
    ]);

    expect(group.problems.map((entry) => entry.activationId)).toEqual(['c', 'b']);
    expect(group.waiting.map((entry) => entry.activationId)).toEqual(['d']);
    expect(group.fine.map((entry) => entry.activationId)).toEqual(['a']);
  });
});

describe('quota', () => {
  it('quotaPercent_UsedOverLimit_RoundedAsTheServersNumbersSayIt', () => {
    expect(quotaPercent({ used: 412, limit: 500 })).toBe(82);
    expect(quotaPercent({ used: 500, limit: 500 })).toBe(100);
    expect(quotaPercent({ used: 0, limit: 500 })).toBe(0);
  });

  it('quotaPercent_NoLimitAboveZero_SaysNothingOfAShare', () => {
    expect(quotaPercent({ used: 5, limit: 0 })).toBeNull();
    expect(quotaPercent({ used: Number.NaN, limit: 100 })).toBeNull();
  });

  it('quotaOf_NoneRead_IsNull_AndTheLatestReadWins', () => {
    expect(quotaOf([item()])).toBeNull();
    expect(
      quotaOf([
        item({ quota: { used: 1, limit: 10, warn: false, readAt: '2026-11-12T10:00:00Z' } }),
        item({ quota: { used: 9, limit: 10, warn: true, readAt: '2026-11-12T11:00:00Z' } }),
      ]),
    ).toMatchObject({ used: 9, warn: true });
  });
});

describe('the words of a date', () => {
  it('formatInstant_UtcInstant_IsToldInRome', () => {
    expect(formatInstant('2026-07-12T13:05:00Z', 'it')).toContain('15:05');
    expect(formatInstant('2026-11-12T14:05:00Z', 'it')).toContain('15:05');
    expect(formatInstant(null, 'it')).toBe('');
    expect(formatInstant('not a date', 'it')).toBe('');
  });

  it('formatDeclaredDay_MidnightUtcOfTheDay_IsThatDayWhateverTheZone', () => {
    expect(formatDeclaredDay('2026-11-10T00:00:00Z', 'it')).toBe('10 novembre 2026');
    expect(formatDeclaredDay('2026-11-10T00:00:00Z', 'en')).toBe('November 10, 2026');
    expect(formatDeclaredDay(null, 'it')).toBe('');
  });
});

describe('fixPathOf', () => {
  const returnTo = '/app/short-rent/marketplace/mine?propertyId=prop-1';

  it.each([
    ['Channel', 'PORTAL1', '/app/short-rent/marketplace/activate/channel/PORTAL1'],
    ['Tool', 'TOOL1', '/app/short-rent/marketplace/activate/tool/TOOL1'],
    ['LicensedFunction', 'chat', '/app/short-rent/marketplace/request/chat'],
    ['Partner', 'beds', '/app/short-rent/marketplace/partners/beds/activate'],
  ] as const)('fixPathOf_%s_OpensTheWizardOfItsKindForTheProperty', (kind, code, path) => {
    const url = new URL(fixPathOf({ kind, code, property: ROSA }, returnTo) ?? '', 'http://localhost');

    expect(url.pathname).toBe(path);
    expect(url.searchParams.get('propertyId')).toBe('prop-1');
    expect(url.searchParams.get('returnTo')).toBe(returnTo);
  });

  it('fixPathOf_RowOfTheWholeOrganization_CarriesNoProperty', () => {
    const url = new URL(fixPathOf({ kind: 'Partner', code: 'beds', property: null }, null) ?? '', 'http://localhost');

    expect(url.searchParams.has('propertyId')).toBe(false);
    expect(url.searchParams.has('returnTo')).toBe(false);
  });
});

describe('mayManageKind', () => {
  const can = (...granted: string[]) => (context: 'short-rent', permission: string) => context === 'short-rent' && granted.includes(permission);

  it('mayManageKind_WithoutOtaWrite_NeverMayManage', () => {
    expect(mayManageKind('Channel', can('ota.read'), true)).toBe(false);
    expect(mayManageKind('Partner', can('ota.read'), true)).toBe(false);
  });

  it('mayManageKind_ConnectorOff_OnlyAPartnerMay', () => {
    expect(mayManageKind('Channel', can('ota.write'), false)).toBe(false);
    expect(mayManageKind('Tool', can('ota.write'), false)).toBe(false);
    expect(mayManageKind('LicensedFunction', can('ota.write'), false)).toBe(false);
    expect(mayManageKind('Partner', can('ota.write'), false)).toBe(true);
    expect(mayManageKind('Channel', can('ota.write'), true)).toBe(true);
  });
});
