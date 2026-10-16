import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import i18n from '@/i18n/config';
import { ErrorBoundary } from '../error-boundary';

function Bomb(): never {
  throw new Error('the part failed');
}

describe('ErrorBoundary', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('ErrorBoundary_ChildrenThatDoNotFail_AreShown', () => {
    render(
      <ErrorBoundary>
        <p>tutto bene</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText('tutto bene')).toBeInTheDocument();
  });

  it('ErrorBoundary_AChildThatFails_ShowsTheFullPageMessageWithItsError', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText('the part failed')).toBeInTheDocument();
  });

  it('ErrorBoundary_FallbackRender_ShowsWhatTheCallerSaysForAPartThatFailsAlone', () => {
    render(
      <div>
        <p>il resto della pagina</p>
        <ErrorBoundary fallbackRender={(error) => <p role="alert">Non riesco a mostrarlo: {error.message}</p>}>
          <Bomb />
        </ErrorBoundary>
      </div>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Non riesco a mostrarlo: the part failed');
    expect(screen.getByText('il resto della pagina')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });
});
