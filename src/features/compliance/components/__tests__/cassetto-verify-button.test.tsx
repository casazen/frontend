import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { complianceHandoffApi } from '@/api/compliance-handoff.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import i18n from '@/i18n/config';
import type { CassettoHandoff } from '@/types';
import { sameTabNavigation } from '../../lib/cassetto';
import { CassettoVerifyButton } from '../cassetto-verify-button';

vi.mock('@/api/compliance-handoff.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/compliance-handoff.api')>()),
  complianceHandoffApi: { start: vi.fn() },
}));
const workspace = vi.hoisted(() => ({ permissions: ['booking.read'] as string[] }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (context: string, permission: string) => context === 'short-rent' && workspace.permissions.includes(permission) }),
}));

const PROPERTY_ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';
const DESTINATION = 'https://panel.example.com/compliance';

const handoff = (change: Partial<CassettoHandoff> = {}): CassettoHandoff => ({
  handoffId: 'h1',
  startedAt: '2026-11-13T10:00:00Z',
  expiresAt: '2026-11-13T10:30:00Z',
  topic: 'Istat',
  destinationUrl: DESTINATION,
  destinationKind: 'Home',
  returnPath: '/app/short-rent/alloggiati/reports?tab=proofs',
  context: { propertyId: PROPERTY_ID, propertyName: 'Casa Como', octorateListingName: 'Casa Como (struttura 12)', bookingId: null, bookingCode: null, period: '2026-08' },
  guide: { code: 'istat_period', menuPath: 'Impostazioni > Polizia e ISTAT', check: "Controlla che l'invio di agosto sia partito." },
  ...change,
});

function problem(status: number, code?: string): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data: code ? { code } : {}, statusText: '', headers: {}, config });
}

function renderButton(connector = true, props: Partial<React.ComponentProps<typeof CassettoVerifyButton>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        FeatureFlagsContext.Provider,
        { value: { flags: { ...DEFAULT_FEATURE_FLAGS, octorateConnector: connector }, isLoading: false } },
        createElement(
          MemoryRouter,
          { initialEntries: ['/app/short-rent/alloggiati/reports?tab=proofs&kind=IstatProof'] },
          createElement(CassettoVerifyButton, { topic: 'Istat', propertyId: PROPERTY_ID, period: '2026-08', ...props }),
        ),
      ),
    ),
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  workspace.permissions = ['booking.read'];
  await i18n.changeLanguage('it');
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe('CassettoVerifyButton (CHK-15, E03/F05/US02)', () => {
  it('CassettoVerifyButton_ConnectorOff_ShowsNoButtonThatCanOnlyFail', () => {
    renderButton(false);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(complianceHandoffApi.start).not.toHaveBeenCalled();
  });

  it('CassettoVerifyButton_WithoutBookingRead_ShowsNoButton', () => {
    workspace.permissions = ['property.read'];
    renderButton(true);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('CassettoVerifyButton_Click_AsksTheServerWithPropertyPeriodAndTheRouteTheHostComesFromAndNeverAnAddress', async () => {
    vi.mocked(complianceHandoffApi.start).mockResolvedValue(handoff());
    renderButton(true);

    fireEvent.click(screen.getByRole('button', { name: 'Verifica nel tuo Cassetto Compliance' }));

    await screen.findByTestId('cassetto-dialog');
    const request = vi.mocked(complianceHandoffApi.start).mock.calls[0][0];
    expect(request).toEqual({ topic: 'Istat', propertyId: PROPERTY_ID, period: '2026-08', returnPath: '/app/short-rent/alloggiati/reports?tab=proofs&kind=IstatProof' });
    // CasaZen alone decides where the host goes: nothing of the kind is sent.
    expect(JSON.stringify(request)).not.toMatch(/url|redirect|http/i);
  });

  it('CassettoVerifyButton_ABookingCheck_SendsTheStayAndNoPeriod', async () => {
    vi.mocked(complianceHandoffApi.start).mockResolvedValue(handoff({ topic: 'Alloggiati', context: { ...handoff().context, period: null, bookingId: 'b1', bookingCode: 'AB123-CD456' } }));
    renderButton(true, { topic: 'Alloggiati', period: null, bookingId: 'b1' });

    fireEvent.click(screen.getByTestId('cassetto-verify'));

    const dialog = await screen.findByTestId('cassetto-dialog');
    expect(vi.mocked(complianceHandoffApi.start).mock.calls[0][0]).toMatchObject({ topic: 'Alloggiati', bookingId: 'b1' });
    expect(vi.mocked(complianceHandoffApi.start).mock.calls[0][0]).not.toHaveProperty('period');
    expect(dialog).toHaveTextContent('AB123-CD456');
  });

  it('CassettoVerifyButton_Dialog_SaysTargetPlaceAndWhatToCheckAndNamesTheSupplierOnlyInTheClosedDisclosure', async () => {
    vi.mocked(complianceHandoffApi.start).mockResolvedValue(handoff());
    renderButton(true);
    fireEvent.click(screen.getByTestId('cassetto-verify'));

    const dialog = await screen.findByTestId('cassetto-dialog');
    expect(within(dialog).getByRole('heading', { name: 'Cassetto Compliance' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Casa Como');
    expect(dialog).toHaveTextContent('agosto 2026');
    expect(dialog).toHaveTextContent('Impostazioni > Polizia e ISTAT');
    expect(dialog).toHaveTextContent("Controlla che l'invio di agosto sia partito.");
    // `Dati consultati su Octorate` is the secondary disclosure; the primary copy speaks as CasaZen.
    const disclosure = dialog.querySelector('details')!;
    expect(disclosure).toHaveTextContent('Dati consultati su Octorate');
    expect(disclosure).not.toHaveAttribute('open');
    const outside = dialog.cloneNode(true) as HTMLElement;
    outside.querySelector('details')!.remove();
    expect(outside.textContent).not.toMatch(/octorate/i);
  });

  it('CassettoVerifyButton_Dialog_AsksNobodyToSayItWentWellAndCreatesNoProof', async () => {
    vi.mocked(complianceHandoffApi.start).mockResolvedValue(handoff());
    renderButton(true);
    fireEvent.click(screen.getByTestId('cassetto-verify'));

    const dialog = await screen.findByTestId('cassetto-dialog');
    expect(dialog.textContent).not.toMatch(/è stato inviato|inviato\?|confermi|successo/i);
    expect(within(dialog).queryByRole('radio')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument();
    // Two buttons only: go on, or stay.
    expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual(expect.arrayContaining(['Continua la verifica', 'Annulla']));
  });

  it('CassettoVerifyButton_Continue_LeavesInTheSameTabAndOpensNoWindowOrFrame', async () => {
    const to = vi.spyOn(sameTabNavigation, 'to').mockImplementation(() => undefined);
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.mocked(complianceHandoffApi.start).mockResolvedValue(handoff());
    const { container } = renderButton(true);
    fireEvent.click(screen.getByTestId('cassetto-verify'));

    fireEvent.click(await screen.findByTestId('cassetto-continue'));

    expect(to).toHaveBeenCalledExactlyOnceWith(DESTINATION);
    expect(open).not.toHaveBeenCalled();
    expect(document.querySelector('iframe')).toBeNull();
    expect(container.querySelector('a[target="_blank"]')).toBeNull();
  });

  it('CassettoVerifyButton_Cancel_StaysInCasaZenAndGoesNowhere', async () => {
    const to = vi.spyOn(sameTabNavigation, 'to').mockImplementation(() => undefined);
    vi.mocked(complianceHandoffApi.start).mockResolvedValue(handoff());
    renderButton(true);
    fireEvent.click(screen.getByTestId('cassetto-verify'));

    fireEvent.click(await screen.findByTestId('cassetto-cancel'));

    await waitFor(() => expect(screen.queryByTestId('cassetto-dialog')).not.toBeInTheDocument());
    expect(to).not.toHaveBeenCalled();
  });

  it.each([
    ['http://panel.example.com/x'],
    ['javascript:alert(1)'],
    ['https://user:secret@panel.example.com/x'],
    ['not an address'],
  ])('CassettoVerifyButton_DestinationThatIsNotPlainHttps_%s_IsRefusedAndTheHostStaysInCasaZen', async (destinationUrl) => {
    const to = vi.spyOn(sameTabNavigation, 'to').mockImplementation(() => undefined);
    vi.mocked(complianceHandoffApi.start).mockResolvedValue(handoff({ destinationUrl }));
    renderButton(true);

    fireEvent.click(screen.getByTestId('cassetto-verify'));

    const error = await screen.findByTestId('cassetto-verify-error');
    expect(error).toHaveTextContent('Verifica non aperta');
    expect(screen.queryByTestId('cassetto-dialog')).not.toBeInTheDocument();
    expect(to).not.toHaveBeenCalled();
  });

  it.each([
    [404, 'octorate_handoff_target_not_found', 'Non troviamo questo immobile o questo soggiorno.'],
    [409, 'octorate_handoff_property_not_mapped', 'Questo immobile non è collegato al tuo channel manager.'],
    [409, 'octorate_handoff_destination_unavailable', 'Al momento non riusciamo a indicarti dove andare.'],
    [404, undefined, 'La verifica nel Cassetto Compliance non è disponibile in questo momento.'],
    [500, undefined, 'Non riusciamo ad aprire la verifica.'],
  ])('CassettoVerifyButton_Refusal%i%s_IsToldInWordsWithTheWayToDoItByHandAndARetry', async (status, code, words) => {
    vi.mocked(complianceHandoffApi.start).mockRejectedValueOnce(problem(status, code));
    renderButton(true);

    fireEvent.click(screen.getByTestId('cassetto-verify'));

    const error = await screen.findByTestId('cassetto-verify-error');
    expect(error).toHaveTextContent(words);
    // The guide to do it by hand is there, and the same button tries again.
    expect(error).toHaveTextContent('Intanto puoi aprire tu');
    expect(screen.queryByTestId('cassetto-dialog')).not.toBeInTheDocument();

    vi.mocked(complianceHandoffApi.start).mockResolvedValueOnce(handoff());
    fireEvent.click(screen.getByTestId('cassetto-verify'));
    await screen.findByTestId('cassetto-dialog');
    expect(screen.queryByTestId('cassetto-verify-error')).not.toBeInTheDocument();
  });

  it('CassettoVerifyButton_WhileTheCallIsUnderWay_WaitsAndIgnoresAnotherClick', async () => {
    let answer: (value: CassettoHandoff) => void = () => undefined;
    vi.mocked(complianceHandoffApi.start).mockReturnValue(new Promise<CassettoHandoff>((resolve) => (answer = resolve)));
    renderButton(true);

    const button = screen.getByTestId('cassetto-verify');
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute('aria-busy', 'true'));
    fireEvent.click(button);

    expect(complianceHandoffApi.start).toHaveBeenCalledTimes(1);
    answer(handoff());
    await screen.findByTestId('cassetto-dialog');
  });
});
