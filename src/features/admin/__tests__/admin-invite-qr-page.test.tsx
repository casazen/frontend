import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { AdminInviteQrPage } from '../admin-invite-qr-page';

const toDataURL = vi.hoisted(() => vi.fn(async (text: string) => `data:image/png;base64,${btoa(text)}`));
vi.mock('qrcode', () => ({ default: { toDataURL } }));

describe('AdminInviteQrPage', () => {
  beforeEach(async () => {
    toDataURL.mockClear();
    await i18n.changeLanguage('it');
  });
  afterEach(cleanup);

  it('drawsOneCodePerEntryAddress_NoTokenNoPersonalData', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <AdminInviteQrPage />
      </I18nextProvider>,
    );

    const origin = window.location.origin;
    await waitFor(() => expect(screen.getByTestId('qr-supplier-image')).toBeInTheDocument());
    expect(screen.getByTestId('qr-supplier-url')).toHaveTextContent(`${origin}/register`);
    await waitFor(() => expect(screen.getByTestId('qr-host-image')).toBeInTheDocument());
    expect(screen.getByTestId('qr-host-url')).toHaveTextContent(`${origin}/signup?role=host&utm_source=qr&utm_medium=print`);
    const printed = toDataURL.mock.calls.map(([text]) => text).join(' ');
    expect(printed).not.toMatch(/token|@/i);
  });

  it('theHostCodeFollowsTheCampaignName_AsAnAddressSafeValue', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <AdminInviteQrPage />
      </I18nextProvider>,
    );

    fireEvent.change(screen.getByTestId('qr-campaign-input'), { target: { value: 'Volantino Roma 2026' } });

    await waitFor(() =>
      expect(screen.getByTestId('qr-host-url')).toHaveTextContent('utm_campaign=volantino-roma-2026'),
    );
    await waitFor(() =>
      expect(toDataURL).toHaveBeenCalledWith(expect.stringContaining('utm_campaign=volantino-roma-2026'), expect.anything()),
    );
    // The image is the one of the current address, never a stale one.
    await waitFor(() => {
      const src = screen.getByTestId('qr-host-image').getAttribute('src') ?? '';
      expect(atob(src.split(',')[1])).toContain('utm_campaign=volantino-roma-2026');
    });
  });
});
