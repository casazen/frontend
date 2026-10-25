import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import type { CedolareAdvisory, LeaseDetail } from '@/types';
import { buildDetail, httpError } from '../../__tests__/lease-test-utils';
import { LeaseGuide } from '../lease-guide';

// LR-GUIDE-1: the guide shows at most three pieces of advice and the tools that fit the contract; a tool says in its row what its window
// says. The real client and queries run; the server is the mock of the HTTP client.
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const get = vi.mocked(axios.get);

const RULES = {
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

/** A far start keeps the lease in preparation on whatever day the suite runs. */
const FAR = { startDate: '2099-01-01T00:00:00Z', endDate: '2102-12-31T00:00:00Z', registrationDeadline: null } as const;

/** The comparison of the regimes with the income of the landlord known: the ordinary regime would cost 192 + 64 + 2.209,60 = 2.465,60 a year. */
const ADVISORY: CedolareAdvisory = {
  leaseRegime: 'CedolareSecca',
  contractType: 'Libero',
  taxRegime: 'CedolareSecca',
  annualRent: 9600,
  ata: 'NotListed',
  concordatoAtaReliefs: false,
  cedolare: { rate: 0.21, rateBasis: 'Standard', annualTaxEur: 2016, registroEur: 0, bolloEur: 0, source: 'Agenzia delle Entrate, test' },
  ordinary: {
    registro: { rate: 0.02, baseShare: 1, taxableBaseEur: 9600, computedEur: 192, firstYearMinimumEur: 67, minimumApplied: false, firstYearEur: 192, source: 'Agenzia delle Entrate, test' },
    bollo: { status: 'Computed', eurPerUnit: 16, pagesPerUnit: 4, linesPerUnit: 100, units: 2, copies: 2, amountEur: 64, linesConsidered: true, source: 'Agenzia delle Entrate, test' },
    irpef: { status: 'Computed', reasonCode: null, taxYear: 2026, rentFlatReduction: 0.05, taxableRentEur: 9120, additionalGrossIrpefEur: 2209.6, source: 'MEF, test' },
  },
  notes: [],
};

function mockServer(advisory?: CedolareAdvisory) {
  get.mockImplementation((url: string) => {
    if (url === '/long-rent/rules') return Promise.resolve({ data: RULES });
    if (url === '/leases/lease-1/rli/advisory' && advisory) return Promise.resolve({ data: advisory });
    return Promise.reject(httpError(404));
  });
}

function renderGuide(lease: LeaseDetail) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/long-rent/leases/lease-1']}>
        <LeaseGuide lease={lease} stage="Draft" stepCode={null} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LeaseGuide', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  afterEach(cleanup);

  it('render_ALiberoInPreparation_ShowsThreePiecesOfAdviceAndTheRestBehindTheButton', async () => {
    mockServer();

    renderGuide(buildDetail({ ...FAR, taxRegime: 'CedolareSecca' }));

    // The advice that quote the figures of the rules wait for them: the list is full once the rules are there.
    const toggle = await screen.findByTestId('lease-advice-toggle');
    const list = screen.getByTestId('lease-advice-list');
    expect(within(list).getAllByTestId('lease-advice')).toHaveLength(3);
    expect(toggle).toHaveTextContent('Mostra tutti i consigli (4)');
    // The figure comes from the rules of the server, not from the text: «Dopo la firma hai 30 giorni per registrare».
    expect(within(list).getByText('Dopo la firma hai 30 giorni per registrare')).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(within(screen.getByTestId('lease-advice-list')).getAllByTestId('lease-advice')).toHaveLength(4);
    expect(screen.getByTestId('lease-advice-toggle')).toHaveTextContent('Mostra meno consigli');

    fireEvent.click(screen.getByTestId('lease-advice-toggle'));
    expect(within(screen.getByTestId('lease-advice-list')).getAllByTestId('lease-advice')).toHaveLength(3);
  });

  it('render_TheToolsOfTheContract_TheRentOfTheAgreementIsForAConcordatoOnly', async () => {
    mockServer();

    const { unmount } = renderGuide(buildDetail({ ...FAR }));
    expect(await screen.findByTestId('guide-tool-regime')).toBeInTheDocument();
    expect(screen.queryByTestId('guide-tool-rent')).not.toBeInTheDocument();
    unmount();

    renderGuide(buildDetail({ ...FAR, contractType: 'Concordato', fiscalRegime: 'CanoneConcordato' }));
    expect(await screen.findByTestId('guide-tool-regime')).toBeInTheDocument();
    expect(screen.getByTestId('guide-tool-rent')).toBeInTheDocument();
    // No data of the house yet: the row says what is needed instead of a verdict.
    expect(screen.getByTestId('guide-tool-rent-summary')).toHaveTextContent(i18n.t('leaseGuide.tools.rent.noData'));
  });

  it('render_TheRegimeTool_TheRowAndTheWindowSayTheSameAndTheAdviceOpensIt', async () => {
    mockServer(ADVISORY);

    renderGuide(buildDetail({ ...FAR, taxRegime: 'CedolareSecca' }));

    // The row answers without being opened: 2.465,60 against 2.016,00, so the cedolare secca saves about 450 € in the first year.
    const sentence = i18n.t('leaseGuide.regime.outcome.cedolareCheaper', { amount: '450 €' }).replace(/\s+/g, ' ');
    const row = await screen.findByTestId('guide-tool-regime-summary');
    await vi.waitFor(() => expect(row.textContent?.replace(/\s+/g, ' ')).toContain(sentence));

    // The first advice asks the same question and opens the same window, with the same sentence on top.
    const advice = within(screen.getByTestId('lease-advice-list')).getAllByTestId('lease-advice')[0];
    expect(advice).toHaveAttribute('data-advice', 'regimeCheckCedolare');
    fireEvent.click(within(advice).getByTestId('lease-advice-action'));

    const dialog = await screen.findByTestId('guide-tool-dialog');
    expect(dialog).toHaveAttribute('data-tool', 'regime');
    const verdict = await within(dialog).findByTestId('advisory-verdict');
    expect(verdict).toHaveAttribute('data-outcome', 'cedolareCheaper');
    expect(verdict.textContent?.replace(/\s+/g, ' ')).toContain(sentence);
  });
});
