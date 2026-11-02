import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { WizardSummary } from '@/components/shared/wizard/wizard-summary';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { PHONE_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { recommendedStyleFor } from '@/lib/supplier-site/style-config';
import type { SupplierService } from '@/types/supplier-services';
import type { ShowcaseContent, ShowcaseDocument } from '@/types/supplier-showcase';
import { CountedField } from '../panels/counted-field';
import { InactiveServices } from '../panels/inactive-services';
import { HalfFilledItems, ReadinessItems } from '../panels/readiness-items';
import { StyleCards } from '../panels/style-cards';
import { SHOWCASE_LIMITS } from '../showcase-limits';
import { bookingsReasonKey, PAYMENTS_SETTINGS_PATH, SERVICES_PATH } from '../showcase-model';
import { ShowcasePreview } from '../showcase-preview';
import type { WizardValues } from './wizard-model';

/** The live preview of the wizard: the draft of the server with what is being typed on top, not on a phone (there it would be below the fold). */
function WizardPreview({ publicPath, draft, patch }: { publicPath: string | null; draft: ShowcaseDocument; patch: Partial<ShowcaseDocument> }) {
  const phone = useMediaQuery(PHONE_QUERY);
  const doc = useMemo(() => ({ ...draft, ...patch }), [draft, patch]);
  if (!publicPath || phone) return null;
  return <ShowcasePreview publicPath={publicPath} doc={doc} hasServices />;
}

interface StyleStepProps {
  categories: string[];
  publicPath: string | null;
  draft: ShowcaseDocument;
}

/** First step, "Stile": the four styles (the one for the trade marked) and the page drawn as it is chosen. */
export function StyleStep({ categories, publicPath, draft }: StyleStepProps) {
  const form = useFormContext<WizardValues>();
  const style = useWatch({ control: form.control, name: 'style' });
  const patch = useMemo(() => ({ style }), [style]);
  return (
    <div className="space-y-6">
      <StyleCards name="wizard-style" value={style} recommended={recommendedStyleFor(categories)} onChange={(id) => form.setValue('style', id, { shouldDirty: true })} />
      <WizardPreview publicPath={publicPath} draft={draft} patch={patch} />
    </div>
  );
}

interface PresentationStepProps {
  publicPath: string | null;
  draft: ShowcaseDocument;
  /** The texts are the starting ones of the trade: said, so that the person reads them before going on. */
  prefilled: boolean;
}

/** Second step, "Presentazione": the sentence in large type (at least 12 characters) and the introduction. */
export function PresentationStep({ publicPath, draft, prefilled }: PresentationStepProps) {
  const { t } = useTranslation();
  const form = useFormContext<WizardValues>();
  const [tagline, intro] = useWatch({ control: form.control, name: ['tagline', 'intro'] });
  const patch = useMemo(() => ({ tagline, intro }), [tagline, intro]);
  return (
    <div className="space-y-6">
      {prefilled ? (
        <Alert variant="info" data-testid="supplier-showcase-wizard-prefilled">
          {t('supplier.showcase.wizard.presentation.prefilled')}
        </Alert>
      ) : null}
      <Controller
        control={form.control}
        name="tagline"
        render={({ field, fieldState }) => (
          <CountedField
            label={t('supplier.showcase.editor.texts.tagline')}
            hint={t('supplier.showcase.wizard.presentation.taglineHint')}
            value={field.value}
            onChange={field.onChange}
            max={SHOWCASE_LIMITS.tagline}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="intro"
        render={({ field, fieldState }) => (
          <CountedField
            label={t('supplier.showcase.editor.texts.intro')}
            hint={t('supplier.showcase.wizard.presentation.introHint')}
            value={field.value}
            onChange={field.onChange}
            max={SHOWCASE_LIMITS.intro}
            multiline
            rows={3}
            optional
            error={fieldState.error?.message}
          />
        )}
      />
      <WizardPreview publicPath={publicPath} draft={draft} patch={patch} />
    </div>
  );
}

const isActive = (service: SupplierService) => service.status === 'Active';

/** Third step, "Servizi": which of the active services the page shows (at least one); the others are listed apart with the reason. */
export function ServicesStep({ services }: { services: readonly SupplierService[] }) {
  const { t } = useTranslation();
  const form = useFormContext<WizardValues>();
  const active = services.filter(isActive);
  const inactive = services.filter((service) => !isActive(service));

  if (active.length === 0) {
    return (
      <div className="space-y-4">
        <Alert variant="warning" data-testid="supplier-showcase-wizard-no-services">
          {t('supplier.showcase.editor.services.none')}
        </Alert>
        <Button asChild variant="outline">
          <Link to={SERVICES_PATH}>{t('supplier.showcase.editor.services.open')}</Link>
        </Button>
        <InactiveServices services={inactive} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Controller
        control={form.control}
        name="services"
        render={({ field, fieldState }) => (
          <div className="space-y-3">
            <ChoiceGroup legend={t('supplier.showcase.editor.services.title')} minCardWidth={14}>
              {active.map((service) => (
                <ChoiceCard
                  key={service.id}
                  type="checkbox"
                  name={`wizard-service-${service.slug}`}
                  checked={field.value.includes(service.slug)}
                  onChange={(event) => field.onChange(event.target.checked ? [...field.value, service.slug] : field.value.filter((slug) => slug !== service.slug))}
                  data-testid={`supplier-showcase-wizard-service-${service.slug}`}
                  title={service.name}
                  description={getServiceCategoryLabel(service.category, t)}
                />
              ))}
            </ChoiceGroup>
            {fieldState.error?.message ? (
              <p role="alert" className="text-sm text-[color:var(--color-danger-foreground,#b4232a)]">
                {t(fieldState.error.message)}
              </p>
            ) : null}
          </div>
        )}
      />
      <InactiveServices services={inactive} />
    </div>
  );
}

interface SummaryStepProps {
  /** The showcase as the server has it now (every step saved before this one): the checks are its. */
  content: ShowcaseContent;
  services: readonly SupplierService[];
}

/** Last step, "Riepilogo": what was chosen with a way back to each answer, the checks of the server, and why the bookings would stay closed. */
export function SummaryStep({ content, services }: SummaryStepProps) {
  const { t } = useTranslation();
  const form = useFormContext<WizardValues>();
  const values = useWatch({ control: form.control }) as WizardValues;
  const chosen = services.filter((service) => values.services.includes(service.slug)).map((service) => service.name);
  // Not being published is what this step is about to change: the reasons that stay after it are what is worth saying.
  const reasonKey = bookingsReasonKey(content.bookings.blockedBy.filter((reason) => reason !== 'not_published'));

  return (
    <div className="space-y-6">
      <WizardSummary
        items={[
          { id: 'style', label: t('supplier.showcase.editor.style.title'), value: t(`supplier.showcase.editor.style.${values.style}.name`), stepId: 'style' },
          { id: 'tagline', label: t('supplier.showcase.editor.texts.tagline'), value: values.tagline, stepId: 'presentation' },
          { id: 'intro', label: t('supplier.showcase.editor.texts.intro'), value: values.intro, stepId: 'presentation' },
          { id: 'services', label: t('supplier.showcase.editor.services.title'), value: chosen.join(', '), stepId: 'services' },
        ]}
      />

      <section className="space-y-3" aria-labelledby="wizard-checks-title">
        <h3 id="wizard-checks-title" className="text-base font-semibold">
          {t('supplier.showcase.editor.publish.checks')}
        </h3>
        <ul className="space-y-3">
          <HalfFilledItems doc={content.draft} />
          <ReadinessItems items={content.readiness.items} />
        </ul>
      </section>

      {reasonKey ? (
        <section className="space-y-2" aria-labelledby="wizard-bookings-title">
          <h3 id="wizard-bookings-title" className="text-base font-semibold">
            {t('supplier.showcase.bookings.title')}
          </h3>
          <p className="text-sm">{t(reasonKey)}</p>
          {content.bookings.blockedBy.includes('payments_account_not_ready') ? (
            <Button asChild variant="outline" size="sm">
              <Link to={PAYMENTS_SETTINGS_PATH}>{t('supplier.showcase.bookings.goToPayments')}</Link>
            </Button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
