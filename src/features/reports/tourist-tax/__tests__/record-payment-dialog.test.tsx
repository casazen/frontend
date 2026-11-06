import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import type { TouristTaxComuneSummary } from '@/types';
import { RecordPaymentDialog } from '../record-payment-dialog';

// The host records what they paid to a comune. The amount goes to the server as text with a dot; what the server refuses next to a field
// stays on that field with everything typed, and a failure no field explains is told by the toast.
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const post = vi.mocked(axios.post);

const MILANO: TouristTaxComuneSummary = {
  comune: 'Milano',
  stays: 4,
  nights: 9,
  guests: 8,
  owed: 30,
  owedCents: 3000,
  staysWithoutAmount: 0,
  paid: 23,
  paidCents: 2300,
  balance: 7,
  balanceCents: 700,
  status: 'ToPay',
  remittances: [],
};

const SAVED = {
  id: 'r-1',
  comune: 'Milano',
  periodFrom: '2026-07-01',
  periodTo: '2026-09-30',
  amount: 1250,
  amountCents: 125000,
  paidOn: '2026-10-05',
  reference: 'RAV 0042',
  notes: null,
  hasReceipt: true,
};

/** Axios error as the HTTP client rejects it, with the problem body of the API. */
function httpError(status: number, data: object): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, { status, statusText: '', headers: {}, config, data });
}

function renderDialog() {
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RecordPaymentDialog comune={MILANO} period={{ from: '2026-07-01', to: '2026-09-30' }} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose };
}

const typeInto = (testId: string, value: string) => fireEvent.change(screen.getByTestId(testId), { target: { value } });

describe('RecordPaymentDialog (NF-100)', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('Open_Row_StartsFromTheComuneTheDaysOfTheSummaryAndWhatIsLeftToPay', () => {
    renderDialog();

    expect(screen.getByDisplayValue('Milano')).toHaveAttribute('readonly');
    expect(screen.getByTestId('record-payment-from')).toHaveValue('2026-07-01');
    expect(screen.getByTestId('record-payment-to')).toHaveValue('2026-09-30');
    expect(screen.getByTestId('record-payment-balance')).toHaveTextContent(/Saldo da versare nel periodo: 7,00\s*€/);
  });

  it('Submit_AmountTypedTheItalianWay_GoesAsTextWithADotAndTheDialogCloses', async () => {
    post.mockResolvedValueOnce({ data: SAVED });
    const { onClose } = renderDialog();

    typeInto('record-payment-amount', '1.250,00');
    // The dialog says how it read the amount before it is recorded.
    expect(await screen.findByText(/Lo leggo come 1\.?250,00\s*€/)).toBeInTheDocument();
    typeInto('record-payment-reference', ' RAV 0042 ');
    fireEvent.change(screen.getByTestId('record-payment-receipt'), {
      target: { files: [new File(['%PDF-1.4'], 'rav.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.click(screen.getByTestId('record-payment-submit'));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe('/tourist-tax/remittances');
    expect(config).toMatchObject({ headers: { 'Content-Type': 'multipart/form-data' } });
    const sent = Object.fromEntries((body as FormData).entries());
    expect(sent).toMatchObject({
      comune: 'Milano',
      periodFrom: '2026-07-01',
      periodTo: '2026-09-30',
      paidAmount: '1250.00',
      reference: 'RAV 0042',
    });
    expect((sent.receipt as File).name).toBe('rav.pdf');

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalledWith('Versamento registrato.');
  });

  it('Submit_AmountThatIsNotAPayment_IsRefusedNextToTheFieldAndNothingIsSent', async () => {
    const { onClose } = renderDialog();

    typeInto('record-payment-amount', '0');
    fireEvent.click(screen.getByTestId('record-payment-submit'));

    expect(await screen.findByText('Scrivi un importo maggiore di zero con al massimo due decimali.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Submit_ServerNamesTheComune_ShowsTheReasonNextToTheFieldAndKeepsTheDialogOpen', async () => {
    post.mockRejectedValueOnce(httpError(422, { code: 'tourist_tax_comune_unknown' }));
    const { onClose } = renderDialog();

    typeInto('record-payment-amount', '125,50');
    fireEvent.click(screen.getByTestId('record-payment-submit'));

    expect(await screen.findByText('Questo comune non risulta tra quelli dei tuoi immobili in Italia.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    // Everything typed is still there.
    expect(screen.getByTestId('record-payment-amount')).toHaveValue('125,50');
  });

  it('Submit_CallerWhoReachesSomePropertiesOnly_IsToldByTheToastAndTheDialogStaysOpen', async () => {
    post.mockRejectedValueOnce(httpError(403, { code: 'tourist_tax_payments_need_whole_org' }));
    const { onClose } = renderDialog();

    typeInto('record-payment-amount', '125,50');
    fireEvent.click(screen.getByTestId('record-payment-submit'));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Il tuo accesso copre solo alcuni immobili: i versamenti riguardano tutta l'organizzazione e non puoi registrarli, aprirli o eliminarli.",
      ),
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
