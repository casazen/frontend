import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Pencil, Undo2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  answerSource,
  assistantProblemMessage,
  isNotFound,
  knowledgeTopicText,
  modeKey,
  situationText,
} from '@/features/assistant/lib/assistant-model';
import { useAssistantSituations, useRemoveSituationException, useSaveSituation } from '@/queries/use-assistant-settings';
import type { EffectiveSituation } from '@/types/assistant-settings.types';
import { SettingsError, SettingsLoading, SettingsNoAccess, SettingsNotFound } from './settings-states';
import { SituationEditDialog } from './situation-edit-dialog';

interface SituationRowProps {
  situation: EffectiveSituation;
  inProperty: boolean;
  editable: boolean;
  /** Any request of the table is going on: every button of every row waits for it. */
  busy: boolean;
  onEdit: (situation: EffectiveSituation) => void;
  onUseOrganization: (situation: EffectiveSituation) => void;
}

function SituationRow({ situation, inProperty, editable, busy, onEdit, onUseOrganization }: SituationRowProps) {
  const { t, i18n } = useTranslation();
  const key = modeKey(situation.mode);
  const source = answerSource(situation);
  const isException = inProperty && situation.origin === 'property';

  let origin = t('assistant.situations.origin.default');
  if (situation.origin === 'organization') origin = t('assistant.situations.origin.organization');
  else if (situation.origin === 'property') origin = t('assistant.situations.origin.property');

  let answer = t('assistant.situations.answer.none');
  if (source.kind === 'template') answer = t('assistant.situations.answer.template');
  else if (source.kind === 'topic') answer = t('assistant.situations.answer.topic', { topic: knowledgeTopicText(source.topic, t, i18n) });

  return (
    <li
      className="grid grid-cols-1 gap-3 rounded-lg border bg-card p-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_auto] md:items-start"
      data-testid="assistant-situation"
      data-code={situation.code}
      data-origin={situation.origin}
    >
      <div className="min-w-0 space-y-1">
        <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <span className="min-w-0 break-words">{situationText(situation.code, t, i18n)}</span>
          {situation.isSensitive ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground/80" data-testid="assistant-situation-lock">
              <Lock aria-hidden="true" className="size-3.5" />
              <span className="sr-only">{t('assistant.situations.sensitiveLabel')}</span>
            </span>
          ) : null}
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={isException ? 'warning' : 'secondary'} data-testid="assistant-situation-origin">
            {origin}
          </Badge>
        </div>
        {situation.isSensitive ? <p className="break-words text-xs text-foreground/70">{t('assistant.situations.sensitive')}</p> : null}
        {/* The start of the value as the server keeps it: a situation nobody configured has none, and none is never shown as a date. */}
        {situation.modeSince ? (
          <p className="text-xs text-foreground/70" data-testid="assistant-situation-since">
            {t('assistant.situations.since', { date: new Date(situation.modeSince).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }) })}
          </p>
        ) : null}
      </div>

      <div className="min-w-0 space-y-1 text-sm">
        <p className="font-medium" data-testid="assistant-situation-mode" data-mode={situation.mode}>
          {t(`assistant.mode.${key}`)}
        </p>
        <p className="break-words text-foreground/80">{t(`assistant.mode.${key}Explain`)}</p>
        <p className="break-words text-xs text-foreground/70" data-testid="assistant-situation-answer">
          {answer}
        </p>
      </div>

      {editable ? (
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => onEdit(situation)} disabled={busy}>
            <Pencil aria-hidden="true" className="mr-1.5 size-4" />
            {t('assistant.situations.edit.button')}
          </Button>
          {isException ? (
            <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => onUseOrganization(situation)} disabled={busy} data-testid="assistant-situation-use-organization">
              <Undo2 aria-hidden="true" className="mr-1.5 size-4" />
              {t('assistant.situations.useOrganization')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

interface SituationsTableProps {
  /** The property whose situations are shown, or `null` for the organization's. */
  propertyId: string | null;
  /** The person may read them (`booking.read` for the organization, `property.read` for a property); without it nothing is asked of the server. */
  canRead: boolean;
  /** The person may change them (the organization administrator for the organization's, `property.write` for a property's exceptions). */
  canEdit: boolean;
}

/**
 * What the assistant does in each situation (E05/F05/US04/T02, NF-66, NF-67, AC-NF66-3), for the organization or for one property: each row says in a plain sentence what
 * it does (only «a person decides» and «a draft for the host» are offered in this release), where its answer comes from (the host's text or the data of the property), and
 * where the value is set (the default, the organization, or an exception of this property, which can go back to the organization's value). A sensitive situation shows
 * a lock and says that it always needs the host's decision. The state is the server's: a mode this release does not offer is not shown as if it worked.
 */
export function SituationsTable({ propertyId, canRead, canEdit }: SituationsTableProps) {
  const { t } = useTranslation();
  const situations = useAssistantSituations(propertyId, canRead);
  const save = useSaveSituation();
  const remove = useRemoveSituationException();
  const [editing, setEditing] = useState<EffectiveSituation | null>(null);

  const busy = save.isPending || remove.isPending;

  if (!canRead) return <SettingsNoAccess message={t('assistant.noAccess.situations')} testId="assistant-situations-no-access" />;
  // A 404 is «not found» even when an older answer is still in the cache (the query keeps its data on an error).
  if (situations.isError && isNotFound(situations.error)) {
    return <SettingsNotFound title={t('assistant.property.notFound')} hint={t('assistant.property.notFoundHint')} testId="assistant-situations-not-found" />;
  }
  if (situations.isPending) return <SettingsLoading testId="assistant-situations-loading" />;
  if (!situations.data) return <SettingsError message={t('assistant.situations.loadError')} onRetry={() => void situations.refetch()} testId="assistant-situations-error" />;

  const open = (situation: EffectiveSituation) => {
    save.reset();
    setEditing(situation);
  };

  const useOrganization = (situation: EffectiveSituation) => {
    if (propertyId === null) return;
    remove.mutate({ propertyId, code: situation.code });
  };

  return (
    <div className="space-y-4" data-testid="assistant-situations">
      {!canEdit ? (
        <Alert variant="info" role="status" data-testid="assistant-situations-read-only">
          {propertyId === null ? t('assistant.readOnly.situations') : t('assistant.readOnly.propertySituations')}
        </Alert>
      ) : null}
      <ul className="space-y-2" aria-label={t('assistant.situations.listLabel')}>
        {situations.data.map((situation) => (
          <SituationRow
            key={situation.code}
            situation={situation}
            inProperty={propertyId !== null}
            editable={canEdit}
            busy={busy}
            onEdit={open}
            onUseOrganization={useOrganization}
          />
        ))}
      </ul>
      {remove.isError ? (
        <Alert variant="danger" role="alert" data-testid="assistant-situations-action-error">
          {assistantProblemMessage(remove.error, t) ?? t('assistant.situations.actionFailed')}
        </Alert>
      ) : null}
      <SituationEditDialog situation={editing} propertyId={propertyId} save={save} onClose={() => setEditing(null)} />
    </div>
  );
}
