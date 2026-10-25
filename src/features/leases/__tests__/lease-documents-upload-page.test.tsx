import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { ROUTE_MANIFEST } from '@/config/route-manifest';
import { LeaseDocumentsUploadPage } from '../lease-documents-upload-page';
import { buildDetail, buildSummary, httpError, renderAt } from './lease-test-utils';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
const id = '0b6f7a3e-5a2d-4c58-9e0a-6c8b0f2e1d11';
const practice = 'P-0123456789ABCDEF';
const lookupUrl = `/concordatofacile/practices/${practice}/lease`;
const path = '/app/long-rent/documents/upload';
const get = vi.mocked(axios.get); const post = vi.mocked(axios.post);
function renderPage(query = '') { return renderAt(`${path}${query}`, path, createElement(LeaseDocumentsUploadPage)); }

describe('lease-owned partner documents', () => {
  beforeEach(async () => { vi.clearAllMocks(); await i18n.changeLanguage('it'); });
  it('guards the upload route with lease read and lease write permissions', () => {
    expect(ROUTE_MANIFEST.find((route) => route.path === path)?.requiredPermissions).toEqual(['lease.read', 'lease.create']);
  });
  it.each(['?leaseId=bad', `?leaseId=${id}&leaseId=${id}`, '?leaseId=', '?propertyId=0f65c27e-0c89-42e1-b0e9-e2e09e73ee79'])('rejects invalid references or a property-only upload: %s', (query) => {
    renderPage(query); expect(screen.getByText(i18n.t('cfDocuments.invalidLease'))).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled(); expect(post).not.toHaveBeenCalled();
  });
  it('never reads documents when the lease is forbidden', async () => {
    get.mockRejectedValue(httpError(403)); renderPage(`?leaseId=${id}`);
    expect(await screen.findByText(i18n.t('cfDocuments.leaseError'))).toBeInTheDocument();
    expect(get.mock.calls.every(([url]) => url === `/leases/${id}`)).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });
  it('uploads to the lease, never to the property, and lists the persisted attachment', async () => {
    let saved = false;
    get.mockImplementation((url) => {
      if (url === `/leases/${id}`) return Promise.resolve({ data: buildDetail({ id }) });
      if (url === `/leases/${id}/documents`) return Promise.resolve({ data: saved ? [{ id: 'doc-1', leaseId: id, kind: 'Attestation', fileName: 'attestazione.pdf', sizeBytes: 10, uploadedAt: '2026-10-21T10:00:00Z' }] : [] });
      return Promise.reject(httpError(404));
    });
    post.mockImplementation(async () => { saved = true; return { data: { id: 'doc-1' } }; });
    renderPage(`?leaseId=${id}&propertyId=untrusted-house`);
    await screen.findByText(i18n.t('cfDocuments.empty'));
    expect(post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(i18n.t('cfDocuments.kind')), { target: { value: 'Attestation' } });
    const file = new File(['%PDF-1.7\nexample'], 'attestazione.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(i18n.t('documentPages.select')), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('cfDocuments.upload') }));
    await screen.findByText('attestazione.pdf');
    expect(post).toHaveBeenCalledTimes(1);
    const [url, body] = post.mock.calls[0]; expect(url).toBe(`/leases/${id}/documents`);
    expect((body as FormData).get('kind')).toBe('Attestation'); expect((body as FormData).get('file')).toBe(file);
    expect(get.mock.calls.some(([url]) => String(url).includes('/properties/'))).toBe(false);
  });
  it('retains the selected file and reports a failed upload without a false saved state', async () => {
    get.mockImplementation((url) => Promise.resolve({ data: url === `/leases/${id}` ? buildDetail({ id }) : [] }));
    post.mockRejectedValue(httpError(500)); renderPage(`?leaseId=${id}`);
    await screen.findByText(i18n.t('cfDocuments.empty'));
    const file = new File(['%PDF-1.7'], 'contratto.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(i18n.t('documentPages.select')), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('cfDocuments.upload') }));
    await screen.findByText(i18n.t('cfDocuments.uploadError'));
    expect(screen.queryByText(i18n.t('cfDocuments.saved'))).not.toBeInTheDocument();
    expect(screen.getByText('1. contratto.pdf')).toBeInTheDocument();
  });
  it('rejects another lease document in the server list rather than exposing it', async () => {
    get.mockImplementation((url) => Promise.resolve({ data: url === `/leases/${id}` ? buildDetail({ id }) : [{ id: 'foreign', leaseId: 'other-lease', fileName: 'private.pdf' }] }));
    renderPage(`?leaseId=${id}`);
    await screen.findByText(i18n.t('cfDocuments.documentsError'));
    expect(screen.queryByText('private.pdf')).not.toBeInTheDocument();
  });
  it('a bare link asks for an existing lease and never invents an identifier', async () => {
    get.mockResolvedValue({ data: [] }); renderPage();
    await screen.findByText(i18n.t('cfDocuments.noLeases')); expect(post).not.toHaveBeenCalled();
    await waitFor(() => expect(get).toHaveBeenCalled());
  });

  // CF-FIX: the button «Carica i dati in CasaZen» of ConcordatoFacile opens this page with `?practice=P-…`.
  it('a practice the server links to a lease shows the documents of that lease, never the list of contracts', async () => {
    get.mockImplementation((url) => {
      if (url === lookupUrl) return Promise.resolve({ data: { leaseId: id, practiceId: practice, status: 'InProgress', manualSelectionRequired: false } });
      if (url === `/leases/${id}`) return Promise.resolve({ data: buildDetail({ id }) });
      if (url === `/leases/${id}/documents`) return Promise.resolve({ data: [] });
      return Promise.reject(httpError(404));
    });
    renderPage(`?practice=${practice}`);
    await screen.findByText(i18n.t('cfDocuments.empty'));
    expect(screen.getByTestId('cf-documents-practice')).toHaveTextContent(i18n.t('cfDocuments.practice.linked', { practice }));
    expect(screen.queryByText(i18n.t('cfDocuments.chooseLease'))).not.toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === '/leases')).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });
  it('a practice the server does not find (or while the service is off) loads no contract until the person chooses one', async () => {
    get.mockImplementation((url) => {
      if (url === lookupUrl) return Promise.reject(httpError(404, { code: 'practice_not_found' }));
      if (url === '/leases') return Promise.resolve({ data: [buildSummary({ id })] });
      return Promise.reject(httpError(404));
    });
    renderPage(`?practice=${practice}`);
    expect(await screen.findByText(i18n.t('cfDocuments.practice.notFound'))).toBeInTheDocument();
    expect(await screen.findByText(i18n.t('cfDocuments.chooseLease'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('cfDocuments.backToHouses'))).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => String(url).startsWith('/leases/'))).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });
  it('a practice not linked yet asks for the contract and goes on with the one chosen, keeping the practice in the address', async () => {
    get.mockImplementation((url) => {
      if (url === lookupUrl) return Promise.resolve({ data: { leaseId: null, practiceId: practice, status: null, manualSelectionRequired: true } });
      if (url === '/leases') return Promise.resolve({ data: [buildSummary({ id })] });
      if (url === `/leases/${id}`) return Promise.resolve({ data: buildDetail({ id }) });
      if (url === `/leases/${id}/documents`) return Promise.resolve({ data: [] });
      return Promise.reject(httpError(404));
    });
    renderPage(`?practice=${practice}`);
    expect(await screen.findByTestId('cf-documents-practice-manual')).toHaveTextContent(practice);
    expect(get.mock.calls.some(([url]) => String(url).startsWith('/leases/'))).toBe(false);
    fireEvent.click(await screen.findByRole('link', { name: new RegExp(id) }));
    await screen.findByText(i18n.t('cfDocuments.empty'));
    expect(screen.getByTestId('cf-documents-practice')).toHaveTextContent(i18n.t('cfDocuments.practice.chosen', { practice }));
    expect(get.mock.calls.filter(([url]) => url === lookupUrl)).toHaveLength(1);
  });
  it.each(['?practice=P-123', `?practice=${practice}&practice=${practice}`, '?practice='])('a practice number that is not one is an invalid link, never looked up: %s', async (query) => {
    get.mockResolvedValue({ data: [] });
    renderPage(query);
    expect(await screen.findByTestId('cf-documents-practice-invalid')).toHaveTextContent(i18n.t('cfDocuments.practice.invalid'));
    await screen.findByText(i18n.t('cfDocuments.noLeases'));
    expect(get.mock.calls.some(([url]) => String(url).includes('/concordatofacile/'))).toBe(false);
  });
  it('a lease named in the link is the only one shown, whatever the practice says', async () => {
    get.mockImplementation((url) => {
      if (url === `/leases/${id}`) return Promise.resolve({ data: buildDetail({ id }) });
      if (url === `/leases/${id}/documents`) return Promise.resolve({ data: [] });
      return Promise.reject(httpError(404));
    });
    renderPage(`?leaseId=${id}&practice=${practice}`);
    await screen.findByText(i18n.t('cfDocuments.empty'));
    expect(screen.getByTestId('cf-documents-practice')).toHaveTextContent(i18n.t('cfDocuments.practice.chosen', { practice }));
    expect(get.mock.calls.some(([url]) => String(url).includes('/concordatofacile/'))).toBe(false);
  });
});
