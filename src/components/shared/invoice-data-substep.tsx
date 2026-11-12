import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { InvoiceDataFields } from '@/components/shared/invoice-data-fields';
import { getProblemMessage } from '@/lib/api-errors';
import { INVOICE_FIELDS_COPY } from '@/lib/invoice-data-copy';
import {
  createInvoiceDataSchema,
  invoiceDataFormOf,
  invoiceFailuresOfZod,
  invoiceFieldErrorsOf,
  readInvoiceDataProblems,
  sameInvoiceData,
  toSaveInvoiceDataRequest,
  type InvoiceDataFieldErrors,
  type InvoiceDataFormValues,
} from '@/lib/invoice-data-schema';
import { useInvoiceData, useSaveInvoiceData } from '@/queries/use-invoice-data';
import { INVOICE_DATA_SOURCES, type InvoiceDataField, type InvoiceDataTextField } from '@/types';

/** What a change of a field says about the form: the kind is one of the two kinds, every other field is text. */
function changeOf(field: InvoiceDataField, value: string): Partial<InvoiceDataFormValues> {
  if (field === 'recipientKind') return { recipientKind: value === 'Company' ? 'Company' : 'Guest' };

  const change: Partial<Record<InvoiceDataTextField, string>> = {};
  change[field] = value;
  return change;
}

export interface InvoiceDataSubstepProps {
  bookingId: string;
  /** The data is right and, if the host changed it, saved: the place the sub-step was opened from shows again. */
  onDone: () => void;
  /** The host gives up: nothing is saved and the place the sub-step was opened from shows again. */
  onCancel: () => void;
}

/**
 * «Who to invoice» (FIS-01, NF-81, UX-02): the sub-step where the host checks who the invoice of a booking is made out to and corrects it. A nested
 * panel with «Done» and «Cancel» that returns to the place it was opened from, so it can be put inside the booking or inside any wizard without
 * leaving the process: it is made of plain controls and plain buttons, no `<form>`, so it never submits the form that holds it.
 *
 * It starts from what CasaZen has (the data of the channel manager or of the guest's check-in is already in the fields) and says where it came from.
 * «Done» checks the data with the rules of the server, saves it as the host's own (what the host writes is never overwritten by an import or by
 * the guest) and closes; when nothing was changed it closes without saving, so a look at the data does not make the host its author. A field
 * the server refuses is shown on the field in simple words, with what the host typed kept.
 */
export function InvoiceDataSubstep({ bookingId, onDone, onCancel }: InvoiceDataSubstepProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const query = useInvoiceData(bookingId);
  const save = useSaveInvoiceData(bookingId);
  const schema = useMemo(() => createInvoiceDataSchema({ requireIdentification: true }), []);

  // What the host typed is kept apart from what the server has, so that a read that comes in while the host types (the guest sent the check-in, the
  // channel manager filled a field) never wipes what was typed.
  const base = useMemo(() => invoiceDataFormOf(query.data), [query.data]);
  const [edits, setEdits] = useState<Partial<InvoiceDataFormValues>>({});
  const values: InvoiceDataFormValues = { ...base, ...edits };
  const [errors, setErrors] = useState<InvoiceDataFieldErrors>({});
  const [problem, setProblem] = useState<string | null>(null);

  const panel = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [focusRequest, setFocusRequest] = useState(0);

  // The panel opens on its title, so a screen reader says where the person is and the keyboard goes on to the fields.
  useEffect(() => {
    heading.current?.focus();
  }, []);

  // After a failed «Done» the focus goes to the first field in error (NF-11).
  useEffect(() => {
    if (focusRequest === 0) return;
    panel.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusRequest]);

  const change = (field: InvoiceDataField, value: string) => {
    setEdits((previous) => ({ ...previous, ...changeOf(field, value) }));
    setErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const done = async () => {
    setProblem(null);
    const checked = schema.safeParse(values);
    if (!checked.success) {
      setErrors(invoiceFieldErrorsOf(invoiceFailuresOfZod(checked.error)));
      setFocusRequest((count) => count + 1);
      return;
    }
    setErrors({});

    if (sameInvoiceData(values, base)) {
      onDone();
      return;
    }
    try {
      await save.mutateAsync(toSaveInvoiceDataRequest(values));
      onDone();
    } catch (error) {
      const refused = readInvoiceDataProblems(error);
      if (refused.length > 0) {
        setErrors(invoiceFieldErrorsOf(refused));
        setFocusRequest((count) => count + 1);
      } else {
        setProblem(getProblemMessage(error, t) ?? t('invoiceData.substep.saveFailed'));
      }
    }
  };

  // Enter in a field is «Done». It is also what keeps the panel from submitting the form that holds it: inside a wizard, Enter in a field would
  // otherwise press that form's own submit button.
  const keyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing || !(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    if (query.isSuccess && !save.isPending) void done();
  };

  const source = query.data?.source;
  const knownSource = source !== undefined && (INVOICE_DATA_SOURCES as readonly string[]).includes(source);

  return (
    <section
      ref={panel}
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col gap-5 rounded-md border p-4"
      onKeyDown={keyDown}
      data-testid="invoice-data-substep"
    >
      <div className="flex flex-col gap-1">
        <h3 id={titleId} ref={heading} tabIndex={-1} className="text-base font-semibold outline-none">
          {t('invoiceData.substep.title')}
        </h3>
        <p className="text-sm text-muted-foreground">{t('invoiceData.substep.intro')}</p>
        {knownSource ? (
          <p className="text-sm text-muted-foreground" data-testid="invoice-data-substep-source" data-source={source}>
            {t(`invoiceData.source.${source}`)}
          </p>
        ) : null}
      </div>

      {query.isPending ? (
        <p role="status" className="text-sm text-muted-foreground" data-testid="invoice-data-substep-loading">
          {t('invoiceData.substep.loading')}
        </p>
      ) : query.isError ? (
        <div className="flex flex-col items-start gap-2" data-testid="invoice-data-substep-load-failed">
          <p role="alert" className="text-sm text-destructive">
            {t('invoiceData.substep.loadFailed')}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
            {t('invoiceData.retry')}
          </Button>
        </div>
      ) : (
        <InvoiceDataFields
          copy={INVOICE_FIELDS_COPY.host}
          idPrefix="invoice-data"
          values={values}
          errors={errors}
          onChange={change}
          disabled={save.isPending}
        />
      )}

      {problem ? (
        <p role="alert" className="text-sm text-destructive" data-testid="invoice-data-substep-problem">
          {problem}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => void done()}
          loading={save.isPending}
          disabled={!query.isSuccess}
          data-testid="invoice-data-substep-done"
        >
          {t('invoiceData.substep.done')}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={save.isPending} data-testid="invoice-data-substep-cancel">
          {t('invoiceData.substep.cancel')}
        </Button>
      </div>
    </section>
  );
}
