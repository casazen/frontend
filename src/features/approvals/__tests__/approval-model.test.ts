import { beforeEach, describe, expect, it } from 'vitest';
import { AxiosError } from 'axios';
import i18n from '@/i18n/config';
import it_ from '@/i18n/locales/it.json';
import en from '@/i18n/locales/en.json';
import { translateErrorCode } from '@/lib/api-errors';
import type { ApprovalOriginActionResult, ApprovalQueueItem } from '@/types/approval-queue.types';
import {
  approvalOutcome,
  approvalTypeLabel,
  campaignTextOf,
  confidenceView,
  editFieldsOf,
  editProblem,
  editedTextOf,
  failureCodeOf,
  finalTextOf,
  firstLineOf,
  isEdited,
  itemIsGone,
  originActionErrorOf,
  originErrorMessage,
  parseCampaignText,
  situationLabel,
} from '../lib/approval-model';

function item(overrides: Partial<ApprovalQueueItem> = {}): ApprovalQueueItem {
  return {
    id: 'a1',
    itemType: 'MessageDraft',
    itemId: 'i1',
    contentText: 'Il check-in è dalle 15.',
    contentVersion: null,
    isAiGenerated: true,
    status: 'Pending',
    approvedByUserId: null,
    approvedAt: null,
    createdAt: '2026-11-10T08:00:00Z',
    expiresAt: '2026-11-17T08:00:00Z',
    propertyId: 'p1',
    originAction: 'SendGuestMessage',
    originActionStatus: 'Pending',
    originActionError: null,
    originActionExecutedAt: null,
    originActionResult: null,
    confidenceScore: 0.92,
    situationCode: 'check_in_time',
    threadKey: 'ota:6f1c9a52-1111-4222-8333-944455556666',
    editedContentText: null,
    editedAt: null,
    rejectionReason: null,
    ...overrides,
  };
}

function httpError(status: number, data: Record<string, unknown>): AxiosError {
  return new AxiosError('failed', String(status), undefined, undefined, { status, data, statusText: '', headers: {}, config: {} as never });
}

/** Whether a key of a locale file is a text. */
function textOf(locale: unknown, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>((node, part) => (node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), locale);
  return typeof value === 'string' ? value : undefined;
}

describe('approval model (NF-68)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  const t = () => i18n.getFixedT('it');

  it('approvalTypeLabel_KnownAndUnknownTypes_NamesThemOrSaysOther', () => {
    expect(approvalTypeLabel('MessageDraft', t())).toBe('Bozza di messaggio');
    expect(approvalTypeLabel('Campaign', t())).toBe('Campagna');
    expect(approvalTypeLabel('Routine', t())).toBe('Routine');
    expect(approvalTypeLabel('AiText', t())).toBe('Testo AI');
    // A type a later version of the server adds is not shown as an identifier.
    expect(approvalTypeLabel('ReviewReply', t())).toBe('Altro');
  });

  it('confidenceView_Score_IsHighFromTheThresholdAndLowBelowIt', () => {
    expect(confidenceView(0.85)).toEqual({ level: 'high', percent: 85 });
    expect(confidenceView(0.849)).toEqual({ level: 'low', percent: 85 });
    expect(confidenceView(0.924)).toEqual({ level: 'high', percent: 92 });
    expect(confidenceView(0.12)).toEqual({ level: 'low', percent: 12 });
    expect(confidenceView(1.4)).toEqual({ level: 'high', percent: 100 });
    expect(confidenceView(-1)).toEqual({ level: 'low', percent: 0 });
  });

  it('confidenceView_NoScore_IsNull', () => {
    expect(confidenceView(null)).toBeNull();
    expect(confidenceView(undefined)).toBeNull();
    expect(confidenceView(Number.NaN)).toBeNull();
  });

  it('situationLabel_KnownCode_IsInWordsAndUnknownCodeIsAPhraseNotAnIdentifier', () => {
    expect(situationLabel('check_in_time', t(), i18n)).toBe('Orario di check-in');
    expect(situationLabel('wifi', t(), i18n)).toBe('Wi-Fi');
    expect(situationLabel('late_arrival_with_dog', t(), i18n)).toBe('Late arrival with dog');
    expect(situationLabel('Weird-Code', t(), i18n)).toBe('Weird Code');
  });

  it('finalTextOf_EditedItem_IsTheEditAndTheOriginalStaysOnTheItem', () => {
    const plain = item();
    expect(isEdited(plain)).toBe(false);
    expect(finalTextOf(plain)).toBe('Il check-in è dalle 15.');

    const edited = item({ editedContentText: 'Il check-in è dalle 16.' });
    expect(isEdited(edited)).toBe(true);
    expect(finalTextOf(edited)).toBe('Il check-in è dalle 16.');
    expect(edited.contentText).toBe('Il check-in è dalle 15.');
  });

  it('firstLineOf_Text_IsTheFirstLineThatSaysSomething', () => {
    expect(firstLineOf('\n\n  Buongiorno,\nil check-in…')).toBe('Buongiorno,');
    expect(firstLineOf('   ')).toBe('');
  });

  describe('the text of a campaign', () => {
    it('parseCampaignText_SubjectBlankLineAndBody_SplitsThem', () => {
      expect(parseCampaignText('Offerta di dicembre\n\nSconto del 10%.\nSolo per te.')).toEqual({
        subject: 'Offerta di dicembre',
        body: 'Sconto del 10%.\nSolo per te.',
      });
      expect(parseCampaignText('Offerta\r\n\r\nTesto')).toEqual({ subject: 'Offerta', body: 'Testo' });
    });

    it('parseCampaignText_NotInThatForm_IsNull', () => {
      expect(parseCampaignText('Solo una riga')).toBeNull();
      expect(parseCampaignText('Oggetto\nsu due righe\n\nTesto')).toBeNull();
      expect(parseCampaignText('\n\nTesto senza oggetto')).toBeNull();
      expect(parseCampaignText('Oggetto\n\n   ')).toBeNull();
      expect(parseCampaignText(`${'x'.repeat(201)}\n\nTesto`)).toBeNull();
    });

    it('campaignTextOf_SubjectAndBody_IsTheFormTheApiReads', () => {
      expect(campaignTextOf(' Offerta ', ' Testo \n')).toBe('Offerta\n\nTesto');
      expect(parseCampaignText(campaignTextOf('Offerta', 'Testo'))).toEqual({ subject: 'Offerta', body: 'Testo' });
    });

    it('editFieldsOf_AndEditedTextOf_CampaignKeepsItsSubjectLineBlankLineAndBody', () => {
      const campaign = item({ itemType: 'Campaign', contentText: 'Offerta\n\nTesto della offerta' });
      const fields = editFieldsOf(campaign, finalTextOf(campaign));
      expect(fields).toMatchObject({ subject: 'Offerta', body: 'Testo della offerta' });
      expect(editedTextOf(campaign, { ...fields, subject: 'Nuova offerta' })).toBe('Nuova offerta\n\nTesto della offerta');

      const message = item();
      expect(editedTextOf(message, editFieldsOf(message, 'Ciao'))).toBe('Ciao');
    });
  });

  describe('what the API would refuse in an edit', () => {
    it('editProblem_Message_EmptyOrLongerThan2000Characters', () => {
      const message = item();
      const fields = (text: string) => ({ text, subject: '', body: '' });

      expect(editProblem(message, fields('Va bene così'))).toBeNull();
      expect(editProblem(message, fields('x'.repeat(2000)))).toBeNull();
      expect(editProblem(message, fields('   \n '))).toEqual({ field: 'text', key: 'approval.edit.error.empty' });
      expect(editProblem(message, fields('x'.repeat(2001)))).toEqual({ field: 'text', key: 'approval.edit.error.tooLong', max: 2000 });
    });

    it('editProblem_Campaign_NeedsASubjectLineOnOneLineAndABody', () => {
      const campaign = item({ itemType: 'Campaign' });
      const fields = (subject: string, body: string) => ({ text: '', subject, body });

      expect(editProblem(campaign, fields('Offerta', 'Testo'))).toBeNull();
      expect(editProblem(campaign, fields('  ', 'Testo'))).toEqual({ field: 'subject', key: 'approval.edit.error.subjectRequired' });
      expect(editProblem(campaign, fields('Due\nrighe', 'Testo'))).toEqual({ field: 'subject', key: 'approval.edit.error.subjectOneLine' });
      expect(editProblem(campaign, fields('x'.repeat(201), 'Testo'))).toEqual({ field: 'subject', key: 'approval.edit.error.subjectTooLong', max: 200 });
      expect(editProblem(campaign, fields('Offerta', ' \n '))).toEqual({ field: 'body', key: 'approval.edit.error.bodyRequired' });
    });

    it('editProblem_OtherTypes_OnlyHaveToSaySomething', () => {
      const routine = item({ itemType: 'Routine' });
      expect(editProblem(routine, { text: 'x'.repeat(5000), subject: '', body: '' })).toBeNull();
      expect(editProblem(routine, { text: ' ', subject: '', body: '' })).toEqual({ field: 'text', key: 'approval.edit.error.empty' });
    });
  });

  describe('what an approval did', () => {
    const outcome = (result: ApprovalOriginActionResult | null, status: ApprovalQueueItem['originActionStatus'] = 'Executed') =>
      approvalOutcome({ originActionResult: result, originActionStatus: status });

    it('approvalOutcome_ResultOfTheAction_SaysWhatWentOut', () => {
      expect(outcome('Sent')).toEqual({ key: 'approval.action.executed.message', tone: 'success' });
      expect(outcome('Created')).toEqual({ key: 'approval.action.executed.messageQueued', tone: 'success' });
      expect(outcome('WaitingAuthorization')).toEqual({ key: 'approval.action.executed.messageQueued', tone: 'success' });
      expect(outcome('Scheduled')).toEqual({ key: 'approval.action.executed.campaign', tone: 'success' });
      expect(outcome('Approved')).toEqual({ key: 'approval.action.executed.campaignApproved', tone: 'success' });
    });

    it('approvalOutcome_SendWhoseOutcomeIsNotKnown_IsAWarningToCheckNeverASuccess', () => {
      expect(outcome('ManualVerify')).toEqual({ key: 'approval.action.executed.messageVerify', tone: 'warning' });
    });

    it('approvalOutcome_NoResult_IsNoActionLinkedOrAlreadyApproved', () => {
      expect(outcome(null, 'NotRequired')).toEqual({ key: 'approval.action.executed.none', tone: 'success' });
      // The same item approved a second time: nothing was sent again, and the page says so.
      expect(outcome(null, 'Executed')).toEqual({ key: 'approval.action.executed.already', tone: 'success' });
    });
  });

  describe('why an action failed', () => {
    it('originActionErrorOf_409OriginActionFailed_IsTheCodeTheServerGave', () => {
      const error = httpError(409, { code: 'approval_origin_action_failed', originActionError: 'thread_closed' });
      expect(originActionErrorOf(error)).toBe('thread_closed');
    });

    it('originActionErrorOf_409WithoutTheExtension_IsTheUnexpectedCodeAndAnyOtherErrorIsNothing', () => {
      expect(originActionErrorOf(httpError(409, { code: 'approval_origin_action_failed' }))).toBe('origin_action_error');
      expect(originActionErrorOf(httpError(409, { code: 'approval_item_not_pending' }))).toBeUndefined();
      expect(originActionErrorOf(httpError(422, { code: 'approval_origin_action_failed', originActionError: 'x' }))).toBeUndefined();
      expect(originActionErrorOf(new Error('boom'))).toBeUndefined();
    });

    it('itemIsGone_AlreadyDecidedOrNotThere_IsTrueAndAFailedActionIsNot', () => {
      expect(itemIsGone(httpError(409, { code: 'approval_item_not_pending' }))).toBe(true);
      expect(itemIsGone(httpError(404, { code: 'approval_item_not_found' }))).toBe(true);
      expect(itemIsGone(httpError(409, { code: 'approval_origin_action_failed', originActionError: 'thread_closed' }))).toBe(false);
      expect(itemIsGone(httpError(422, { code: 'approval_edit_invalid' }))).toBe(false);
      expect(itemIsGone(undefined)).toBe(false);
    });

    it('failureCodeOf_PendingItemWhoseLastActionFailed_IsItsCode', () => {
      expect(failureCodeOf({ originActionStatus: 'Failed', originActionError: 'mapping_not_confirmed' })).toBe('mapping_not_confirmed');
      expect(failureCodeOf({ originActionStatus: 'Failed', originActionError: null })).toBe('origin_action_error');
      expect(failureCodeOf({ originActionStatus: 'Pending', originActionError: null })).toBeNull();
    });

    it('originErrorMessage_CodeOfTheActions_IsPlainWordsAndAnUnknownCodeIsAGeneralSentence', () => {
      expect(originErrorMessage('thread_closed', t())).toBe('Questa conversazione è chiusa: non si possono più scrivere messaggi.');
      expect(originErrorMessage('crm_marketing_disabled', t())).toBe("Le campagne non sono ancora attive per la tua organizzazione: l'approvazione resta in attesa.");
      expect(originErrorMessage('something_new', t())).toBe('Qualcosa non ha funzionato. Riprova tra poco.');
      expect(originErrorMessage(null, t())).toBe('Qualcosa non ha funzionato. Riprova tra poco.');
    });

    // The codes the actions of an approval can fail with (`MessageDraftApprovalAction`, `CampaignApprovalAction`, the reply service, Octorate): each one has its
    // words in both languages, so a host never reads a code.
    it.each([
      'thread_closed',
      'thread_not_found',
      'thread_key_invalid',
      'mapping_not_confirmed',
      'channel_rule_violation',
      'message_text_invalid',
      'idempotency_key_invalid',
      'octorate_message_error',
      'octorate_request_rejected',
      'octorate_chat_not_sendable',
      'octorate_rate_limited',
      'octorate_not_connected',
      'octorate_auth_failed',
      'octorate_unavailable',
      'chat_not_licensed',
      'approval_send_attempts_exhausted',
      'approval_edit_invalid',
      'crm_marketing_disabled',
      'campaign_not_pending_approval',
    ])('originErrorMessage_%s_HasWordsInItalianAndEnglish', (code) => {
      expect(translateErrorCode(code, i18n.getFixedT('it'))).toBeTruthy();
      expect(translateErrorCode(code, i18n.getFixedT('en'))).toBeTruthy();
    });
  });

  it('theKeysOfTheModel_AllExistInItalianAndEnglish', () => {
    const keys = [
      'approval.action.executed.message',
      'approval.action.executed.messageQueued',
      'approval.action.executed.messageVerify',
      'approval.action.executed.campaign',
      'approval.action.executed.campaignApproved',
      'approval.action.executed.already',
      'approval.action.executed.none',
      'approval.edit.error.empty',
      'approval.edit.error.tooLong',
      'approval.edit.error.subjectRequired',
      'approval.edit.error.subjectOneLine',
      'approval.edit.error.subjectTooLong',
      'approval.edit.error.bodyRequired',
      'approval.type.messageDraft',
      'approval.type.campaign',
      'approval.type.routine',
      'approval.type.aiText',
      'approval.type.other',
      ...[
        'check_in_time',
        'early_arrival_or_late_checkout',
        'parking',
        'wifi',
        'directions',
        'pets',
        'invoice_request',
        'thank_you',
        'malfunction',
        'noise',
        'discount_request',
        'cancellation_or_refund',
        'complaint',
        'emergency',
        'other',
      ].map((code) => `approval.situation.${code}`),
    ];

    for (const key of keys) {
      expect(textOf(it_, key), `it: ${key}`).toBeTruthy();
      expect(textOf(en, key), `en: ${key}`).toBeTruthy();
    }
  });
});
