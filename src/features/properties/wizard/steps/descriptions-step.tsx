import { useId, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ChevronDown, Languages, Pencil, PenLine, type LucideIcon } from 'lucide-react';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { tabLinkClass } from '@/components/ui/tab-styles';
import { Textarea } from '@/components/ui/textarea';
import { LISTING_DESCRIPTION_MAX, LISTING_TITLE_MAX, OPTIONAL_LANGUAGES, shownOrigin } from '@/lib/listing-texts';
import { usePropertyPhotos } from '@/queries/use-property-photos';
import { useSiteProfile } from '@/queries/use-site-profile';
import type { ListingLanguage, TextOrigin } from '@/types';
import type { PropertyWizardValues } from '../property-wizard-model';
import { ListingTextCard } from './listing-text-card';

/** The two languages the listing cannot be published without: they are the tabs. */
const REQUIRED_TABS = ['it', 'en'] as const;
type RequiredTab = (typeof REQUIRED_TABS)[number];

const ORIGIN_ICONS: Record<TextOrigin, LucideIcon> = {
  UserWritten: PenLine,
  AutoTranslated: Languages,
  ModifiedAfterTranslation: Pencil,
};

/** Who wrote a text, said in words next to it (NF-31): written by the host, translated by a machine, or edited after a translation. */
function OriginNote({ origin, testId }: { origin: TextOrigin | null; testId: string }) {
  const { t } = useTranslation();
  if (!origin) return null;
  const Icon = ORIGIN_ICONS[origin];

  return (
    <p className="flex items-center gap-1.5 text-xs text-foreground/70" data-testid={testId} data-origin={origin}>
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {t(`propertyWizard.descriptions.origin.${origin}`)}
    </p>
  );
}

interface LanguageFieldsProps {
  form: UseFormReturn<PropertyWizardValues>;
  language: ListingLanguage;
  /** The origins and the stored texts the server has, to tell what the save will make of what is typed. */
  profile: Parameters<typeof shownOrigin>[0];
}

/** The headline and the description in one language other than Italian. Errors sit on the field they are about. */
function LanguageFields({ form, language, profile }: LanguageFieldsProps) {
  const { t } = useTranslation();
  const { register, watch, formState } = form;
  const typed = watch('texts')[language] ?? { title: '', description: '' };
  const languageName = t(`propertyWizard.descriptions.languages.${language}`);
  const problems = formState.errors.texts?.[language];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Field
          label={t('propertyWizard.descriptions.title.label', { language: languageName })}
          counter={`${typed.title.length}/${LISTING_TITLE_MAX}`}
          error={problems?.title}
        >
          <Input autoComplete="off" lang={language} maxLength={LISTING_TITLE_MAX} {...register(`texts.${language}.title`)} />
        </Field>
        <OriginNote origin={shownOrigin(profile, language, 'title', typed.title)} testId={`property-wizard-origin-${language}-title`} />
      </div>
      <div className="space-y-1">
        <Field
          label={t('propertyWizard.descriptions.description.label', { language: languageName })}
          counter={`${typed.description.length}/${LISTING_DESCRIPTION_MAX}`}
          error={problems?.description}
        >
          <Textarea rows={7} lang={language} {...register(`texts.${language}.description`)} />
        </Field>
        <OriginNote origin={shownOrigin(profile, language, 'description', typed.description)} testId={`property-wizard-origin-${language}-description`} />
      </div>
    </div>
  );
}

interface DescriptionsStepProps {
  form: UseFormReturn<PropertyWizardValues>;
  propertyId: string;
}

/**
 * Step 4 · «Racconta la casa» (NF-31): the headline and the description of the listing in Italian and in English — both required, the
 * channels take no listing without them — in two tabs, and the other twelve languages of the channel manager in an accordion, optional.
 * The origin of each text is told next to it (written by the host, translated automatically, edited after the translation). Italian is
 * the columns of the property and carries the AI suggestion of «Il tuo annuncio»; the other languages are the site profile. A tab that has
 * a problem opens by itself, so the message and the field are where the host looks.
 */
export function DescriptionsStep({ form, propertyId }: DescriptionsStepProps) {
  const { t } = useTranslation();
  const baseId = useId();
  const gallery = usePropertyPhotos(propertyId);
  const photos = gallery.data && Array.isArray(gallery.data.photoUrls) ? gallery.data.photoUrls : [];
  const profile = useSiteProfile(propertyId);
  const { errors } = form.formState;
  const typedTexts = form.watch('texts');
  const typedItalian = form.watch('listingTitle').trim() !== '' && form.watch('description').trim() !== '';
  const [selected, setSelected] = useState<RequiredTab>('it');

  const problemIn: Record<RequiredTab, boolean> = {
    it: Boolean(errors.listingTitle || errors.description),
    en: Boolean(errors.texts?.en),
  };
  // The tab with the first problem opens when a problem appears (state set while rendering, from what the render read: no effect).
  const firstProblem: RequiredTab | null = problemIn.it ? 'it' : problemIn.en ? 'en' : null;
  const [seenProblem, setSeenProblem] = useState<RequiredTab | null>(null);
  if (firstProblem !== seenProblem) {
    setSeenProblem(firstProblem);
    if (firstProblem) setSelected(firstProblem);
  }

  const moveSelection = (key: string) => {
    if (key === 'ArrowRight' || key === 'ArrowLeft') setSelected((current) => (current === 'it' ? 'en' : 'it'));
  };

  const tabId = (tab: RequiredTab) => `${baseId}-tab-${tab}`;
  const panelId = (tab: RequiredTab) => `${baseId}-panel-${tab}`;

  return (
    <>
      <p className="text-sm text-foreground/70" data-testid="property-wizard-descriptions-intro">
        {t('propertyWizard.descriptions.intro')}
      </p>

      <div className="min-w-0">
        <div
          role="tablist"
          aria-label={t('propertyWizard.descriptions.tabs.label')}
          className="mb-4 flex gap-1 border-b"
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
              event.preventDefault();
              moveSelection(event.key);
              document.getElementById(tabId(selected === 'it' ? 'en' : 'it'))?.focus();
            }
          }}
        >
          {REQUIRED_TABS.map((tab) => (
            <button
              key={tab}
              id={tabId(tab)}
              type="button"
              role="tab"
              aria-selected={selected === tab}
              aria-controls={panelId(tab)}
              tabIndex={selected === tab ? 0 : -1}
              className={tabLinkClass(selected === tab)}
              data-testid={`property-wizard-descriptions-tab-${tab}`}
              onClick={() => setSelected(tab)}
            >
              {t(`propertyWizard.descriptions.languages.${tab}`)}
              {problemIn[tab] ? (
                <>
                  <AlertCircle aria-hidden="true" className="size-4 shrink-0 text-danger-foreground" />
                  <span className="sr-only">{t('propertyWizard.descriptions.tabs.problem')}</span>
                </>
              ) : null}
            </button>
          ))}
        </div>

        <div id={panelId('it')} role="tabpanel" aria-labelledby={tabId('it')} hidden={selected !== 'it'} className="min-w-0 space-y-2">
          <ListingTextCard form={form} propertyId={propertyId} photos={photos} />
          <OriginNote origin={typedItalian ? 'UserWritten' : null} testId="property-wizard-origin-it" />
        </div>

        <div id={panelId('en')} role="tabpanel" aria-labelledby={tabId('en')} hidden={selected !== 'en'} className="min-w-0 space-y-4">
          <p className="text-sm text-foreground/70">{t('propertyWizard.descriptions.en.hint')}</p>
          <LanguageFields form={form} language="en" profile={profile.data} />
        </div>
      </div>

      <section aria-labelledby={`${baseId}-others`} className="min-w-0 space-y-2" data-testid="property-wizard-descriptions-others">
        <div className="space-y-1">
          <h3 id={`${baseId}-others`} className="text-base font-semibold">
            {t('propertyWizard.descriptions.others.title')}
          </h3>
          <p className="text-sm text-foreground/70">{t('propertyWizard.descriptions.others.hint')}</p>
        </div>
        <div className="divide-y rounded-lg ring-1 ring-inset ring-border">
          {OPTIONAL_LANGUAGES.map((language) => {
            const typed = typedTexts[language];
            const filled = Boolean(typed && (typed.title.trim() !== '' || typed.description.trim() !== ''));
            return (
              <details key={language} className="group min-w-0 px-4" data-testid={`property-wizard-descriptions-language-${language}`}>
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 font-medium">{t(`propertyWizard.descriptions.languages.${language}`)}</span>
                  <span className="flex shrink-0 items-center gap-2 text-sm text-foreground/70">
                    {filled ? t('propertyWizard.descriptions.others.filled') : t('propertyWizard.descriptions.others.empty')}
                    <ChevronDown aria-hidden="true" className="size-5 transition-transform group-open:rotate-180" />
                  </span>
                </summary>
                <div className="pb-4 pt-1">
                  <LanguageFields form={form} language={language} profile={profile.data} />
                </div>
              </details>
            );
          })}
        </div>
      </section>
    </>
  );
}
