import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { publicOrgApi } from '@/api/public-org.api';
import { ContactHostDialog } from '../contact-host-dialog';

vi.mock('@/api/public-org.api', () => ({ publicOrgApi: { sendHostContact: vi.fn() } }));

function openDialog() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ContactHostDialog
          site="villa-mare"
          hostName="Giulia"
          propertyId="property-1"
          trigger={<button type="button">Apri il modulo</button>}
        />
      </QueryClientProvider>
    </I18nextProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Apri il modulo' }));
}

function fillTheForm() {
  fireEvent.change(screen.getByLabelText(i18n.t('hostContact.emailLabel')), { target: { value: 'ospite@example.com' } });
  fireEvent.change(screen.getByLabelText(i18n.t('hostContact.messageLabel')), {
    target: { value: 'Siamo in quattro e arriviamo con un cane piccolo: si può?' },
  });
}

// DB-02b: the message and the address of a visitor go to the host only if the visitor agreed to it.
describe('ContactHostDialog (DB-02b, privacy)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    vi.mocked(publicOrgApi.sendHostContact).mockReset().mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it('ContactHostDialog_ConsentNotGiven_SendsNothingAndSaysWhy', async () => {
    openDialog();
    fillTheForm();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('hostContact.send') }));

    expect(await screen.findByText(i18n.t('hostContact.errors.consent'))).toBeInTheDocument();
    expect(publicOrgApi.sendHostContact).not.toHaveBeenCalled();
  });

  it('ContactHostDialog_ConsentGiven_SendsTheMessageWithTheLanguageAndTheHome', async () => {
    openDialog();
    fillTheForm();
    fireEvent.click(screen.getByRole('checkbox'));

    fireEvent.click(screen.getByRole('button', { name: i18n.t('hostContact.send') }));

    await waitFor(() => expect(publicOrgApi.sendHostContact).toHaveBeenCalledTimes(1));
    expect(publicOrgApi.sendHostContact).toHaveBeenCalledWith('villa-mare', {
      email: 'ospite@example.com',
      message: 'Siamo in quattro e arriviamo con un cane piccolo: si può?',
      propertyId: 'property-1',
      lang: 'it',
      consent: true,
    });
    expect(await screen.findByTestId('host-contact-done')).toBeInTheDocument();
  });
});
