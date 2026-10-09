import { expect, type Page } from '@playwright/test';

/**
 * The menu of the profile in the header (UI-05): the avatar opens it. Language and "Esci" are in it, no longer in the header
 * itself, and a phone reaches the pages through "Altro" of the bottom bar instead of a menu button.
 */

/** The avatar of the header: there is one, and the only button of the header with a menu, in every shell. */
export const profileMenuTrigger = (page: Page) => page.locator('header button[aria-haspopup="menu"]');

/** Opens the profile menu and returns it. */
export async function openProfileMenu(page: Page) {
  await profileMenuTrigger(page).click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  return menu;
}

/** Chooses a language in the profile menu: the names are written in the language itself, whatever the current one is. */
export async function chooseLanguage(page: Page, language: 'Italiano' | 'English') {
  const menu = await openProfileMenu(page);
  await menu.getByRole('menuitemradio', { name: language }).click();
  await expect(menu).toBeHidden();
}

/** "Altro" of the bottom bar of a phone, which opens the sheet with the menu (the language of the page is the Italian one). */
export const moreOfTheBar = (page: Page) => page.locator('[data-more-trigger]');
