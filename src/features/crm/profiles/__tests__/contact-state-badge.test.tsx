import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { contactStateOf, type ContactState } from '../contact-state';
import { ContactStateBadge } from '../contact-state-badge';

const STATES: ContactState[] = ['consent', 'softOptIn', 'toConfirm', 'serviceOnly', 'unsubscribed', 'noContact'];

describe('contactStateOf: the e-mail state of a profile or of a contact (NF-89)', () => {
  it.each([
    ['a confirmed consent', { hasAddress: true, basis: 'Consent', reachable: true }, 'consent'],
    ['a soft opt-in that may receive marketing', { hasAddress: true, basis: 'SoftOptIn', reachable: true }, 'softOptIn'],
    ['a consent that is not confirmed yet', { hasAddress: true, basis: 'Consent', reachable: false }, 'toConfirm'],
    ['a service-only address', { hasAddress: true, basis: 'ServiceOnly', reachable: false }, 'serviceOnly'],
    ['a soft opt-in that cannot be used: the guest withdrew it', { hasAddress: true, basis: 'SoftOptIn', reachable: false }, 'unsubscribed'],
    ['an address with no basis at all', { hasAddress: true, basis: 'None', reachable: false }, 'noContact'],
    ['no address', { hasAddress: false, basis: 'None', reachable: false }, 'noContact'],
    ['a contact that opted out', { hasAddress: true, basis: 'Consent', reachable: false, suppressed: true }, 'unsubscribed'],
    ['the forward address of a channel', { hasAddress: true, basis: 'ServiceOnly', reachable: false, otaForward: true }, 'serviceOnly'],
  ] as const)('%s', (_name, facts, expected) => {
    expect(contactStateOf(facts)).toBe(expected);
  });

  it('contactStateOf_AGuestWhoOptedOut_IsNeverReachableWhateverTheBasis', () => {
    // The rule that matters: an opt-out wins over a consent, even one the list still counts as reachable.
    expect(contactStateOf({ hasAddress: true, basis: 'Consent', reachable: true, suppressed: true })).toBe('unsubscribed');
  });
});

describe('ContactStateBadge', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it.each(['it', 'en'])('says every state with a word and a tooltip in plain words (%s)', async (language) => {
    await i18n.changeLanguage(language);
    for (const state of STATES) {
      const { unmount } = render(
        <I18nextProvider i18n={i18n}>
          <ContactStateBadge state={state} />
        </I18nextProvider>,
      );

      const badge = screen.getByTestId('contact-state-badge');
      expect(badge).toHaveAttribute('data-state', state);
      // A word, and an explanation that is a sentence of its own: never an unresolved key.
      expect(badge.textContent).toBeTruthy();
      expect(badge.textContent).not.toMatch(/^crm\./);
      expect(badge.getAttribute('title')).toBeTruthy();
      expect(badge.getAttribute('title')).not.toMatch(/^crm\./);
      expect(badge.getAttribute('title')!.length).toBeGreaterThan(40);
      unmount();
    }
  });

  it('shows the words of the state in the language of the app', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ContactStateBadge state="toConfirm" />
      </I18nextProvider>,
    );
    expect(screen.getByText('Da confermare')).toBeInTheDocument();

    await i18n.changeLanguage('en');
    expect(await screen.findByText('To confirm')).toBeInTheDocument();
  });
});
