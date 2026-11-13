import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { WIZARD_LINK_CLASS } from '../../components/wizard-frame';
import { MARKETPLACE_PATH } from '../../lib/marketplace-paths';
import { briefRows, partnerProblemOf, type BriefField, type PartnerContext } from '../partner-wizard-model';

/** The words of each field of the brief; the keys are written out so that the test of the locale files finds a missing translation. */
const FIELD_TEXT: Readonly<Record<BriefField, string>> = {
  name: 'marketplace.partnerFlow.prepare.fields.name',
  address: 'marketplace.partnerFlow.prepare.fields.address',
  city: 'marketplace.partnerFlow.prepare.fields.city',
  postalCode: 'marketplace.partnerFlow.prepare.fields.postalCode',
  bedrooms: 'marketplace.partnerFlow.prepare.fields.bedrooms',
  bathrooms: 'marketplace.partnerFlow.prepare.fields.bathrooms',
  maxGuests: 'marketplace.partnerFlow.prepare.fields.maxGuests',
  cinCode: 'marketplace.partnerFlow.prepare.fields.cinCode',
};

/** What a read of the brief that failed says: a partner the organization may not see, a property outside its scope, or something that can be tried again. */
export function BriefProblem({ context }: { context: PartnerContext }) {
  const { t } = useTranslation();
  const problem = partnerProblemOf(context.briefError);

  if (problem === 'notFound' || problem === 'propertyNotFound') {
    return (
      <Alert variant="warning" title={t('marketplace.partnerFlow.problem.notAvailable.title')} data-testid="partner-not-available">
        <p>{t(problem === 'notFound' ? 'marketplace.partnerFlow.problem.notAvailable.text' : 'marketplace.partnerFlow.problem.propertyNotFound')}</p>
        <Link to={MARKETPLACE_PATH} className={WIZARD_LINK_CLASS} data-testid="partner-back-to-marketplace">
          {t('marketplace.partnerFlow.backToMarketplace')}
        </Link>
      </Alert>
    );
  }

  return (
    <Alert
      variant="danger"
      data-testid="partner-brief-error"
      action={
        <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={context.onRetry}>
          {t('marketplace.partnerFlow.problem.retry')}
        </Button>
      }
    >
      {t('marketplace.partnerFlow.problem.generic')}
    </Alert>
  );
}

interface PrepareStepProps {
  context: PartnerContext;
}

/**
 * Step «Cosa preparare» (E09/F02/US04/T04, S18): what the host takes to the partner's own site. The data of the property that the partner is likely to ask for, each with
 * a «Copia» button (the brief carries a fixed list of fields: no guest, no booking, no price, no document), and the checklist of what to choose and what to authorise
 * there. The page only shows it to the host: CasaZen sends nothing to the partner.
 */
export function PrepareStep({ context }: PrepareStepProps) {
  const { t } = useTranslation();
  const { brief } = context;

  if (context.briefStatus === 'pending') {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-muted p-4 text-sm" role="status" data-testid="partner-brief-loading">
        <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        {t('marketplace.partnerFlow.prepare.loading')}
      </div>
    );
  }
  if (context.briefStatus === 'error' || !brief) return <BriefProblem context={context} />;

  const rows = briefRows(brief.propertyData);
  const copy = async (field: BriefField, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t('marketplace.partnerFlow.prepare.copied', { field: t(FIELD_TEXT[field]) }));
    } catch {
      // The value is on the screen and can be selected: the person copies it by hand.
      toast.error(t('marketplace.partnerFlow.prepare.copyFailed'));
    }
  };

  return (
    <div className="flex flex-col gap-6" data-testid="partner-prepare-step">
      <section className="min-w-0 space-y-3" aria-labelledby="partner-data-title">
        <h3 id="partner-data-title" className="text-base font-semibold">
          {t('marketplace.partnerFlow.prepare.dataTitle')}
        </h3>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="partner-no-property-data">
            {t('marketplace.partnerFlow.prepare.noProperty', { name: brief.name })}
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t('marketplace.partnerFlow.prepare.dataHint', { name: brief.name })}</p>
            <dl className="divide-y rounded-md border" data-testid="partner-property-data">
              {rows.map(({ field, value }) => (
                <div key={field} className="grid min-w-0 gap-1 px-4 py-2 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] sm:items-center sm:gap-4" data-testid={`partner-field-${field}`}>
                  <dt className="break-words text-sm text-muted-foreground">{t(FIELD_TEXT[field])}</dt>
                  <dd className="min-w-0 break-words text-sm font-medium" data-testid={`partner-field-${field}-value`}>
                    {value ?? t('marketplace.partnerFlow.prepare.noValue')}
                  </dd>
                  {value ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-11 justify-self-start sm:justify-self-end"
                      onClick={() => void copy(field, value)}
                      aria-label={t('marketplace.partnerFlow.prepare.copyField', { field: t(FIELD_TEXT[field]) })}
                      iconRight={<Copy />}
                      data-testid={`partner-copy-${field}`}
                    >
                      {t('marketplace.partnerFlow.prepare.copy')}
                    </Button>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                </div>
              ))}
            </dl>
          </>
        )}
      </section>

      <section className="min-w-0 space-y-3" aria-labelledby="partner-checklist-title">
        <h3 id="partner-checklist-title" className="text-base font-semibold">
          {t('marketplace.partnerFlow.prepare.checklistTitle', { name: brief.name })}
        </h3>
        {brief.checklist.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('marketplace.partnerFlow.prepare.noChecklist', { name: brief.name })}</p>
        ) : (
          <ol className="list-decimal space-y-2 pl-5 text-sm" data-testid="partner-checklist">
            {brief.checklist.map((line, index) => (
              <li key={`${index}-${line}`} className="break-words">
                {line}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
