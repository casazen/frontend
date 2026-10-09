import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { EmptyState } from '../empty-state';

afterEach(cleanup);

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

function renderState(props: Partial<React.ComponentProps<typeof EmptyState>> = {}) {
  return render(
    <MemoryRouter initialEntries={['/start']}>
      <EmptyState icon={Inbox} title="Nessuna prenotazione" description="Qui compariranno le prenotazioni." {...props} />
      <Where />
    </MemoryRouter>,
  );
}

describe('EmptyState (existing usage)', () => {
  it('EmptyState_TitleDescriptionAndOnClickAction_RenderAsBefore', () => {
    const onClick = vi.fn();
    renderState({ action: { label: 'Crea prenotazione', onClick } });

    expect(screen.getByRole('heading', { level: 3, name: 'Nessuna prenotazione' })).toBeInTheDocument();
    expect(screen.getByText('Qui compariranno le prenotazioni.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Crea prenotazione' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('EmptyState_NoAction_ShowsNoButtonsAndNoLinks', () => {
    renderState();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('EmptyState_ClassName_IsAppended', () => {
    const { container } = renderState({ className: 'py-4' });

    expect(container.querySelector('h3')?.parentElement).toHaveClass('py-4', 'text-center');
  });
});

describe('EmptyState actions', () => {
  it('EmptyState_ActionWithInternalHref_IsARouterLinkStyledAsAButton', () => {
    renderState({ action: { label: 'Crea prenotazione', href: '/app/short-rent/bookings/create' } });

    const link = screen.getByRole('link', { name: 'Crea prenotazione' });
    expect(link).toHaveAttribute('href', '/app/short-rent/bookings/create');
    expect(link).toHaveClass('bg-primary');

    fireEvent.click(link);
    expect(screen.getByTestId('where')).toHaveTextContent('/app/short-rent/bookings/create');
  });

  it('EmptyState_ActionWithExternalHref_IsAPlainLink', () => {
    renderState({ action: { label: 'Leggi la guida', href: 'https://example.com/guida' } });

    const link = screen.getByRole('link', { name: 'Leggi la guida' });
    expect(link).toHaveAttribute('href', 'https://example.com/guida');
    // jsdom cannot leave the page: the click is cancelled here, what matters is that the router did not take it.
    link.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(link);
    expect(screen.getByTestId('where')).toHaveTextContent('/start');
  });

  it('EmptyState_ProtocolRelativeHref_IsNotTreatedAsAnInternalPath', () => {
    renderState({ action: { label: 'Altrove', href: '//example.com/x' } });

    expect(screen.getByRole('link', { name: 'Altrove' })).toHaveAttribute('href', '//example.com/x');
  });

  it('EmptyState_ActionWithHrefAndOnClick_RunsBoth', () => {
    const onClick = vi.fn();
    renderState({ action: { label: 'Vai', href: '/app/dove', onClick } });

    fireEvent.click(screen.getByRole('link', { name: 'Vai' }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('where')).toHaveTextContent('/app/dove');
  });

  it('EmptyState_SecondaryAction_IsQuieterAndWorks', () => {
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();
    renderState({
      action: { label: 'Aggiungi', onClick: onPrimary },
      secondaryAction: { label: 'Importa da file', onClick: onSecondary },
    });

    expect(screen.getByRole('button', { name: 'Aggiungi' })).toHaveClass('bg-primary');
    const secondary = screen.getByRole('button', { name: 'Importa da file' });
    expect(secondary).toHaveClass('border-input');
    expect(secondary).not.toHaveClass('bg-primary');

    fireEvent.click(secondary);
    expect(onSecondary).toHaveBeenCalledTimes(1);
    expect(onPrimary).not.toHaveBeenCalled();
  });

  it('EmptyState_SecondaryActionWithHref_IsALink', () => {
    renderState({ secondaryAction: { label: 'Vedi gli esempi', href: '/app/esempi' } });

    expect(screen.getByRole('link', { name: 'Vedi gli esempi' })).toHaveAttribute('href', '/app/esempi');
  });
});

describe('EmptyState help and sample data', () => {
  it('EmptyState_HelpLink_PointsToHowItWorks', () => {
    renderState({ helpLink: { label: 'Come funziona', href: '/help/prenotazioni' } });

    const link = screen.getByRole('link', { name: 'Come funziona' });
    expect(link).toHaveAttribute('href', '/help/prenotazioni');
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('EmptyState_HelpLinkExternal_IsAPlainLink', () => {
    renderState({ helpLink: { label: 'Come funziona', href: 'https://example.com/aiuto' } });

    expect(screen.getByRole('link', { name: 'Come funziona' })).toHaveAttribute('href', 'https://example.com/aiuto');
  });

  it('EmptyState_SampleDataSlot_IsRenderedAsItComes', () => {
    const onTry = vi.fn();
    renderState({
      action: { label: 'Aggiungi', onClick: vi.fn() },
      sampleData: (
        <button type="button" onClick={onTry}>
          Prova con dati di esempio
        </button>
      ),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Prova con dati di esempio' }));
    expect(onTry).toHaveBeenCalledTimes(1);
  });

  it('EmptyState_HelpLinkAndSampleData_SitTogetherAfterTheActions', () => {
    renderState({
      action: { label: 'Aggiungi', onClick: vi.fn() },
      helpLink: { label: 'Come funziona', href: '/help' },
      sampleData: <button type="button">Prova con dati di esempio</button>,
    });

    const help = screen.getByRole('link', { name: 'Come funziona' });
    const sample = screen.getByRole('button', { name: 'Prova con dati di esempio' });
    const add = screen.getByRole('button', { name: 'Aggiungi' });
    expect(help.parentElement).toBe(sample.parentElement);
    expect(add.compareDocumentPosition(help) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('EmptyState_NoHelpNoSample_HasNoExtraRow', () => {
    const { container } = renderState({ action: { label: 'Aggiungi', onClick: vi.fn() } });

    // icon box, title, description, actions: nothing else.
    expect(container.querySelector('h3')?.parentElement?.children).toHaveLength(4);
  });
});
