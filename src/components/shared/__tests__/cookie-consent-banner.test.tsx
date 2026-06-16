import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
