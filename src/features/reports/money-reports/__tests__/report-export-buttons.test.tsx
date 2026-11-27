import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { saveBlobAs } from '@/lib/file-download';
import { ReportExportButtons } from '../report-export-buttons';

// The file of a money report: each way it can fail is said as it is under the buttons, nothing is saved, and the person can try again.
vi.mock('@/lib/file-download', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/file-download')>()), saveBlobAs: vi.fn() }));

const save = vi.mocked(saveBlobAs);

/** What axios throws for a failed answer of a file (the API has already turned the JSON Blob of its body back into an object). */
function failure(status: number, body: unknown): AxiosError {
  return new AxiosError('failed', undefined, undefined, undefined, { status, statusText: '', data: body, headers: {}, config: { headers: new AxiosHeaders() } });
}

function renderButtons(fetchFile: () => Promise<Blob>) {
  return render(<ReportExportButtons requestKey="2026-09-01|2026-09-30|" disabled={false} fetchFile={fetchFile} fileName={(format) => `report.${format}`} testId="export" />);
}

describe('ReportExportButtons: each failure of the file is said as it is', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    await i18n.changeLanguage('it');
  });
  afterEach(() => cleanup());

  // A 404 is "not found", and the text of the server never replaces it: the property is not one of the person's (or no longer exists), and
  // "try again" cannot work.
  it.each([
    { format: 'csv', body: {} },
    { format: 'xlsx', body: { code: 'property_not_found', detail: 'Property 6f1c0f66 not found' } },
  ])('Export_404_SaysNotFoundInTheWordsOfThePageNotTheTextOfTheServer_$format', async ({ format, body }) => {
    renderButtons(() => Promise.reject(failure(404, body)));

    fireEvent.click(screen.getByTestId(`export-${format}`));

    const text = await screen.findByTestId('export-failure');
    expect(text).toHaveTextContent('Non troviamo i dati richiesti.');
    expect(text).not.toHaveTextContent('Property');
    expect(text).not.toHaveTextContent('Riprova');
    expect(save).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('export-csv')).not.toBeDisabled());
    expect(screen.getByTestId('export-xlsx')).not.toBeDisabled();
  });

  it('Export_404InEnglish_SaysNotFoundToo', async () => {
    await i18n.changeLanguage('en');
    renderButtons(() => Promise.reject(failure(404, {})));

    fireEvent.click(screen.getByTestId('export-xlsx'));

    expect(await screen.findByTestId('export-failure')).toHaveTextContent('We cannot find the data you asked for.');
  });

  // A 500 is a file that did not come, with a try again, and what the server says of its own failure is never shown to the person.
  it.each([
    { format: 'csv', body: { detail: 'NullReferenceException at HostCollectionsReportService' } },
    { format: 'xlsx', body: { title: 'Internal Server Error' } },
  ])('Export_500_SaysTheFileDidNotComeWithATryAgainAndNothingOfTheServer_$format', async ({ format, body }) => {
    renderButtons(() => Promise.reject(failure(500, body)));

    fireEvent.click(screen.getByTestId(`export-${format}`));

    const text = await screen.findByTestId('export-failure');
    expect(text).toHaveTextContent('Non è stato possibile scaricare il file. Riprova.');
    expect(text).not.toHaveTextContent('NullReference');
    expect(text).not.toHaveTextContent('Internal Server Error');
    expect(save).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('export-csv')).not.toBeDisabled());
    expect(screen.getByTestId('export-xlsx')).not.toBeDisabled();
  });
});
