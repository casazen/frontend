import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { formatCurrency } from '@/lib/utils';
import { CedolareDecisionPanel } from '../cedolare-decision-panel';
import { httpError } from '../../__tests__/lease-test-utils';
import type { CedolareAdvisory } from '@/types';

// LT-08 (A7-09): the tax advisory panel shows the backend figures (ATA, 70% base, 67 € minimum, stamp duty rule) and
// asks for the data CasaZen does not hold instead of inventing them.
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const get = vi.mocked(axios.get);
const post = vi.mocked(axios.post);

const SOURCE = 'Agenzia delle Entrate, test';

/** Testing Library collapses the non-breaking space of the formatted amounts: compare the same way. */
function normalized(text: string): string {
  return text.replace(/\s+/g, ' ');
}

function eur(amount: number): string {
  return normalized(formatCurrency(amount));
}

function advisory(overrides: Partial<CedolareAdvisory> = {}): CedolareAdvisory {
  return {
    leaseRegime: 'CanoneConcordato',
    contractType: 'Concordato',
    taxRegime: 'CedolareSecca',
    annualRent: 9600,
    ata: 'Unverified',
    concordatoAtaReliefs: false,
    cedolare: {
      rate: 0.21,
      rateBasis: 'Standard',
      annualTaxEur: 2016,
      registroEur: 0,
      bolloEur: 0,
      source: SOURCE,
    },
    ordinary: {
      registro: {
        rate: 0.02,
        baseShare: 1,
        taxableBaseEur: 9600,
        computedEur: 192,
        firstYearMinimumEur: 67,
        minimumApplied: false,
        firstYearEur: 192,
        source: SOURCE,
      },
      bollo: {
        status: 'InputRequired',
        eurPerUnit: 16,
        pagesPerUnit: 4,
        linesPerUnit: 100,
        units: null,
        copies: null,
        amountEur: null,
        linesConsidered: false,
        source: SOURCE,
      },
      irpef: {
        status: 'InputRequired',
        reasonCode: null,
        taxYear: 2026,
        rentFlatReduction: 0.05,
        taxableRentEur: 9120,
        additionalGrossIrpefEur: null,
        source: 'MEF, test',
      },
    },
    notes: ['ata_unverified', 'emergency_comuni_not_checked', 'concordato_attestation_required'],
    ...overrides,
  };
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <CedolareDecisionPanel leaseId="lease-1" />
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

describe('CedolareDecisionPanel', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    get.mockReset();
    post.mockReset();
  });

  afterEach(cleanup);

  it('render_ConcordatoWithAtaNotVerified_ShowsStandardRateFullBaseAndTheAtaNote', async () => {
    get.mockResolvedValue({ data: advisory() });

    renderPanel();

    const cedolare = await screen.findByTestId('advisory-cedolare');
    expect(within(cedolare).getByText('21%')).toBeInTheDocument();
    expect(within(cedolare).getByText(eur(2016))).toBeInTheDocument();
    expect(within(cedolare).getByText(i18n.t('leases.rli.advisory.cedolare.noRegistroBollo'))).toBeInTheDocument();
    expect(within(cedolare).getByText(i18n.t('leases.rli.advisory.chosen'))).toBeInTheDocument();
    expect(screen.getByTestId('advisory-ata')).toHaveTextContent(i18n.t('leases.rli.advisory.ata.Unverified'));
    const registro = screen.getByTestId('advisory-registro');
    expect(within(registro).getByText(eur(192))).toBeInTheDocument();
    expect(screen.getByTestId('advisory-notes')).toHaveTextContent(i18n.t('leases.rli.advisory.note.ata_unverified'));
    expect(get).toHaveBeenCalledWith('/leases/lease-1/rli/advisory', expect.anything());
  });

  it('render_VerifiedAtaWithMinimum_ShowsSeventyPercentBaseAndTheMinimum', async () => {
    const data = advisory({ ata: 'Verified', concordatoAtaReliefs: true, notes: [] });
    data.cedolare = { ...data.cedolare, rate: 0.1, rateBasis: 'ConcordatoAta', annualTaxEur: 360 };
    data.ordinary.registro = {
      ...data.ordinary.registro,
      baseShare: 0.7,
      taxableBaseEur: 2520,
      computedEur: 50.4,
      minimumApplied: true,
      firstYearEur: 67,
    };
    get.mockResolvedValue({ data });

    renderPanel();

    const registro = await screen.findByTestId('advisory-registro');
    expect(within(registro).getByText(eur(67))).toBeInTheDocument();
    expect(registro).toHaveTextContent('70%');
    expect(registro).toHaveTextContent(
      normalized(
        i18n.t('leases.rli.advisory.ordinary.registroMinimum', {
          minimum: formatCurrency(67),
          computed: formatCurrency(50.4),
        }),
      ),
    );
    expect(within(screen.getByTestId('advisory-cedolare')).getByText('10%')).toBeInTheDocument();
  });

  it('render_WithoutPagesAndIncome_ShowsTheRulesAndNoInventedAmounts', async () => {
    get.mockResolvedValue({ data: advisory() });

    renderPanel();

    const bollo = await screen.findByTestId('advisory-bollo');
    expect(bollo).toHaveTextContent(i18n.t('leases.rli.advisory.ordinary.bolloInputRequired'));
    expect(within(bollo).queryByText(eur(16))).not.toBeInTheDocument();
    const irpef = screen.getByTestId('advisory-irpef');
    expect(irpef).toHaveTextContent(i18n.t('leases.rli.advisory.ordinary.irpefToAssess'));
    expect(irpef).toHaveTextContent(i18n.t('leases.rli.advisory.ordinary.irpefInputHint'));
  });

  it('submit_WithPagesCopiesAndIncome_PostsThemAndShowsTheComputedFigures', async () => {
    get.mockResolvedValue({ data: advisory() });
    const computed = advisory();
    computed.ordinary.bollo = { ...computed.ordinary.bollo, status: 'Computed', units: 2, copies: 2, amountEur: 64 };
    computed.ordinary.irpef = { ...computed.ordinary.irpef, status: 'Computed', additionalGrossIrpefEur: 2209.6 };
    post.mockResolvedValue({ data: computed });

    renderPanel();
    await screen.findByTestId('advisory-bollo');
    fireEvent.change(screen.getByLabelText(i18n.t('leases.rli.advisory.inputs.writtenPages')), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText(i18n.t('leases.rli.advisory.inputs.copies')), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(i18n.t('leases.rli.advisory.inputs.otherIncome')), { target: { value: '20000' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('leases.rli.advisory.inputs.submit') }));

    await waitFor(() => expect(within(screen.getByTestId('advisory-bollo')).getByText(eur(64))).toBeInTheDocument());
    expect(post).toHaveBeenCalledWith(
      '/leases/lease-1/rli/advisory',
      { writtenPages: 6, lines: undefined, copies: 2, otherTaxableIncomeEur: 20000 },
      undefined,
    );
    expect(screen.getByTestId('advisory-bollo')).toHaveTextContent(
      i18n.t('leases.rli.advisory.ordinary.bolloPagesOnly', { lines: 100, pages: 4 }),
    );
    expect(within(screen.getByTestId('advisory-irpef')).getByText(eur(2209.6))).toBeInTheDocument();
  });

  it('submit_IncomeWithItalianThousandsSeparator_SendsTheWholeAmount', async () => {
    get.mockResolvedValue({ data: advisory() });
    post.mockResolvedValue({ data: advisory() });

    renderPanel();
    await screen.findByTestId('advisory-bollo');
    fireEvent.change(screen.getByLabelText(i18n.t('leases.rli.advisory.inputs.otherIncome')), { target: { value: '20.000,50' } });
    fireEvent.change(screen.getByLabelText(i18n.t('leases.rli.advisory.inputs.lines')), { target: { value: '1.500' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('leases.rli.advisory.inputs.submit') }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith(
      '/leases/lease-1/rli/advisory',
      { writtenPages: undefined, lines: 1500, copies: undefined, otherTaxableIncomeEur: 20000.5 },
      undefined,
    );
  });

  it('submit_WithPagesButNoCopies_ShowsTheValidationErrorWithoutCallingTheApi', async () => {
    get.mockResolvedValue({ data: advisory() });

    renderPanel();
    await screen.findByTestId('advisory-bollo');
    fireEvent.change(screen.getByLabelText(i18n.t('leases.rli.advisory.inputs.writtenPages')), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('leases.rli.advisory.inputs.submit') }));

    expect(await screen.findByText(i18n.t('leases.rli.advisory.inputs.invalid'))).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('render_IrpefNotComputed_ShowsToAssessWithTheReason', async () => {
    const data = advisory();
    data.ordinary.irpef = { ...data.ordinary.irpef, status: 'NotComputed', reasonCode: 'brackets_outdated' };
    get.mockResolvedValue({ data });

    renderPanel();

    const irpef = await screen.findByTestId('advisory-irpef');
    expect(irpef).toHaveTextContent(i18n.t('leases.rli.advisory.ordinary.irpefToAssess'));
    expect(irpef).toHaveTextContent(i18n.t('leases.rli.advisory.ordinary.irpefReason.brackets_outdated', { year: 2026 }));
  });

  it('render_ApiError_ShowsTheErrorNotAnEmptyPanel', async () => {
    get.mockRejectedValue(httpError(500));

    renderPanel();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByTestId('advisory-cedolare')).not.toBeInTheDocument();
  });

  it('render_EnglishUi_TranslatesNotesAndLabels', async () => {
    await i18n.changeLanguage('en');
    get.mockResolvedValue({ data: advisory({ notes: ['questura_not_replaced', 'unknown_future_code'] }) });

    renderPanel();

    const notes = await screen.findByTestId('advisory-notes');
    expect(notes).toHaveTextContent('48 hours');
    expect(notes).not.toHaveTextContent('unknown_future_code');
    expect(screen.getByText('Ordinary regime')).toBeInTheDocument();
  });
});
