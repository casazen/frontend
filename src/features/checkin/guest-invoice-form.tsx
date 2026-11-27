import { useEffect, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { publicCheckinApi } from '@/api/checkin.api';
import { readInvoiceDataProblems } from '@/lib/invoice-data-schema';
import type { PublicCheckInContextDto, PublicCheckInInvoiceRequest } from '@/types/public-checkin.types';
import { InvoiceStep } from './components/invoice-step';
import { guestProblemMessage } from './lib/guest-errors';
import { initialInvoiceStep, invoiceStepSchema, toPublicCheckInInvoice, type PublicCheckInFormValues } from './schemas/checkin.schema';

type InvoiceFormProps = {
  context: Pick<PublicCheckInContextDto, 'invoiceRequested' | 'hasInvoiceData'>;
} & ({ token: string; save?: never } | { token?: never; save: (request: PublicCheckInInvoiceRequest) => Promise<void> });

export function GuestInvoiceForm({ token, context, save }: InvoiceFormProps) {
  const { t } = useTranslation();
  const form = useForm<PublicCheckInFormValues>({ defaultValues: { invoice: initialInvoiceStep(context) } });
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [focusRequest, setFocusRequest] = useState(0);
  const formElement = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (focusRequest) formElement.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusRequest]);
  const submit = form.handleSubmit(async ({ invoice }) => {
    setError('');
    const parsed = invoiceStepSchema.safeParse(invoice);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof NonNullable<typeof invoice>;
        form.setError(`invoice.${field}`, { message: issue.message });
      }
      setFocusRequest(n => n + 1);
      return;
    }
    const request = toPublicCheckInInvoice(parsed.data);
    try {
      if (save) {
        if (request || parsed.data?.answer === 'no') await save(request ?? { needInvoice: false });
      } else if (request) await publicCheckinApi.requestInvoice(token, request);
      setDone(true);
    } catch (cause) {
      const problems = readInvoiceDataProblems(cause);
      for (const problem of problems) form.setError(`invoice.${problem.field}`, { message: problem.code });
      setError(problems.length ? t('checkin.fixHighlightedFields') : guestProblemMessage(cause, t));
      setFocusRequest(n => n + 1);
    }
  });
  const Heading = save ? 'h2' : 'h1';
  return <section className="space-y-4 rounded-lg border bg-card p-6">
    <Heading className="text-xl font-semibold">{t('checkin.invoice.title')}</Heading>
    {done ? <div><p role="status">{t('checkin.invoiceFinished')}</p>
      {save && <Button type="button" variant="outline" onClick={() => {
        form.reset({ invoice: initialInvoiceStep(context) });
        setDone(false);
      }}>{t('checkin.invoice.onFile.replace')}</Button>}</div> : <FormProvider {...form}>
      <form ref={formElement} noValidate onSubmit={submit} className="space-y-4">
        <InvoiceStep hasInvoiceData={context.hasInvoiceData === true} />
        {error && <p role="alert" data-testid="checkin-submit-error">{error}</p>}
        <Button type="submit" disabled={form.formState.isSubmitting}>{t('checkin.invoiceSave')}</Button>
      </form>
    </FormProvider>}
  </section>;
}
