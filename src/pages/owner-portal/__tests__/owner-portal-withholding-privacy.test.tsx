import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { OwnerWithholdingSection } from '@/features/owner-portal/withholding-section';
import { OWNER_PORTAL_KEY } from '@/queries/ownerPortal';

const client = vi.hoisted(() => ({ get: vi.fn() }));

// The call is the real one (`ownerPortalApi.getWithholding`, with the parser that keeps only the members of the page): only the transport is replaced.
vi.mock('@/api/client', () => ({ ApiClient: client }));
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

vi.setConfig({ testTimeout: 30_000 });

/**
 * The withholding of the owner in the portal (E18/F01/US02/T01, E18/F02/US01/T01, NF-117, ADR-011-R3): the owner sees what was withheld on its own payouts and the data of its own Certificazione Unica, and nothing that
 * belongs to the agency: not the recipient of the CU (name, fiscal code, address), not the stays it is made of, not the co-owners. The server already leaves them out; the page does not trust that, it keeps only the
 * members it draws, so that they never reach the screen, the cache of the queries or a log, whatever an answer carries.
 */

// What the server must never send and a faulty or newer one might: a recipient with its fiscal code and address, the stays of the record and the co-owners with their shares.
const FISCAL_CODE = 'BNCLCU80A01H501Z';
const ADDRESS = 'Via dei Platani 12, 22100 Como';
const COOWNER = 'Giulia Verdi';
const GUEST = 'Hans Gast';

function answer(year: number, overrides: Record<string, unknown> = {}) {
  return {
    year,
    currency: 'EUR',
    totalWithheld: 210,
    details: [
      { agencyId: 'ag-1', agencyName: 'Agenzia del Lago', propertyId: 'p-1', propertyName: 'Casa Lago', month: 10, grossBase: 1000, amountWithheld: 210, guestName: GUEST, bookingCode: 'BK-1' },
    ],
    cuStatements: [
      {
        agencyId: 'ag-1',
        agencyName: 'Agenzia del Lago',
        year,
        state: 'Reviewed',
        generatedAt: '2026-11-02T09:00:00Z',
        grossBase: 1000,
        withheld: 210,
        taxCode: '1919',
        attribution: 'signatory',
        recipient: { name: 'Luca Bianchi', fiscalCode: FISCAL_CODE, address: ADDRESS },
        stays: [{ bookingId: 'b-1', checkIn: '2026-10-10', checkOut: '2026-10-14', guest: GUEST }],
        shares: [{ ownerId: 'o-2', name: COOWNER, percent: 50, withheld: 105 }],
      },
    ],
    ...overrides,
  };
}

function refusal(status: number, code: string): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('refused', 'ERR_BAD_REQUEST', config, null, { status, statusText: '', headers: {}, config, data: { status, code } });
}

function renderSection(taxReportingExports: boolean) {
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    createElement(
      FeatureFlagsContext.Provider,
      { value: { flags: { ...DEFAULT_FEATURE_FLAGS, taxReportingExports }, isLoading: false } },
      createElement(QueryClientProvider, { client: queries }, createElement(MemoryRouter, null, createElement(OwnerWithholdingSection))),
    ),
  );
  return { ...view, queries };
}

beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('it');
  client.get.mockImplementation(async (_url: string, params?: { year?: number }) => answer(params?.year ?? 2026));
});

afterEach(() => cleanup());

describe('the withholding of the owner in the portal never shows what belongs to the agency (privacy)', () => {
  it('OwnerPortalWithholding_Privacy_TheOwnerSeesItsOwnFigures_AndNothingOfTheRecipientTheStaysOrTheCoOwners', async () => {
    const { container, queries } = renderSection(true);

    expect(await screen.findByTestId('owner-withholding-total')).toHaveTextContent('210,00');
    const detail = screen.getByTestId('owner-withholding-detail');
    expect(detail).toHaveTextContent('Casa Lago');
    expect(detail).toHaveTextContent('1000,00');
    const cu = screen.getByTestId('owner-cu');
    expect(within(cu).getByTestId('owner-cu-base')).toHaveTextContent('1000,00');
    expect(within(cu).getByTestId('owner-cu-withheld')).toHaveTextContent('210,00');
    expect(cu).toHaveTextContent('1919');
    // The record of a signatory says that it holds the part of other owners, never whose.
    expect(cu).toHaveTextContent(i18n.t('ownerPortal.withholding.cu.attribution.signatory'));

    // Nothing of the recipient, the stays, the co-owners or a guest is on the screen...
    const text = container.textContent ?? '';
    for (const secret of [FISCAL_CODE, ADDRESS, COOWNER, GUEST, 'Luca Bianchi', 'BK-1', '2026-10-10']) expect(text).not.toContain(secret);
    // ...and none of it reached the cache of the queries either: the page keeps only the members it draws.
    const cached = JSON.stringify(queries.getQueryCache().getAll().map((query) => query.state.data));
    for (const secret of [FISCAL_CODE, ADDRESS, COOWNER, GUEST, 'recipient', 'shares', 'stays']) expect(cached).not.toContain(secret);
  });

  it('OwnerPortalWithholding_Privacy_TheStateIsWhatTheAgencyRecorded_NeverASubmissionOrAnAcceptanceTheOwnerCannotSee', async () => {
    client.get.mockResolvedValue(
      answer(2026, {
        cuStatements: ['Reviewed', 'Submitted', 'Accepted', 'Rejected'].map((state, index) => ({
          agencyId: `ag-${index}`,
          agencyName: 'Agenzia',
          year: 2026,
          state,
          generatedAt: '2026-11-02T09:00:00Z',
          grossBase: 100,
          withheld: 21,
          taxCode: '1919',
          attribution: 'owner',
        })),
      }),
    );
    renderSection(true);

    const cards = await screen.findAllByTestId('owner-cu');
    expect(cards.map((card) => card.getAttribute('data-state'))).toEqual(['Reviewed', 'Submitted', 'Accepted', 'Rejected']);
    // The portal has no proof of a filing: it tells what the agency recorded, and never that something reached the Revenue Agency or was accepted by it.
    const words = cards.map((card) => card.textContent ?? '').join(' ');
    expect(words).toContain(i18n.t('ownerPortal.withholding.cu.state.submitted'));
    expect(words).toContain(i18n.t('ownerPortal.withholding.cu.state.accepted'));
    expect(words).not.toMatch(/inviata all|trasmessa all|accettata dall/i);
  });

  it('OwnerPortalWithholding_Privacy_AContactWithoutThePermissionSeesTheRefusalAndNoFigure', async () => {
    client.get.mockRejectedValue(refusal(403, 'owner_portal_permission_missing'));
    renderSection(true);

    const notice = await screen.findByTestId('owner-withholding-error');
    expect(notice).toHaveAttribute('data-state', 'permission');
    expect(screen.queryByTestId('owner-withholding-total')).toBeNull();
    expect(screen.queryByTestId('owner-cu')).toBeNull();
    // A refusal is not «no withholding»: the page does not say the year is empty.
    expect(screen.queryByTestId('owner-withholding-empty')).toBeNull();
  });

  it('OwnerPortalWithholding_Privacy_WithTheFlagOffNothingIsAskedAndNothingIsDrawn', () => {
    const { container, queries } = renderSection(false);

    expect(container.textContent).toBe('');
    expect(client.get).not.toHaveBeenCalled();
    // The query exists, disabled, and has never run: nothing of it is held.
    for (const query of queries.getQueryCache().findAll({ queryKey: [OWNER_PORTAL_KEY, 'withholding'] })) {
      expect(query.state.fetchStatus).toBe('idle');
      expect(query.state.data).toBeUndefined();
    }
  });

  it('OwnerPortalWithholding_Privacy_AnAnswerThatIsNotTheOneOfTheEndpointIsAnErrorNeverAnEmptyYear', async () => {
    client.get.mockResolvedValue('<!doctype html><html></html>');
    renderSection(true);

    expect(await screen.findByTestId('owner-withholding-error')).toBeInTheDocument();
    expect(screen.queryByTestId('owner-withholding-empty')).toBeNull();
    expect(screen.queryByTestId('owner-withholding-total')).toBeNull();
  });
});
