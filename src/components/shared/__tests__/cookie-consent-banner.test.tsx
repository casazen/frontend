import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { useCookiePreferencesStore } from '@/store/cookie-preferences-store';
import { CookieConsentBanner } from '../cookie-consent-banner';

const STORAGE_KEY = 'casazen_cookie_consent';

beforeEach(() => {
  localStorage.removeItem(STORAGE_KEY);
});

afterEach(() => {
  localStorage.removeItem(STORAGE_KEY);
});

describe('CookieConsentBanner', () => {
  it('renders on first visit when no consent is stored', () => {
    render(<CookieConsentBanner />);
    expect(screen.getByTestId('cookie-consent-banner')).toBeInTheDocument();
  });

  it('does not render when consent is already accepted', () => {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    render(<CookieConsentBanner />);
    expect(screen.queryByTestId('cookie-consent-banner')).not.toBeInTheDocument();
  });

  it('does not render when consent is already rejected', () => {
    localStorage.setItem(STORAGE_KEY, 'rejected');
    render(<CookieConsentBanner />);
    expect(screen.queryByTestId('cookie-consent-banner')).not.toBeInTheDocument();
  });

  it('persists "accepted" and hides banner when accept button is clicked', () => {
    render(<CookieConsentBanner />);

    const acceptBtn = screen.getByRole('button', { name: 'Accetta' });
    fireEvent.click(acceptBtn);

    expect(screen.queryByTestId('cookie-consent-banner')).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('accepted');
  });

  it('persists "rejected" and hides banner when reject button is clicked', () => {
    render(<CookieConsentBanner />);

    const rejectBtn = screen.getByRole('button', { name: 'Rifiuta' });
    fireEvent.click(rejectBtn);

    expect(screen.queryByTestId('cookie-consent-banner')).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('rejected');
  });

  it('displays informative text about cookie usage', () => {
    render(<CookieConsentBanner />);
    expect(screen.getByText(/cookie/i)).toBeInTheDocument();
  });

  it('has the correct dialog role for accessibility', () => {
    render(<CookieConsentBanner />);
    expect(screen.getByRole('dialog', { name: 'Consenso cookie' })).toBeInTheDocument();
  });
});

// DB-02b: the third answer. What the panel stores decides whether anything is measured, so it is the one thing proved here.
describe('CookieConsentBanner, "Scegli tu" (DB-02b)', () => {
  beforeEach(() => {
    useCookiePreferencesStore.setState({ open: false, opener: null });
  });

  afterEach(() => {
    useCookiePreferencesStore.setState({ open: false, opener: null });
  });

  it('opens the panel with the statistics off, and "Solo i necessari" refuses them', () => {
    render(<CookieConsentBanner />);

    fireEvent.click(screen.getByRole('button', { name: 'Scegli tu' }));

    expect(screen.getByTestId('cookie-preferences')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Necessari' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Statistiche anonime' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Solo i necessari' }));

    expect(localStorage.getItem(STORAGE_KEY)).toBe('rejected');
    expect(screen.queryByTestId('cookie-preferences')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cookie-consent-banner')).not.toBeInTheDocument();
  });

  it('keeps the statistics only if the visitor turned them on', () => {
    render(<CookieConsentBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Scegli tu' }));

    fireEvent.click(screen.getByRole('switch', { name: 'Statistiche anonime' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salva le mie scelte' }));

    expect(localStorage.getItem(STORAGE_KEY)).toBe('accepted');
  });

  it('the footer link opens the panel again after a choice, showing it', () => {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    render(<CookieConsentBanner />);
    expect(screen.queryByTestId('cookie-preferences')).not.toBeInTheDocument();

    act(() => useCookiePreferencesStore.getState().openPreferences());

    expect(screen.getByRole('switch', { name: 'Statistiche anonime' })).toBeChecked();
    fireEvent.click(screen.getByRole('switch', { name: 'Statistiche anonime' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salva le mie scelte' }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('rejected');
  });
});
