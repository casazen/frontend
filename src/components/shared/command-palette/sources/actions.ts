import { CalendarPlus, FilePlus, Languages, LifeBuoy, LogOut, PlugZap, Plus, WalletCards, type LucideIcon } from 'lucide-react';
import { getNavIcon } from '@/lib/nav-icons';
import type { AppLocale } from '@/i18n/config';
import type { CommandContext, CommandItem, CommandSource } from '../types';
import { openablePage, splitKeywords } from './availability';

/**
 * The things the user can start from the palette that are a page of their own: to add a booking, a property, a payment, a
 * channel or a lease. Each one points at a page of the route manifest, so it is offered only to who may open that page (the
 * area, the permissions, the feature flag): the palette never offers an action the menu would not let the user finish.
 * The keys are written out so that the i18n test finds a missing translation.
 */
interface QuickAction {
  id: string;
  /** A page of the route manifest. */
  path: string;
  icon: LucideIcon;
  labelKey: string;
  keywordsKey: string;
}

const QUICK_ACTIONS: readonly QuickAction[] = [
  {
    id: 'new-booking',
    path: '/app/short-rent/bookings/create',
    icon: CalendarPlus,
    labelKey: 'commandPalette.actions.newBooking.label',
    keywordsKey: 'commandPalette.actions.newBooking.keywords',
  },
  {
    id: 'new-property',
    path: '/app/short-rent/properties/create',
    icon: Plus,
    labelKey: 'commandPalette.actions.newProperty.label',
    keywordsKey: 'commandPalette.actions.newProperty.keywords',
  },
  {
    id: 'new-payment',
    path: '/app/short-rent/payments/create',
    icon: WalletCards,
    labelKey: 'commandPalette.actions.newPayment.label',
    keywordsKey: 'commandPalette.actions.newPayment.keywords',
  },
  {
    id: 'connect-channel',
    path: '/app/short-rent/ota/create',
    icon: PlugZap,
    labelKey: 'commandPalette.actions.connectChannel.label',
    keywordsKey: 'commandPalette.actions.connectChannel.keywords',
  },
  {
    id: 'new-lease',
    path: '/app/long-rent/leases/new',
    icon: FilePlus,
    labelKey: 'commandPalette.actions.newLease.label',
    keywordsKey: 'commandPalette.actions.newLease.keywords',
  },
  {
    id: 'new-long-rent-property',
    path: '/app/long-rent/properties/new',
    icon: Plus,
    labelKey: 'commandPalette.actions.newProperty.label',
    keywordsKey: 'commandPalette.actions.newProperty.keywords',
  },
];

/** Going to another area: the label says which one ("Vai ad Affitti lunghi"), the keywords are the name of the area and the words for "area". */
const SWITCH_AREA = {
  labelKey: 'commandPalette.actions.switchArea.label',
  keywordsKey: 'commandPalette.actions.switchArea.keywords',
};

/** The language to offer is the other one: its name is the label (the keys exist for the language switch of the profile). */
const SWITCH_LANGUAGE: Record<AppLocale, { labelKey: string; keywordsKey: string }> = {
  en: { labelKey: 'language.switchToEnglish', keywordsKey: 'commandPalette.actions.switchLanguage.keywords' },
  it: { labelKey: 'language.switchToItalian', keywordsKey: 'commandPalette.actions.switchLanguage.keywords' },
};

const SIGN_OUT = { labelKey: 'shared.userMenu.logout', keywordsKey: 'commandPalette.actions.signOut.keywords' };

const SUPPORT = {
  labelKey: 'commandPalette.actions.support.label',
  keywordsKey: 'commandPalette.actions.support.keywords',
};

/**
 * The actions of the palette: start something (a page of the manifest the user may open), go to another area, change the
 * language, sign out, write to the support when the build has an address. There is no "change theme" (the dark theme does
 * not exist yet, UI-10) and no help centre (UI-08 registers its own command when it exists).
 */
function actionCommands(context: CommandContext): CommandItem[] {
  const { t } = context;
  const severalAreas = context.areas.length > 1;
  const items: CommandItem[] = [];

  for (const action of QUICK_ACTIONS) {
    const page = openablePage(context, action.path);
    if (!page) continue;
    const area = context.areas.find((candidate) => candidate.key === page.context);
    items.push({
      id: `action:${action.id}`,
      kind: 'action',
      label: t(action.labelKey),
      subtitle: severalAreas && area ? t(area.nameKey) : undefined,
      keywords: splitKeywords(t(action.keywordsKey)),
      icon: action.icon,
      to: page.path,
      area: page.context,
    });
  }

  for (const area of context.areas) {
    if (area.key === context.activeArea) continue;
    items.push({
      id: `action:switch-area:${area.key}`,
      kind: 'action',
      label: t(SWITCH_AREA.labelKey, { area: t(area.nameKey) }),
      subtitle: t(area.descriptionKey),
      keywords: [t(area.nameKey), ...splitKeywords(t(SWITCH_AREA.keywordsKey))],
      icon: getNavIcon(area.icon),
      to: context.getDefaultRoute(area.key),
      area: area.key,
    });
  }

  const otherLocale: AppLocale = context.locale === 'it' ? 'en' : 'it';
  items.push({
    id: 'action:switch-language',
    kind: 'action',
    label: t(SWITCH_LANGUAGE[otherLocale].labelKey),
    keywords: splitKeywords(t(SWITCH_LANGUAGE[otherLocale].keywordsKey)),
    icon: Languages,
    quiet: true,
    run: () => context.actions.changeLocale(otherLocale),
  });

  const supportEmail = context.supportEmail;
  if (supportEmail) {
    items.push({
      id: 'action:support',
      kind: 'action',
      label: t(SUPPORT.labelKey),
      keywords: splitKeywords(t(SUPPORT.keywordsKey)),
      icon: LifeBuoy,
      quiet: true,
      run: () => context.actions.writeToSupport(supportEmail),
    });
  }

  items.push({
    id: 'action:sign-out',
    kind: 'action',
    label: t(SIGN_OUT.labelKey),
    keywords: splitKeywords(t(SIGN_OUT.keywordsKey)),
    icon: LogOut,
    quiet: true,
    run: context.actions.signOut,
  });

  return items;
}

export const actionsSource: CommandSource = { id: 'actions', getItems: actionCommands };
