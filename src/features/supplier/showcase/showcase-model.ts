import type { ShowcaseBlockedBy, ShowcaseContent, ShowcaseDocument, ShowcaseReadinessItem, ShowcaseState } from '@/types/supplier-showcase';

/** Where the supplier turns the payments on: the answers' tab of its settings has the payments account (SP-16c-b). */
export const PAYMENTS_SETTINGS_PATH = '/app/supplier/settings?tab=pagamenti';

/** The page of the editor in the console (the route of the menu "Vetrina"). */
const SHOWCASE_PATH = '/app/supplier/showcase';

/**
 * The steps of the editor a panel exists for, in the order they are taken (`?step=style|works|texts|services|publish`; the others come
 * with their panels). A target that names a step with no panel is not offered as a link: a link must lead somewhere.
 */
export const EDITOR_STEPS = ['style', 'texts', 'publish'] as const;
export type EditorStep = (typeof EDITOR_STEPS)[number];

/** The step an address asks for, or null (the overview) when it names none that exists. */
export function editorStepOf(value: string | null): EditorStep | null {
  return EDITOR_STEPS.find((step) => step === value) ?? null;
}

/** The address of a step of the editor. */
export function stepPath(step: EditorStep): string {
  return `${SHOWCASE_PATH}?step=${step}`;
}

/** The address of the overview. */
export const OVERVIEW_PATH = SHOWCASE_PATH;

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

/** A row of the texts the server would refuse at publication because it is half filled: which list and which row (the guarantee is one). */
export interface HalfFilledRow {
  section: 'team' | 'certs' | 'faq' | 'guarantee';
  index: number;
}

const filled = (value: string | null | undefined) => (value ?? '').trim() !== '';

/**
 * The rows the publication would refuse (`ShowcaseContentRules.ForPublication`, SP-13a): a person with a role and no name, a
 * certification with a detail and no name, a question without its answer or an answer without its question, a guarantee with only one of
 * title and text. An empty row is not one of them (it is dropped). The server judges again: this is to say it before, not instead.
 */
export function halfFilledRows(doc: ShowcaseDocument): HalfFilledRow[] {
  const rows: HalfFilledRow[] = [];
  (doc.team ?? []).forEach((member, index) => {
    if (filled(member.role) && !filled(member.name)) rows.push({ section: 'team', index });
  });
  (doc.certs ?? []).forEach((cert, index) => {
    if (filled(cert.detail) && !filled(cert.label)) rows.push({ section: 'certs', index });
  });
  (doc.faq ?? []).forEach((row, index) => {
    if (filled(row.q) !== filled(row.a)) rows.push({ section: 'faq', index });
  });
  if (doc.guarantee && filled(doc.guarantee.title) !== filled(doc.guarantee.text)) rows.push({ section: 'guarantee', index: 0 });
  return rows;
}

/** The page where an item is fixed, or null when it is a step of the editor that has no page yet. */
export function fixPathOf(item: ShowcaseReadinessItem): string | null {
  const [, query = ''] = item.target.split('?');
  const step = new URLSearchParams(query).get('step');
  if (step && !editorStepOf(step)) return null;
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
