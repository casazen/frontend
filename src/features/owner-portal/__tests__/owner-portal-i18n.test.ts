import { describe, expect, it } from 'vitest';
import it_ from '@/i18n/locales/it.json';
import en from '@/i18n/locales/en.json';
import { OWNER_PORTAL_PERMISSIONS } from '@/types';

/**
 * The texts of the owner portal (E07/F07/US01/T03): both languages hold the same keys, in alphabetical order, nobody reads a name of a supplier or of the channel
 * manager, every key the pages ask for is there, and no page gives a `defaultValue` (a missing text must show as a missing text, never as another one).
 */
const BLOCKS = ['ownerPortal', 'ownerContactInvitation'] as const;
const LOCALES = [
  ['it', it_ as Record<string, unknown>],
  ['en', en as Record<string, unknown>],
] as const;

function leaves(node: unknown, path = ''): Array<[string, unknown]> {
  if (node !== null && typeof node === 'object' && !Array.isArray(node)) {
    return Object.entries(node).flatMap(([key, value]) => leaves(value, path ? `${path}.${key}` : key));
  }
  return [[path, node]];
}

function unsortedPaths(node: unknown, path = ''): string[] {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return [];
  const keys = Object.keys(node);
  const here = JSON.stringify(keys) === JSON.stringify([...keys].sort()) ? [] : [path];
  return [...here, ...Object.entries(node).flatMap(([key, value]) => unsortedPaths(value, path ? `${path}.${key}` : key))];
}

function lookup(locale: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), locale);
}

const SOURCES = import.meta.glob<string>(
  [
    '/src/features/owner-portal/*.{ts,tsx}',
    '/src/pages/owner-portal/*.tsx',
    '/src/lib/owner-contact-invitation.ts',
    '/src/routes/ownerPortalRoutes.tsx',
  ],
  { query: '?raw', import: 'default', eager: true },
);

describe('the texts of the owner portal', () => {
  it.each(BLOCKS)('%s: Italian and English have the same keys', (block) => {
    const keysOf = (locale: Record<string, unknown>) => leaves(locale[block]).map(([key]) => key).sort();
    expect(keysOf(it_ as Record<string, unknown>)).toEqual(keysOf(en as Record<string, unknown>));
    expect(keysOf(it_ as Record<string, unknown>).length).toBeGreaterThan(25);
  });

  it.each(LOCALES)('%s.json: the blocks of the portal are in alphabetical order, at every level', (_language, locale) => {
    for (const block of BLOCKS) expect(unsortedPaths(locale[block], block)).toEqual([]);
  });

  it.each(LOCALES)('%s.json: every text is a sentence, none names a supplier or the channel manager', (_language, locale) => {
    for (const block of BLOCKS) {
      for (const [key, text] of leaves(locale[block], block)) {
        expect(typeof text, key).toBe('string');
        expect((text as string).trim().length, key).toBeGreaterThan(0);
        expect(text as string, key).not.toMatch(/octorate|concordato\s*facile|channel\s*manager|gestionale\s+dei\s+canali|partner/i);
      }
    }
  });

  it.each(LOCALES)('%s.json: a text with a count has both its forms', (_language, locale) => {
    for (const block of BLOCKS) {
      const keys = leaves(locale[block], block).map(([key]) => key);
      for (const key of keys.filter((item) => item.endsWith('_one'))) expect(keys, key).toContain(key.replace(/_one$/, '_other'));
      for (const key of keys.filter((item) => item.endsWith('_other'))) expect(keys, key).toContain(key.replace(/_other$/, '_one'));
    }
  });

  it.each(LOCALES)('%s.json: every key the pages ask for is there', (_language, locale) => {
    const files = Object.entries(SOURCES).filter(([file]) => !file.includes('__tests__'));
    expect(files.length).toBeGreaterThan(20);

    const missing: string[] = [];
    let seen = 0;
    for (const [file, source] of files) {
      // A key written out in full: t('ownerPortal.x.y'), or a key a model hands over as a plain word.
      for (const match of source.matchAll(/\bt\(\s*'((?:ownerPortal|ownerContactInvitation|apiErrors)\.[A-Za-z0-9_.]+)'/g)) {
        seen += 1;
        const value = lookup(locale, match[1]);
        const plural = lookup(locale, `${match[1]}_other`);
        if (typeof value !== 'string' && typeof plural !== 'string') missing.push(`${file}: ${match[1]}`);
      }
      // No page gives a text of its own for a key that is missing.
      expect(source, file).not.toMatch(/\bdefaultValue\b/);
    }
    expect(seen).toBeGreaterThan(100);
    expect(missing).toEqual([]);
  });

  it.each(LOCALES)('%s.json: the keys built from a state, a kind or a permission have a text for each of them', (_language, locale) => {
    const families: Array<[string, readonly string[], readonly string[]]> = [
      ['ownerPortal.states', ['unavailable', 'permission', 'ownerOnly', 'forbidden'], ['title', 'description']],
      ['ownerPortal.stays.state', ['requested', 'approved_syncing', 'confirmed', 'sync_failed', 'rejected', 'cancelled'], ['title', 'description']],
      ['ownerPortal.stays.errors', ['datesRequired', 'endBeforeStart', 'startInPast', 'tooShort', 'tooLong', 'noticeTooShort', 'beyondWindow', 'allowanceExceeded', 'generic'], ['']],
      ['ownerPortal.calendar.kinds', ['available', 'occupied', 'blocked', 'ownerStay'], ['']],
      ['ownerPortal.calendar.summary', ['available', 'occupied', 'blocked', 'ownerStay'], ['']],
      ['ownerPortal.calendar.periods', ['threeMonths', 'sixMonths', 'twelveMonths'], ['']],
      ['ownerPortal.documents.type', ['Mandate', 'Contract', 'Insurance', 'Statement', 'Invoice', 'Other'], ['']],
      ['ownerPortal.documents.expiry', ['valid', 'expiring', 'expired'], ['']],
      ['ownerPortal.documents.expiryNoDate', ['valid', 'expiring', 'expired'], ['']],
      ['ownerPortal.documents.versionState', ['upcoming', 'current', 'superseded', 'expired'], ['']],
      ['ownerPortal.accounting.invoiceStatus', ['Entered', 'Verified'], ['']],
      ['ownerPortal.accounting.status', ['published', 'superseded'], ['']],
      ['ownerPortal.accounting.totals', ['gross', 'channelFees', 'withholding', 'commission', 'charges', 'corrections', 'net', 'payments', 'openingBalance', 'closingBalance'], ['']],
      ['ownerPortal.accounting.sections', ['stays', 'channelFees', 'withholding', 'commission', 'recharges', 'corrections', 'payments'], ['']],
      ['ownerPortal.accounting.pmInvoices.kind', ['Invoice', 'Receipt', 'CreditNote', 'Other'], ['']],
      ['ownerPortal.accounting.line.kind', ['cleaning', 'linen'], ['']],
      ['ownerPortal.inbox.topic', ['General', 'Property', 'OwnerStay', 'Document', 'StatementVersion'], ['']],
      ['ownerPortal.inbox.new.topics', ['general', 'property', 'ownerStay', 'document', 'statementVersion'], ['']],
      ['ownerPortal.inbox.thread.attachment', ['type', 'size', 'empty'], ['']],
      ['ownerPortal.contacts.status', ['invited', 'expired', 'active', 'revoked'], ['title', 'description']],
      ['ownerPortal.contacts.permissions', [...OWNER_PORTAL_PERMISSIONS], ['label', 'description']],
      ['ownerContactInvitation.unusable', ['invalid', 'expired', 'used', 'revoked'], ['title', 'description']],
    ];
    const missing: string[] = [];
    for (const [prefix, names, parts] of families) {
      for (const name of names) {
        for (const part of parts) {
          const key = part ? `${prefix}.${name}.${part}` : `${prefix}.${name}`;
          if (typeof lookup(locale, key) !== 'string') missing.push(key);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it.each(LOCALES)('%s.json: every code the portal can answer has its text', (_language, locale) => {
    const codes = [
      'owner_portal_permission_missing', 'owner_portal_permissions_empty', 'owner_portal_permission_unknown', 'owner_portal_property_not_found',
      'owner_stay_not_found', 'owner_stay_invalid_range', 'owner_stay_in_past', 'owner_stay_too_short', 'owner_stay_too_long', 'owner_stay_notice_too_short',
      'owner_stay_beyond_window', 'owner_stay_blackout', 'owner_stay_outside_period', 'owner_stay_allowance_exceeded', 'owner_stay_dates_unavailable',
      'owner_stay_not_cancellable', 'owner_calendar_range_invalid', 'owner_document_not_found', 'owner_contact_not_found', 'owner_contact_owner_only',
      'owner_contact_agency_required', 'owner_contact_invalid', 'owner_contact_exists', 'owner_contact_limit_reached', 'owner_contact_daily_limit_reached',
      'owner_contact_revoked', 'owner_contact_email_not_queued', 'owner_conversation_not_found', 'owner_conversation_invalid',
      'owner_conversation_reference_not_found', 'owner_message_invalid', 'owner_attachment_not_found', 'owner_file_too_large', 'owner_file_type_not_allowed',
      'owner_file_active_content', 'owner_statement_version_not_found', 'owner_statement_pdf_not_available', 'owner_portal_invoice_not_found',
    ];
    const camel = (code: string) => {
      const [first, ...rest] = code.split('_');
      return first + rest.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
    };
    const missing = codes.filter((code) => typeof lookup(locale, `apiErrors.codes.${camel(code)}`) !== 'string');
    expect(missing).toEqual([]);
  });
});
