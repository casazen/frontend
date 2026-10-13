import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import { CommandPaletteTrigger } from '../command-palette-trigger';
import { renderShell } from './palette-harness';

vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: { id: 'u1' }, logout: vi.fn() }) }));

const NAME = 'Cerca immobili, prenotazioni, ospiti, pagine…';

describe('CommandPaletteTrigger: the search of the header (UI-06)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('it');
  });

  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('it');
    vi.restoreAllMocks();
  });

  it('CommandPaletteTrigger_Rendered_IsAButtonThatNamesTheWholeSentenceAndSaysItOpensADialog', () => {
    renderShell();

    const button = screen.getByRole('button', { name: NAME });

    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    // A screen reader is told both shortcuts, whatever the system.
    expect(button).toHaveAttribute('aria-keyshortcuts', 'Control+K Meta+K');
    // The visible words and the name are the same (WCAG 2.5.3, label in name).
    expect(button).toHaveTextContent(NAME);
  });

  it('CommandPaletteTrigger_Shortcut_IsShownForTheSightedAndHiddenFromTheScreenReader', () => {
    renderShell();

    const chip = screen.getByTestId('command-palette-trigger').querySelector('kbd');

    expect(chip).toHaveTextContent('Ctrl K');
    expect(chip).toHaveAttribute('aria-hidden', 'true');
  });

  it('CommandPaletteTrigger_OnAMac_ShowsCommand', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    renderShell();

    expect(screen.getByTestId('command-palette-trigger').querySelector('kbd')).toHaveTextContent('⌘K');
  });

  it('CommandPaletteTrigger_OnAPhone_IsTheMagnifyingGlassAloneWithItsNameForTheScreenReader', () => {
    renderShell();

    const button = screen.getByTestId('command-palette-trigger');

    // 44 px for a finger, and the text becomes a text for assistive technology only; the shortcut is not shown.
    expect(button).toHaveClass('max-md:size-11', 'max-md:min-h-11', 'max-md:justify-center');
    expect(within(button).getByText(NAME)).toHaveClass('max-md:sr-only');
    expect(button.querySelector('kbd')).toHaveClass('max-md:hidden');
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('CommandPaletteTrigger_Click_OpensThePaletteWithTheFocusInTheBox', async () => {
    renderShell();

    fireEvent.click(screen.getByTestId('command-palette-trigger'));

    const palette = await screen.findByRole('dialog', { name: 'Cerca' });
    await waitFor(() => expect(within(palette).getByRole('combobox')).toHaveFocus());
  });

  it('CommandPaletteTrigger_InEnglish_IsInEnglish', async () => {
    await i18n.changeLanguage('en');
    renderShell();

    expect(screen.getByRole('button', { name: 'Search properties, bookings, guests, pages…' })).toBeInTheDocument();
  });

  it('CommandPaletteTrigger_OutsideTheProvider_SaysWhatIsMissing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<CommandPaletteTrigger />)).toThrow('useCommandPalette must be used within CommandPaletteProvider');
  });
});
