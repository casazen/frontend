import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { HelpTip } from '@/components/ui/help-tip';
import { getProblemMessage } from '@/lib/api-errors';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { toastUndo } from '@/lib/toast-undo';
import { useSuggestShowcaseTexts } from '@/queries/supplier/use-showcase';
import type { ShowcaseDocument, ShowcaseTextField, ShowcaseTextSuggestion } from '@/types/supplier-showcase';
import {
  AI_ANSWER_LIMITS,
  aiFill,
  answersToSend,
  defaultChoice,
  isWritten,
  suggestedFields,
  suggestedValue,
  type AiAnswerInputs,
  type AppliedAi,
} from '../showcase-ai-texts';
import type { DraftPatch } from '../use-showcase-draft';
import { CountedField } from './counted-field';

/** The label of each member, the same words the field of the panel has. */
const FIELD_LABEL: Record<ShowcaseTextField, string> = {
  tagline: 'supplier.showcase.editor.texts.tagline',
  intro: 'supplier.showcase.editor.texts.intro',
  bio: 'supplier.showcase.editor.texts.bio',
  prep: 'supplier.showcase.editor.texts.prepTitle',
};

const NO_ANSWERS: AiAnswerInputs = { about: '', years: '', specialties: '', differentiator: '' };

/** More zones than this are said as «e altre N». */
const ZONES_SHOWN = 3;

interface AiTextsBlockProps {
  doc: ShowcaseDocument;
  change: (patch: DraftPatch) => void;
  /** Told which members went into the draft from the AI: the panel marks them as a draft until the supplier changes them. */
  onApplied: (applied: AppliedAi) => void;
  /** Told which members were taken back with «Annulla»: the mark goes with them. */
  onTakenBack: (fields: ShowcaseTextField[]) => void;
  /** The static starter, when there is one to offer: a way to it under the button, for who prefers a text that is ready. */
  onUseStarter?: () => void;
}

/**
 * «Scrivi con l'AI» (the AI help of the editor, next to the static starter of SP-13d): drafts of the sentence, the introduction, «chi siamo» and
 * the tips «prima che arriviamo», written on the server from what is true of the supplier (its categories, its zones, the names of its services)
 * and from what it types here, and checked there so that no guarantee, certification, insurance, years, time, price or rating appears that the
 * supplier did not write. Nothing is put in the draft by itself: the supplier chooses the members, they go in with an «Annulla», they are marked as
 * a draft of the AI until it changes them, and nothing is public before the publication. The guarantee, the people, the strengths, the
 * certifications and the questions are not drafted: the supplier writes them.
 */
export function AiTextsBlock({ doc, change, onApplied, onTakenBack, onUseStarter }: AiTextsBlockProps) {
  const { t } = useTranslation();
  const suggest = useSuggestShowcaseTexts();
  const [answers, setAnswers] = useState<AiAnswerInputs>(NO_ANSWERS);
  const [more, setMore] = useState(false);
  const [suggestion, setSuggestion] = useState<ShowcaseTextSuggestion | null>(null);
  const [chosen, setChosen] = useState<ShowcaseTextField[]>([]);
  const [failure, setFailure] = useState<string | null>(null);

  const setAnswer = (key: keyof AiAnswerInputs) => (value: string) => setAnswers((previous) => ({ ...previous, [key]: value }));

  const write = (regenerate: boolean) => {
    setFailure(null);
    suggest.mutate(
      { answers: answersToSend(answers), regenerate },
      {
        onSuccess: (next) => {
          setSuggestion(next);
          setChosen(defaultChoice(doc, next));
        },
        onError: (error) => setFailure(getProblemMessage(error, t) ?? t('supplier.showcase.editor.ai.error')),
      },
    );
  };

  const apply = () => {
    const fill = suggestion ? aiFill(doc, suggestion, chosen) : null;
    if (!fill) return;

    change(fill.patch);
    onApplied(fill.applied);
    setSuggestion(null);
    toastUndo(t('supplier.showcase.editor.ai.applied'), {
      undo: () => {
        change(fill.inverse);
        onTakenBack(Object.keys(fill.applied) as ShowcaseTextField[]);
      },
    });
  };

  return (
    <section aria-labelledby="supplier-showcase-ai-title" className="space-y-4 rounded-lg bg-muted p-4" data-testid="supplier-showcase-ai">
      <div className="flex min-w-0 items-start gap-3">
        <Sparkles aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-foreground/70" />
        <div className="min-w-0 flex-1 space-y-1">
          <h2 id="supplier-showcase-ai-title" className="flex items-center gap-1 text-lg font-semibold">
            {t('supplier.showcase.editor.ai.title')}
            <HelpTip title={t('supplier.showcase.editor.ai.tipBasis.title')}>{t('supplier.showcase.editor.ai.tipBasis.body')}</HelpTip>
          </h2>
          <p className="text-sm text-foreground/70">{t('supplier.showcase.editor.ai.hint')}</p>
        </div>
      </div>

      {suggestion ? (
        <SuggestionResult
          doc={doc}
          suggestion={suggestion}
          chosen={chosen}
          onChosen={setChosen}
          onApply={apply}
          onAgain={() => write(true)}
          onClose={() => setSuggestion(null)}
          busy={suggest.isPending}
        />
      ) : (
        <div className="space-y-3">
          <p className="flex items-center gap-1 text-sm font-medium">
            {t('supplier.showcase.editor.ai.answers.title')}
            <HelpTip title={t('supplier.showcase.editor.ai.tipBetter.title')}>{t('supplier.showcase.editor.ai.tipBetter.body')}</HelpTip>
          </p>
          <CountedField
            label={t('supplier.showcase.editor.ai.answers.about.label')}
            hint={t('supplier.showcase.editor.ai.answers.about.hint')}
            value={answers.about}
            max={AI_ANSWER_LIMITS.about}
            multiline
            rows={3}
            optional
            onChange={setAnswer('about')}
          />
          <Button type="button" variant="ghost" size="sm" aria-expanded={more} onClick={() => setMore((open) => !open)} data-testid="supplier-showcase-ai-more">
            {more ? t('supplier.showcase.editor.ai.answers.less') : t('supplier.showcase.editor.ai.answers.more')}
          </Button>
          {more ? (
            <div className="space-y-3">
              <CountedField
                label={t('supplier.showcase.editor.ai.answers.years.label')}
                hint={t('supplier.showcase.editor.ai.answers.years.hint')}
                value={answers.years}
                max={AI_ANSWER_LIMITS.years}
                optional
                onChange={setAnswer('years')}
              />
              <CountedField
                label={t('supplier.showcase.editor.ai.answers.specialties.label')}
                value={answers.specialties}
                max={AI_ANSWER_LIMITS.specialties}
                optional
                onChange={setAnswer('specialties')}
              />
              <CountedField
                label={t('supplier.showcase.editor.ai.answers.differentiator.label')}
                value={answers.differentiator}
                max={AI_ANSWER_LIMITS.differentiator}
                optional
                onChange={setAnswer('differentiator')}
              />
            </div>
          ) : null}

          {failure ? (
            <p role="alert" className="text-sm text-danger-foreground" data-testid="supplier-showcase-ai-error">
              {failure}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" loading={suggest.isPending} onClick={() => write(false)} data-testid="supplier-showcase-ai-write">
              {suggest.isPending ? t('supplier.showcase.editor.ai.writing') : t('supplier.showcase.editor.ai.write')}
            </Button>
            {onUseStarter ? (
              <Button type="button" variant="ghost" size="sm" onClick={onUseStarter} data-testid="supplier-showcase-ai-starter">
                {t('supplier.showcase.editor.ai.starterInstead')}
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

interface SuggestionResultProps {
  doc: ShowcaseDocument;
  suggestion: ShowcaseTextSuggestion;
  chosen: ShowcaseTextField[];
  onChosen: (chosen: ShowcaseTextField[]) => void;
  onApply: () => void;
  onAgain: () => void;
  onClose: () => void;
  busy: boolean;
}

/** The draft: each member with a box to take it, ticked where the supplier has written nothing, and the line that says what it was written from. */
function SuggestionResult({ doc, suggestion, chosen, onChosen, onApply, onAgain, onClose, busy }: SuggestionResultProps) {
  const { t } = useTranslation();
  const fields = suggestedFields(suggestion);

  const toggle = (field: ShowcaseTextField, on: boolean) =>
    onChosen(on ? [...chosen, field] : chosen.filter((other) => other !== field));

  return (
    <div className="space-y-4" data-testid="supplier-showcase-ai-result">
      <h3 className="text-base font-semibold">{t('supplier.showcase.editor.ai.result.title')}</h3>

      <ul role="list" className="space-y-3">
        {fields.map((field) => {
          const value = suggestedValue(suggestion, field);
          return (
            <li key={field} className="flex min-w-0 items-start gap-3 rounded-md border bg-card p-3" data-testid={`supplier-showcase-ai-field-${field}`}>
              <Checkbox
                id={`supplier-showcase-ai-take-${field}`}
                className="mt-1"
                checked={chosen.includes(field)}
                onCheckedChange={(checked) => toggle(field, checked === true)}
              />
              <div className="min-w-0 flex-1 space-y-1">
                <label htmlFor={`supplier-showcase-ai-take-${field}`} className="text-sm font-medium">
                  {t(FIELD_LABEL[field])}
                </label>
                {Array.isArray(value) ? (
                  <ul className="list-disc space-y-0.5 pl-5 text-sm">
                    {value.map((item) => (
                      <li key={item} className="break-words">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="whitespace-pre-line break-words text-sm">{value}</p>
                )}
                {isWritten(doc, field) ? <p className="text-xs text-foreground/70">{t('supplier.showcase.editor.ai.replaces')}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>

      {suggestion.rejected.length > 0 ? (
        <p className="text-sm text-foreground/70" data-testid="supplier-showcase-ai-dropped">
          {t('supplier.showcase.editor.ai.dropped', { names: suggestion.rejected.map((field) => t(FIELD_LABEL[field])).join(', ') })}
        </p>
      ) : null}

      <BasedOn suggestion={suggestion} />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={onApply} disabled={chosen.length === 0} data-testid="supplier-showcase-ai-use">
          {t('supplier.showcase.editor.ai.result.use')}
        </Button>
        <Button type="button" variant="outline" loading={busy} onClick={onAgain} data-testid="supplier-showcase-ai-again">
          {t('supplier.showcase.editor.ai.again')}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          {t('supplier.showcase.editor.ai.result.close')}
        </Button>
      </div>
    </div>
  );
}

/** «Basato su: Pulizie, Giardinaggio · Cesano Maderno, Seveso · 2 servizi · le tue righe»: only what was really used. */
function BasedOn({ suggestion }: { suggestion: ShowcaseTextSuggestion }) {
  const { t } = useTranslation();
  const { categories, zones, services, answers } = suggestion.basis;

  const zonesText =
    zones.length > ZONES_SHOWN
      ? t('supplier.showcase.editor.ai.basedOn.zonesMore', { names: zones.slice(0, ZONES_SHOWN).join(', '), count: zones.length - ZONES_SHOWN })
      : zones.join(', ');

  const parts = [
    categories.length > 0 ? categories.map((code) => getServiceCategoryLabel(code, t)).join(', ') : null,
    zones.length > 0 ? zonesText : null,
    services.length > 0 ? t('supplier.showcase.editor.ai.basedOn.services', { count: services.length }) : null,
    answers.length > 0 ? t('supplier.showcase.editor.ai.basedOn.answers') : null,
  ].filter((part): part is string => part !== null);

  if (parts.length === 0) return null;
  return (
    <p className="text-xs text-foreground/70" data-testid="supplier-showcase-ai-basis">
      {t('supplier.showcase.editor.ai.basedOn.label', { parts: parts.join(' · ') })}
    </p>
  );
}
