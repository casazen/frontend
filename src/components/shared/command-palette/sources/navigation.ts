import { getNavMatchEntries, type RouteManifestEntry } from '@/config/route-manifest';
import { getNavIcon } from '@/lib/nav-icons';
import { getNavLabel } from '@/lib/nav-labels';
import type { CommandContext, CommandItem, CommandSource } from '../types';
import { splitKeywords } from './availability';

/**
 * Other words that find a page besides its name (`commandPalette.keywords.*`, separated by `|`), by the `navKey` of its entry
 * in the route manifest: "oggi" finds the dashboard, "stripe" finds the page of the online payments. A page that has none
 * is found by its name. The keys are written out so that the i18n test finds a missing translation.
 */
const PAGE_KEYWORDS: ReadonlyArray<{ navKey: string; keywordsKey: string }> = [
  { navKey: 'nav.alloggiati', keywordsKey: 'commandPalette.keywords.alloggiati' },
  { navKey: 'nav.bookings', keywordsKey: 'commandPalette.keywords.bookings' },
  { navKey: 'nav.calendar', keywordsKey: 'commandPalette.keywords.calendar' },
  { navKey: 'nav.cin', keywordsKey: 'commandPalette.keywords.cin' },
  { navKey: 'nav.compliance', keywordsKey: 'commandPalette.keywords.compliance' },
  { navKey: 'nav.complianceAudit', keywordsKey: 'commandPalette.keywords.complianceAudit' },
  { navKey: 'nav.dashboard', keywordsKey: 'commandPalette.keywords.dashboard' },
  { navKey: 'nav.directBooking', keywordsKey: 'commandPalette.keywords.directBooking' },
  { navKey: 'nav.domain', keywordsKey: 'commandPalette.keywords.domain' },
  { navKey: 'nav.fiscal', keywordsKey: 'commandPalette.keywords.fiscal' },
  { navKey: 'nav.guests', keywordsKey: 'commandPalette.keywords.guests' },
  { navKey: 'nav.inviteSupplier', keywordsKey: 'commandPalette.keywords.inviteSupplier' },
  { navKey: 'nav.jobs', keywordsKey: 'commandPalette.keywords.jobs' },
  { navKey: 'nav.leases', keywordsKey: 'commandPalette.keywords.leases' },
  { navKey: 'nav.ltrReferenceData', keywordsKey: 'commandPalette.keywords.ltrReferenceData' },
  { navKey: 'nav.marketing', keywordsKey: 'commandPalette.keywords.marketing' },
  { navKey: 'nav.marketplace', keywordsKey: 'commandPalette.keywords.marketplace' },
  { navKey: 'nav.organization', keywordsKey: 'commandPalette.keywords.organization' },
  { navKey: 'nav.ota', keywordsKey: 'commandPalette.keywords.ota' },
  { navKey: 'nav.payments', keywordsKey: 'commandPalette.keywords.payments' },
  { navKey: 'nav.profile', keywordsKey: 'commandPalette.keywords.profile' },
  { navKey: 'nav.properties', keywordsKey: 'commandPalette.keywords.properties' },
  { navKey: 'nav.revenue', keywordsKey: 'commandPalette.keywords.revenue' },
  { navKey: 'nav.seo', keywordsKey: 'commandPalette.keywords.seo' },
  { navKey: 'nav.siteAppearance', keywordsKey: 'commandPalette.keywords.siteAppearance' },
  { navKey: 'nav.siteDocuments', keywordsKey: 'commandPalette.keywords.siteDocuments' },
  { navKey: 'nav.stripeConnect', keywordsKey: 'commandPalette.keywords.stripeConnect' },
  { navKey: 'nav.supplierAvailability', keywordsKey: 'commandPalette.keywords.supplierAvailability' },
  { navKey: 'nav.supplierCalendar', keywordsKey: 'commandPalette.keywords.supplierCalendar' },
  { navKey: 'nav.supplierDashboard', keywordsKey: 'commandPalette.keywords.supplierDashboard' },
  { navKey: 'nav.supplierHelpIcal', keywordsKey: 'commandPalette.keywords.supplierHelpIcal' },
  { navKey: 'nav.supplierInbox', keywordsKey: 'commandPalette.keywords.supplierInbox' },
  { navKey: 'nav.supplierShowcase', keywordsKey: 'commandPalette.keywords.supplierShowcase' },
  { navKey: 'nav.suppliers', keywordsKey: 'commandPalette.keywords.suppliers' },
  { navKey: 'nav.taxRates', keywordsKey: 'commandPalette.keywords.taxRates' },
  { navKey: 'nav.users', keywordsKey: 'commandPalette.keywords.users' },
];

const KEYWORDS_BY_NAV_KEY = new Map(PAGE_KEYWORDS.map(({ navKey, keywordsKey }) => [navKey, keywordsKey]));

function keywordsOf(entry: RouteManifestEntry, context: CommandContext): string[] {
  const key = entry.navKey ? KEYWORDS_BY_NAV_KEY.get(entry.navKey) : undefined;
  return key ? splitKeywords(context.t(key)) : [];
}

/**
 * The pages of the app, from the same place the menus read them: for every area the user can open, the entries that area's
 * sidebar shows (the main menu and "Altro") and the pages that hang from them, filtered by the same test of permissions,
 * role and feature flags (`getNavMatchEntries`). A page the menu would not show is not here. A page that hangs from another
 * (Alloggiati from Adempimenti) says so in its second line, and with more than one area every page says in which.
 */
function navigationCommands(context: CommandContext): CommandItem[] {
  const severalAreas = context.areas.length > 1;
  const items: CommandItem[] = [];

  for (const area of context.areas) {
    const entries = getNavMatchEntries(area.key, context.hasPermission, context.flags);
    for (const entry of entries) {
      const parent = entry.navParent ? entries.find((candidate) => candidate.path === entry.navParent) : undefined;
      const where = [parent ? getNavLabel(parent, context.t) : '', severalAreas ? context.t(area.nameKey) : ''].filter(Boolean);
      items.push({
        id: `page:${entry.path}`,
        kind: 'page',
        label: getNavLabel(entry, context.t),
        subtitle: where.length > 0 ? where.join(' · ') : undefined,
        keywords: keywordsOf(entry, context),
        icon: getNavIcon(entry.icon),
        to: entry.path,
        area: area.key,
      });
    }
  }

  return items;
}

export const navigationSource: CommandSource = { id: 'navigation', getItems: navigationCommands };
