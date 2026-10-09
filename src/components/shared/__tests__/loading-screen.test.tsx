import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AppShellContext } from '@/components/layout/app-shell-context';
import { LoadingScreen } from '../loading-screen';

describe('LoadingScreen', () => {
  afterEach(() => {
    cleanup();
  });

  it('LoadingScreen_Default_FillsTheViewportAsBefore', () => {
    const { container } = render(<LoadingScreen message="Caricamento area" />);

    expect(container.firstElementChild).toHaveClass('flex', 'h-screen', 'items-center', 'justify-center');
    expect(screen.getByText('Caricamento area')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  // Inside the content region of the shell, which scrolls with the window, a spinner as tall as the viewport would add
  // a scroll bar of its own (UI-03). Page loaders (booking detail, alloggiati, admin profile) must not have to opt in.
  it('LoadingScreen_InsideTheShell_FillsTheContentRegionNotTheViewport', () => {
    const { container } = render(
      <AppShellContext.Provider value={{ contextKey: 'short-rent' }}>
        <LoadingScreen message="Caricamento prenotazione" />
      </AppShellContext.Provider>,
    );

    const root = container.firstElementChild;
    expect(root).toHaveClass('flex-1', 'h-auto', 'items-center', 'justify-center');
    expect(root).not.toHaveClass('h-screen');
    expect(screen.getByText('Caricamento prenotazione')).toBeInTheDocument();
  });

  it('LoadingScreen_ClassNameGiven_ReplacesTheViewportHeight', () => {
    const { container } = render(<LoadingScreen className="h-auto flex-1" />);

    const root = container.firstElementChild;
    expect(root).toHaveClass('flex-1', 'h-auto', 'items-center', 'justify-center');
    expect(root).not.toHaveClass('h-screen');
  });
});
