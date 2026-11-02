import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { gdprApi } from '@/api/gdpr.api';
import { saveBlobAs } from '@/lib/file-download';
import { AccountPrivacySection } from '../account-privacy-section';

vi.mock('@/api/gdpr.api', () => ({ gdprApi: { exportOrgFiscal: vi.fn() } }));
vi.mock('@/lib/file-download', () => ({ saveBlobAs: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(createElement(I18nextProvider, { i18n }, createElement(QueryClientProvider, { client }, createElement(AccountPrivacySection))));
}

const textOf = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });

// The export holds the personal data of the team: it is saved exactly as the server sends it and its name says nothing about who is in it.
describe('AccountPrivacySection (AM-08b-c)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });
  afterEach(() => cleanup());

  it('AccountPrivacySection_Download_SavesTheExportAsItComesUnderANameWithNoPersonalData', async () => {
    const exported = { org: { name: 'Villa Segreta S.r.l.', vatNumber: 'IT00000000000' }, team: [{ email: 'anna.leone@example.com' }] };
    vi.mocked(gdprApi.exportOrgFiscal).mockResolvedValue(exported);
    renderSection();

    fireEvent.click(screen.getByTestId('account-export-org-data'));

    await waitFor(() => expect(saveBlobAs).toHaveBeenCalledTimes(1));
    const [file, fileName] = vi.mocked(saveBlobAs).mock.calls[0];
    expect(file.type).toBe('application/json');
    expect(JSON.parse(await textOf(file))).toEqual(exported);
    expect(fileName).toMatch(new RegExp(`^${i18n.t('accountSettings.privacy.fileName')}-\\d{4}-\\d{2}-\\d{2}\\.json$`));
    expect(fileName).not.toMatch(/villa|segreta|anna|leone|example|IT0000/i);
    expect(gdprApi.exportOrgFiscal).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith(i18n.t('accountSettings.privacy.done'));
  });
});
