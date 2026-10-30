import type { ShowcaseBlockedBy, ShowcaseContent, ShowcaseReadinessItem, ShowcaseState } from '@/types/supplier-showcase';

/** Where the supplier turns the payments on: the answers' tab of its settings has the payments account (SP-16c-b). */
export const PAYMENTS_SETTINGS_PATH = '/app/supplier/settings?tab=pagamenti';

/**
 * The steps of the editor that a page exists for (`?step=style|works|texts|services|publish`). A target that names a step with no
 * page yet is not offered as a link: the editor grows step by step and a link must lead somewhere.
 */
const EDITOR_STEPS: readonly string[] = [];

/** The state as the person reads it: the label (a key), and the tone of its badge. */
export interface StateView {
  labelKey: string;
  tone: 'neutral' | 'success' | 'warning' | 'info';
}

export function stateView(state: ShowcaseState): StateView {
  switch (state) {
    case 'Online':
      return { labelKey: 'supplier.showcase.state.online', tone: 'success' };
    case 'ChangesReady':
      return { labelKey: 'supplier.showcase.state.changes', tone: 'warning' };
    case 'Paused':
      return { labelKey: 'supplier.showcase.state.paused', tone: 'info' };
    case 'Draft':
      return { labelKey: 'supplier.showcase.state.draft', tone: 'neutral' };
  }
}

/** The members of the content the server can list in `changes`, each with a name of its own in the texts. */
const CHANGE_MEMBERS: readonly string[] = [
  'style',
  'font',
  'color',
  'logo',
  'cover',
  'tagline',
  'intro',
  'bio',
  'team',
  'values',
  'guarantee',
  'certs',
  'faq',
  'gallery',
  'prep',
  'sections',
  'serviceOrder',
];

/** The key of the text that names a member of the content ("Frase in grande"), or null for a member this page does not know. */
export function changeLabelKey(member: string): string | null {
  return CHANGE_MEMBERS.includes(member) ? `supplier.showcase.changes.${member}` : null;
}

/** What there is to fix before publishing or advised: the readiness items that are not done, the required ones first. */
export function itemsToFix(content: ShowcaseContent): ShowcaseReadinessItem[] {
  return content.readiness.items.filter((item) => item.level !== 'ok').sort((a, b) => Number(b.required) - Number(a.required));
}

/** The page where an item is fixed, or null when it is a step of the editor that has no page yet. */
export function fixPathOf(item: ShowcaseReadinessItem): string | null {
  const [, query = ''] = item.target.split('?');
  const step = new URLSearchParams(query).get('step');
  if (step && !EDITOR_STEPS.includes(step)) return null;
  return item.target.startsWith('/') ? item.target : null;
}

/** The first required item still to do that can be fixed from here. */
export function firstFixable(content: ShowcaseContent): { item: ShowcaseReadinessItem; path: string } | null {
  for (const item of itemsToFix(content)) {
    const path = fixPathOf(item);
    if (item.level === 'todo' && path) return { item, path };
  }
  return null;
}

/** Why the bookings are closed, as a key of the texts: the first reason the server gives. */
export function bookingsReasonKey(blockedBy: readonly ShowcaseBlockedBy[]): string | null {
  const first = blockedBy[0];
  return first ? `supplier.showcase.bookings.${first}` : null;
}

/** The text a supplier sends with the link (WhatsApp and e-mail). No name of its own is in it: it is the supplier who speaks. */
export function shareMessage(url: string, bookingsOpen: boolean, t: (key: string, options?: Record<string, unknown>) => string): string {
  return t(bookingsOpen ? 'supplier.showcase.share.messageBookable' : 'supplier.showcase.share.message', { url });
}
