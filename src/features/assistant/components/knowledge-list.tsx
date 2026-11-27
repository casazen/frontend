import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { KeyRound, Pencil, Plus, Trash2 } from 'lucide-react';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  assistantProblemMessage,
  entryFieldsOf,
  entryRequestOf,
  isNotFound,
  knowledgeTopicText,
  languageText,
} from '@/features/assistant/lib/assistant-model';
import {
  useAssistantKnowledge,
  useDeleteKnowledgeEntry,
  useOrganizationEntries,
  useSaveKnowledgeEntry,
  type EntryScope,
} from '@/queries/use-assistant-settings';
import { KNOWLEDGE_TOPICS, type KnowledgeEntry, type KnowledgeTopic } from '@/types/assistant-settings.types';
import { KnowledgeEntryDialog } from './knowledge-entry-dialog';
import { SettingsError, SettingsLoading, SettingsNoAccess, SettingsNotFound } from './settings-states';

/** What the answers belong to: a property, or the whole organization (every property that has no answer of its own for the same topic and kind). */
export type KnowledgeScope = { kind: 'property'; propertyId: string } | { kind: 'organization' };

interface KnowledgeListProps {
  scope: KnowledgeScope;
  /** The person may read the answers (`property.read` for a property, `booking.read` for the organization); without it nothing is asked of the server. */
  canRead: boolean;
  /** The person may add, change, switch and delete the answers of this scope (`property.write`; the administrator for the organization's). */
  canEdit: boolean;
}

const asTopic = (value: string): KnowledgeTopic | undefined => (KNOWLEDGE_TOPICS as readonly string[]).includes(value) ? (value as KnowledgeTopic) : undefined;

type HeadingTag = 'h2' | 'h3' | 'h4';

interface EntryRowProps {
  entry: KnowledgeEntry;
  /** The level of the heading of the answer: one under the heading of the section it is in. */
  Heading: HeadingTag;
  editable: boolean;
  /** Any request of the list is going on: every button of every row waits for it. */
  busy: boolean;
  onEdit: (entry: KnowledgeEntry) => void;
  onToggle: (entry: KnowledgeEntry, isActive: boolean) => void;
  onDelete: (entry: KnowledgeEntry) => void;
}

function EntryRow({ entry, Heading, editable, busy, onEdit, onToggle, onDelete }: EntryRowProps) {
  const { t, i18n } = useTranslation();
  const heading = entry.title?.trim() ? entry.title : knowledgeTopicText(entry.topic, t, i18n);
  const switchId = `assistant-entry-switch-${entry.id}`;

  return (
    <li className="space-y-2 rounded-lg border bg-card p-3" data-testid="assistant-entry" data-entry-id={entry.id}>
      <div className="flex flex-wrap items-center gap-2">
        <Heading className="min-w-0 break-words text-sm font-semibold">{heading}</Heading>
        <Badge variant="outline">{t(`assistant.knowledge.kind.${entry.kind}`)}</Badge>
        {entry.title?.trim() ? <Badge variant="secondary">{knowledgeTopicText(entry.topic, t, i18n)}</Badge> : null}
        {entry.language ? <Badge variant="outline">{languageText(entry.language, t, i18n)}</Badge> : null}
        {entry.inherited ? <Badge variant="secondary">{t('assistant.knowledge.entry.inherited')}</Badge> : null}
        {!entry.isActive ? (
          <Badge variant="warning" data-testid="assistant-entry-off">
            {t('assistant.knowledge.entry.off')}
          </Badge>
        ) : null}
      </div>
      <p className="whitespace-pre-wrap break-words text-sm text-foreground/80">{entry.text}</p>
      {entry.inherited ? <p className="text-xs text-muted-foreground">{t('assistant.knowledge.entry.inheritedHelp')}</p> : null}
      {editable ? (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={switchId} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <Switch id={switchId} checked={entry.isActive} onCheckedChange={(isActive) => onToggle(entry, isActive)} disabled={busy} />
            <span>{entry.isActive ? t('assistant.knowledge.entry.switchOn') : t('assistant.knowledge.entry.switchOff')}</span>
          </label>
          <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => onEdit(entry)} disabled={busy}>
            <Pencil aria-hidden="true" className="mr-1.5 size-4" />
            {t('assistant.knowledge.entry.edit')}
          </Button>
          <Button type="button" variant="danger-outline" size="sm" className="min-h-11" onClick={() => onDelete(entry)} disabled={busy}>
            <Trash2 aria-hidden="true" className="mr-1.5 size-4" />
            {t('assistant.knowledge.entry.delete')}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

/**
 * What the assistant may say (E05/F05/US04/T02, NF-66, AC-NF66-1). For a property: «From your listing» (the facts the server read from the listing, read-only, with the link
 * to change them there), «Missing information» (the topics with no data, each with an «Add») and «Your answers» (the custom entries, those of the organization shown
 * under them as such: add, edit, switch off, delete; a FAQ has its question and its answer). For the organization: the answers that apply to every property.
 * The texts are the host's own words and may hold a password: they are read where the person may, dropped when the page is left, and a note says that the access
 * codes of a property are never read by the assistant. Every button waits while any request of the list is going on.
 */
export function KnowledgeList({ scope, canRead, canEdit }: KnowledgeListProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language.startsWith('en') ? 'en' : 'it';
  const propertyId = scope.kind === 'property' ? scope.propertyId : null;
  const ofProperty = useAssistantKnowledge(propertyId, language, canRead && scope.kind === 'property');
  const ofOrganization = useOrganizationEntries(canRead && scope.kind === 'organization');
  const save = useSaveKnowledgeEntry();
  const remove = useDeleteKnowledgeEntry();
  const [target, setTarget] = useState<{ entry: KnowledgeEntry | null; topic?: KnowledgeTopic } | null>(null);
  const [deleting, setDeleting] = useState<KnowledgeEntry | null>(null);

  const entryScope: EntryScope = { propertyId };
  const busy = save.isPending || remove.isPending;
  const query = scope.kind === 'property' ? ofProperty : ofOrganization;

  if (!canRead) return <SettingsNoAccess message={t('assistant.noAccess.knowledge')} testId="assistant-knowledge-no-access" />;
  // A 404 is «not found» whatever the cache still holds: the property is not the person's, or it is gone.
  if (query.isError && isNotFound(query.error)) {
    return <SettingsNotFound title={t('assistant.property.notFound')} hint={t('assistant.property.notFoundHint')} testId="assistant-knowledge-not-found" />;
  }
  if (query.isPending) return <SettingsLoading testId="assistant-knowledge-loading" />;
  if (!query.data) return <SettingsError message={t('assistant.knowledge.loadError')} onRetry={() => void query.refetch()} testId="assistant-knowledge-error" />;

  const entries: KnowledgeEntry[] = scope.kind === 'property' ? (ofProperty.data?.entries ?? []) : (ofOrganization.data ?? []);
  const facts = scope.kind === 'property' ? (ofProperty.data?.facts ?? []) : [];
  const missing = scope.kind === 'property' ? (ofProperty.data?.topicsWithoutData ?? []) : [];

  const open = (next: { entry: KnowledgeEntry | null; topic?: KnowledgeTopic }) => {
    save.reset();
    setTarget(next);
  };

  const toggle = (entry: KnowledgeEntry, isActive: boolean) => {
    save.mutate({ scope: entryScope, entryId: entry.id, request: entryRequestOf({ ...entryFieldsOf(entry), isActive }) });
  };

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate({ scope: entryScope, entryId: deleting.id }, { onSuccess: () => setDeleting(null), onError: () => setDeleting(null) });
  };

  const failure = save.isError ? save.error : remove.isError ? remove.error : null;
  // The answers of the organization are a section of the page (h2); the sections of a property are under its name (h3), and its answers under them (h4).
  const SectionHeading: HeadingTag = scope.kind === 'organization' ? 'h2' : 'h3';
  const EntryHeading: HeadingTag = scope.kind === 'organization' ? 'h3' : 'h4';

  return (
    <div className="space-y-6" data-testid="assistant-knowledge">
      {scope.kind === 'property' ? (
        <>
          <section className="space-y-2" aria-labelledby="assistant-facts-title" data-testid="assistant-facts">
            <SectionHeading id="assistant-facts-title" className="text-base font-semibold">
              {t('assistant.knowledge.listing.title')}
            </SectionHeading>
            <p className="break-words text-sm text-foreground/70">{t('assistant.knowledge.listing.help')}</p>
            {facts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('assistant.knowledge.listing.none')}</p>
            ) : (
              <ul className="space-y-1.5">
                {facts.map((fact) => (
                  <li key={`${fact.topic}:${fact.sourceField}`} className="rounded-lg bg-muted/50 p-3 text-sm" data-testid="assistant-fact">
                    <span className="font-medium">{knowledgeTopicText(fact.topic, t, i18n)}: </span>
                    <span className="break-words">{fact.text}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link to={`/app/short-rent/properties/${encodeURIComponent(scope.propertyId)}/edit`} className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline">
              {t('assistant.knowledge.listing.change')}
            </Link>
          </section>

          <section className="space-y-2" aria-labelledby="assistant-missing-title" data-testid="assistant-missing">
            <SectionHeading id="assistant-missing-title" className="text-base font-semibold">
              {t('assistant.knowledge.missing.title')}
            </SectionHeading>
            <p className="break-words text-sm text-foreground/70">{t('assistant.knowledge.missing.help')}</p>
            {missing.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('assistant.knowledge.missing.none')}</p>
            ) : (
              <ul className="space-y-1.5">
                {missing.map((topic) => (
                  <li key={topic} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed p-2 pl-3 text-sm" data-testid="assistant-missing-topic">
                    <span className="min-w-0 break-words">{knowledgeTopicText(topic, t, i18n)}</span>
                    {canEdit ? (
                      <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => open({ entry: null, topic: asTopic(topic) })} disabled={busy}>
                        <Plus aria-hidden="true" className="mr-1.5 size-4" />
                        {t('assistant.knowledge.missing.add')}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      <section className="space-y-2" aria-labelledby={`assistant-answers-title-${scope.kind}`} data-testid="assistant-answers">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionHeading id={`assistant-answers-title-${scope.kind}`} className="text-base font-semibold">
            {scope.kind === 'property' ? t('assistant.knowledge.answers.title') : t('assistant.knowledge.organization.title')}
          </SectionHeading>
          {canEdit ? (
            <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => open({ entry: null })} disabled={busy} data-testid="assistant-entry-add">
              <Plus aria-hidden="true" className="mr-1.5 size-4" />
              {t('assistant.knowledge.answers.add')}
            </Button>
          ) : null}
        </div>
        <p className="break-words text-sm text-foreground/70">
          {scope.kind === 'property' ? t('assistant.knowledge.answers.help') : t('assistant.knowledge.organization.help')}
        </p>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="assistant-entries-none">
            {t('assistant.knowledge.answers.none')}
          </p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} Heading={EntryHeading} editable={canEdit && !entry.inherited} busy={busy} onEdit={(next) => open({ entry: next })} onToggle={toggle} onDelete={setDeleting} />
            ))}
          </ul>
        )}
        {failure ? (
          <Alert variant="danger" role="alert" data-testid="assistant-knowledge-action-error">
            {assistantProblemMessage(failure, t) ?? t('assistant.knowledge.actionFailed')}
          </Alert>
        ) : null}
      </section>

      {scope.kind === 'property' ? (
        <p className="flex items-start gap-2 text-sm text-foreground/70" data-testid="assistant-access-codes-note">
          <KeyRound aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 break-words">{t('assistant.knowledge.accessCodesNote')}</span>
        </p>
      ) : null}

      <KnowledgeEntryDialog target={target} scope={entryScope} save={save} onClose={() => setTarget(null)} />
      <ConfirmationDialog
        open={deleting !== null}
        onOpenChange={(openState) => {
          if (!openState) setDeleting(null);
        }}
        title={t('assistant.knowledge.delete.title')}
        description={t('assistant.knowledge.delete.description')}
        confirmLabel={t('assistant.knowledge.entry.delete')}
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
