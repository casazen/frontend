import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Star } from 'lucide-react';
import { AA_TEXT_CONTRAST, contrastRatio } from '@/lib/public-site-colors';
import { fallbackColor, themeColor } from '@/test/colors';
import { Alert, type AlertVariant } from '../alert';
import { Button } from '../button';

afterEach(cleanup);

const VARIANTS: AlertVariant[] = ['info', 'success', 'warning', 'danger'];

describe('Alert roles', () => {
  it('Alert_Danger_IsAnnouncedAtOnceAsAnAlert', () => {
    render(<Alert variant="danger">Il pagamento non è andato a buon fine.</Alert>);

    expect(screen.getByRole('alert')).toHaveTextContent('Il pagamento non è andato a buon fine.');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it.each(['info', 'success', 'warning'] as const)('Alert_%s_IsAStatusNotAnAlert', (variant) => {
    render(<Alert variant={variant}>Testo</Alert>);

    expect(screen.getByRole('status')).toHaveTextContent('Testo');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('Alert_NoVariant_IsInfo', () => {
    render(<Alert>Testo</Alert>);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('Alert_RoleProp_CanTurnOffTheLiveRegionOfAStaticNotice', () => {
    render(
      <Alert variant="info" role="note">
        Sempre visibile
      </Alert>,
    );

    expect(screen.getByRole('note')).toHaveTextContent('Sempre visibile');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('Alert content', () => {
  it('Alert_TitleTextAndAction_AreAllRendered', () => {
    render(
      <Alert
        variant="warning"
        title="Manca un documento"
        action={
          <Button size="sm" variant="outline">
            Carica ora
          </Button>
        }
      >
        Senza il documento non puoi inviare la comunicazione.
      </Alert>,
    );

    const alert = screen.getByRole('status');
    expect(alert).toHaveTextContent('Manca un documento');
    expect(alert).toHaveTextContent('Senza il documento non puoi inviare la comunicazione.');
    expect(screen.getByRole('button', { name: 'Carica ora' })).toBeInTheDocument();
    expect(screen.getByText('Manca un documento')).toHaveClass('font-semibold');
  });

  it('Alert_OnlyChildren_HasNoTitleNoActionAndNoEmptyBoxes', () => {
    const { container } = render(<Alert>Solo testo</Alert>);

    expect(container.querySelector('p')).toBeNull();
    expect(screen.getByRole('status').querySelectorAll('button')).toHaveLength(0);
    expect(screen.getByRole('status').textContent).toBe('Solo testo');
  });

  it.each(VARIANTS)('Alert_%s_HasADecorativeIcon', (variant) => {
    render(<Alert variant={variant}>Testo</Alert>);

    const icon = screen.getByRole(variant === 'danger' ? 'alert' : 'status').querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('Alert_IconProp_ReplacesTheIconOfTheVariant', () => {
    const { rerender } = render(<Alert variant="info">Testo</Alert>);
    const standard = screen.getByRole('status').querySelector('svg')?.getAttribute('class');

    rerender(
      <Alert variant="info" icon={Star}>
        Testo
      </Alert>,
    );
    const custom = screen.getByRole('status').querySelector('svg');

    expect(custom).toHaveClass('lucide-star');
    expect(standard).not.toContain('lucide-star');
  });

  it('Alert_ClassNameAndDataAttributes_ReachTheBox', () => {
    render(
      <Alert className="mt-4" data-testid="notice">
        Testo
      </Alert>,
    );

    expect(screen.getByTestId('notice')).toHaveClass('mt-4', 'rounded-md');
  });

  it('Alert_LongUnbrokenText_CanBreakInsteadOfOverflowing', () => {
    render(<Alert title="Titolo">Testo</Alert>);

    expect(screen.getByText('Titolo').parentElement).toHaveClass('min-w-0', 'break-words');
  });
});

describe('Alert colors', () => {
  it.each(VARIANTS)('Alert_%s_MeetsAaForTheTextAndTheIcon', (variant) => {
    render(<Alert variant={variant}>Testo</Alert>);

    const box = screen.getByRole(variant === 'danger' ? 'alert' : 'status');
    const soft = fallbackColor(box.className, `${variant}-soft`);
    const iconColor = fallbackColor(box.querySelector('svg')?.getAttribute('class') ?? '', `${variant}-foreground`);

    // The text is the page foreground on the soft background; the icon is graphical but read as text-level (AA).
    expect(contrastRatio(themeColor('foreground'), soft)).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
    expect(contrastRatio(iconColor, soft)).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
  });

  it('Alert_Edge_IsAnInsetRingNotABorder', () => {
    render(<Alert variant="success">Testo</Alert>);

    // `border-*` colors are overridden by a global rule today; an inset ring always draws.
    const box = screen.getByRole('status');
    expect(box).toHaveClass('ring-1', 'ring-inset');
    expect(Array.from(box.classList).filter((c) => /^border(-|$)/.test(c))).toEqual([]);
  });
});
