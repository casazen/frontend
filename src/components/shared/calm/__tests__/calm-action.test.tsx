import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { CalmActionButton, type CalmAction } from '../calm-action';

function Arrived() {
  const location = useLocation();
  return <p data-testid="arrived">{`${location.pathname}${location.search}|${JSON.stringify(location.state)}`}</p>;
}

function renderAction(action: CalmAction) {
  return render(
    <MemoryRouter initialEntries={['/start']}>
      <Routes>
        <Route path="/start" element={<CalmActionButton action={action} />} />
        <Route path="*" element={<Arrived />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CalmActionButton (UI-16)', () => {
  afterEach(() => {
    cleanup();
  });

  it('CalmActionButton_OnClick_IsAButtonThatRunsTheAction', () => {
    const onClick = vi.fn();
    renderAction({ label: 'Registra', onClick, testId: 'go' });

    const button = screen.getByRole('button', { name: 'Registra' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('data-testid', 'go');
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('CalmActionButton_PathOfTheApp_IsALinkOfTheRouterThatKeepsTheStateOfTheLink', () => {
    renderAction({ label: 'Apri', href: '/app/long-rent/contracts?tab=dati', state: { completeStep: true }, testId: 'open' });

    const link = screen.getByRole('link', { name: 'Apri' });
    expect(link).toHaveAttribute('href', '/app/long-rent/contracts?tab=dati');
    expect(link).toHaveAttribute('data-testid', 'open');
    fireEvent.click(link);

    // The page changed without a reload, and the next page received the state.
    expect(screen.getByTestId('arrived')).toHaveTextContent('/app/long-rent/contracts?tab=dati|{"completeStep":true}');
  });

  it.each(['https://example.com/aiuto', 'mailto:aiuto@example.com', 'tel:+390800000000', '//example.com/aiuto'])(
    'CalmActionButton_AddressOutsideTheApp_%s_IsAPlainLink',
    (href) => {
      renderAction({ label: 'Aiuto', href });

      const link = screen.getByRole('link', { name: 'Aiuto' });
      expect(link).toHaveAttribute('href', href);
    },
  );

  it('CalmActionButton_AriaLabel_NamesTheActionBeyondItsLabel', () => {
    renderAction({ label: 'Apri', ariaLabel: 'Apri: contratto Rossi', onClick: () => undefined });

    expect(screen.getByRole('button', { name: 'Apri: contratto Rossi' })).toHaveTextContent('Apri');
  });

  it('CalmActionButton_Always_HasAHitAreaOf44PxAndLetsALongLabelWrap', () => {
    renderAction({ label: 'Un testo molto lungo che deve andare a capo', onClick: () => undefined });

    expect(screen.getByRole('button')).toHaveClass('min-h-11', 'h-auto', 'whitespace-normal');
  });
});
