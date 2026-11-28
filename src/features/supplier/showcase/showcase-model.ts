import type { ShowcaseBlockedBy, ShowcaseContent, ShowcaseDocument, ShowcaseReadinessItem, ShowcaseState } from '@/types/supplier-showcase';

export const PAYMENTS_SETTINGS_PATH = '/app/supplier/settings?tab=pagamenti';

export const SERVICES_PATH = '/app/supplier/services';

const SHOWCASE_PATH = '/app/supplier/showcase';

export const EDITOR_STEPS = ['style', 'works', 'texts', 'services', 'publish'] as const;
export type EditorStep = (typeof EDITOR_STEPS)[number];

export function editorStepOf(value: string | null): EditorStep | null {
  return EDITOR_STEPS.find((step) => step === value) ?? null;
}

export function stepPath(step: EditorStep): string {
  return `${SHOWCASE_PATH}?step=${step}`;
}

export const OVERVIEW_PATH = SHOWCASE_PATH;

export const WIZARD_PATH = `${SHOWCASE_PATH}/publish`;

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

export function changeLabelKey(member: string): string | null {
  return CHANGE_MEMBERS.includes(member) ? `supplier.showcase.changes.${member}` : null;
}

export function itemsToFix(content: ShowcaseContent): ShowcaseReadinessItem[] {
  return content.readiness.items.filter((item) => item.level !== 'ok').sort((a, b) => Number(b.required) - Number(a.required));
}

/** A row of the texts the server would refuse at publication because it is half filled: which list and which row (the guarantee is one). */
export interface HalfFilledRow {
  section: 'team' | 'certs' | 'faq' | 'guarantee' | 'gallery';
  index: number;
}

export function stepOfRow(row: HalfFilledRow): EditorStep {
  return row.section === 'gallery' ? 'works' : 'texts';
}

const filled = (value: string | null | undefined) => (value ?? '').trim() !== '';

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
  (doc.gallery ?? []).forEach((work, index) => {
    if (!filled(work.photoUrl) && (filled(work.beforeUrl) || filled(work.caption) || filled(work.place) || filled(work.alt))) {
      rows.push({ section: 'gallery', index });
    }
  });
  return rows;
}

export function fixPathOf(item: ShowcaseReadinessItem): string | null {
  const [, query = ''] = item.target.split('?');
  const step = new URLSearchParams(query).get('step');
  if (step && !editorStepOf(step)) return null;
  return item.target.startsWith('/') ? item.target : null;
}

export function firstFixable(content: ShowcaseContent): { item: ShowcaseReadinessItem; path: string } | null {
  for (const item of itemsToFix(content)) {
    const path = fixPathOf(item);
    if (item.level === 'todo' && path) return { item, path };
  }
  return null;
}

export function bookingsReasonKey(blockedBy: readonly ShowcaseBlockedBy[]): string | null {
  const first = blockedBy[0];
  return first ? `supplier.showcase.bookings.${first}` : null;
}

export function shareMessage(url: string, bookingsOpen: boolean, t: (key: string, options?: Record<string, unknown>) => string): string {
  return t(bookingsOpen ? 'supplier.showcase.share.messageBookable' : 'supplier.showcase.share.message', { url });
}
