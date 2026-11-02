import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { toastUndo } from '@/lib/toast-undo';
import type { BankImportInstallment, BankImportPreview, BankImportSuggestion } from '@/types';
import { httpError } from '../../__tests__/lease-test-utils';
import { MAX_STATEMENT_BYTES } from '../../lib/bank-import';
import { BankStatementImportDialog } from '../bank-statement-import-dialog';

// The landlord gives the file of their bank and the server proposes which rents it pays; nothing is recorded until they confirm, and the
// confirmation waits for its six seconds (the toast is mocked: its `commit` is what runs when they pass, its `undo` is «Annulla»).
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/lib/toast-undo', () => ({ toastUndo: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const post = vi.mocked(axios.post);

function installment(id: string, tenantName: string | null, overrides: Partial<BankImportInstallment> = {}): BankImportInstallment {
  return {
    id,
    leaseId: `lease-${id}`,
    propertyId: 'property-1',
    propertyName: 'Casa Trastevere',
    tenantName,
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
    dueDate: '2026-10-05',
    amount: 900,
    currency: 'EUR',
    ...overrides,
  };
}

function suggestion(
  fingerprint: string,
  confidence: BankImportSuggestion['confidence'],
  best: BankImportInstallment,
  overrides: Partial<BankImportSuggestion> = {},
): BankImportSuggestion {
  return {
    fingerprint,
    date: '2026-10-03',
    amount: best.amount,
    currency: 'EUR',
    description: 'BONIFICO DA VERDI GIULIA CANONE OTTOBRE 2026',
    payer: 'Giulia Verdi',
    confidence,
    reasons: ['Amount', 'Surname', 'Month'],
    installment: best,
    alternatives: [],
    ...overrides,
  };
}

const verdi = installment('rent-verdi', 'Giulia Verdi');
const rossi = installment('rent-rossi', 'Mario Rossi', { propertyName: 'Trilocale Murat', amount: 750 });
const bianchi = installment('rent-bianchi', 'Anna Bianchi', { propertyName: 'Studio Duomo' });

function preview(overrides: Partial<BankImportPreview> = {}): BankImportPreview {
  return {
    format: 'Csv',
    summary: { movements: 5, credits: 4, alreadyImported: 1, suggested: 3, confident: 2, unmatched: 1 },
    suggestions: [
      suggestion('fp-verdi', 'High', verdi),
      suggestion('fp-rossi', 'High', rossi, { description: 'BONIFICO DA ROSSI MARIO AFFITTO', payer: 'Mario Rossi', date: '2026-10-04' }),
      suggestion('fp-maybe', 'Low', bianchi, {
        description: 'BONIFICO 900 EURO',
        payer: null,
        reasons: ['Amount'],
        alternatives: [installment('rent-other', 'Luca Neri', { propertyName: 'Mansarda Brera' })],
      }),
    ],
    unmatched: [{ fingerprint: 'fp-salary', date: '2026-10-06', amount: 2100, currency: 'EUR', description: 'STIPENDIO OTTOBRE', payer: null }],
    ...overrides,
  };
}

function file(name = 'estratto.csv', content = 'Data;Descrizione;Importo\n03/10/2026;Canone;900,00\n') {
  return new File([content], name, { type: 'text/csv' });
}

function renderDialog() {
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <BankStatementImportDialog onClose={onClose} />
      </I18nextProvider>
    </QueryClientProvider>,
  );
  return { onClose };
}

/** Gives the dialog a file, as a click on «Scegli il file» followed by the choice in the picker would. */
function choose(chosen: File) {
  fireEvent.change(screen.getByTestId('bank-import-dropzone-input'), { target: { files: [chosen] } });
}

/** What the confirmation sent: the form fields as plain values. */
function sentForm(call: number): Record<string, FormDataEntryValue> {
  const body = post.mock.calls[call][1] as FormData;
  return Object.fromEntries(body.entries());
}

describe('BankStatementImportDialog', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    // A recording a test left waiting (its six seconds are never waited for) is let go, so the next test does not find the way in held.
    act(() => {
      for (const [, options] of vi.mocked(toastUndo).mock.calls) options.undo();
    });
    vi.clearAllMocks();
    cleanup();
  });

  it('chooseAFile_TheServerReadsItOnceAsMultipart_AndNothingIsConfirmedYet', async () => {
    post.mockResolvedValue({ data: preview() });
    renderDialog();

    expect(screen.getByText(/non registro niente finché non confermi/)).toBeInTheDocument();
    expect(screen.getByText(/Il file viene letto e non viene salvato/)).toBeInTheDocument();
    choose(file('estratto-ottobre.csv'));

    expect(await screen.findByTestId('bank-import-review')).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/long-rent/rents/bank-import/preview', expect.any(FormData), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const sent = sentForm(0);
    expect((sent.file as File).name).toBe('estratto-ottobre.csv');
    expect(sent.mapping).toBeUndefined();
    expect(sent.selections).toBeUndefined();
    expect(toastUndo).not.toHaveBeenCalled();
  });

  it('review_TheSureOnesAreTicked_AndOneButtonConfirmsThem', async () => {
    post.mockResolvedValue({ data: preview() });
    renderDialog();
    choose(file());

    const sure = within(await screen.findByTestId('bank-import-sure'));
    expect(sure.getByRole('heading', { name: 'Pronti da confermare (2)' })).toBeInTheDocument();
    expect(sure.getByText(/Giulia Verdi · Casa Trastevere/)).toBeInTheDocument();
    expect(sure.getByText(/Mario Rossi · Trilocale Murat/)).toBeInTheDocument();
    expect(sure.getAllByText(/Canone di ottobre 2026 · scadenza 5 ott/)).toHaveLength(2);
    expect(sure.getAllByText(/corrisponde: importo uguale, cognome, mese del canone/)).toHaveLength(2);
    for (const box of sure.getAllByRole('checkbox')) expect(box).toBeChecked();

    expect(screen.getByText('Ho trovato 4 accrediti nel file.')).toBeInTheDocument();
    expect(screen.getByText('1 era già stato importato.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Conferma 2 incassi' })).toBeEnabled();
  });

  it('confirm_TheWindowClosesAndTheRecordingWaitsItsSixSeconds_StillNothingWritten', async () => {
    post.mockResolvedValue({ data: preview() });
    const { onClose } = renderDialog();
    choose(file());
    await screen.findByTestId('bank-import-review');
    post.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Conferma 2 incassi' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(toastUndo).toHaveBeenCalledTimes(1);
    expect(vi.mocked(toastUndo).mock.calls[0][0]).toBe('Registro 2 incassi dall\'estratto conto');
    expect(post).not.toHaveBeenCalled();

    // «Annulla»: it is dropped, nothing was ever written.
    vi.mocked(toastUndo).mock.calls[0][1].undo();
    expect(post).not.toHaveBeenCalled();
  });

  it('confirm_SixSecondsPass_SendsTheFileAgainWithTheChoices_AndTellsHowManyWereRecorded', async () => {
    post.mockResolvedValue({ data: preview() });
    renderDialog();
    choose(file('estratto.csv'));
    await screen.findByTestId('bank-import-review');
    post.mockReset();
    post.mockResolvedValue({
      data: {
        requested: 2,
        confirmed: [
          { fingerprint: 'fp-verdi', installmentId: 'rent-verdi' },
          { fingerprint: 'fp-rossi', installmentId: 'rent-rossi' },
        ],
        skipped: [],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Conferma 2 incassi' }));
    await vi.mocked(toastUndo).mock.calls[0][1].commit?.();

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/long-rent/rents/bank-import/confirm', expect.any(FormData), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const sent = sentForm(0);
    expect((sent.file as File).name).toBe('estratto.csv');
    expect(JSON.parse(sent.selections as string)).toEqual([
      { fingerprint: 'fp-verdi', installmentId: 'rent-verdi' },
      { fingerprint: 'fp-rossi', installmentId: 'rent-rossi' },
    ]);
    expect(toast.success).toHaveBeenCalledWith('2 canoni segnati come incassati');
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('confirm_SomeChoicesAreSkippedByTheServer_TheLandlordIsToldHowMany', async () => {
    post.mockResolvedValue({ data: preview() });
    renderDialog();
    choose(file());
    await screen.findByTestId('bank-import-review');
    post.mockReset();
    post.mockResolvedValue({
      data: {
        requested: 2,
        confirmed: [{ fingerprint: 'fp-verdi', installmentId: 'rent-verdi' }],
        skipped: [{ fingerprint: 'fp-rossi', installmentId: 'rent-rossi', code: 'rent_installment_not_payable' }],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Conferma 2 incassi' }));
    await vi.mocked(toastUndo).mock.calls[0][1].commit?.();

    expect(toast.success).toHaveBeenCalledWith('1 canone segnato come incassato');
    expect(toast.info).toHaveBeenCalledWith('1 incasso non registrato: era già pagato o è cambiato nel frattempo.');
  });

  it('confirm_TheLastImportIsStillWaiting_ThisOneWaitsToo_AndTheReviewKeepsItsChoices', async () => {
    post.mockResolvedValue({ data: preview() });
    const { onClose } = renderDialog();
    choose(file());
    await screen.findByTestId('bank-import-review');

    // The first confirmation starts its six seconds (here the window stays open to look at it; in the app it closes).
    fireEvent.click(screen.getByRole('button', { name: 'Conferma 2 incassi' }));
    expect(toastUndo).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);

    // A second window opened meanwhile has nothing to press until the first is recorded or cancelled: no click that seems to do nothing.
    const confirmButton = screen.getByRole('button', { name: 'Conferma 2 incassi' });
    expect(confirmButton).toBeDisabled();
    expect(screen.getByTestId('bank-import-confirm-note')).toHaveTextContent('Sto ancora registrando gli incassi di prima');
    fireEvent.click(confirmButton);
    expect(toastUndo).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('bank-import-review')).toBeInTheDocument();

    // «Annulla» of the first one: the review is as the landlord left it and can go.
    act(() => {
      vi.mocked(toastUndo).mock.calls[0][1].undo();
    });
    expect(screen.getByRole('button', { name: 'Conferma 2 incassi' })).toBeEnabled();
    expect(screen.getByTestId('bank-import-confirm-note')).toHaveTextContent('Segno i canoni come incassati');
  });

  it('review_UntickingASureOne_ConfirmsOnlyTheOthers', async () => {
    post.mockResolvedValue({ data: preview() });
    renderDialog();
    choose(file());
    const sure = within(await screen.findByTestId('bank-import-sure'));

    fireEvent.click(sure.getByRole('checkbox', { name: /Segna come incassato: Mario Rossi/ }));

    expect(screen.getByRole('button', { name: 'Conferma 1 incasso' })).toBeEnabled();
    post.mockReset();
    post.mockResolvedValue({ data: { requested: 1, confirmed: [{ fingerprint: 'fp-verdi', installmentId: 'rent-verdi' }], skipped: [] } });
    fireEvent.click(screen.getByRole('button', { name: 'Conferma 1 incasso' }));
    await vi.mocked(toastUndo).mock.calls[0][1].commit?.();
    expect(JSON.parse(sentForm(0).selections as string)).toEqual([{ fingerprint: 'fp-verdi', installmentId: 'rent-verdi' }]);
  });

  it('review_NothingTicked_NothingToConfirm', async () => {
    post.mockResolvedValue({ data: preview() });
    renderDialog();
    choose(file());
    const sure = within(await screen.findByTestId('bank-import-sure'));

    for (const box of sure.getAllByRole('checkbox')) fireEvent.click(box);

    expect(screen.getByRole('button', { name: 'Conferma 0 incassi' })).toBeDisabled();
  });

  it('review_AnAmountOnlyMatch_WaitsForTheLandlordToPickTheRent_ThenCountsIt', async () => {
    post.mockResolvedValue({ data: preview() });
    renderDialog();
    choose(file());
    await screen.findByTestId('bank-import-review');
    // With sure matches the doubtful ones are folded: one click opens them.
    expect(screen.queryByTestId('bank-import-check-row')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Da controllare (1)' }));

    const row = within(screen.getByTestId('bank-import-check-row'));
    expect(row.getByText(/BONIFICO 900 EURO/)).toBeInTheDocument();
    const tick = row.getByRole('checkbox');
    // Each select is named by the credit it belongs to, so two of them are never the same control to a screen reader.
    const pick = row.getByRole('combobox', { name: /^Canone da segnare come incassato per l'accredito del 3 ott 2026 di/ });
    // No proposal: the box cannot be ticked before a rent is chosen, and nothing is counted.
    expect(tick).toBeDisabled();
    expect(pick).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Conferma 2 incassi' })).toBeEnabled();

    fireEvent.change(pick, { target: { value: 'rent-other' } });

    expect(tick).toBeChecked();
    expect(screen.getByRole('button', { name: 'Conferma 3 incassi' })).toBeEnabled();
    post.mockReset();
    post.mockResolvedValue({ data: { requested: 3, confirmed: [], skipped: [] } });
    fireEvent.click(screen.getByRole('button', { name: 'Conferma 3 incassi' }));
    await vi.mocked(toastUndo).mock.calls[0][1].commit?.();
    expect(JSON.parse(sentForm(0).selections as string)).toContainEqual({ fingerprint: 'fp-maybe', installmentId: 'rent-other' });
    expect(toast.info).toHaveBeenCalledWith('Nessun canone è stato segnato come incassato.');
  });

  it('review_ARentAlreadyChosenForAnotherCredit_CannotBePickedAgain', async () => {
    const twoDoubtful = preview({
      suggestions: [
        suggestion('fp-one', 'Medium', verdi, { alternatives: [bianchi] }),
        suggestion('fp-two', 'Low', verdi, { alternatives: [bianchi], description: 'ALTRO BONIFICO 900' }),
      ],
      summary: { movements: 2, credits: 2, alreadyImported: 0, suggested: 2, confident: 0, unmatched: 0 },
      unmatched: [],
    });
    post.mockResolvedValue({ data: twoDoubtful });
    renderDialog();
    choose(file());
    // No sure match: the doubtful ones are open from the start.
    const rows = await screen.findAllByTestId('bank-import-check-row');
    const first = within(rows[0]);
    const second = within(rows[1]);

    fireEvent.click(first.getByRole('checkbox'));
    expect(first.getByRole('combobox')).toHaveValue('rent-verdi');

    const taken = second.getAllByRole('option').find((option) => option.getAttribute('value') === 'rent-verdi');
    expect(taken).toBeDisabled();
    expect(taken).toHaveTextContent('già scelto per un altro accredito');
    expect(second.getAllByRole('option').find((option) => option.getAttribute('value') === 'rent-bianchi')).toBeEnabled();
  });

  it('review_ADoubtfulProposalWhoseRentAnotherCreditHasTaken_CannotBeTicked_UntilItIsFreedAgain', async () => {
    const twoDoubtful = preview({
      suggestions: [
        suggestion('fp-one', 'Medium', verdi, { alternatives: [bianchi] }),
        suggestion('fp-two', 'Low', verdi, { alternatives: [bianchi], description: 'ALTRO BONIFICO 900' }),
      ],
      summary: { movements: 2, credits: 2, alreadyImported: 0, suggested: 2, confident: 0, unmatched: 0 },
      unmatched: [],
    });
    post.mockResolvedValue({ data: twoDoubtful });
    renderDialog();
    choose(file());
    const rows = await screen.findAllByTestId('bank-import-check-row');
    const first = within(rows[0]);
    const second = within(rows[1]);
    expect(first.getByRole('checkbox')).toBeEnabled();

    // The second credit takes the rent the first one proposed: ticking the first would pay it twice, so it cannot be ticked.
    fireEvent.change(second.getByRole('combobox'), { target: { value: 'rent-verdi' } });
    expect(first.getByRole('checkbox')).toBeDisabled();
    expect(first.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Conferma 1 incasso' })).toBeEnabled();

    fireEvent.change(second.getByRole('combobox'), { target: { value: '' } });
    expect(first.getByRole('checkbox')).toBeEnabled();
  });

  it('review_ASureOneUntickedWhoseRentAnotherCreditHasTaken_CannotBeTickedBack_UntilItIsFreedAgain', async () => {
    const contested = preview({
      suggestions: [
        suggestion('fp-sure', 'High', verdi),
        suggestion('fp-maybe', 'Low', bianchi, { description: 'BONIFICO 900 EURO', payer: null, reasons: ['Amount'], alternatives: [verdi] }),
      ],
      summary: { movements: 2, credits: 2, alreadyImported: 0, suggested: 2, confident: 1, unmatched: 0 },
      unmatched: [],
    });
    post.mockResolvedValue({ data: contested });
    renderDialog();
    choose(file());
    const sureRow = within(await screen.findByTestId('bank-import-sure-row'));
    const tick = sureRow.getByRole('checkbox');

    fireEvent.click(tick);
    expect(tick).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Da controllare (1)' }));
    const pick = within(screen.getByTestId('bank-import-check-row')).getByRole('combobox');
    fireEvent.change(pick, { target: { value: 'rent-verdi' } });

    // The rent is now the other credit's: the sure row says so and cannot be ticked, so that no choice is silently dropped at the end.
    expect(tick).toBeDisabled();
    expect(screen.getByTestId('bank-import-sure-row')).toHaveTextContent('già scelto per un altro accredito');
    expect(screen.getByRole('button', { name: 'Conferma 1 incasso' })).toBeEnabled();

    fireEvent.change(pick, { target: { value: '' } });
    expect(tick).toBeEnabled();
    expect(screen.getByTestId('bank-import-sure-row')).not.toHaveTextContent('già scelto per un altro accredito');
  });

  it('review_TheTextOfARowIsPartOfItsTickBox_AndEveryTickBoxHasItsOwnName', async () => {
    post.mockResolvedValue({ data: preview() });
    renderDialog();
    choose(file());
    const sure = within(await screen.findByTestId('bank-import-sure'));

    const names = sure.getAllByRole('checkbox').map((box) => box.getAttribute('aria-label'));
    expect(names).toHaveLength(2);
    expect(new Set(names).size).toBe(2);
    expect(names[0]).toContain('Giulia Verdi, Casa Trastevere, canone di ottobre 2026');

    // Pressing the words of the row does what pressing the box does.
    const tick = sure.getAllByRole('checkbox')[0];
    expect(tick).toBeChecked();
    fireEvent.click(sure.getByText(/Giulia Verdi · Casa Trastevere/));
    expect(tick).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Conferma 1 incasso' })).toBeEnabled();
  });

  it('review_TheCreditsWithoutARent_AreFoldedAndOneClickShowsThem', async () => {
    post.mockResolvedValue({ data: preview() });
    renderDialog();
    choose(file());
    await screen.findByTestId('bank-import-review');
    expect(screen.queryByTestId('bank-import-unmatched-row')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Senza canone (1)' }));

    const row = within(screen.getByTestId('bank-import-unmatched-row'));
    expect(row.getByText('STIPENDIO OTTOBRE')).toBeInTheDocument();
    expect(row.getByText(/2100,00/)).toBeInTheDocument();
  });

  it('review_NothingMatches_SaysSo_AndNothingCanBeConfirmed', async () => {
    post.mockResolvedValue({
      data: preview({ suggestions: [], summary: { movements: 2, credits: 1, alreadyImported: 0, suggested: 0, confident: 0, unmatched: 1 } }),
    });
    renderDialog();
    choose(file());

    expect(await screen.findByTestId('bank-import-none')).toHaveTextContent('Nessun accredito corrisponde a un canone da incassare');
    expect(screen.queryByTestId('bank-import-sure')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Conferma 0 incassi' })).toBeDisabled();
  });

  it('review_ChooseAnotherFile_GoesBackToTheStart', async () => {
    post.mockResolvedValue({ data: preview() });
    renderDialog();
    choose(file());
    await screen.findByTestId('bank-import-review');

    fireEvent.click(screen.getByRole('button', { name: 'Scegli un altro file' }));

    expect(screen.getByTestId('bank-import-dropzone')).toBeInTheDocument();
    expect(screen.queryByTestId('bank-import-review')).not.toBeInTheDocument();
  });

  it('chooseAFile_TooLarge_IsRefusedWithoutSendingIt', () => {
    renderDialog();
    const big = file('grande.csv');
    Object.defineProperty(big, 'size', { value: MAX_STATEMENT_BYTES + 1 });

    choose(big);

    expect(screen.getByTestId('bank-import-error')).toHaveTextContent('Il file è troppo grande: al massimo 8 MB');
    expect(post).not.toHaveBeenCalled();
  });

  it('chooseAFile_Empty_IsRefusedWithoutSendingIt', () => {
    renderDialog();

    choose(file('vuoto.csv', ''));

    expect(screen.getByTestId('bank-import-error')).toHaveTextContent('Il file è vuoto.');
    expect(post).not.toHaveBeenCalled();
  });

  it('chooseAFile_TheServerRefusesIt_ShowsItsReasonAndAsksForAnotherFile', async () => {
    post.mockRejectedValue(httpError(415, { code: 'bank_statement_format_unsupported', detail: 'Questo file non si può leggere. Esporta i movimenti in CSV.' }));
    renderDialog();

    choose(file('estratto.pdf'));

    expect(await screen.findByTestId('bank-import-error')).toHaveTextContent('Questo file non si può leggere. Esporta i movimenti in CSV.');
    expect(screen.getByTestId('bank-import-dropzone')).toBeInTheDocument();
  });

  it('chooseAFile_TheNetworkFails_SaysSoAndLetsTheLandlordTryAgain', async () => {
    post.mockRejectedValueOnce(httpError());
    renderDialog();

    choose(file());

    expect(await screen.findByTestId('bank-import-error')).toHaveTextContent(i18n.t('apiErrors.network'));
    post.mockResolvedValueOnce({ data: preview() });
    choose(file());
    expect(await screen.findByTestId('bank-import-review')).toBeInTheDocument();
    expect(screen.queryByTestId('bank-import-error')).not.toBeInTheDocument();
  });

  it('chooseAFile_AnAnswerThatIsNotAPreview_IsAReadFailure', async () => {
    post.mockResolvedValue({ data: '<!doctype html><html></html>' });
    renderDialog();

    choose(file());

    expect(await screen.findByTestId('bank-import-error')).toHaveTextContent('Non sono riuscito a leggere il file');
  });

  describe('when the columns are not recognized', () => {
    const columnsProblem = httpError(422, {
      code: 'bank_statement_columns_unrecognized',
      headerRow: 0,
      columnCount: 3,
      rows: [
        ['Foo', 'Bar', 'Baz'],
        ['03/10/2026', 'BONIFICO VERDI', '900,00'],
      ],
    });

    it('asksWhichColumnIsWhich_AndSendsTheMappingWithTheSameFile', async () => {
      post.mockRejectedValueOnce(columnsProblem);
      renderDialog();
      choose(file('strano.csv'));

      const step = within(await screen.findByTestId('bank-import-columns'));
      expect(screen.getByText(/Non riconosco le colonne di questo file/)).toBeInTheDocument();
      expect(step.getByLabelText('La prima riga contiene i titoli delle colonne')).toBeChecked();
      // The columns are named by their titles and show what the first movement has in them.
      expect(step.getAllByRole('option', { name: 'Bar · BONIFICO VERDI' })).toHaveLength(3);
      const continueButton = step.getByTestId('bank-import-columns-continue');
      expect(continueButton).toBeDisabled();

      fireEvent.change(step.getByTestId('bank-import-column-date'), { target: { value: '0' } });
      fireEvent.change(step.getByTestId('bank-import-column-description'), { target: { value: '1' } });
      expect(continueButton).toBeDisabled();
      fireEvent.change(step.getByTestId('bank-import-column-amount'), { target: { value: '2' } });
      expect(continueButton).toBeEnabled();

      post.mockResolvedValueOnce({ data: preview() });
      fireEvent.click(continueButton);

      expect(await screen.findByTestId('bank-import-review')).toBeInTheDocument();
      expect(post).toHaveBeenCalledTimes(2);
      const sent = sentForm(1);
      expect((sent.file as File).name).toBe('strano.csv');
      expect(JSON.parse(sent.mapping as string)).toEqual({ headerRow: 0, date: 0, description: 1, amount: 2 });

      // The confirmation sends the same mapping with the same file.
      post.mockReset();
      post.mockResolvedValue({ data: { requested: 2, confirmed: [], skipped: [] } });
      fireEvent.click(screen.getByRole('button', { name: 'Conferma 2 incassi' }));
      await vi.mocked(toastUndo).mock.calls[0][1].commit?.();
      expect(JSON.parse(sentForm(0).mapping as string)).toEqual({ headerRow: 0, date: 0, description: 1, amount: 2 });
    });

    it('aFileWithNoTitles_IsMappedFromItsFirstRow', async () => {
      post.mockRejectedValueOnce(
        httpError(422, {
          code: 'bank_statement_columns_unrecognized',
          headerRow: -1,
          columnCount: 3,
          rows: [['03/10/2026', 'BONIFICO VERDI', '900,00']],
        }),
      );
      renderDialog();
      choose(file());

      const step = within(await screen.findByTestId('bank-import-columns'));
      expect(step.getByLabelText('La prima riga contiene i titoli delle colonne')).not.toBeChecked();
      expect(step.getAllByRole('option', { name: 'Colonna 2 · BONIFICO VERDI' })).toHaveLength(3);
      fireEvent.change(step.getByTestId('bank-import-column-date'), { target: { value: '0' } });
      fireEvent.change(step.getByTestId('bank-import-column-description'), { target: { value: '1' } });
      fireEvent.change(step.getByTestId('bank-import-column-amount'), { target: { value: '2' } });
      post.mockResolvedValueOnce({ data: preview() });

      fireEvent.click(step.getByTestId('bank-import-columns-continue'));

      await screen.findByTestId('bank-import-review');
      expect(JSON.parse(sentForm(1).mapping as string)).toEqual({ headerRow: -1, date: 0, description: 1, amount: 2 });
    });

    it('theSameColumnForTwoRoles_CannotContinue', async () => {
      post.mockRejectedValueOnce(columnsProblem);
      renderDialog();
      choose(file());
      const step = within(await screen.findByTestId('bank-import-columns'));

      fireEvent.change(step.getByTestId('bank-import-column-date'), { target: { value: '0' } });
      fireEvent.change(step.getByTestId('bank-import-column-description'), { target: { value: '0' } });
      fireEvent.change(step.getByTestId('bank-import-column-amount'), { target: { value: '2' } });

      expect(step.getByTestId('bank-import-columns-continue')).toBeDisabled();
      expect(step.getByText(/Ogni colonna può avere un solo ruolo/)).toBeInTheDocument();
    });

    it('aMappingTheFileDoesNotAccept_BringsBackTheSameColumns_WithTheReason', async () => {
      post.mockRejectedValueOnce(columnsProblem);
      renderDialog();
      choose(file());
      const step = within(await screen.findByTestId('bank-import-columns'));
      fireEvent.change(step.getByTestId('bank-import-column-date'), { target: { value: '0' } });
      fireEvent.change(step.getByTestId('bank-import-column-description'), { target: { value: '1' } });
      fireEvent.change(step.getByTestId('bank-import-column-amount'), { target: { value: '2' } });
      post.mockRejectedValueOnce(httpError(422, { code: 'bank_statement_mapping_invalid', detail: 'Con queste colonne non trovo nessun movimento.' }));

      fireEvent.click(step.getByTestId('bank-import-columns-continue'));

      // Not back to the start: the landlord changes one column and tries again, with the file already in hand.
      expect(await screen.findByTestId('bank-import-error')).toHaveTextContent('Con queste colonne non trovo nessun movimento.');
      const again = within(screen.getByTestId('bank-import-columns'));
      expect(again.getByTestId('bank-import-column-date')).toHaveValue('0');
      expect(again.getByTestId('bank-import-column-description')).toHaveValue('1');
      expect(again.getByTestId('bank-import-column-amount')).toHaveValue('2');
      expect(again.getByTestId('bank-import-columns-continue')).toBeEnabled();

      post.mockResolvedValueOnce({ data: preview() });
      fireEvent.click(again.getByTestId('bank-import-columns-continue'));

      expect(await screen.findByTestId('bank-import-review')).toBeInTheDocument();
      expect(screen.queryByTestId('bank-import-error')).not.toBeInTheDocument();
      expect(post).toHaveBeenCalledTimes(3);
    });

    it('theWholeTopOfTheFileIsShown_SoTheTitlesAfterAPreambleCanBeSeen', async () => {
      post.mockRejectedValueOnce(
        httpError(422, {
          code: 'bank_statement_columns_unrecognized',
          headerRow: 4,
          columnCount: 10,
          rows: [
            ['Intestatario', 'Giulia Verdi'],
            ['Conto', 'IT60X0542811101000000123456'],
            ['Periodo', 'ottobre 2026'],
            [],
            ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
            ['03/10/2026', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', '900,00'],
          ],
        }),
      );
      renderDialog();
      choose(file());

      const step = within(await screen.findByTestId('bank-import-columns'));

      // The six rows the server sends and all ten columns: the titles (row 5) and the first movement (row 6) are among them.
      expect(step.getAllByRole('row')).toHaveLength(6);
      expect(step.getByLabelText('La prima riga contiene i titoli delle colonne')).toBeChecked();
      expect(step.getAllByRole('option', { name: 'J · 900,00' })).toHaveLength(3);
    });

    it('back_ReturnsToTheChoiceOfTheFile', async () => {
      post.mockRejectedValueOnce(columnsProblem);
      renderDialog();
      choose(file());
      const step = within(await screen.findByTestId('bank-import-columns'));

      fireEvent.click(step.getByRole('button', { name: 'Indietro' }));

      expect(screen.getByTestId('bank-import-dropzone')).toBeInTheDocument();
    });
  });

  it('inEnglish_TheDialogSpeaksEnglish', async () => {
    await i18n.changeLanguage('en');
    post.mockResolvedValue({ data: preview() });
    renderDialog();
    expect(screen.getByRole('heading', { name: 'Import bank statement' })).toBeInTheDocument();

    choose(file());

    expect(await screen.findByRole('heading', { name: 'Ready to confirm (2)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm 2 payments' })).toBeEnabled();
    await waitFor(() => expect(screen.getByText('I found 4 credits in the file.')).toBeInTheDocument());
  });
});
