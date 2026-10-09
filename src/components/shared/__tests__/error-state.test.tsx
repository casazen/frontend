import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from '@/i18n/config';
import { ErrorState } from '../error-state';

// The e-mail comes from the build configuration (VITE_SUPPORT_EMAIL); the tests choose it.
const support = vi.hoisted(() => ({ email: null as string | null }));
vi.mock('@/config/support.config', () => ({ supportConfig: support }));

beforeEach(async () => {
  support.email = null;
  await i18n.changeLanguage('it');
});

afterEach(cleanup);

describe('ErrorState (existing usage)', () => {
  it('ErrorState_TitleAndRetry_RenderAsBefore', () => {
    const onRetry = vi.fn();
    render(<ErrorState title="Impossibile caricare le richieste" onRetry={onRetry} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('data-testid', 'error-state');
    expect(alert).toHaveTextContent('Impossibile caricare le richieste');
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('ErrorState_NoRetryHandler_ShowsNoButton', () => {
    render(<ErrorState title="Impossibile caricare" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('ErrorState_TestId_CanBeReplaced', () => {
    render(<ErrorState title="Impossibile caricare" testId="requests-error" />);

    expect(screen.getByTestId('requests-error')).toBeInTheDocument();
  });

  it('ErrorState_ConfiguredEmail_IsNotShownUnlessAskedFor', () => {
    support.email = 'aiuto@casazen.test';
    render(<ErrorState title="Impossibile caricare" onRetry={vi.fn()} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText(/aiuto@casazen\.test/)).not.toBeInTheDocument();
  });
});

describe('ErrorState support reference', () => {
  it('ErrorState_ShowSupportWithConfiguredEmail_OffersAMailtoLinkAfterTheRetry', () => {
    support.email = 'aiuto@casazen.test';
    render(<ErrorState title="Impossibile caricare" onRetry={vi.fn()} showSupport />);

    const link = screen.getByRole('link', { name: 'aiuto@casazen.test' });
    expect(link).toHaveAttribute('href', 'mailto:aiuto@casazen.test');
    expect(link.parentElement).toHaveTextContent('Se il problema continua, scrivi al supporto: aiuto@casazen.test');
    expect(screen.getByRole('button', { name: 'Riprova' }).compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('ErrorState_ShowSupportWithoutConfiguredEmail_ShowsNothingAndInventsNothing', () => {
    support.email = null;
    render(<ErrorState title="Impossibile caricare" onRetry={vi.fn()} showSupport />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    const text = screen.getByRole('alert').textContent ?? '';
    expect(text).not.toMatch(/supporto|support|tel|chat|@/i);
  });

  it('ErrorState_ShowSupport_FollowsTheLanguage', async () => {
    support.email = 'aiuto@casazen.test';
    render(<ErrorState title="Could not load" onRetry={vi.fn()} showSupport />);

    await act(async () => {
      await i18n.changeLanguage('en');
    });

    expect(screen.getByRole('alert')).toHaveTextContent('If the problem continues, write to support: aiuto@casazen.test');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('ErrorState_ShowSupportWithoutRetry_StillShowsTheContact', () => {
    support.email = 'aiuto@casazen.test';
    render(<ErrorState title="Impossibile caricare" showSupport />);

    expect(screen.getByRole('link', { name: 'aiuto@casazen.test' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
