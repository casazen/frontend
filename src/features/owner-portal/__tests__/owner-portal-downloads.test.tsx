import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { saveBlobAs } from '@/lib/file-download';
import { DocumentsList } from '../documents-list';
import { MessageList } from '../conversation-thread';
import type { OwnerDocument, OwnerMessage } from '@/types';

vi.mock('@/api/ownerPortal.api', () => ({ ownerPortalApi: { downloadDocument: vi.fn(), downloadAttachment: vi.fn() } }));
vi.mock('@/lib/file-download', () => ({ saveBlobAs: vi.fn(), withJsonErrorBody: vi.fn() }));

import { ownerPortalApi } from '@/api/ownerPortal.api';

const api = vi.mocked(ownerPortalApi);

/** A refusal as the API client raises it: the status and a ProblemDetails body with the code. */
function refusal(status: number, code: string): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('refused', 'ERR_BAD_REQUEST', config, null, { status, statusText: '', headers: {}, config, data: { status, code } });
}

/** A mandate with two versions: the one in force, whose file carries a double extension, and the one it replaced. */
const DOCUMENT: OwnerDocument = {
  id: 'd1',
  orgId: 'o1',
  propertyOwnerId: 'po1',
  propertyId: 'p1',
  propertyName: 'Casa Mare',
  type: 'Mandate',
  title: 'Mandato di gestione',
  expiryState: 'expiring',
  expiresOn: '2026-12-01',
  updatedAt: '2026-11-01T10:00:00Z',
  versions: [
    {
      id: 'v2',
      versionNumber: 2,
      fileName: 'mandato.pdf.exe',
      contentType: 'application/pdf',
      sizeBytes: 2048,
      sha256: 'a',
      effectiveFrom: '2026-01-01',
      expiresOn: '2026-12-01',
      state: 'current',
      uploadedAt: '2026-11-01T10:00:00Z',
    },
    { id: 'v1', versionNumber: 1, fileName: 'mandato-1.pdf', contentType: 'application/pdf', sizeBytes: 1024, sha256: 'b', state: 'superseded', uploadedAt: '2025-01-01T10:00:00Z' },
  ],
};

function renderDocuments(documents: OwnerDocument[] = [DOCUMENT]) {
  return render(
    <MemoryRouter>
      <DocumentsList documents={documents} emptyText="Nessun documento" />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
});

describe('the documents of the owner: the version in force, its dates and its expiry, and a download for every version (AC-NF111-3)', () => {
  it('OwnerDocuments_ShowTheVersionInForceItsDatesAndItsExpiry_AndKeepTheOlderVersionsAsTheyWere', () => {
    renderDocuments();
    const card = screen.getByTestId('owner-document');

    expect(card.textContent).toContain('Mandato di gestione');
    expect(card.textContent).toContain('Mandato');
    expect(card.textContent).toContain('Casa Mare');
    // The expiry of the document, and the state of the version in force with its number, the day it holds from, the day it lapses and the size of its file.
    expect(within(card).getByTestId('owner-document-expiry').textContent).toMatch(/In scadenza il 1 dic\.? 2026/);
    expect(card.textContent).toContain('In vigore');
    expect(card.textContent).toContain('Versione 2');
    expect(card.textContent).toMatch(/In vigore dal 1 gen\.? 2026/);
    expect(card.textContent).toMatch(/Scade il 1 dic\.? 2026/);
    expect(card.textContent).toContain('2 KB');
    // The version it replaced is kept, with its own word.
    expect(card.textContent).toContain('1 versione precedente');
    expect(card.textContent).toContain('Sostituita');
    expect(card.textContent).toContain('Versione 1');
  });

  it('OwnerDocuments_ADownloadAsksForTheVersionTheOwnerChose_AndSavesItUnderANameMadeSafe', async () => {
    const blob = new Blob(['%PDF-1.4']);
    api.downloadDocument.mockResolvedValue(blob);
    renderDocuments();

    fireEvent.click(screen.getByTestId('owner-document-download'));
    await waitFor(() => expect(saveBlobAs).toHaveBeenCalledTimes(1));

    // The version in force is asked for by its id (the audit of the download is the server's), and its file is saved under the name of the agency made safe: no second extension.
    expect(api.downloadDocument).toHaveBeenCalledWith('d1', 'v2');
    expect(saveBlobAs).toHaveBeenCalledWith(blob, 'mandato_pdf.pdf');
    cleanup();

    // The older version has its own button, and its own file.
    const older = new Blob(['%PDF-1.3']);
    api.downloadDocument.mockResolvedValue(older);
    renderDocuments();
    fireEvent.click(screen.getByRole('button', { name: 'Scarica Mandato di gestione, versione 1' }));
    await waitFor(() => expect(saveBlobAs).toHaveBeenCalledTimes(2));
    expect(api.downloadDocument).toHaveBeenLastCalledWith('d1', 'v1');
    expect(saveBlobAs).toHaveBeenLastCalledWith(older, 'mandato-1.pdf');
  });

  it('OwnerDocuments_OneDownloadAtATime_EveryButtonWaitsForTheOneThatIsWorking', async () => {
    let finish: (blob: Blob) => void = () => {};
    api.downloadDocument.mockReturnValue(new Promise<Blob>((resolve) => (finish = resolve)));
    renderDocuments();
    const buttons = screen.getAllByRole('button', { name: /^Scarica Mandato di gestione/ });
    expect(buttons).toHaveLength(2);

    fireEvent.click(buttons[0]);
    await waitFor(() => expect(buttons[0]).toBeDisabled());
    expect(buttons[1]).toBeDisabled();
    // A click on the other one while the first works asks for nothing.
    fireEvent.click(buttons[1]);
    expect(api.downloadDocument).toHaveBeenCalledTimes(1);

    finish(new Blob(['x']));
    await waitFor(() => expect(saveBlobAs).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(buttons[1]).toBeEnabled());
  });

  it('OwnerDocuments_ARefusedDownload_IsSaidInWords_NothingIsSaved_AndTheButtonsComeBack', async () => {
    api.downloadDocument.mockRejectedValue(refusal(404, 'owner_document_not_found'));
    renderDocuments();

    fireEvent.click(screen.getByTestId('owner-document-download'));

    const failed = await screen.findByTestId('owner-document-download-failed');
    expect(failed.textContent).toContain('Questo documento non è disponibile');
    expect(saveBlobAs).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('owner-document-download')).toBeEnabled());
  });
});

describe('the attachment of a message is downloaded from the authenticated API under a name made safe', () => {
  const MESSAGES: OwnerMessage[] = [
    {
      id: 'm2',
      conversationId: 'c1',
      sender: 'Agency',
      authorName: 'Agenzia',
      body: 'Ti mandiamo il rinnovo.',
      attachment: { fileName: 'rinnovo.pdf.exe', contentType: 'application/pdf', sizeBytes: 3000 },
      createdAt: '2026-11-06T10:00:00Z',
    },
  ];

  it('OwnerMessageAttachment_AsksForTheFileOfThatMessage_AndSavesItAsPdfWithNoSecondExtension', async () => {
    const blob = new Blob(['%PDF-1.4']);
    api.downloadAttachment.mockResolvedValue(blob);
    render(<MessageList conversationId="c1" messages={MESSAGES} />);

    fireEvent.click(screen.getByTestId('owner-attachment-download'));
    await waitFor(() => expect(saveBlobAs).toHaveBeenCalledTimes(1));

    expect(api.downloadAttachment).toHaveBeenCalledWith('c1', 'm2');
    expect(saveBlobAs).toHaveBeenCalledWith(blob, 'rinnovo_pdf.pdf');
  });

  it('OwnerMessageAttachment_ARefusedDownload_IsSaidInWordsUnderThatMessage_AndNothingIsSaved', async () => {
    api.downloadAttachment.mockRejectedValue(refusal(404, 'owner_attachment_not_found'));
    render(<MessageList conversationId="c1" messages={MESSAGES} />);

    fireEvent.click(screen.getByTestId('owner-attachment-download'));

    expect((await screen.findByTestId('owner-attachment-failed')).textContent).toContain('Questo allegato non è disponibile');
    expect(saveBlobAs).not.toHaveBeenCalled();
  });
});
