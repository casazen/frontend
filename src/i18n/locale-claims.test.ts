import { describe, expect, it } from 'vitest';
import { MAINTENANCE_URGENCY_WIRE } from '@/features/maintenance-requests/model';
import enLocale from './locales/en.json';
import itLocale from './locales/it.json';

/**
 * Words of the app that must not contradict what the code does or each other (the review of the guide, 2026-11-27: INC-26, 28, 41, 42, 45, 47):
 * one name for a thing, one path in the iCal guide, one word per urgency, and no promise that the e-mail of an invitation waits for a check.
 */
type Tree = { [key: string]: string | string[] | Tree };

/** Every string of a locale, by its path (`a.b.c`; arrays as `a.b.0`). */
function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else if (Array.isArray(value)) value.forEach((item, index) => out.set(`${path}.${index}`, item));
    else for (const [inner, text] of flatten(value, path)) out.set(inner, text);
  }
  return out;
}

const italian = flatten(itLocale as unknown as Tree);
const english = flatten(enLocale as unknown as Tree);
const both = [
  ['it', italian],
  ['en', english],
] as const;

describe.each(both)('the words of the app (%s)', (_language, texts) => {
  const text = (path: string): string => {
    const value = texts.get(path);
    if (value === undefined) throw new Error(`Missing key ${path}`);
    return value;
  };
  const endingWith = (suffix: string): string[] => [...texts].filter(([path]) => path.endsWith(suffix)).map(([, value]) => value);

  it('NamesTheCinButtonOnceAndTheBookingSiteOnce', () => {
    expect(text('cin.banner.requestOnBdsr')).toBe(text('cin.requestOnPortal'));
    expect(text('directBooking.title')).not.toMatch(/direct booking/i);
  });

  it('GivesOnePathToExportTheBookingCalendar_InGeneralWords', () => {
    const steps = [0, 1, 2, 3, 4].map((index) => text(`supplier.help.bookingSteps.${index}`)).join(' ');
    expect(steps).not.toMatch(/Calendario|→/);
    expect(steps).not.toMatch(/Calendar →/);
    const [channelHint] = endingWith('.exportBookingSteps');
    expect(channelHint).toBeDefined();
    // The two places speak of the same section, with the same words.
    const section = texts === italian ? /sincronizzare i calendari/ : /syncing calendars/;
    expect(steps).toMatch(section);
    expect(channelHint).toMatch(section);
  });

  it('SaysThatTheEmailOfAnInvitationToATrustedSupplierLeavesAtOnce', () => {
    expect(text('supplier.trusted.inviteSuccess')).not.toMatch(/dopo la verifica|after verification/i);
  });

  it('SaysThatTheEmailOfTheTenantIsTheKeyToTheirArea', () => {
    expect(text('leaseWizard.parties.contactEmailHintTenant')).toMatch(/area/i);
    expect(text('leaseWizard.parties.contactEmailHintTenant')).not.toMatch(/^(Serve solo|Only used)/);
  });

  it('SaysThatAnEmergencyIsNotACallToAnyone', () => {
    const notice = text('shared.emergencyNotice');
    expect(notice).toMatch(texts === italian ? /pronto intervento.*non chiama nessuno/ : /emergency service.*calls no one/);
    expect(text('tenantArea.maintenance.emergencyNotImmediate')).toContain(notice.slice(0, 20));
  });

  it('CallsTheUrgencyByTheSameWordInEveryScreen_WhateverTheValueSentToTheServer', () => {
    // The tenant wizard keeps its keys (bassa, normale, urgente) and the values it sends (Normal, High, Emergency).
    expect(MAINTENANCE_URGENCY_WIRE).toEqual({ bassa: 'Normal', normale: 'High', urgente: 'Emergency' });
    const pairs: Array<[string, string, string]> = [
      ['bassa', 'Normal', 'urgencyNormal'],
      ['normale', 'High', 'urgencyHigh'],
      ['urgente', 'Emergency', 'urgencyEmergency'],
    ];
    for (const [wizardKey, level, requestKey] of pairs) {
      expect(text(`maintenanceRequest.urgency.${wizardKey}`)).toBe(text(`tenantArea.maintenance.urgencyLevel.${level}`));
      expect(text(`maintenanceRequest.urgency.${wizardKey}`)).toBe(text(`serviceRequest.${requestKey}`));
      expect(text(`maintenanceRequest.urgency.${wizardKey}`)).toBe(text(`requestWizard.what.urgencies.${level}.title`));
      expect(text(`maintenanceRequest.urgency.detail.${wizardKey}`)).toBe(text(`requestWizard.what.urgencies.${level}.text`));
    }
  });
});

describe('the names of the plans (it)', () => {
  it('CallsTheTopPlanAgencyEverywhere', () => {
    expect([...italian.values()].filter((value) => /piano Agenzia/i.test(value))).toEqual([]);
    expect(italian.get('org.tier.requires_agency')).toBe('Questa funzionalità richiede il piano Agency');
  });
});

describe('the words of the open access', () => {
  it.each(both)('DoesNotPromiseThatNothingIsChargedNorThatEveryFunctionIsUnlocked (%s)', (_language, texts) => {
    for (const key of ['accountBilling.plan.notice.openAccess', 'accountBilling.plan.notice.openAccessPricesPending']) {
      expect(texts.get(key)).not.toMatch(/non addebitiamo nulla|tutte le funzioni sono sbloccate|we charge nothing|every feature is unlocked/i);
    }
  });
});
