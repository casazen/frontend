import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  TEMPLATE_MAX_LENGTH,
  assistantProblemMessage,
  isNotFound,
  knowledgeTopicText,
  modeKey,
  situationText,
} from '@/features/assistant/lib/assistant-model';
import type { useSaveSituation } from '@/queries/use-assistant-settings';
import {
  KNOWLEDGE_TOPICS,
  OFFERED_MODES,
  type AssistantMode,
  type EffectiveSituation,
  type KnowledgeTopic,
} from '@/types/assistant-settings.types';

interface SituationEditDialogProps {
  /** The situation to change; `null` while the dialog is closed. */
  situation: EffectiveSituation | null;
  /** The property whose exception is saved, or `null` for the value of the organization. */
  propertyId: string | null;
  /**
   * The mutation belongs to the table, not to the dialog: the dialog may be closed while the request goes on, and every button of the table waits until it is over.
   */
  save: ReturnType<typeof useSaveSituation>;
  onClose: () => void;
}

/**
 * What the assistant does in a situation (NF-66, NF-67, AC-NF66-3): in this release only «a person decides» (a «To do») and «a draft for the host» are offered, never a mode
 * that sends by itself, and a sensitive situation says that it always needs the host's decision. The answer comes from the text the host writes here or, without one,
 * from a topic of the data of the property. The row is saved whole: the mode, the text and the topic that were read are sent back, so that changing one never drops the others.
 */
export function SituationEditDialog({ situation, propertyId, save, onClose }: SituationEditDialogProps) {
  return (
    <Dialog
      open={situation !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {situation ? <SituationDialogBody key={`${situation.code}:${propertyId ?? 'org'}`} situation={situation} propertyId={propertyId} save={save} onClose={onClose} /> : null}
    </Dialog>
  );
}

function SituationDialogBody({ situation, propertyId, save, onClose }: Omit<SituationEditDialogProps, 'situation'> & { situation: EffectiveSituation }) {
  const { t, i18n } = useTranslation();
  // The modes the situation allows and this release offers; a mode that is neither (an automatic one set through the API) is told, and saving sets a mode that is offered.
  const allowed = OFFERED_MODES.filter((mode) => situation.allowedModes.includes(mode));
  const currentIsOffered = allowed.includes(situation.mode as AssistantMode);
  const [mode, setMode] = useState<AssistantMode>(currentIsOffered ? (situation.mode as AssistantMode) : 'Draft');
  const [template, setTemplate] = useState(situation.template ?? '');
  const [source, setSource] = useState<string>(situation.source ?? '');
  const [attempted, setAttempted] = useState(false);

  // The text of the answer is the host's own, shown only to whoever may edit it: a person who may not read it cannot keep it, and saving a row without it is said.
  const templateHidden = situation.hasTemplate && situation.template === null;
  const templateTooLong = template.trim().length > TEMPLATE_MAX_LENGTH;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setAttempted(true);
    if (templateTooLong) return;
    save.mutate(
      {
        propertyId,
        code: situation.code,
        request: {
          mode,
          template: template.trim().length > 0 ? template.trim() : null,
          source: (KNOWLEDGE_TOPICS as readonly string[]).includes(source) ? (source as KnowledgeTopic) : null,
        },
      },
      { onSuccess: onClose },
    );
  };

  const failure = save.isError ? save.error : null;
  const name = situationText(situation.code, t, i18n);

  return (
    <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto" data-testid="assistant-situation-dialog">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <DialogHeader>
          <DialogTitle>{t('assistant.situations.edit.title', { situation: name })}</DialogTitle>
          <DialogDescription>{propertyId === null ? t('assistant.situations.edit.descriptionOrganization') : t('assistant.situations.edit.descriptionProperty')}</DialogDescription>
        </DialogHeader>

        {situation.isSensitive ? (
          <p className="flex items-start gap-2 text-sm" data-testid="assistant-situation-sensitive">
            <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 break-words">{t('assistant.situations.sensitive')}</span>
          </p>
        ) : null}

        <div className="space-y-1.5">
          <p className="text-sm font-medium leading-snug">{t('assistant.situations.edit.mode')}</p>
          <Segmented<AssistantMode>
            label={t('assistant.situations.edit.mode')}
            value={mode}
            onValueChange={setMode}
            options={allowed.map((option) => ({ value: option, label: t(`assistant.mode.${modeKey(option)}`), testId: `assistant-mode-${option}`, disabled: save.isPending }))}
          />
          <p className="break-words text-sm text-foreground/70" data-testid="assistant-mode-explain">
            {t(`assistant.mode.${modeKey(mode)}Explain`)}
          </p>
          {!currentIsOffered ? (
            <Alert variant="warning" data-testid="assistant-mode-not-offered">
              {t('assistant.situations.edit.notOffered')}
            </Alert>
          ) : null}
        </div>

        {templateHidden ? (
          <Alert variant="info" data-testid="assistant-template-hidden">
            {t('assistant.situations.edit.templateHidden')}
          </Alert>
        ) : null}

        <Field
          label={t('assistant.situations.edit.template')}
          hint={t('assistant.situations.edit.templateHelp')}
          counter={`${template.trim().length}/${TEMPLATE_MAX_LENGTH}`}
          error={attempted && templateTooLong ? t('assistant.situations.edit.templateTooLong', { max: TEMPLATE_MAX_LENGTH }) : undefined}
        >
          <Textarea rows={4} value={template} onChange={(event) => setTemplate(event.target.value)} readOnly={save.isPending} data-testid="assistant-situation-template" />
        </Field>

        <Field label={t('assistant.situations.edit.source')} hint={t('assistant.situations.edit.sourceHelp')}>
          <Select value={source} onChange={(event) => setSource(event.target.value)} disabled={save.isPending} data-testid="assistant-situation-source">
            <option value="">{t('assistant.situations.edit.noSource')}</option>
            {KNOWLEDGE_TOPICS.map((topic) => (
              <option key={topic} value={topic}>
                {knowledgeTopicText(topic, t, i18n)}
              </option>
            ))}
          </Select>
        </Field>

        {failure ? (
          <Alert variant="danger" role="alert" data-testid="assistant-situation-error">
            {isNotFound(failure) ? t('assistant.error.situationNotFound') : (assistantProblemMessage(failure, t) ?? t('assistant.situations.edit.saveFailed'))}
          </Alert>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" className="min-h-11" onClick={onClose} disabled={save.isPending}>
            {t('shared.cancel')}
          </Button>
          <Button type="submit" className="min-h-11" loading={save.isPending} data-testid="assistant-situation-save">
            {t('assistant.situations.edit.save')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
