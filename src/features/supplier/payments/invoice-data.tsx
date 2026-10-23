import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { useSupplierProfile } from '@/queries/supplier/use-profile';

const PROFILE_PATH = '/app/supplier/profile';

/**
 * The invoicing details (SP-16c): the business name and the VAT number of the profile, which has them already. Read-only here: they
 * are changed in the profile, one click away. A profile that cannot be read says so with a retry instead of an empty box.
 */
export function InvoiceData() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useSupplierProfile();
  const notGiven = <span className="text-foreground/70">{t('supplier.payments.invoice.notGiven')}</span>;

  return (
    <PlainSection
      title={t('supplier.payments.invoice.title')}
      actionLabel={t('supplier.payments.invoice.edit')}
      href={PROFILE_PATH}
      data-testid="supplier-payments-invoice"
    >
      <p className="text-sm text-foreground/70">{t('supplier.payments.invoice.hint')}</p>
      {data ? (
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-y-2">
          <dt className="text-foreground/70">{t('supplier.payments.invoice.legalName')}</dt>
          <dd className="mb-2 min-w-0 break-words font-medium sm:mb-0">{data.legalName?.trim() || notGiven}</dd>
          <dt className="text-foreground/70">{t('supplier.payments.invoice.vatNumber')}</dt>
          <dd className="min-w-0 break-words font-medium">{data.vatNumber?.trim() || notGiven}</dd>
        </dl>
      ) : isError ? (
        <div className="flex flex-wrap items-center gap-3 text-sm" role="alert">
          <span>{t('supplier.payments.invoice.loadError')}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            {t('supplier.retry')}
          </Button>
        </div>
      ) : isLoading ? (
        <SkeletonLine lines={2} label={t('supplier.payments.invoice.loading')} />
      ) : null}
    </PlainSection>
  );
}
