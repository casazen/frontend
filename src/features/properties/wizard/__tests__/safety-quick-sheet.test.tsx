import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import i18n from '@/i18n/config';
import * as compliance from '@/features/compliance/use-compliance';
import * as fiscal from '@/queries/use-fiscal';
import * as properties from '@/queries/use-properties';
import { useWorkspace } from '@/hooks/use-workspace';
import {
  SAFETY_ITEM_CODES,
  type SafetyChecklist,
  type SafetyChecklistItem,
  type SafetyItemCode,
  type SaveSafetyChecklistCommand,
} from '@/types/compliance.types';
import { SafetyQuickSheet } from '../safety/safety-quick-sheet';

vi.mock('@/features/compliance/use-compliance', () => ({
  useSafetyChecklist: vi.fn(),
  useSaveSafetyChecklist: vi.fn(),
}));
vi.mock('@/queries/use-properties', () => ({ useProperty: vi.fn() }));
vi.mock('@/queries/use-fiscal', () => ({ useFiscalRegime: vi.fn() }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: vi.fn() }));

// The sheet reads only these fields: partial objects are cast to the full hook results.
type Hook<T extends (...args: never[]) => unknown> = ReturnType<T>;

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

function checklist(patch: Partial<SafetyChecklist> = {}): SafetyChecklist {
  return {
    schemaVersion: 2,
    legalBasis: 'DL145/2023 art.13-ter, RS-3 2026-09',
    declarationTextVersion: '2026-09-v1',
    saved: false,
    importedFromLegacy: false,
    facts: { entrepreneurial: null, hasGasSupply: null, combustionAppliances: null, floorCount: null, floorAreasSqm: null },
    items: SAFETY_ITEM_CODES.map((code) => item(code)),
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

const saveChecklist = vi.fn();
const hasPermission = vi.fn();

function mockHooks({
  data = checklist(),
  cinCode = null,
  taxData = null,
}: {
  data?: SafetyChecklist;
  cinCode?: string | null;
  taxData?: { hasPartitaIva: boolean; requiresPartitaIva: boolean } | null;
} = {}) {
  vi.mocked(compliance.useSafetyChecklist).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as Hook<typeof compliance.useSafetyChecklist>);
  vi.mocked(properties.useProperty).mockReturnValue({
    data: { id: 'prop-1', cinCode },
    isLoading: false,
  } as unknown as Hook<typeof properties.useProperty>);
  vi.mocked(fiscal.useFiscalRegime).mockReturnValue({
    data: taxData ?? undefined,
    isLoading: false,
  } as unknown as Hook<typeof fiscal.useFiscalRegime>);
}

const sent = () => saveChecklist.mock.calls[0][0] as SaveSafetyChecklistCommand;
const answerOf = (command: SaveSafetyChecklistCommand, code: SafetyItemCode) => command.items.find((i) => i.code === code);

describe('SafetyQuickSheet', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    saveChecklist.mockImplementation(async () => checklist({ saved: true, isComplete: true }));
    vi.mocked(compliance.useSaveSafetyChecklist).mockReturnValue({
      mutateAsync: saveChecklist,
      isPending: false,
    } as unknown as Hook<typeof compliance.useSaveSafetyChecklist>);
    hasPermission.mockReturnValue(true);
    vi.mocked(useWorkspace).mockReturnValue({ hasPermission } as unknown as ReturnType<typeof useWorkspace>);
    mockHooks();
  });

  it('prefill_WhatCasaZenKnows_AnswersMarkedForTheHostToCheck', () => {
    mockHooks({ cinCode: 'IT013075C2ABCDEF12', taxData: { hasPartitaIva: true, requiresPartitaIva: false } });
    render(<SafetyQuickSheet propertyId="prop-1" amenities={['FireExtinguisher', 'Fireplace']} areaSqm={75} />);

    expect(screen.getByTestId('safety-quick-heat-yes')).toBeChecked();
    expect(screen.getByTestId('safety-quick-source-Fireplace')).toBeChecked();
    expect(screen.getByTestId('safety-quick-prefill-heat')).toHaveTextContent('Dalle dotazioni che hai scelto');
    expect(screen.getByTestId('safety-quick-business-yes')).toBeChecked();
    expect(screen.getByTestId('safety-quick-prefill-entrepreneurial')).toHaveTextContent('partita IVA');
    expect(screen.getByTestId('safety-quick-item-FireExtinguishers')).toBeChecked();
    expect(screen.getByTestId('safety-quick-item-BdsrDeclaration')).toBeChecked();
    expect(screen.getByTestId('safety-quick-prefill-BdsrDeclaration')).toHaveTextContent('Hai già il CIN');
    // A flame in the home and a business: the detectors and the compliant systems are asked.
    expect(screen.getByTestId('safety-quick-item-GasDetector')).not.toBeChecked();
    expect(screen.getByTestId('safety-quick-item-CoDetector')).toBeInTheDocument();
    expect(screen.getByTestId('safety-quick-item-SystemsCompliance')).toBeInTheDocument();
    expect(fiscal.useFiscalRegime).toHaveBeenCalledWith(expect.any(Number), true);
  });

  it('noTaxPermission_TaxDataNotRead_QuestionLeftToTheHost', () => {
    hasPermission.mockReturnValue(false);
    render(<SafetyQuickSheet propertyId="prop-1" amenities={[]} areaSqm={null} />);

    expect(fiscal.useFiscalRegime).toHaveBeenCalledWith(expect.any(Number), false);
    expect(screen.getByTestId('safety-quick-business-yes')).not.toBeChecked();
    expect(screen.getByTestId('safety-quick-business-no')).not.toBeChecked();
    expect(screen.queryByTestId('safety-quick-item-SystemsCompliance')).not.toBeInTheDocument();
  });

  it('allElectric_DetectorsGone_SavedWithTheExemption', async () => {
    const onSaved = vi.fn();
    render(<SafetyQuickSheet propertyId="prop-1" amenities={['FireExtinguisher']} areaSqm={75} onSaved={onSaved} />);

    fireEvent.click(screen.getByTestId('safety-quick-heat-no'));
    expect(screen.getByTestId('safety-quick-exempt')).toHaveTextContent("resta l'estintore");
    expect(screen.queryByTestId('safety-quick-item-GasDetector')).not.toBeInTheDocument();
    expect(screen.queryByTestId('safety-quick-item-CoDetector')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('safety-quick-business-no'));
    fireEvent.click(screen.getByTestId('safety-quick-item-BdsrDeclaration'));
    fireEvent.click(screen.getByTestId('safety-quick-confirm'));
    fireEvent.click(screen.getByTestId('safety-quick-save'));

    await waitFor(() => expect(saveChecklist).toHaveBeenCalledTimes(1));
    const command = sent();
    expect(command.facts).toEqual({
      entrepreneurial: false,
      hasGasSupply: false,
      combustionAppliances: [],
      floorCount: 1,
      floorAreasSqm: [75],
    });
    expect(command.confirm).toBe(true);
    expect(answerOf(command, 'FireExtinguishers')).toMatchObject({ answer: 'Present', quantity: 1 });
    expect(answerOf(command, 'BdsrDeclaration')?.answer).toBe('Present');
    expect(answerOf(command, 'GasDetector')?.answer).toBeNull();
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ isComplete: true })));
  });

  it('flameWithNothingPicked_AsksWhatThereIs_NothingSaved', () => {
    render(<SafetyQuickSheet propertyId="prop-1" amenities={[]} areaSqm={null} />);

    fireEvent.click(screen.getByTestId('safety-quick-heat-yes'));
    fireEvent.click(screen.getByTestId('safety-quick-save'));

    expect(screen.getByTestId('safety-quick-heat-error')).toHaveTextContent('Scegli almeno una voce');
    expect(saveChecklist).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('safety-quick-source-GasHob'));
    expect(screen.queryByTestId('safety-quick-heat-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('safety-quick-item-GasDetector')).toBeInTheDocument();
  });

  it('extinguishers_TwoFloors_MinimumFollowsTheFloors', async () => {
    render(<SafetyQuickSheet propertyId="prop-1" amenities={['FireExtinguisher']} areaSqm={140} />);

    fireEvent.click(screen.getByRole('button', { name: 'Aumenta Piani della casa' }));
    expect(screen.queryByTestId('safety-quick-prefill-floorCount')).not.toBeInTheDocument();
    expect(screen.getByTestId('safety-quick-item-FireExtinguishers').closest('label')).toHaveTextContent('Ne servono almeno 2.');

    fireEvent.click(screen.getByTestId('safety-quick-save'));
    await waitFor(() => expect(saveChecklist).toHaveBeenCalledTimes(1));
    expect(sent().facts).toMatchObject({ floorCount: 2, floorAreasSqm: null });
    expect(answerOf(sent(), 'FireExtinguishers')).toMatchObject({ answer: 'Present', quantity: 2 });
  });

  it('fullForm_OfferedUntilTheFirstChange', () => {
    const onOpenFull = vi.fn();
    render(<SafetyQuickSheet propertyId="prop-1" amenities={[]} areaSqm={null} onOpenFull={onOpenFull} />);

    fireEvent.click(screen.getByTestId('safety-quick-full'));
    expect(onOpenFull).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('safety-quick-heat-no'));
    expect(screen.queryByTestId('safety-quick-full')).not.toBeInTheDocument();
  });

  it('savedWithBlockers_SaysWhatIsStillMissing', () => {
    mockHooks({
      data: checklist({
        saved: true,
        updatedAt: '2026-11-01T20:00:00Z',
        facts: { entrepreneurial: false, hasGasSupply: false, combustionAppliances: [], floorCount: 1, floorAreasSqm: null },
        blockers: [
          { code: 'safety_bdsr_declaration_missing', message: 'server text' },
          { code: 'safety_confirmation_missing', message: 'server text' },
        ],
      }),
    });
    render(<SafetyQuickSheet propertyId="prop-1" amenities={[]} areaSqm={null} />);

    const missing = screen.getByTestId('safety-quick-missing');
    expect(missing).toHaveTextContent('Da completare nella scheda');
    expect(missing).toHaveTextContent('BDSR');
    expect(screen.queryByTestId('safety-quick-prefill-floorCount')).not.toBeInTheDocument();
  });
});
