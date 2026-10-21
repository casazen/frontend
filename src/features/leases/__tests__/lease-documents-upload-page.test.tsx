import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { ROUTE_MANIFEST } from '@/config/route-manifest';
import { LeaseDocumentsUploadPage } from '../lease-documents-upload-page';
import { buildDetail, httpError, renderAt } from './lease-test-utils';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

const id = '0b6f7a3e-5a2d-4c58-9e0a-6c8b0f2e1d11';
const path = '/app/long-rent/documents/upload';
const get = vi.mocked(axios.get);
const post = vi.mocked(axios.post);
function renderPage(query = '') { return renderAt(`${path}${query}`, path, createElement(LeaseDocumentsUploadPage)); }

describe('partner document upload', () => {
  beforeEach(async () => { vi.clearAllMocks(); await i18n.changeLanguage('it'); });

  it('registers the exact email landing path with read and property write permissions', () => {
    expect(ROUTE_MANIFEST.find((route) => route.path === path)?.requiredPermissions).toEqual(['lease.read', 'property.read', 'property.write']);
  });

  it.each(['?leaseId=bad', `?leaseId=${id}&leaseId=${id}`, '?leaseId='])('rejects malformed or ambiguous references without API access: %s', (query) => {
    renderPage(query);
    expect(screen.getByText(i18n.t('cfDocuments.invalidLease'))).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('never reads house documents when the lease is forbidden', async () => {
    get.mockRejectedValue(httpError(403));
    renderPage(`?leaseId=${id}`);
    expect(await screen.findByText(i18n.t('cfDocuments.leaseError'))).toBeInTheDocument();
    expect(get.mock.calls.every(([url]) => url === `/leases/${id}`)).toBe(true);
    expect(screen.queryByRole('button', { name: i18n.t('shared.documentUpload.uploadDocument') })).not.toBeInTheDocument();
  });

  it('loads the authorized lease then uploads only to its house using the existing Other document flow', async () => {
    get.mockImplementation((url) => {
      if (url === `/leases/${id}`) return Promise.resolve({ data: buildDetail({ id }) });
      if (url === '/properties/property-1/documents') return Promise.resolve({ data: [] });
      return Promise.reject(httpError(404));
    });
    post.mockResolvedValue({ data: { id: 'document-1' } });
    renderPage(`?leaseId=${id}&propertyId=untrusted-house`);
    const open = await screen.findByRole('button', { name: i18n.t('shared.documentUpload.uploadDocument') });
    expect(screen.getByText('Casa Trastevere')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(open);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(['%PDF-1.7\nexample'], 'contratto.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.documentUpload.upload') }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [url, body] = post.mock.calls[0];
    expect(url).toBe('/properties/property-1/documents');
    expect((body as FormData).get('documentType')).toBe('Other');
    expect((body as FormData).get('file')).toBe(file);
    expect(get.mock.calls.some(([url]) => String(url).includes('untrusted-house'))).toBe(false);
  });

  it('a bare link asks the user to select a saved lease rather than inventing a reference', async () => {
    get.mockResolvedValue({ data: [] });
    renderPage();
    expect(await screen.findByText(i18n.t('cfDocuments.noLeases'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: i18n.t('cfDocuments.backToHouses') })).toHaveAttribute('href', '/app/long-rent/properties');
    expect(post).not.toHaveBeenCalled();
  });
});
