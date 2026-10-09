import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PageHeader } from '../page-header';

describe('PageHeader (UI-04a CI fix)', () => {
  afterEach(() => {
    cleanup();
  });

  it('PageHeader_TitleDescriptionAndAction_ShowsAllThree', () => {
    render(<PageHeader title="Cruscotto" description="Benvenuto in CASAZEN" action={<button type="button">Nuova</button>} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Cruscotto' })).toBeInTheDocument();
    expect(screen.getByText('Benvenuto in CASAZEN')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuova' })).toBeInTheDocument();
  });

  it('PageHeader_OnlyTheTitle_ShowsNoDescriptionAndNoActionBox', () => {
    const { container } = render(<PageHeader title="Ospiti" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Ospiti' })).toBeInTheDocument();
    expect(container.querySelector('p')).toBeNull();
    // The row holds the text block only: no empty box for an action that is not there.
    expect(container.firstElementChild?.children).toHaveLength(1);
  });

  it('PageHeader_ControlsDoNotFitBesideTheText_WrapUnderItInsteadOfPushingOutOfAPhone', () => {
    // jsdom has no layout: this guards the classes that make the header fit a phone with any font (the real check, at
    // 360 and 390 px with wider letters, is e2e/page-header-reflow.spec.ts).
    const { container } = render(
      <PageHeader title="Cruscotto" description="Benvenuto" action={<button type="button">Periodo</button>} />,
    );

    const row = container.firstElementChild as HTMLElement;
    const text = screen.getByRole('heading', { level: 1 }).parentElement as HTMLElement;
    const controls = screen.getByRole('button', { name: 'Periodo' }).parentElement as HTMLElement;

    // The controls go to the next line when the text would keep less than 14rem.
    expect(row).toHaveClass('flex', 'flex-wrap');
    expect(text).toHaveClass('min-w-0', 'grow', 'basis-56');
    // Neither block can be wider than the screen, and a word longer than the screen breaks.
    expect(controls).toHaveClass('min-w-0', 'max-w-full');
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('break-words');
    expect(screen.getByText('Benvenuto')).toHaveClass('break-words');
  });
});
