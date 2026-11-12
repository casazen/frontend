import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { DocumentRegime } from '@/types';

interface ExampleCopy {
  titleKey: string;
  issuedByKey: string;
  vatKey: string;
}

/**
 * What the document of each regime looks like, in plain words: who issues it, for whom, for what and with which VAT. It is an example,
 * not the rule: the kind of document and the VAT of a regime are in the configuration of the server and are confirmed by the accountant,
 * which the note under the example says. The keys are written out so that the i18n test finds a missing translation.
 */
const EXAMPLES: Readonly<Record<DocumentRegime, ExampleCopy>> = {
  PrivatePerson: {
    titleKey: 'fiscalDocuments.issuer.example.PrivatePerson.title',
    issuedByKey: 'fiscalDocuments.issuer.example.PrivatePerson.issuedBy',
    vatKey: 'fiscalDocuments.issuer.example.PrivatePerson.vat',
  },
  VatOrdinary: {
    titleKey: 'fiscalDocuments.issuer.example.VatOrdinary.title',
    issuedByKey: 'fiscalDocuments.issuer.example.VatOrdinary.issuedBy',
    vatKey: 'fiscalDocuments.issuer.example.VatOrdinary.vat',
  },
  VatFlatRate: {
    titleKey: 'fiscalDocuments.issuer.example.VatFlatRate.title',
    issuedByKey: 'fiscalDocuments.issuer.example.VatFlatRate.issuedBy',
    vatKey: 'fiscalDocuments.issuer.example.VatFlatRate.vat',
  },
};

interface ExampleRowProps {
  label: string;
  value: string;
}

function ExampleRow({ label, value }: ExampleRowProps) {
  return (
    <div className="grid min-w-0 gap-0.5 py-2 sm:grid-cols-[minmax(0,8rem)_minmax(0,1fr)] sm:gap-4">
      <dt className="break-words text-foreground/70">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  );
}

interface DocumentExampleProps {
  regime: DocumentRegime;
}

/** The example document of the regime the two answers lead to (NF-04: an example under what is hard to picture). */
export function DocumentExample({ regime }: DocumentExampleProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const copy = EXAMPLES[regime];

  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-2" data-testid="fiscal-issuer-example" data-regime={regime}>
      <h3 id={headingId} className="text-base font-semibold">
        {t('fiscalDocuments.issuer.example.heading')}
      </h3>
      <div className="min-w-0 rounded-md border bg-background p-4 text-sm">
        <p className="break-words font-semibold">{t(copy.titleKey)}</p>
        <dl className="mt-2 divide-y">
          <ExampleRow label={t('fiscalDocuments.issuer.example.rows.issuedBy')} value={t(copy.issuedByKey)} />
          <ExampleRow label={t('fiscalDocuments.issuer.example.rows.issuedTo')} value={t('fiscalDocuments.issuer.example.issuedTo')} />
          <ExampleRow label={t('fiscalDocuments.issuer.example.rows.stay')} value={t('fiscalDocuments.issuer.example.stay')} />
          <ExampleRow label={t('fiscalDocuments.issuer.example.rows.vat')} value={t(copy.vatKey)} />
        </dl>
      </div>
      <p className="break-words text-sm text-foreground/70">{t('fiscalDocuments.issuer.example.note')}</p>
    </section>
  );
}
