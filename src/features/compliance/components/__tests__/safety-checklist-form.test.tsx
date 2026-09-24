import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import * as compliance from '@/features/compliance/use-compliance';
import * as properties from '@/queries/use-properties';
import {
  SAFETY_ITEM_CODES,
  type SafetyChecklist,
  type SafetyChecklistItem,
  type SafetyItemCode,
} from '@/types/compliance.types';
import { minimumExtinguishers } from '@/lib/safety-checklist';
import { SafetyChecklistForm } from '../safety-checklist-form';

vi.mock('@/features/compliance/use-compliance', () => ({
  useSafetyChecklist: vi.fn(),
  useSaveSafetyChecklist: vi.fn(),
}));
vi.mock('@/queries/use-properties', () => ({ useUploadPropertyDocument: vi.fn() }));

// The form reads only these fields: partial objects are cast to the full hook results.
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
    blockers: [{ code: 'safety_extinguishers_missing', message: 'server text' }],
    warnings: [],
    confirmedAt: null,
    confirmedTextVersion: null,
    updatedAt: null,
    ...patch,
  };
}

const saveChecklist = vi.fn();
const uploadDocument = vi.fn();
const refetch = vi.fn();

function mockChecklist(data: SafetyChecklist | undefined, state: { isLoading?: boolean; isError?: boolean } = {}) {
  vi.mocked(compliance.useSafetyChecklist).mockReturnValue({
    data,
    isLoading: state.isLoading ?? false,
    isError: state.isError ?? false,
    refetch,
  } as unknown as Hook<typeof compliance.useSafetyChecklist>);
}

const group = (name: RegExp | string) => screen.getByRole('group', { name });
const itemCard = (code: SafetyItemCode) => screen.getByTestId(`safety-item-${code}`);

function answer(code: SafetyItemCode, value: 'Sì' | 'No') {
  fireEvent.click(within(itemCard(code)).getByRole('radio', { name: value }));
}

describe('SafetyChecklistForm', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    saveChecklist.mockImplementation(async () => checklist({ isComplete: true, blockers: [] }));
    vi.mocked(compliance.useSaveSafetyChecklist).mockReturnValue({
      mutateAsync: saveChecklist,
      isPending: false,
    } as unknown as Hook<typeof compliance.useSaveSafetyChecklist>);
    vi.mocked(properties.useUploadPropertyDocument).mockReturnValue({
      mutateAsync: uploadDocument,
      isPending: false,
    } as unknown as Hook<typeof properties.useUploadPropertyDocument>);
    mockChecklist(checklist());
  });

  it('allElectricHome_NoGasNoCombustion_GasAndCoNotApplicableAndSavedWithoutAnswers', async () => {
    const onSaved = vi.fn();
    render(<SafetyChecklistForm propertyId="prop-1" onSaved={onSaved} />);

    fireEvent.click(within(group(/forma imprenditoriale/)).getByRole('radio', { name: 'No' }));
    fireEvent.click(within(group(/impianto o una fornitura di gas/)).getByRole('radio', { name: 'No' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Nessun apparecchio a combustione' }));

    expect(screen.getByTestId('safety-detectors-exempt')).toHaveTextContent('Gli estintori restano obbligatori');
    expect(screen.getByTestId('safety-item-GasDetector-not-applicable')).toHaveTextContent(
      "l'unità non ha impianto a gas né apparecchi a combustione",
    );
    expect(screen.getByTestId('safety-item-CoDetector-not-applicable')).toBeInTheDocument();
    expect(screen.getByTestId('safety-item-SystemsCompliance-not-applicable')).toHaveTextContent(
      'non è gestita in forma imprenditoriale',
    );
    expect(within(itemCard('FireExtinguishers')).getByText('Obbligatorio')).toBeInTheDocument();
    expect(within(itemCard('SmokeDetector')).getByText('Consigliato, non obbligatorio per legge')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Numero di piani dell'unità"), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('m² di pavimento del piano 1 (facoltativo)'), { target: { value: '80' } });
    expect(screen.getByTestId('safety-minimum-extinguishers')).toHaveTextContent('Estintori minimi richiesti: 1');

    answer('FireExtinguishers', 'Sì');
    fireEvent.change(within(itemCard('FireExtinguishers')).getByLabelText('Numero di estintori'), { target: { value: '1' } });
    fireEvent.change(within(itemCard('FireExtinguishers')).getByLabelText("Data dell'ultimo controllo periodico"), {
      target: { value: '2026-09-01' },
    });
    answer('BdsrDeclaration', 'Sì');
    answer('SmokeDetector', 'No');
    fireEvent.click(screen.getByTestId('safety-confirm'));
    fireEvent.click(screen.getByTestId('safety-save'));

    await waitFor(() => expect(saveChecklist).toHaveBeenCalledTimes(1));
    const payload = saveChecklist.mock.calls[0][0];
    expect(payload.facts).toEqual({
      entrepreneurial: false,
      hasGasSupply: false,
      combustionAppliances: [],
      floorCount: 1,
      floorAreasSqm: [80],
    });
    expect(payload.confirm).toBe(true);
    const byCode = Object.fromEntries(payload.items.map((i: { code: string }) => [i.code, i]));
    expect(byCode.FireExtinguishers).toMatchObject({ answer: 'Present', quantity: 1, checkedOn: '2026-09-01' });
    expect(byCode.BdsrDeclaration).toMatchObject({ answer: 'Present' });
    expect(byCode.SmokeDetector).toMatchObject({ answer: 'Missing' });
    // "Not applicable" is never sent: it follows from the facts.
    expect(byCode.GasDetector.answer).toBeNull();
    expect(byCode.CoDetector.answer).toBeNull();
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ isComplete: true })));
  });

  it('fireplaceWithoutGas_DetectorsStayRequired', () => {
    render(<SafetyChecklistForm propertyId="prop-1" />);

    fireEvent.click(within(group(/impianto o una fornitura di gas/)).getByRole('radio', { name: 'No' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Camino' }));

    expect(screen.queryByTestId('safety-detectors-exempt')).not.toBeInTheDocument();
    expect(screen.getByText(/il rischio di monossido di carbonio non è escluso/)).toBeInTheDocument();
    expect(within(itemCard('GasDetector')).getByText('Obbligatorio')).toBeInTheDocument();
    expect(within(itemCard('CoDetector')).getByText('Obbligatorio')).toBeInTheDocument();
  });

  it('entrepreneurial_Yes_AsksForCompliantSystems', () => {
    render(<SafetyChecklistForm propertyId="prop-1" />);

    fireEvent.click(within(group(/forma imprenditoriale/)).getByRole('radio', { name: 'Sì' }));

    expect(screen.queryByTestId('safety-item-SystemsCompliance-not-applicable')).not.toBeInTheDocument();
    expect(within(itemCard('SystemsCompliance')).getByText('Obbligatorio')).toBeInTheDocument();
    expect(within(itemCard('SystemsCompliance')).getByText(/D\.M\. 37\/2008/)).toBeInTheDocument();
  });

  it('floors_WithAndWithoutAreas_ComputesMinimumExtinguishersAndWarns', () => {
    render(<SafetyChecklistForm propertyId="prop-1" />);

    fireEvent.change(screen.getByLabelText("Numero di piani dell'unità"), { target: { value: '2' } });
    expect(screen.getByTestId('safety-minimum-extinguishers')).toHaveTextContent('Estintori minimi richiesti: 2');
    expect(screen.getByTestId('safety-floor-areas-missing')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('m² di pavimento del piano 1 (facoltativo)'), { target: { value: '250' } });
    fireEvent.change(screen.getByLabelText('m² di pavimento del piano 2 (facoltativo)'), { target: { value: '50' } });

    expect(screen.getByTestId('safety-minimum-extinguishers')).toHaveTextContent('Estintori minimi richiesti: 3');
    expect(screen.queryByTestId('safety-floor-areas-missing')).not.toBeInTheDocument();
  });

  it('minimumExtinguishers_SameRuleAsBackend', () => {
    expect(minimumExtinguishers(1, [200])).toBe(1);
    expect(minimumExtinguishers(1, [201])).toBe(2);
    expect(minimumExtinguishers(2, [250, 50])).toBe(3);
    expect(minimumExtinguishers(2, [])).toBe(2);
    expect(minimumExtinguishers(null, [])).toBeNull();
  });

  it('importedChecklist_ShowsReviewAndTranslatedBlockersAndKeepsReviewWhenUnanswered', async () => {
    mockChecklist(
      checklist({
        saved: true,
        schemaVersion: 1,
        importedFromLegacy: true,
        updatedAt: '2026-09-24T10:00:00Z',
        items: SAFETY_ITEM_CODES.map((code) =>
          code === 'FireExtinguishers' ? item(code, { answer: 'ToReview', status: 'ToReview' }) : item(code),
        ),
        blockers: [
          { code: 'safety_extinguishers_review', message: 'server text' },
          { code: 'safety_future_code', message: 'Messaggio del server' },
        ],
      }),
    );
    render(<SafetyChecklistForm propertyId="prop-1" />);

    expect(screen.getByTestId('safety-imported')).toHaveTextContent('vecchia checklist');
    expect(within(itemCard('FireExtinguishers')).getByText('Da rivedere')).toBeInTheDocument();
    const blockers = screen.getByTestId('safety-blockers');
    expect(within(blockers).getByText(/Estintori: la risposta viene dalla vecchia checklist/)).toBeInTheDocument();
    expect(within(blockers).getByText('Messaggio del server')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('safety-save'));

    await waitFor(() => expect(saveChecklist).toHaveBeenCalled());
    const extinguishers = saveChecklist.mock.calls[0][0].items.find((i: { code: string }) => i.code === 'FireExtinguishers');
    expect(extinguishers.answer).toBeNull();
    expect(saveChecklist.mock.calls[0][0].confirm).toBe(false);
  });

  it('belowMinimumBlocker_ShowsDeclaredAndMinimum', () => {
    mockChecklist(
      checklist({
        minimumExtinguishers: 3,
        items: SAFETY_ITEM_CODES.map((code) =>
          code === 'FireExtinguishers' ? item(code, { answer: 'Present', status: 'Present', quantity: 1 }) : item(code),
        ),
        blockers: [{ code: 'safety_extinguishers_below_minimum', message: 'server text' }],
      }),
    );
    render(<SafetyChecklistForm propertyId="prop-1" />);

    expect(screen.getByTestId('safety-blockers')).toHaveTextContent(
      'Estintori insufficienti: ne hai indicati 1, ne servono almeno 3.',
    );
  });

  it('evidence_UploadedToThePrivateDocumentsAndSentWithTheItem', async () => {
    uploadDocument.mockResolvedValue({ id: 'doc-1', fileName: 'estintore.jpg' });
    render(<SafetyChecklistForm propertyId="prop-1" />);

    answer('FireExtinguishers', 'Sì');
    const file = new File(['x'], 'estintore.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('safety-item-FireExtinguishers-evidence-input'), { target: { files: [file] } });

    expect(await screen.findByTestId('safety-item-FireExtinguishers-evidence')).toHaveTextContent('estintore.jpg');
    expect(uploadDocument).toHaveBeenCalledWith({ propertyId: 'prop-1', file, documentType: 'SafetyCompliance' });

    fireEvent.click(screen.getByTestId('safety-save'));
    await waitFor(() => expect(saveChecklist).toHaveBeenCalled());
    const extinguishers = saveChecklist.mock.calls[0][0].items.find((i: { code: string }) => i.code === 'FireExtinguishers');
    expect(extinguishers.evidenceDocumentId).toBe('doc-1');
  });

  it('completeChecklist_ShowsNoBlocker', () => {
    mockChecklist(checklist({ isComplete: true, blockers: [], saved: true, updatedAt: '2026-09-24T10:00:00Z' }));
    render(<SafetyChecklistForm propertyId="prop-1" />);

    expect(screen.getByTestId('safety-complete')).toBeInTheDocument();
    expect(screen.queryByTestId('safety-blockers')).not.toBeInTheDocument();
  });

  it('loadingAndError_ShowStatesNotAnEmptyForm', () => {
    mockChecklist(undefined, { isLoading: true });
    const { rerender } = render(<SafetyChecklistForm propertyId="prop-1" />);
    expect(screen.getByTestId('safety-checklist-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('safety-checklist-form')).not.toBeInTheDocument();

    mockChecklist(undefined, { isError: true });
    rerender(<SafetyChecklistForm propertyId="prop-1" />);
    expect(screen.getByTestId('safety-checklist-error')).toHaveTextContent('Impossibile caricare la checklist di sicurezza.');
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(refetch).toHaveBeenCalled();
  });
});
