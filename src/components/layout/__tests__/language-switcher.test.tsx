import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import { LanguageSwitcher } from '../language-switcher';

const italian = () => screen.getByRole('button', { name: "Passa all'italiano" });
const english = () => screen.getByRole('button', { name: "Passa all'inglese" });

describe('LanguageSwitcher (UI-05)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('LanguageSwitcher_Rendered_IsAGroupNamedLinguaWithTheCurrentLanguagePressed', () => {
    render(<LanguageSwitcher />);

    const group = screen.getByRole('group', { name: 'Lingua' });
    expect(group).toHaveAttribute('data-testid', 'language-switcher');
    expect(within(group).getAllByRole('button')).toHaveLength(2);
    expect(italian()).toHaveAttribute('aria-pressed', 'true');
    expect(english()).toHaveAttribute('aria-pressed', 'false');
  });

  it('LanguageSwitcher_EachButton_IsAtLeast44PixelsTallAndWideForAFinger', () => {
    render(<LanguageSwitcher />);

    // They were `h-7` (28 px).
    for (const button of [italian(), english()]) {
      expect(button).toHaveClass('min-h-11', 'min-w-11');
      expect(button).not.toHaveClass('h-7');
    }
  });

  it('LanguageSwitcher_ChoosingEnglish_ChangesTheLanguageKeepsTheChoiceAndPressesTheOtherButton', async () => {
    render(<LanguageSwitcher />);

    fireEvent.click(english());

    await waitFor(() => expect(i18n.language).toBe('en'));
    expect(localStorage.getItem('casazen.locale')).toBe('en');
    expect(screen.getByRole('button', { name: 'Switch to English' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Switch to Italian' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('LanguageSwitcher_ChoosingTheLanguageInUse_ChangesNothing', () => {
    render(<LanguageSwitcher />);

    fireEvent.click(italian());

    expect(i18n.language).toBe('it');
    expect(localStorage.getItem('casazen.locale')).toBeNull();
  });
});
