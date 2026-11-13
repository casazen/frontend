import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import {
  attachmentProblem,
  ATTACHMENT_MAX_BYTES,
  calendarRuns,
  calendarTotals,
  calendarWindow,
  canCancelStay,
  contactName,
  currentData,
  formatBytes,
  isAccountingDocument,
  isContactEditable,
  isOwnerOnlyRefusal,
  looksLikeEmail,
  otherVersions,
  ownerReadStateOf,
  primaryVersion,
  safeDownloadName,
  safeExternalUrl,
  samePermissions,
  stayFormProblem,
  stayRefusalText,
  togglePermission,
  visibleStatements,
} from '../owner-portal-model';
import type { OwnerCalendarRange, OwnerDocumentVersion, OwnerStatementReference, OwnerStayRule } from '@/types';

function failure(status: number, code?: string): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('failed', 'ERR_BAD_REQUEST', config, null, { status, statusText: '', headers: {}, config, data: code ? { status, code } : { status } });
}

const RULE: OwnerStayRule = {
  propertyId: 'p1',
  minAdvanceDays: 14,
  maxAdvanceDays: 365,
  minNights: 2,
  maxNights: 21,
  yearlyNightAllowance: 30,
  approvalRequired: true,
  blackouts: [],
};

describe('what a failed read means for a section', () => {
  it('OwnerReadState_EachRefusalHasItsOwnHonestState_AndNoneIsTheStateOfAnEmptyList', () => {
    expect(ownerReadStateOf(failure(404, 'owner_document_not_found'))).toBe('unavailable');
    expect(ownerReadStateOf(failure(403, 'owner_portal_permission_missing'))).toBe('permission');
    expect(ownerReadStateOf(failure(403, 'owner_contact_owner_only'))).toBe('ownerOnly');
    expect(ownerReadStateOf(failure(403))).toBe('forbidden');
    expect(ownerReadStateOf(failure(500))).toBe('failed');
    expect(ownerReadStateOf(new Error('no answer'))).toBe('failed');
    expect(isOwnerOnlyRefusal(failure(403, 'owner_contact_owner_only'))).toBe(true);
    expect(isOwnerOnlyRefusal(failure(403, 'owner_portal_permission_missing'))).toBe(false);
  });

  it('CurrentData_IsNothingOnceTheLastAnswerWasAnError_WhateverAnEarlierAnswerLeftInTheCache', () => {
    expect(currentData({ data: ['a'], isError: false })).toEqual(['a']);
    // TanStack Query keeps the data of the answer before when the next one fails: it is not drawn next to the notice of the refusal.
    expect(currentData({ data: ['a'], isError: true })).toBeUndefined();
    expect(currentData({ data: undefined, isError: false })).toBeUndefined();
  });
});

describe('the calendar', () => {
  it('CalendarRuns_KeepOnlyTheDatesAndTheKind_AndDropWhateverElseAnAnswerCarried', () => {
    const polluted = {
      start: '2026-12-01',
      end: '2026-12-05',
      kind: 'occupied',
      guestName: 'Mario Rossi',
      guestEmail: 'mario@example.com',
      channel: 'Airbnb',
      note: 'con cane',
    } as unknown as OwnerCalendarRange;
    const [run] = calendarRuns([polluted]);
    expect(Object.keys(run).sort()).toEqual(['end', 'key', 'kind', 'nights', 'start', 'stayId', 'stayState']);
    expect(JSON.stringify(run)).not.toMatch(/Mario|mario@|Airbnb|con cane/);
    expect(run.nights).toBe(4);
  });

  it('CalendarRuns_ADateThatIsNotADay_OrARunThatEndsBeforeItStarts_IsNotDrawn_AndTheRestIsInTheOrderOfTheDays', () => {
    const runs = calendarRuns([
      { start: '2026-12-10', end: '2026-12-12', kind: 'blocked' },
      { start: 'soon', end: '2026-12-12', kind: 'blocked' },
      { start: '2026-12-08', end: '2026-12-08', kind: 'available' },
      { start: '2026-12-01', end: '2026-12-10', kind: 'available' },
    ]);
    expect(runs.map((run) => [run.start, run.end])).toEqual([
      ['2026-12-01', '2026-12-10'],
      ['2026-12-10', '2026-12-12'],
    ]);
    expect(calendarTotals(runs)).toEqual({ available: 9, occupied: 0, blocked: 2, ownerStay: 0 });
  });

  it('CalendarWindow_NeverAsksForMoreThanTheServerAnswers', () => {
    const { from, to } = calendarWindow('2026-11-13', 'twelveMonths');
    expect(from).toBe('2026-11-13');
    expect(to).toBe('2027-11-12');
  });
});

describe('the owner stays', () => {
  it('CanCancelStay_OnlyAStayThatHasNotEnded_AndIsNotAlreadyRefusedOrCancelled', () => {
    expect(canCancelStay({ state: 'requested', endDate: '2026-12-10' }, '2026-11-13')).toBe(true);
    expect(canCancelStay({ state: 'approved_syncing', endDate: '2026-12-10' }, '2026-11-13')).toBe(true);
    expect(canCancelStay({ state: 'confirmed', endDate: '2026-12-10' }, '2026-11-13')).toBe(true);
    expect(canCancelStay({ state: 'sync_failed', endDate: '2026-12-10' }, '2026-11-13')).toBe(true);
    expect(canCancelStay({ state: 'confirmed', endDate: '2026-11-13' }, '2026-11-13')).toBe(false);
    expect(canCancelStay({ state: 'rejected', endDate: '2026-12-10' }, '2026-11-13')).toBe(false);
    expect(canCancelStay({ state: 'cancelled', endDate: '2026-12-10' }, '2026-11-13')).toBe(false);
  });

  it('StayFormProblem_ChecksOnlyWhatCostsNothing_TheRulesOfTheAgencyAreTheServers', () => {
    expect(stayFormProblem('', '2026-12-10', '2026-11-13')).toBe('datesRequired');
    expect(stayFormProblem('2026-12-10', '2026-12-10', '2026-11-13')).toBe('endBeforeStart');
    expect(stayFormProblem('2026-11-01', '2026-11-05', '2026-11-13')).toBe('startInPast');
    expect(stayFormProblem('2026-12-01', '2026-12-04', '2026-11-13')).toBeNull();
  });

  it('StayRefusalText_PutsTheNumbersOfTheRuleInTheWordsOfTheRefusal', () => {
    expect(stayRefusalText(failure(422, 'owner_stay_too_short'), RULE, 2026)).toEqual({ key: 'tooShort', values: { nights: 2 } });
    expect(stayRefusalText(failure(422, 'owner_stay_too_long'), RULE, 2026)).toEqual({ key: 'tooLong', values: { nights: 21 } });
    expect(stayRefusalText(failure(422, 'owner_stay_notice_too_short'), RULE, 2026)).toEqual({ key: 'noticeTooShort', values: { days: 14 } });
    expect(stayRefusalText(failure(422, 'owner_stay_beyond_window'), RULE, 2026)).toEqual({ key: 'beyondWindow', values: { days: 365 } });
    expect(stayRefusalText(failure(422, 'owner_stay_allowance_exceeded'), RULE, 2026)).toEqual({ key: 'allowanceExceeded', values: { nights: 30, year: 2026 } });
    // A code with no number, or a rule that is not known: the common text of the code applies.
    expect(stayRefusalText(failure(409, 'owner_stay_dates_unavailable'), RULE, 2026)).toBeNull();
    expect(stayRefusalText(failure(422, 'owner_stay_too_short'), null, null)).toBeNull();
    expect(stayRefusalText(new Error('x'), RULE, 2026)).toBeNull();
  });
});

describe('documents and accounting', () => {
  const version = (over: Partial<OwnerDocumentVersion>): OwnerDocumentVersion => ({
    id: 'v',
    versionNumber: 1,
    fileName: 'a.pdf',
    contentType: 'application/pdf',
    sizeBytes: 10,
    sha256: 'x',
    state: 'current',
    uploadedAt: '2026-11-01T10:00:00Z',
    ...over,
  });

  it('PrimaryVersion_IsTheOneInForce_OrTheNewestWhenNoneIs', () => {
    const current = version({ id: 'cur', versionNumber: 2, state: 'current' });
    const older = version({ id: 'old', versionNumber: 1, state: 'superseded' });
    expect(primaryVersion({ versions: [older, current] })?.id).toBe('cur');
    expect(otherVersions({ versions: [older, current] }).map((v) => v.id)).toEqual(['old']);
    const upcoming = version({ id: 'up', versionNumber: 3, state: 'upcoming' });
    expect(primaryVersion({ versions: [upcoming, older] })?.id).toBe('up');
    expect(primaryVersion({ versions: [] })).toBeNull();
  });

  it('SafeDownloadName_GivesTheOneExtensionOfTheTypeAndNothingThatWouldRunOrEscapeTheFolder', () => {
    expect(safeDownloadName('fattura.pdf.exe', 'application/pdf', 'doc')).toBe('fattura_pdf.pdf');
    expect(safeDownloadName('..\\..\\windows\\evil.bat', 'application/pdf', 'doc')).toBe('evil.pdf');
    expect(safeDownloadName('../../etc/passwd', 'image/png', 'doc')).toBe('passwd.png');
    expect(safeDownloadName('foto\u202Egpj.exe', 'image/jpeg', 'doc')).toBe('fotogpj.jpg');
    expect(safeDownloadName('', 'application/pdf', 'Mandato')).toBe('Mandato.pdf');
    expect(safeDownloadName(null, 'application/octet-stream', 'doc')).toBe('doc.pdf');
  });

  it('VisibleStatements_AreOnlyThePublishedOnesAndTheOnesSuperseded_LatestFirst', () => {
    const statement = (status: OwnerStatementReference['status'], month: number, versionNumber = 1): OwnerStatementReference => ({
      statementVersionId: `${status}-${month}-${versionNumber}`,
      orgId: 'o',
      propertyOwnerId: 'po',
      periodYear: 2026,
      periodMonth: month,
      versionNumber,
      status,
      publishedAt: '2026-11-01T10:00:00Z',
    });
    const shown = visibleStatements([
      statement('Draft', 9),
      statement('Flagged', 8),
      statement('Approved', 7),
      statement('Superseded', 6, 1),
      statement('Published', 6, 2),
      statement('Published', 5),
    ]);
    expect(shown.map((item) => item.statementVersionId)).toEqual(['Published-6-2', 'Superseded-6-1', 'Published-5-1']);
  });

  it('SafeExternalUrl_IsOnlyAnHttpsAddress', () => {
    expect(safeExternalUrl('https://fatture.example.com/f/1')).toBe('https://fatture.example.com/f/1');
    expect(safeExternalUrl('http://fatture.example.com/f/1')).toBeNull();
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('data:text/html,<script>1</script>')).toBeNull();
    expect(safeExternalUrl('file:///etc/passwd')).toBeNull();
    expect(safeExternalUrl('not a url')).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
  });

  it('IsAccountingDocument_IsAStatementOrAnInvoice', () => {
    expect(isAccountingDocument({ type: 'Statement' })).toBe(true);
    expect(isAccountingDocument({ type: 'Invoice' })).toBe(true);
    expect(isAccountingDocument({ type: 'Mandate' })).toBe(false);
  });
});

describe('delegated contacts', () => {
  it('TogglePermission_EachPermissionIsIndependent_AndTheOrderIsAlwaysTheOneOfTheBrief', () => {
    let permissions = togglePermission([], 'inbox.use', true);
    permissions = togglePermission(permissions, 'calendar.read', true);
    expect(permissions).toEqual(['calendar.read', 'inbox.use']);
    expect(togglePermission(permissions, 'inbox.use', false)).toEqual(['calendar.read']);
    // Taking away one never touches another, and a permission that is not held can be taken away without effect.
    expect(togglePermission(['accounting.read', 'documents.read'], 'accounting.read', false)).toEqual(['documents.read']);
    expect(togglePermission(['documents.read'], 'stays.request', false)).toEqual(['documents.read']);
    expect(samePermissions(['calendar.read', 'inbox.use'], ['inbox.use', 'calendar.read'])).toBe(true);
    expect(samePermissions(['calendar.read'], ['calendar.read', 'inbox.use'])).toBe(false);
  });

  it('IsContactEditable_OnlyAnInvitedOrActiveContact_ARevokedOrLapsedOneIsARecord', () => {
    expect(isContactEditable({ status: 'invited' })).toBe(true);
    expect(isContactEditable({ status: 'active' })).toBe(true);
    expect(isContactEditable({ status: 'revoked' })).toBe(false);
    expect(isContactEditable({ status: 'expired' })).toBe(false);
  });

  it('ContactName_AndEmailShape', () => {
    expect(contactName({ firstName: 'Anna', lastName: 'Verdi', email: 'a@x.it' })).toBe('Anna Verdi');
    expect(contactName({ firstName: '', lastName: ' ', email: 'a@x.it' })).toBe('a@x.it');
    expect(looksLikeEmail('anna@example.com')).toBe(true);
    expect(looksLikeEmail('anna@example')).toBe(false);
    expect(looksLikeEmail('anna example@x.it')).toBe(false);
  });
});

describe('the inbox', () => {
  it('AttachmentProblem_SparesAnUploadTheServerWouldRefuse', () => {
    expect(attachmentProblem({ type: 'application/pdf', size: 1000 })).toBeNull();
    expect(attachmentProblem({ type: 'image/png', size: ATTACHMENT_MAX_BYTES })).toBeNull();
    expect(attachmentProblem({ type: 'image/png', size: ATTACHMENT_MAX_BYTES + 1 })).toBe('size');
    expect(attachmentProblem({ type: 'application/zip', size: 10 })).toBe('type');
    expect(attachmentProblem({ type: 'application/pdf', size: 0 })).toBe('empty');
  });

  it('FormatBytes_SaysTheSizeInWords', () => {
    expect(formatBytes(512, 'it')).toBe('512 B');
    expect(formatBytes(2048, 'en')).toBe('2 KB');
    expect(formatBytes(2.5 * 1024 * 1024, 'en')).toBe('2.5 MB');
    expect(formatBytes(-1, 'en')).toBe('');
  });
});
