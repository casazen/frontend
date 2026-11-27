import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UseFormReturn } from 'react-hook-form';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { listingTextApi, type ListingTextBasis } from '@/api/listing-text.api';
import { LISTING_LANGUAGES, type ListingLanguage, type ListingTexts } from '@/types';
import { getHttpStatus } from '@/lib/api-errors';
import { LISTING_EXTRA_FIELDS } from '@/lib/listing-texts';
import { describeBasis } from '../listing-text-basis';
import { reducePhotosForAi } from '../photos/reduce-photo';
import type { PropertyWizardValues } from '../property-wizard-model';

type Snapshot = Pick<PropertyWizardValues, 'listingTitle' | 'description' | 'houseRules' | 'texts'>;
const FIELDS = ['title', 'description', ...LISTING_EXTRA_FIELDS] as const;

/** Suggestions remain in a preview until explicitly applied. A failed language never changes the host's draft. */
export function ListingAiDialog({ form, propertyId, photos }: { form: UseFormReturn<PropertyWizardValues>; propertyId: string; photos: readonly string[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ListingLanguage[]>(['it', 'en']);
  const [results, setResults] = useState<Partial<Record<ListingLanguage, ListingTexts>>>({});
  const [basis, setBasis] = useState<Partial<Record<ListingLanguage, ListingTextBasis>>>({});
  const [failed, setFailed] = useState<ListingLanguage[]>([]);
  const [progress, setProgress] = useState<{ language: ListingLanguage; current: number; total: number } | null>(null);
  const [review, setReview] = useState(false);
  const [previous, setPrevious] = useState<Snapshot | null>(null);
  const generation = useRef(0);
  const requestController = useRef<AbortController | null>(null);
  useEffect(() => () => { generation.current++; requestController.current?.abort(); }, []);
  const busy = progress !== null;
  const languageName = (language: ListingLanguage) => t(`propertyWizard.descriptions.languages.${language}`);
  const changeOpen = (value: boolean) => {
    if (!value) { generation.current++; requestController.current?.abort(); setProgress(null); }
    setOpen(value);
  };
  const generate = async (languages: ListingLanguage[], retry = false) => {
    const run = ++generation.current;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setFailed([]);
    setReview(true);
    if (!retry) setResults({});
    setProgress({ language: languages[0], current: 1, total: languages.length });
    let reduced: string[];
    try { reduced = await reducePhotosForAi(photos); }
    catch { reduced = []; }
    if (generation.current !== run) return;
    for (const [index, language] of languages.entries()) {
      setProgress({ language, current: index + 1, total: languages.length });
      let budgetExhausted = false;
      try {
        const answer = await listingTextApi.suggestFields(propertyId, { photos: reduced, language, regenerate: retry }, controller.signal);
        if (generation.current !== run) return;
        budgetExhausted = answer.reason === 'ai_budget_exhausted';
        if (!answer.aiUsed || !answer.fields?.title || !answer.fields.description) throw new Error('No suggestion');
        setResults((current) => ({ ...current, [language]: answer.fields! }));
        setBasis((current) => ({ ...current, [language]: answer.basedOn }));
      } catch (error) {
        if (generation.current !== run) return;
        if (budgetExhausted || [401, 403, 429].includes(getHttpStatus(error) ?? 0)) {
          setFailed((current) => [...current, ...languages.slice(index)]);
          break;
        }
        setFailed((current) => [...current, language]);
      }
    }
    if (generation.current === run) setProgress(null);
  };
  const apply = () => {
    const values = form.getValues();
    setPrevious((current) => current ?? structuredClone({ listingTitle: values.listingTitle, description: values.description, houseRules: values.houseRules, texts: values.texts }));
    const texts = structuredClone(values.texts);
    for (const language of selected) {
      const fields = results[language];
      if (!fields) continue;
      const populated = Object.fromEntries(FIELDS.filter((field) => fields[field]?.trim()).map((field) => [field, fields[field]!.trim()]));
      if (language === 'it') {
        if (populated.title) form.setValue('listingTitle', populated.title, { shouldDirty: true, shouldValidate: true });
        if (populated.description) form.setValue('description', populated.description, { shouldDirty: true, shouldValidate: true });
        if (populated.rules) form.setValue('houseRules', populated.rules, { shouldDirty: true });
        texts.it = { ...texts.it, title: '', description: '', ...Object.fromEntries(LISTING_EXTRA_FIELDS.filter((field) => populated[field]).map((field) => [field, populated[field]])) };
      } else texts[language] = { ...texts[language], ...populated, title: populated.title ?? texts[language]?.title ?? '', description: populated.description ?? texts[language]?.description ?? '' };
    }
    form.setValue('texts', texts, { shouldDirty: true, shouldValidate: true });
    changeOpen(false);
  };
  const undo = () => {
    if (!previous) return;
    form.setValue('listingTitle', previous.listingTitle, { shouldDirty: true, shouldValidate: true });
    form.setValue('description', previous.description, { shouldDirty: true, shouldValidate: true });
    form.setValue('houseRules', previous.houseRules, { shouldDirty: true });
    form.setValue('texts', previous.texts, { shouldDirty: true, shouldValidate: true });
    setPrevious(null);
  };
  return <>
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={() => { setReview(false); changeOpen(true); }} data-testid="property-wizard-suggest"><Sparkles className="size-4" aria-hidden="true" />{t('propertyWizard.photos.listing.suggest')}</Button>
      {previous ? <Button type="button" variant="ghost" onClick={undo} data-testid="property-wizard-suggest-undo">{t('listingAi.undo')}</Button> : null}
    </div>
    {previous ? <p role="status" className="text-sm text-foreground/70">{t('listingAi.applied')}</p> : null}
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{t(review ? 'listingAi.review' : 'listingAi.title')}</DialogTitle><DialogDescription>{t(review ? 'listingAi.reviewHint' : 'listingAi.intro')}</DialogDescription></DialogHeader>
        {!review ? <>
          <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => setSelected(['it', 'en'])}>{t('listingAi.recommended')}</Button><Button type="button" variant="outline" onClick={() => setSelected([...LISTING_LANGUAGES])}>{t('listingAi.all')}</Button></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {LISTING_LANGUAGES.map((language) => <label key={language} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-border p-3"><input type="checkbox" checked={selected.includes(language)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, language] : current.filter((item) => item !== language))} />{languageName(language)}</label>)}
          </div>
          <Button type="button" disabled={selected.length === 0} onClick={() => void generate(selected)} data-testid="listing-ai-generate">{t('listingAi.generate')}</Button>
        </> : <>
          <div role="status" aria-live="polite" className="text-sm text-foreground/70">{progress ? t('listingAi.generating', { ...progress, language: languageName(progress.language) }) : null}</div>
          {failed.map((language) => <p key={language} role="alert" className="text-sm text-danger-foreground">{t('listingAi.failed', { language: languageName(language) })}</p>)}
          {selected.map((language) => <details key={language} className="rounded-lg border border-border p-4" open={selected.length === 1}>
            <summary className="cursor-pointer font-medium">{languageName(language)}</summary>
            {basis[language] ? <p className="mt-3 text-xs text-foreground/70">{t('propertyWizard.photos.listing.aiWritten', { basis: describeBasis(basis[language]!, t) })}</p> : null}
            {results[language] ? <dl className="mt-4 space-y-4">{FIELDS.map((field) => <div key={field}><dt className="text-sm font-medium">{t(`listingAi.fields.${field}`)}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground/70" lang={language}>{results[language]?.[field] || t('listingAi.empty')}</dd></div>)}</dl> : null}
          </details>)}
          <div className="flex flex-wrap justify-between gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setReview(false)}>{t('listingAi.back')}</Button>
            {failed.length ? <Button type="button" variant="outline" disabled={busy} onClick={() => void generate(failed, true)}>{t('listingAi.retry')}</Button> : null}
            <Button type="button" disabled={busy || !selected.some((language) => results[language])} onClick={apply} data-testid="listing-ai-apply">{t('listingAi.apply')}</Button>
          </div>
        </>}
        <Button type="button" variant="ghost" onClick={() => changeOpen(false)}>{t('listingAi.cancel')}</Button>
      </DialogContent>
    </Dialog>
  </>;
}
