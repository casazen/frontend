import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  ASSISTANT_LANGUAGES,
  ENTRY_TEXT_MAX_LENGTH,
  ENTRY_TITLE_MAX_LENGTH,
  assistantProblemMessage,
  entryFieldsOf,
  entryProblem,
  entryRequestOf,
  isNotFound,
  knowledgeTopicText,
  languageText,
  type EntryFields,
} from '@/features/assistant/lib/assistant-model';
import type { EntryScope, useSaveKnowledgeEntry } from '@/queries/use-assistant-settings';
import { KNOWLEDGE_ENTRY_KINDS, KNOWLEDGE_TOPICS, type KnowledgeEntry, type KnowledgeEntryKind, type KnowledgeTopic } from '@/types/assistant-settings.types';

interface KnowledgeEntryDialogProps {
  /** Closed while `null`; `{ entry: null, topic }` is a new answer (for the topic that is missing, when it comes from «Add»); `{ entry }` is a change. */
  target: { entry: KnowledgeEntry | null; topic?: KnowledgeTopic } | null;
  scope: EntryScope;
  /**
   * The mutation belongs to the list, not to the dialog: the host may close the dialog (the X, Esc, a tap outside) while a request goes on, the request must
   * still end the way it started, and every button of the list waits until it is over.
   */
  save: ReturnType<typeof useSaveKnowledgeEntry>;
  onClose: () => void;
}

/**
 * Add or change an answer the assistant may use (NF-66, AC-NF66-1): a question with its answer (a FAQ), a fact or a rule, for a topic, with the language it is
 * written in (or any) and a switch. The text is the host's own words and can hold a password: it stays in this form, is not logged and is not kept after the dialog
 * closes. The rules are the ones of the server (a text of 1 to 1,000 characters, a FAQ with its question); the server stays the judge and a 422 stays on the form.
 */
export function KnowledgeEntryDialog({ target, scope, save, onClose }: KnowledgeEntryDialogProps) {
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {target ? <EntryDialogBody key={target.entry?.id ?? `new:${target.topic ?? ''}`} target={target} scope={scope} save={save} onClose={onClose} /> : null}
    </Dialog>
  );
}

function EntryDialogBody({ target, scope, save, onClose }: Omit<KnowledgeEntryDialogProps, 'target'> & { target: NonNullable<KnowledgeEntryDialogProps['target']> }) {
  const { t, i18n } = useTranslation();
  const { entry, topic } = target;
  const [fields, setFields] = useState<EntryFields>(() => entryFieldsOf(entry, topic));
  const [attempted, setAttempted] = useState(false);

  const problem = entryProblem(fields);
  const update = (patch: Partial<EntryFields>) => setFields((current) => ({ ...current, ...patch }));
  const problemFor = (field: 'title' | 'text'): string | undefined =>
    attempted && problem?.field === field ? t(problem.key, problem.max === undefined ? undefined : { max: problem.max }) : undefined;

  const handleSubmit = (event: FormEvent) => {
    // The dialog is in a portal, and a submit would also reach any form that holds the list in React's tree.
    event.preventDefault();
    event.stopPropagation();
    setAttempted(true);
    if (problem) return;
    save.mutate({ scope, entryId: entry?.id ?? null, request: entryRequestOf(fields) }, { onSuccess: onClose });
  };

  const languages = [...ASSISTANT_LANGUAGES, ...(fields.language && !(ASSISTANT_LANGUAGES as readonly string[]).includes(fields.language) ? [fields.language] : [])];
  const failure = save.isError ? save.error : null;

  return (
    <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto" data-testid="assistant-entry-dialog">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <DialogHeader>
          <DialogTitle>{entry ? t('assistant.knowledge.entry.editTitle') : t('assistant.knowledge.entry.addTitle')}</DialogTitle>
          <DialogDescription>{t('assistant.knowledge.entry.description')}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t('assistant.knowledge.entry.topic')}>
            <Select value={fields.topic} onChange={(event) => update({ topic: event.target.value as KnowledgeTopic })} disabled={save.isPending}>
              {KNOWLEDGE_TOPICS.map((name) => (
                <option key={name} value={name}>
                  {knowledgeTopicText(name, t, i18n)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('assistant.knowledge.entry.kind')}>
            <Select value={fields.kind} onChange={(event) => update({ kind: event.target.value as KnowledgeEntryKind })} disabled={save.isPending}>
              {KNOWLEDGE_ENTRY_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t(`assistant.knowledge.kind.${kind}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {fields.kind === 'Faq' ? (
          <Field label={t('assistant.knowledge.entry.question')} counter={`${fields.title.trim().length}/${ENTRY_TITLE_MAX_LENGTH}`} error={problemFor('title')}>
            <Input value={fields.title} onChange={(event) => update({ title: event.target.value })} readOnly={save.isPending} data-testid="assistant-entry-title" />
          </Field>
        ) : null}

        <Field
          label={fields.kind === 'Faq' ? t('assistant.knowledge.entry.answer') : t('assistant.knowledge.entry.text')}
          hint={t('assistant.knowledge.entry.textHelp')}
          counter={`${fields.text.trim().length}/${ENTRY_TEXT_MAX_LENGTH}`}
          error={problemFor('text')}
        >
          <Textarea rows={5} value={fields.text} onChange={(event) => update({ text: event.target.value })} readOnly={save.isPending} data-testid="assistant-entry-text" />
        </Field>

        <Field label={t('assistant.knowledge.entry.language')} hint={t('assistant.knowledge.entry.languageHelp')}>
          <Select value={fields.language} onChange={(event) => update({ language: event.target.value })} disabled={save.isPending}>
            <option value="">{t('assistant.knowledge.entry.anyLanguage')}</option>
            {languages.map((code) => (
              <option key={code} value={code}>
                {languageText(code, t, i18n)}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <Label htmlFor="assistant-entry-active">{t('assistant.knowledge.entry.active')}</Label>
            <p className="break-words text-sm text-foreground/70">{t('assistant.knowledge.entry.activeHelp')}</p>
          </div>
          <Switch id="assistant-entry-active" checked={fields.isActive} onCheckedChange={(isActive) => update({ isActive })} disabled={save.isPending} />
        </div>

        {failure ? (
          <Alert variant="danger" role="alert" data-testid="assistant-entry-error">
            {isNotFound(failure) ? t('assistant.error.entryNotFound') : (assistantProblemMessage(failure, t) ?? t('assistant.knowledge.entry.saveFailed'))}
          </Alert>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" className="min-h-11" onClick={onClose} disabled={save.isPending}>
            {t('shared.cancel')}
          </Button>
          <Button type="submit" className="min-h-11" loading={save.isPending} data-testid="assistant-entry-save">
            {t('assistant.knowledge.entry.save')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
