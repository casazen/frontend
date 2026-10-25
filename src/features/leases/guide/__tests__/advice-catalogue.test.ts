import { describe, expect, it } from 'vitest';
import it_ from '@/i18n/locales/it.json';
import en from '@/i18n/locales/en.json';
import type { LeaseDetail, LeaseStage, LongRentRules } from '@/types';
import { buildDetail } from '../../__tests__/lease-test-utils';
import { ADVICE_CATALOGUE, SOURCES, type GuideTool } from '../advice-catalogue';
import { buildGuideFacts, guideValues, type GuideFacts, type GuideInputs } from '../guide-facts';
import { selectAdvice } from '../select-advice';

// LR-GUIDE-1: the catalogue picks the advice that is for a lease by its type, its moment and its data; the texts of every entry exist in
// both languages. A far day for the start keeps these cases the same whatever day the suite runs on (`today` is given, not read).
const RULES: LongRentRules = {
  termMonths: { Libero: 48, Concordato: 36 },
  renewalMonths: { Libero: 48, Concordato: 24 },
  noticeMonths: 6,
  registrationDays: 30,
  depositMaxRents: 3,
  availableTypes: ['Libero', 'Concordato', 'Transitorio'],
  importedTypes: ['Libero', 'Concordato', 'Transitorio'],
  transitoryTermMonths: { min: 1, max: 18 },
  transitoryDocumentationAfterDays: 30,
  transitoryBandFromInhabitants: 10_000,
};

const TODAY = '2026-10-25';

const REGISTRATION = { status: 'Registered', channel: 'Manual', hasReceipt: true, registrationCode: 'PROT-1', registrationDate: '2026-10-05T00:00:00Z' } as const;

/** The range of a canone concordato the server computed when the lease was made (the rent outside it is what the cases change). */
const ASSESSMENT = {
  sqm: 65,
  garageSqm: 0,
  balconySqm: 0,
  otherAppurtenanceSqm: 0,
  privateGreenSqm: 0,
  typeAElementCount: 2,
  typeBElementCount: 3,
  typeCElementCount: 0,
  typeDElementCount: 0,
  qualifyingTypeDElementCount: 0,
  stoveHeating: false,
  isFurnished: false,
  airConditioning: false,
  zoneName: null,
  cadastralSheet: null,
  contractYears: 3,
  usableSqm: 65,
  zone: 'Unica',
  subFascia: 2,
  canoneMinAnnuo: 1300,
  canoneMaxAnnuo: 5525,
  canoneMinMensile: 108.34,
  canoneMaxMensile: 460.41,
  dataCompleteness: 'Partial',
  indicative: true,
  rentWithinRange: true,
  calculatedAt: '2026-09-24T10:00:00Z',
} as const;

function inputsOf(lease: Partial<LeaseDetail>, stage?: LeaseStage): GuideInputs {
  return {
    lease: buildDetail({ startDate: '2099-01-01T00:00:00Z', endDate: '2102-12-31T00:00:00Z', ...lease }),
    stage,
    stepCode: null,
    today: TODAY,
    rules: RULES,
    ata: undefined,
    hasAttestation: undefined,
    imuApplicable: undefined,
  };
}

/** The text at a dotted path of a locale file, or `undefined` when there is none (or it is not a text). */
function textAt(tree: unknown, path: string): string | undefined {
  let node: unknown = tree;
  for (const part of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function placeholdersOf(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((match) => match[1]))].sort();
}

function factsOf(lease: Partial<LeaseDetail>, stage?: LeaseStage, extra: Partial<GuideInputs> = {}): GuideFacts {
  return buildGuideFacts({ ...inputsOf(lease, stage), ...extra });
}

const idsOf = (facts: GuideFacts) => selectAdvice(facts).map((entry) => entry.id);

describe('the catalogue of the advice of a lease', () => {
  it('selectAdvice_ByTypeAndMoment_ATransitoryNearItsEndIsToldToConfirmItsNeedAndALiberoIsNot', () => {
    const transitory = idsOf(
      factsOf({ contractType: 'Transitorio', status: 'Registered', registration: REGISTRATION, startDate: '2026-05-01T00:00:00Z', endDate: '2026-12-31T00:00:00Z' }, 'Expiring'),
    );
    const libero = idsOf(factsOf({ status: 'Registered', registration: REGISTRATION, startDate: '2023-01-01T00:00:00Z', endDate: '2027-01-31T00:00:00Z' }, 'Expiring'));

    expect(transitory).toContain('transitorioConfirmNeed');
    expect(libero).not.toContain('transitorioConfirmNeed');
    // The libero one is told what the first expiry means; the transitory one, who has none, is not.
    expect(libero).toContain('liberoFirstExpiry');
    expect(transitory).not.toContain('liberoFirstExpiry');
    // The same transitory contract, still in preparation, is not told to confirm anything yet.
    expect(idsOf(factsOf({ contractType: 'Transitorio' }, 'Draft'))).not.toContain('transitorioConfirmNeed');
  });

  it('selectAdvice_ARegisteredConcordato_GetsTheBenefitsToClaimFirst_ALiberoDoesNot', () => {
    const concordato = idsOf(factsOf({ contractType: 'Concordato', status: 'Registered', registration: REGISTRATION }, 'Active'));
    const libero = idsOf(factsOf({ status: 'Registered', registration: REGISTRATION }, 'Active'));

    expect(concordato[0]).toBe('concordatoBenefits');
    expect(libero).not.toContain('concordatoBenefits');
    // Nothing of the canone concordato leaks into the advice of the other types.
    expect(libero.filter((id) => id.startsWith('concordato'))).toEqual([]);
    // The follow-up is for the moment after the registration: a concordato still to be registered does not get it.
    expect(idsOf(factsOf({ contractType: 'Concordato', status: 'Signed' }, 'Signed'))).not.toContain('concordatoBenefits');
  });

  it('selectAdvice_TheDeadlineThatHasPassed_ComesBeforeEverythingElse', () => {
    const late = factsOf({ status: 'Signed', hasSignedPdf: true, registrationDeadline: '2026-10-10T00:00:00Z' }, 'Signed');
    const inTime = factsOf({ status: 'Signed', hasSignedPdf: true, registrationDeadline: '2026-11-10T00:00:00Z' }, 'Signed');

    expect(idsOf(late)[0]).toBe('lateRegistration');
    expect(idsOf(inTime)).not.toContain('lateRegistration');
  });

  it('selectAdvice_TheDataOfTheContract_DecideWhichAdviceFitsIt', () => {
    // The regime chosen decides which question about it is asked, and the costs of registering are for the ordinary one.
    expect(idsOf(factsOf({ taxRegime: 'CedolareSecca' }, 'Draft'))).toEqual(expect.arrayContaining(['regimeCheckCedolare']));
    expect(idsOf(factsOf({ taxRegime: 'CedolareSecca' }, 'Draft'))).not.toContain('registrationCosts');
    expect(idsOf(factsOf({ taxRegime: 'Ordinario' }, 'Draft'))).toEqual(expect.arrayContaining(['regimeCheckOrdinary', 'registrationCosts']));
    expect(idsOf(factsOf({ taxRegime: null, contractType: 'Concordato' }, 'Draft'))).toContain('regimeChoose');

    // A deposit above the limit of the rules comes first; one within it only gets the rule.
    const over = idsOf(factsOf({ monthlyRent: 1000, securityDeposit: 4000 }, 'Draft'));
    const within = idsOf(factsOf({ monthlyRent: 1000, securityDeposit: 3000 }, 'Draft'));
    expect(over[0]).toBe('depositOverMax');
    expect(over).not.toContain('depositMax');
    expect(within).toContain('depositMax');
    expect(within).not.toContain('depositOverMax');

    // An extra-EU tenant: the Questura, until the communication is declared.
    const extraEu = { hasExtraEUTenant: true, status: 'Signed', hasSignedPdf: true } as const;
    expect(idsOf(factsOf(extraEu, 'Signed'))).toContain('extraEu');
    expect(idsOf(factsOf({ ...extraEu, events: [{ eventType: 'QuesturaCommunicationMarkedDone', occurredAt: '2026-10-06T00:00:00Z' }] }, 'Signed'))).not.toContain('extraEu');

    // A canone concordato whose rent the server found outside the range: told at once, whatever the moment.
    const outside = { contractType: 'Concordato', concordatoAssessment: { ...ASSESSMENT, rentWithinRange: false } } as const;
    expect(idsOf(factsOf(outside, 'Draft'))[0]).toBe('concordatoRentOutOfRange');
    expect(idsOf(factsOf({ contractType: 'Concordato' }, 'Draft'))).toContain('concordatoRentCheck');
  });

  it('selectAdvice_WhatTheStepAlreadySays_IsNotRepeated_AndTheFiguresOfTheRulesAreWaitedFor', () => {
    const extraEu = { hasExtraEUTenant: true, status: 'Signed', hasSignedPdf: true } as const;
    const said = buildGuideFacts({ ...inputsOf(extraEu, 'Signed'), stepCode: 'QuesturaCommunication' });
    expect(idsOf(said)).not.toContain('extraEu');

    // No figure of law is written in the interface: without the rules the advice that quote them wait, the others stay.
    const waiting = buildGuideFacts({ ...inputsOf({}, 'Draft'), rules: undefined });
    const needing = ADVICE_CATALOGUE.filter((entry) => entry.needsRules).map((entry) => entry.id);
    expect(needing.length).toBeGreaterThan(5);
    expect(idsOf(waiting).filter((id) => needing.includes(id))).toEqual([]);
    expect(idsOf(waiting)).toContain('regimeCheckCedolare');
  });

  it('theTextsOfEveryEntry_ExistInBothLanguages_WithOnlyThePlaceholdersTheGuideGives', () => {
    const ids = ADVICE_CATALOGUE.map((entry) => entry.id);
    expect(new Set(ids).size, 'an id is used twice').toBe(ids.length);

    // Every number a text can take, as the guide would give it.
    const known = new Set(Object.keys(guideValues(factsOf({ monthlyRent: 1000, securityDeposit: 5000 }, 'Draft'), 'it')));
    const missing: string[] = [];
    const strange: string[] = [];

    for (const entry of ADVICE_CATALOGUE) {
      if (entry.render) {
        expect(entry.action, `${entry.id} brings its own buttons`).toBeUndefined();
        continue;
      }
      expect(entry.action, `${entry.id} has no gesture`).toBeDefined();
      const base = `leaseGuide.advice.${entry.id}`;
      let usesFigures = false;
      for (const part of ['title', 'body', 'why', 'action']) {
        const italian = textAt(it_, `${base}.${part}`);
        const english = textAt(en, `${base}.${part}`);
        if (!italian || !english) {
          missing.push(`${base}.${part}`);
          continue;
        }
        const names = placeholdersOf(italian);
        if (names.join() !== placeholdersOf(english).join()) strange.push(`${base}.${part}: placeholders differ`);
        for (const name of names) {
          usesFigures = true;
          if (!known.has(name)) strange.push(`${base}.${part}: {{${name}}} is not given by the guide`);
        }
      }
      // A text with a figure of the rules must not reach the screen before the rules do.
      if (usesFigures && !entry.needsRules) strange.push(`${entry.id}: its texts have figures but it does not wait for the rules`);
      for (const source of entry.sources) {
        if (!textAt(it_, `leaseGuide.source.${source}`) || !textAt(en, `leaseGuide.source.${source}`)) missing.push(`leaseGuide.source.${source}`);
      }
      if (entry.action?.kind === 'official') expect(SOURCES[entry.action.source].url, `${entry.id} points to a page with no address`).toBeTruthy();
    }

    const tools: GuideTool[] = ['regime', 'rent', 'attestation', 'imu'];
    for (const tool of tools) {
      for (const part of ['title', 'description']) {
        if (!textAt(it_, `leaseGuide.tool.${tool}.${part}`) || !textAt(en, `leaseGuide.tool.${tool}.${part}`)) missing.push(`leaseGuide.tool.${tool}.${part}`);
      }
    }

    expect(missing).toEqual([]);
    expect(strange).toEqual([]);
  });
});
