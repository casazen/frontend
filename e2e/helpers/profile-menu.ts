import { expect, type Page } from '@playwright/test';

/**
 * The menu of the profile in the header (UI-05): the avatar opens it. Language and "Esci" are in it, no longer in the header
 * itself, and a phone reaches the pages through "Altro" of the bottom bar instead of a menu button.
 */

export const profileMenuTrigger = (page: Page) => page.locator('header button[aria-haspopup="menu"]');

export async function openProfileMenu(page: Page) {
  await profileMenuTrigger(page).click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  return menu;
}

export async function chooseLanguage(page: Page, language: 'Italiano' | 'English') {
  const menu = await openProfileMenu(page);
  await menu.getByRole('menuitemradio', { name: language }).click();
  await expect(menu).toBeHidden();
}

export const moreOfTheBar = (page: Page) => page.locator('[data-more-trigger]');
