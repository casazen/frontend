import { ApiClient } from '@/api/client';
import { bookingsApi } from '@/api/bookings.api';
import { internalActivitiesApi } from '@/api/internal-activities.api';
import { navigationSource } from '@/components/shared/command-palette/sources/navigation';
import { normalizeText, prepareCommands, searchCommands } from '@/components/shared/command-palette/search';
import type { CommandContext } from '@/components/shared/command-palette/types';
import { getManifestEntry, hasEntryPermission, isEntryFeatureEnabled } from '@/config/route-manifest';
import { todoActionRoute } from '@/features/todo/activity-card';
import { isTruncatedList, typeTitle } from '@/features/todo/lib/todo-model';
import { searchManual, type ManualHit } from '@/lib/manual/manual-search';
import { formatStayDate, todayInRome } from '@/lib/stay-dates';

export interface AskLink { to: string; title: string; detail?: string; state?: object }
export interface AskAnswer { links: AskLink[]; guide?: ManualHit[]; message?: string; direct?: boolean }
type Answer = AskAnswer;
type Intent = { kind: string; term?: string };

const MANUAL_WAIT_MS = 3000;

async function manualAnswers(question: string): Promise<ManualHit[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const noAnswerInTime = new Promise<ManualHit[]>((resolve) => {
    timer = setTimeout(() => resolve([]), MANUAL_WAIT_MS);
  });
  try {
    return await Promise.race([searchManual(question, 4), noAnswerInTime]);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

const ACTION_START = /^(?:per favore\s+)?(?:apri(?:mi)?|vai (?:a|al|alla)|porta(?:mi)? (?:a|al|alla)|mostrami|fammi vedere|voglio vedere|cerca|trova|dimmi se ci sono|dove trovo|dove si trova|come apro|open|go to|take me to|show me|find|where (?:can i |do i )?find)\s+(?:(?:il|lo|la|le|i|gli|the)\s+)?/i;
const MONTHS = [
  'gennaio january', 'febbraio february', 'marzo march', 'aprile april', 'maggio may', 'giugno june',
  'luglio july', 'agosto august', 'settembre september', 'ottobre october', 'novembre november', 'dicembre december',
];

export function fiscalPeriod(value: string, today = todayInRome()): string {
  const words = normalizeText(value).split(' ');
  const index = MONTHS.findIndex(month => month.split(' ').some(name => words.includes(name)));
  if (index < 0) return '';
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));
  const year = Number(words.find(word => /^(?:19|20)\d{2}$/.test(word))) || (index + 1 > currentMonth ? currentYear - 1 : currentYear);
  const month = String(index + 1).padStart(2, '0');
  const lastDay = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
  return '?' + new URLSearchParams({ from: [year, month, '01'].join('-'), to: [year, month, lastDay].join('-') }).toString();
}

function localIntent(text: string): Intent | undefined {
  const strip = text.replace(ACTION_START, '').trim();
  const booking = strip.match(/^(?:la\s+|the\s+)?(?:prenotazione|booking|reservation)\s+(?:(?:di|per|for|of)\s+)?(.+?)\s*[?!.]*$/i);
  if (booking && normalizeText(booking[1]).length >= 2) return { kind: 'booking', term: booking[1] };
  const value = normalizeText(strip);
  if (/^(?:(?:voglio|vorrei) invitare|invita|invite)\b/.test(value)) return { kind: 'invite', term: strip };
  if (/\b(?:alloggiati|police (?:lodging|report))\b/.test(value)) return { kind: 'alloggiati' };
  if (/\b(?:fattur[ae]|invoices?|documenti fiscali)\b/.test(value)) return { kind: 'invoices', term: strip };
  if (/\b(?:cose da fare|da fare|todo|to do|outstanding tasks|pending tasks)\b/.test(value)) return { kind: 'tasks' };
  if (/\b(?:routine|automazion[ei]|automations?|ai agents?|agenti ai)\b/.test(value) &&
      /\b(?:crea\w*|create|nuov[ao]|new|configur\w*|impostare|setup|automati\w*|store|libreria|library)\b/.test(value))
    return { kind: 'routine', term: strip };
  if (/^(?:setting[s]?|impostazioni|preferenze)(?: di casazen)?$/.test(value)) return { kind: 'settings' };
}

export function invitePrefill(value: string) {
  const email = value.match(/[\w.+-]+@[\w.-]+\.[\p{L}]{2,}/u)?.[0] ?? '';
  const request = value.replace(email || /$^/, '').replace(/^\s*(?:(?:voglio|vorrei) invitare|invita|invite)\s+/i, '').trim();
  const roleMatch = request.match(/\s+(?:come|as)\s+(collaborat\w*|manager|amministrat\w*|admin|commercialista|accountant)\b/i);
  const orgMatch = request.match(/\s+(?:in|nell['’]organizzazione|per l['’]organizzazione|for)\s+(.+)$/i);
  const role = roleMatch?.[1].toLowerCase() ?? '';
  const name = request.slice(0, Math.min(roleMatch?.index ?? request.length, orgMatch?.index ?? request.length)).replace(/[(),.!?]+$/g, '').trim();
  return {
    name: name.length <= 100 ? name : '', email, org: orgMatch?.[1].replace(/[.!?]+$/, '').trim(),
    role: /^(admin|amministrat)/.test(role) ? 'admin' : /^(commercialista|accountant)/.test(role) ? 'accountant' : role === 'manager' ? 'manager' : 'collaborator',
  };
}

export async function resolveAsk(text: string, context: CommandContext, orgName: string | null, signal: AbortSignal): Promise<Answer> {
  const { t, activeArea } = context;
  const page = (path: string) => {
    const entry = getManifestEntry(path);
    return Boolean(entry && hasEntryPermission(entry, context.hasPermission) && isEntryFeatureEnabled(entry, context.flags) && context.canOpenPath?.(path) !== false);
  };
  const direct = (to: string, title: string, state?: object): Answer => ({ links: [{ to, title, state }], direct: true });
  const unclear = (message: string): Answer => ({ links: [], message });
  const pages = prepareCommands(navigationSource.getItems(context).filter(item => item.to));
  const matches = (value: string) => searchCommands(pages, value, { activeArea }).flatMap(group => group.hits)
    .map(({ item }) => ({ to: item.to!, title: item.label, detail: item.subtitle }));
  const named = text.replace(ACTION_START, '');
  const exact = pages.filter(item => item.title === normalizeText(named));
  const exactHere = exact.filter(item => item.item.area === activeArea);
  let intent = localIntent(text);
  if (!intent) {
    const exactMatch = exactHere.length === 1 ? exactHere[0] : exact.length === 1 ? exact[0] : null;
    if (exactMatch?.item.to) return direct(exactMatch.item.to, exactMatch.item.label);
    if (exact.length > 1) return { links: matches(named) };
    try {
      intent = await ApiClient.post<Intent>('/ask/navigation', { text }, { signal, timeout: 15000 });
    } catch {
      if (signal.aborted) return { links: [] };
    }
  }
  if (signal.aborted) return { links: [] };
  const unavailable = () => unclear(t('ask.accessUnavailable'));
  switch (intent?.kind) {
    case 'booking': {
      const path = '/app/short-rent/bookings';
      const term = intent.term?.trim();
      if (!page(path)) return unavailable();
      if (!term || term.length > 64 || !normalizeText(text).includes(normalizeText(term))) return { links: [{ to: path, title: t('nav.bookings') }] };
      const result = await bookingsApi.search({ q: term, page: 1, pageSize: 20 });
      const names = (row: typeof result.items[number]) => [row.guest?.firstName, row.guest?.lastName].filter(Boolean).join(' ');
      const matchesTerm = (row: typeof result.items[number]) =>
        [names(row), [row.guest?.lastName, row.guest?.firstName].filter(Boolean).join(' '), row.bookingCode]
          .some(value => value && normalizeText(value) === normalizeText(term));
      const toLink = (row: typeof result.items[number]) => ({
        to: path + '/' + encodeURIComponent(row.id),
        title: names(row) || row.bookingCode,
        detail: [row.bookingCode, row.propertyName, formatStayDate(row.checkInDate, context.locale)].filter(Boolean).join(' · '),
      });
      const exactBooking = result.items.filter(matchesTerm);
      if (exactBooking.length === 1 && result.totalCount <= result.items.length) {
        const link = toLink(exactBooking[0]);
        return direct(link.to, link.title);
      }
      let rows = result.items;
      if (!rows.length) {
        const words = term.split(/\s+/).filter(word => normalizeText(word).length >= 3);
        if (words.length > 1 && !signal.aborted) rows = (await bookingsApi.search({ q: words.at(-1), page: 1, pageSize: 8 })).items;
      }
      return {
        links: [...rows.slice(0, 6).map(toLink), { to: path + '?' + new URLSearchParams({ q: term }), title: t('ask.allBookings') }],
        message: t(rows.length ? 'ask.bookingChoices' : 'ask.noBooking'),
      };
    }
    case 'routine': {
      const path = '/app/short-rent/automations';
      if (!page(path)) return unavailable();
      const topic = normalizeText((intent.term ?? '') + ' ' + text);
      const preset = /\b(recension\w*|reviews?)\b/.test(topic) ? 'review'
        : /\b(pulizi\w*|cleaning)\b/.test(topic) ? 'cleaning'
          : /\b(document\w*)\b/.test(topic) ? 'documents'
            : /\b(check ?in|arriv\w*|arrival)\b/.test(topic) ? 'arrival' : null;
      const query = preset || /\b(store|libreria|library)\b/.test(topic) ? '?view=library' + (preset ? '&preset=' + preset : '') : '?view=create';
      return direct(path + query, t('routines.title'), { agentObjective: text });
    }
    case 'invite': {
      const path = '/app/account/people/invite';
      if (!page(path)) return unavailable();
      const { name, email, role, org } = invitePrefill(intent.term ?? text);
      if (org && (!orgName || !normalizeText(orgName).replaceAll(' ', '').startsWith(normalizeText(org).replaceAll(' ', ''))))
        return unclear(t('ask.inviteOrgMismatch', { org: orgName ?? '' }));
      return direct(path + '?' + new URLSearchParams({ role, area: activeArea }), t('ask.invite'), { invite: { name, email } });
    }
    case 'settings': {
      const settings = '/app/' + activeArea + '/settings/organization';
      const path = page(settings) ? settings : '/app/account/settings';
      return page(path) ? direct(path, t('nav.settings')) : unavailable();
    }
    case 'alloggiati': {
      const path = '/app/short-rent/alloggiati/reports';
      return page(path) ? direct(path, t('nav.alloggiatiReports')) : unavailable();
    }
    case 'invoices': {
      const path = '/app/short-rent/fiscal/documents';
      const criteria = new URLSearchParams(fiscalPeriod(text));
      if (/\b(?:fattur[ae]|invoices?)\b/.test(normalizeText(text))) criteria.set('kind', 'Invoice');
      return page(path) ? direct(path + (criteria.size ? '?' + criteria : ''), t('nav.fiscalDocuments')) : unavailable();
    }
    case 'tasks': {
      const path = '/app/short-rent/activities';
      if (!page(path)) return unavailable();
      const rows = await internalActivitiesApi.getPending(true);
      if (!Array.isArray(rows)) return unclear(t('ask.lookupFailed'));
      const seen = new Set<string>();
      const links = rows.slice(0, 5).flatMap(row => {
        const to = todoActionRoute(row, context.hasPermission);
        if (!to || seen.has(to) || context.canOpenPath?.(to.split('?')[0]) === false) return [];
        seen.add(to);
        return [{ to, title: typeTitle(row.activityType, { t, exists: key => t(key) !== key }),
          detail: row.dueAt ? formatStayDate(row.dueAt, context.locale) : undefined }];
      });
      return { links: [...links, { to: path, title: t('nav.todo') }],
        message: t(isTruncatedList(rows.length) ? 'ask.manyTasks' : 'ask.taskCount', { count: rows.length }) };
    }
    default: {
      const suggested = intent?.kind === 'page' && typeof intent.term === 'string' ? matches(intent.term) : [];
      const hits = suggested.length ? suggested : matches(named);
      if (ACTION_START.test(text) && hits.length === 1 && normalizeText(hits[0].title) === normalizeText(intent?.term ?? named))
        return direct(hits[0].to, hits[0].title);
      const links = hits.slice(0, 6);
      const guide = await manualAnswers(text);
      return { links, guide, message: links.length ? t('ask.choosePage') : guide.length ? undefined : t('ask.noPages') };
    }
  }
}
