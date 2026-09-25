import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import itLocale from '@/i18n/locales/it.json';
import en from '@/i18n/locales/en.json';
import {
  getLeaseEventTypeLabel,
  getLeaseStatusLabel,
  getRliChecklistItemLabel,
} from '@/lib/i18n-labels';
import { LEASE_EVENT_TYPES, LEASE_STATUSES } from '@/types';
import { LEASE_STATUS_VARIANTS } from '../schemas/lease.schema';

const LOCALES = { it: itLocale, en } as const;
const CHECKLIST_KEYS = [
  'contract_signed',
  'delega_captured',
  'rli_exported',
  'rli_registered',
  'questura_extra_eu',
];

describe('lease labels (A7-15, A7-26)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it.each(Object.entries(LOCALES))('statusLabels_%s_ExactlyTheBackendStatuses', (_, locale) => {
    // One label per LeaseStatus of the backend enum, none for statuses that do not exist.
    expect(Object.keys(locale.leases.statusLabel).sort()).toEqual([...LEASE_STATUSES].sort());
  });

  it.each(Object.entries(LOCALES))('eventTypeLabels_%s_EveryBackendEventType', (_, locale) => {
    expect(Object.keys(locale.leases.eventType).sort()).toEqual([...LEASE_EVENT_TYPES].sort());
  });

  it.each(Object.entries(LOCALES))('checklistItemLabels_%s_EveryBackendKey', (_, locale) => {
    expect(Object.keys(locale.leases.rli.checklistItem).sort()).toEqual([...CHECKLIST_KEYS].sort());
  });

  it('getLeaseStatusLabel_EveryStatus_IsTranslatedAndHasABadgeVariant', () => {
    for (const status of LEASE_STATUSES) {
      const label = getLeaseStatusLabel(status, i18n.t);
      expect(label).not.toContain('leases.statusLabel');
      expect(label).not.toBe(status);
      expect(LEASE_STATUS_VARIANTS[status]).toBeDefined();
    }
    expect(getLeaseStatusLabel('SentToProvider', i18n.t)).toBe('Inviato al provider');
    expect(getLeaseStatusLabel('PartiallySigned', i18n.t)).toBe('Firmato parzialmente');
  });

  it('getLeaseStatusLabel_UnknownStatus_ShowsTheValueNotTheKey', () => {
    expect(getLeaseStatusLabel('FutureStatus', i18n.t)).toBe('FutureStatus');
  });

  it('getLeaseEventTypeLabel_KnownAndUnknown_TranslatesOrShowsValue', () => {
    expect(getLeaseEventTypeLabel('RegistrationAuthorized', i18n.t)).toBe('Delega RLI registrata');
    expect(getLeaseEventTypeLabel('SomethingNew', i18n.t)).toBe('SomethingNew');
  });

  it('getRliChecklistItemLabel_KnownKey_UsesUiLanguageNotServerLabel', async () => {
    await i18n.changeLanguage('en');
    expect(getRliChecklistItemLabel({ key: 'contract_signed', label: 'Contratto firmato da tutte le parti' }, i18n.t))
      .toBe('Contract signed by all parties');
  });

  it('getRliChecklistItemLabel_UnknownKey_FallsBackToServerLabel', () => {
    expect(getRliChecklistItemLabel({ key: 'new_item', label: 'Voce nuova' }, i18n.t)).toBe('Voce nuova');
  });
});
