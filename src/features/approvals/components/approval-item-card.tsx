import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import {
  approvalTypeLabel,
  confidenceView,
  failureCodeOf,
  finalTextOf,
  isCampaign,
  isEdited,
  isMessageDraft,
  originErrorMessage,
  parseCampaignText,
  situationLabel,
} from '@/features/approvals/lib/approval-model';
import { messageThreadPath } from '@/lib/message-hub-routes';
import { formatRomeDateTime } from '@/lib/stay-dates';
import type { ApprovalQueueItem } from '@/types/approval-queue.types';

const EXPIRY_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };

interface ApprovalItemCardProps {
  item: ApprovalQueueItem;
  /** The code of the failure of the last approval, when the page has just seen one; the failure the server saved on the item is read from the item itself. */
  failureCode?: string;
  /** A decision is going on somewhere in the queue: every button waits for it, the one that started it says so. */
  busy: boolean;
  /** The approval of this item is the one going on. */
  approving: boolean;
  onApprove: (item: ApprovalQueueItem) => void;
  onEdit: (item: ApprovalQueueItem) => void;
  onReject: (item: ApprovalQueueItem) => void;
}

/** The text of an item exactly as it will go: a campaign with its subject line apart, any other text as it is. */
function ItemText({ item }: { item: ApprovalQueueItem }) {
  const text = finalTextOf(item);
  const campaign = isCampaign(item) ? parseCampaignText(text) : null;

  return (
    <div className="break-words rounded-md bg-muted p-4 text-sm" data-testid="approval-item-text">
      {campaign ? (
        <>
          <p className="font-semibold">{campaign.subject}</p>
          <p className="mt-3 whitespace-pre-wrap">{campaign.body}</p>
        </>
      ) : (
        <p className="whitespace-pre-wrap">{text}</p>
      )}
    </div>
  );
}

/**
 * One item waiting for a decision (NF-68): its type, for the draft of a message the situation and how sure the assistant is (in words, with the
 * number), the link to the conversation, the exact text with the edit marked and the original within reach, and Approve, Edit and Reject. When the
 * action the item was waiting for failed, the item stays here with the reason in plain words and a retry (AC-NF68-1).
 */
export function ApprovalItemCard({ item, failureCode, busy, approving, onApprove, onEdit, onReject }: ApprovalItemCardProps) {
  const { t, i18n } = useTranslation();
  const draft = isMessageDraft(item);
  const edited = isEdited(item);
  const confidence = confidenceView(item.confidenceScore);
  const failure = failureCode ?? failureCodeOf(item);
  const expires = formatRomeDateTime(item.expiresAt, i18n.language, EXPIRY_FORMAT);

  let hint: string | null = null;
  if (draft) hint = t('approval.hint.messageDraft');
  else if (isCampaign(item)) hint = t('approval.hint.campaign');

  let approveLabel = t('approval.action.approve');
  if (failure) approveLabel = t('approval.action.retry');
  else if (draft) approveLabel = t('approval.action.approveAndSend');

  return (
    <Card data-testid="approval-item" data-item-id={item.id} data-item-type={item.itemType}>
      <CardHeader>
        {/* A heading of the second level: the page has its title as the first (the card title of the kit is a third level). */}
        <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold leading-none tracking-tight">
          <span>{approvalTypeLabel(item.itemType, t)}</span>
          {item.isAiGenerated ? (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Sparkles aria-hidden="true" className="h-3 w-3" />
              {t('approval.ai_generated')}
            </Badge>
          ) : null}
          {edited ? (
            <Badge variant="outline" data-testid="approval-item-edited">
              {t('approval.edited')}
            </Badge>
          ) : null}
        </h2>
        <CardDescription>
          {t('approval.status.pending')} • {t('approval.expires')}: {expires}
        </CardDescription>
        {draft && (item.situationCode || confidence) ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-sm" data-testid="approval-item-draft-meta">
            {item.situationCode ? (
              <span>
                <span className="text-muted-foreground">{t('approval.situation.label')}: </span>
                <span className="font-medium">{situationLabel(item.situationCode, t, i18n)}</span>
              </span>
            ) : null}
            {confidence ? (
              <Badge variant="outline" className="flex items-center gap-1" data-testid="approval-item-confidence" data-level={confidence.level}>
                {confidence.level === 'high' ? <CheckCircle2 aria-hidden="true" className="h-3 w-3" /> : <AlertTriangle aria-hidden="true" className="h-3 w-3" />}
                {t('approval.confidence.label', {
                  level: confidence.level === 'high' ? t('approval.confidence.high') : t('approval.confidence.low'),
                  percent: confidence.percent,
                })}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">{edited ? t('approval.contentEdited') : t('approval.content')}</div>
          <ItemText item={item} />
          {edited ? (
            <details className="text-sm">
              <summary className="flex min-h-11 cursor-pointer items-center text-muted-foreground underline-offset-4 hover:underline">
                {t('approval.contentShowOriginal')}
              </summary>
              <div className="mt-1 whitespace-pre-wrap break-words rounded-md border border-dashed p-3" data-testid="approval-item-original">
                {item.contentText}
              </div>
            </details>
          ) : null}
        </div>

        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}

        {failure ? (
          <Alert variant="danger" title={t('approval.action.originFailed')} data-testid="approval-item-failure">
            <p>{originErrorMessage(failure, t)}</p>
            <p className="mt-1">{t('approval.action.originFailedHint')}</p>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => onApprove(item)} loading={approving} disabled={busy && !approving}>
            {approveLabel}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onEdit(item)} disabled={busy}>
            {t('approval.action.edit')}
          </Button>
          <Button variant="danger-outline" size="sm" onClick={() => onReject(item)} disabled={busy}>
            {t('approval.action.reject')}
          </Button>
          {draft && item.threadKey ? (
            <Button asChild variant="ghost" size="sm" className="sm:ml-auto">
              <Link to={messageThreadPath(item.threadKey)}>{t('approval.thread.open')}</Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
