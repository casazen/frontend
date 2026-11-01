import { describe, it, expect } from 'vitest';
import {
  SAFETY_ITEM_CODES,
  type SafetyChecklist,
  type SafetyChecklistItem,
  type SafetyItemCode,
} from '@/types/compliance.types';
import {
  extinguisherCount,
  floorAreasFor,
  heatFacts,
  heatIsIncomplete,
  initialQuickState,
  quickCommand,
  visibleItems,
  type QuickSafetyState,
  type SafetyHints,
} from '../safety/safety-quick-model';

function item(code: SafetyItemCode, patch: Partial<SafetyChecklistItem> = {}): SafetyChecklistItem {
  return {
    code,
    requirement: 'Required',
    status: 'NotAnswered',
    notApplicableReason: null,
    answer: null,
    quantity: null,
    location: null,
    detectorType: null,
    checkedOn: null,
    expiresOn: null,
    evidenceDocumentId: null,
    evidenceFileName: null,
    notes: null,
    ...patch,
  };
}

function checklist(patch: Partial<SafetyChecklist> = {}, items: Partial<Record<SafetyItemCode, Partial<SafetyChecklistItem>>> = {}): SafetyChecklist {
  return {
    schemaVersion: 2,
    legalBasis: 'DL145/2023 art.13-ter, RS-3 2026-09',
    declarationTextVersion: '2026-09-v1',
    saved: false,
    importedFromLegacy: false,
    facts: { entrepreneurial: null, hasGasSupply: null, combustionAppliances: null, floorCount: null, floorAreasSqm: null },
    items: SAFETY_ITEM_CODES.map((code) => item(code, items[code])),
    minimumExtinguishers: null,
    isComplete: false,
    blockers: [],
    warnings: [],
    confirmedAt: null,
    confirmedTextVersion: null,
    updatedAt: null,
    ...patch,
  };
}

const noHints: SafetyHints = { amenities: [], areaSqm: null, cinCode: null, fiscal: null };

function state(patch: Partial<QuickSafetyState> = {}): QuickSafetyState {
  return {
    heat: null,
    heatSources: [],
    entrepreneurial: null,
    floorCount: 1,
    present: [],
    touched: [],
    extinguishers: null,
    confirm: false,
    ...patch,
  };
}

const answers = (command: ReturnType<typeof quickCommand>) =>
  Object.fromEntries(command.items.map((i) => [i.code, i.answer])) as Record<SafetyItemCode, string | null>;

describe('safety quick model', () => {
  it('heatFacts_AllElectric_IsTheExemptionOfTheDetectors', () => {
    expect(heatFacts({ heat: 'no', heatSources: [] })).toEqual({ hasGasSupply: false, combustionAppliances: [] });
    expect(visibleItems(state({ heat: 'no', entrepreneurial: false }))).toEqual([
      'FireExtinguishers',
      'SmokeDetector',
      'EmergencyInstructions',
      'BdsrDeclaration',
    ]);
  });

  it('heatFacts_FireplaceOnly_DetectorsRequiredAndGasLeftUnstated', () => {
    expect(heatFacts({ heat: 'yes', heatSources: ['Fireplace'] })).toEqual({ hasGasSupply: null, combustionAppliances: ['Fireplace'] });
    expect(visibleItems(state({ heat: 'yes', heatSources: ['Fireplace'], entrepreneurial: true }))).toEqual([
      'FireExtinguishers',
      'GasDetector',
      'CoDetector',
      'SystemsCompliance',
      'SmokeDetector',
      'EmergencyInstructions',
      'BdsrDeclaration',
    ]);
  });

  it('heatFacts_GasHobOrGasPicked_GasPresent', () => {
    expect(heatFacts({ heat: 'yes', heatSources: ['GasHob'] })).toEqual({ hasGasSupply: true, combustionAppliances: ['GasHob'] });
    expect(heatFacts({ heat: 'yes', heatSources: ['GasSupply'] })).toEqual({ hasGasSupply: true, combustionAppliances: null });
  });

  it('heatIsIncomplete_YesWithNothingPicked_True', () => {
    expect(heatIsIncomplete({ heat: 'yes', heatSources: [] })).toBe(true);
    expect(heatIsIncomplete({ heat: 'yes', heatSources: ['Stove'] })).toBe(false);
    expect(heatIsIncomplete({ heat: null, heatSources: [] })).toBe(false);
  });

  it('visibleItems_QuestionsNotAnswered_DependentItemsWait', () => {
    expect(visibleItems(state())).toEqual(['FireExtinguishers', 'SmokeDetector', 'EmergencyInstructions', 'BdsrDeclaration']);
  });

  it('floorAreasFor_OneFloorWithTheArea_TheAreaOfTheProperty', () => {
    const facts = checklist().facts;
    expect(floorAreasFor(1, facts, 75)).toEqual([75]);
    expect(floorAreasFor(2, facts, 75)).toBeNull();
    expect(floorAreasFor(2, { ...facts, floorAreasSqm: [90, 60] }, 150)).toEqual([90, 60]);
    expect(floorAreasFor(1, facts, null)).toBeNull();
  });

  it('initialQuickState_NothingStored_PrefilledFromWhatCasaZenKnows', () => {
    const { state: initial, prefilled } = initialQuickState(checklist(), {
      amenities: ['FireExtinguisher', 'CarbonMonoxideDetector', 'SmokeDetector', 'Fireplace', 'WiFi'],
      areaSqm: 75,
      cinCode: 'IT013075C2ABCDEF12',
      fiscal: { hasPartitaIva: true, requiresPartitaIva: false },
    });

    expect(initial).toMatchObject({ heat: 'yes', heatSources: ['Fireplace'], entrepreneurial: true, floorCount: 1, confirm: false });
    expect(initial.present).toEqual(['FireExtinguishers', 'CoDetector', 'SmokeDetector', 'BdsrDeclaration']);
    expect(prefilled).toEqual({
      heat: 'amenity',
      entrepreneurial: 'fiscalVat',
      floorCount: 'floors',
      FireExtinguishers: 'amenity',
      CoDetector: 'amenity',
      SmokeDetector: 'amenity',
      BdsrDeclaration: 'cin',
    });
  });

  it('initialQuickState_TaxData_ThresholdOrNothing', () => {
    const over = initialQuickState(checklist(), { ...noHints, fiscal: { hasPartitaIva: false, requiresPartitaIva: true } });
    expect(over.state.entrepreneurial).toBe(true);
    expect(over.prefilled.entrepreneurial).toBe('fiscalThreshold');

    const under = initialQuickState(checklist(), { ...noHints, fiscal: { hasPartitaIva: false, requiresPartitaIva: false } });
    expect(under.state.entrepreneurial).toBe(false);
    expect(under.prefilled.entrepreneurial).toBe('fiscalNone');

    const unknown = initialQuickState(checklist(), noHints);
    expect(unknown.state.entrepreneurial).toBeNull();
    expect(unknown.prefilled.entrepreneurial).toBeUndefined();
  });

  it('initialQuickState_StoredAnswers_WinOverEveryHint', () => {
    const stored = checklist(
      { facts: { entrepreneurial: false, hasGasSupply: false, combustionAppliances: [], floorCount: 2, floorAreasSqm: null } },
      { CoDetector: { answer: 'Missing' }, FireExtinguishers: { answer: 'Present', quantity: 3 } },
    );
    const { state: initial, prefilled } = initialQuickState(stored, {
      amenities: ['CarbonMonoxideDetector', 'Fireplace'],
      areaSqm: 80,
      cinCode: null,
      fiscal: { hasPartitaIva: true, requiresPartitaIva: true },
    });

    expect(initial).toMatchObject({ heat: 'no', heatSources: [], entrepreneurial: false, floorCount: 2 });
    expect(initial.present).toEqual(['FireExtinguishers']);
    expect(prefilled).toEqual({});
    expect(extinguisherCount(initial, stored, noHints)).toBe(3);
  });

  it('quickCommand_AllElectricOneFloor_BodyOfTheFullForm', () => {
    const empty = checklist();
    const hints = { ...noHints, areaSqm: 250 };
    const command = quickCommand(
      state({ heat: 'no', entrepreneurial: false, present: ['FireExtinguishers', 'BdsrDeclaration'], confirm: true }),
      empty,
      hints,
    );

    expect(command.facts).toEqual({
      entrepreneurial: false,
      hasGasSupply: false,
      combustionAppliances: [],
      floorCount: 1,
      floorAreasSqm: [250],
    });
    expect(command.confirm).toBe(true);
    // 250 m² on one floor: one extinguisher every 200 m² or fraction.
    expect(command.items.find((i) => i.code === 'FireExtinguishers')).toMatchObject({ answer: 'Present', quantity: 2 });
    expect(answers(command)).toEqual({
      FireExtinguishers: 'Present',
      GasDetector: null,
      CoDetector: null,
      SystemsCompliance: null,
      BdsrDeclaration: 'Present',
      SmokeDetector: null,
      EmergencyInstructions: null,
    });
  });

  it('quickCommand_UntickedHere_MissingOnlyWhenTouchedOrAlreadyNo', () => {
    const stored = checklist({}, { SmokeDetector: { answer: 'Missing' }, EmergencyInstructions: { answer: 'Present' } });
    const command = quickCommand(
      state({ heat: 'yes', heatSources: ['GasHob'], entrepreneurial: true, present: [], touched: ['EmergencyInstructions', 'GasDetector'] }),
      stored,
      noHints,
    );

    expect(answers(command)).toMatchObject({
      GasDetector: 'Missing',
      CoDetector: null,
      SystemsCompliance: null,
      SmokeDetector: 'Missing',
      EmergencyInstructions: 'Missing',
    });
  });

  it('quickCommand_DetailsAndHiddenItems_SentBackAsStored', () => {
    const stored = checklist(
      { facts: { entrepreneurial: true, hasGasSupply: true, combustionAppliances: ['Boiler'], floorCount: 1, floorAreasSqm: [60] } },
      {
        GasDetector: { answer: 'Present', quantity: 1, location: 'Cucina', detectorType: 'Battery', checkedOn: '2026-10-01' },
        FireExtinguishers: { answer: 'Present', quantity: 1, evidenceDocumentId: 'doc-1', evidenceFileName: 'estintore.jpg' },
        SystemsCompliance: { answer: 'ToReview' },
      },
    );
    // The host now says the home is all electric and not a business: the detectors and the systems are not asked.
    const command = quickCommand(state({ heat: 'no', entrepreneurial: false, present: ['FireExtinguishers'] }), stored, noHints);

    expect(command.items.find((i) => i.code === 'GasDetector')).toMatchObject({
      answer: 'Present',
      quantity: 1,
      location: 'Cucina',
      detectorType: 'Battery',
      checkedOn: '2026-10-01',
    });
    expect(command.items.find((i) => i.code === 'FireExtinguishers')).toMatchObject({ answer: 'Present', quantity: 1, evidenceDocumentId: 'doc-1' });
    // `ToReview` is never sent back.
    expect(command.items.find((i) => i.code === 'SystemsCompliance')?.answer).toBeNull();
    expect(command.facts.floorAreasSqm).toEqual([60]);
  });

  it('extinguisherCount_MoreFloors_FollowsTheMinimumUntilTheHostSetsIt', () => {
    const empty = checklist();
    expect(extinguisherCount(state({ floorCount: 3 }), empty, noHints)).toBe(3);
    expect(extinguisherCount(state({ floorCount: 3, extinguishers: 4 }), empty, noHints)).toBe(4);
  });
});
