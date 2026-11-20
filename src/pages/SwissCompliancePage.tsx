import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Download, ExternalLink, Upload } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PlainSection } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getHttpStatus } from '@/lib/api-errors';
import { formatStayDate } from '@/lib/stay-dates';
import { useDownloadTicinoFile, useTicinoDay, useUploadReceipt } from '@/queries/swissCompliance';
import { TicinoStructureIdForm } from '@/features/compliance/ticino/ticino-structure-id-form';
import type { TicinoNotificationDay, TicinoNotificationIssue } from '@/types/swissCompliance.types';

const MISSING_CODES = ['firstName', 'lastName', 'birthDate', 'nationality', 'documentType', 'guests'];

/**
 * «Notifica alla polizia (Ticino)» (casazen/backend#979): the guided notification of the guests of a property in canton Ticino to the
 * cantonal police, within 24 hours of the arrival. One arrival day at a time (`?property=<id>&date=yyyy-MM-dd`; without a date the oldest
 * day still to notify): the host downloads the official file, uploads it on notifiche.ti.ch («Notifiche → Invio») and records the summary
 * page of the portal as the receipt of the day. CasaZen transmits nothing. Reached from the Adempimenti cockpit and the property page.
 */
export function SwissCompliancePage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const propertyId = params.get('property') ?? '';
  const date = params.get('date') ?? undefined;
  const day = useTicinoDay(propertyId, date);

  return (
    <AppShell>
      <div className="space-y-6 md:space-y-8" data-testid="ticino-police-page">
        <PageHeader title={t('swiss.title')} description={t('swiss.description')} crumbs="auto" />
        {!propertyId ? (
          <p className="text-sm text-foreground/70">
            {t('swiss.noProperty')}{' '}
            <Link to="/app/short-rent/compliance" className="text-primary hover:underline">{t('swiss.backToCompliance')}</Link>
          </p>
        ) : day.isLoading ? (
          <p className="text-sm text-foreground/70">{t('swiss.loading')}</p>
        ) : day.isError || !day.data ? (
          <p className="text-sm text-foreground/70" role="alert">
            {getHttpStatus(day.error) === 422 ? t('swiss.notInTicino') : t('swiss.loadFailed')}
          </p>
        ) : (
          <TicinoDay
            day={day.data}
            onPickDay={(next) => setParams({ property: propertyId, date: next })}
            onChanged={() => void day.refetch()}
          />
        )}
      </div>
    </AppShell>
  );
}

interface TicinoDayProps {
  day: TicinoNotificationDay;
  onPickDay: (day: string) => void;
  onChanged: () => void;
}

function TicinoDay({ day, onPickDay, onChanged }: TicinoDayProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const dayName = formatStayDate(day.day, locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const otherDays = day.pendingDays.filter((pending) => pending.day !== day.day);
  const notified = day.receiptCount > 0;

  return (
    <div className="space-y-6">
      <PlainSection title={t('swiss.day.title', { day: dayName })}>
        <p className="text-sm text-foreground/70">
          {day.stayCount === 0
            ? t('swiss.day.none')
            : notified
              ? t('swiss.day.notified')
              : t('swiss.day.due', { when: new Date(day.dueAt).toLocaleString(locale, { weekday: 'long', hour: '2-digit', minute: '2-digit' }) })}
        </p>
        {otherDays.length > 0 ? (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-foreground/70">{t('swiss.day.otherDays')}</span>
            {otherDays.map((pending) => (
              <Button key={pending.day} type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => onPickDay(pending.day)}>
                {formatStayDate(pending.day, locale, { day: 'numeric', month: 'long' })}
              </Button>
            ))}
          </p>
        ) : null}
      </PlainSection>

      {!day.structureId ? (
        <PlainSection title={t('swiss.structureId.title')}>
          <p className="mb-3 text-sm text-foreground/70">{t('swiss.structureId.missing')}</p>
          <TicinoStructureIdForm propertyId={day.propertyId} value={day.structureId} onSaved={onChanged} />
        </PlainSection>
      ) : day.stayCount > 0 && !notified ? (
        <TicinoSteps day={day} onChanged={onChanged} />
      ) : notified ? (
        <p className="flex items-center gap-2 text-sm" data-testid="ticino-day-notified">
          <CheckCircle2 aria-hidden="true" className="size-4 text-primary" />
          {t('swiss.day.notifiedDone')}
        </p>
      ) : null}
    </div>
  );
}

function TicinoSteps({ day, onChanged }: { day: TicinoNotificationDay; onChanged: () => void }) {
  const { t } = useTranslation();
  const download = useDownloadTicinoFile(day.propertyId);
  const upload = useUploadReceipt(day.propertyId);
  const [receipt, setReceipt] = useState<File | null>(null);
  const minors = day.rows.reduce((sum, row) => sum + row.personsOver14 + row.personsUnder14, 0);

  const record = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!receipt) return;
    await upload.mutateAsync({ type: 'Police', reportDate: day.day, reference: day.reference, file: receipt });
    setReceipt(null);
    onChanged();
  };

  return (
    <ol className="space-y-6" data-testid="ticino-steps">
      <li>
        <PlainSection title={t('swiss.file.title')}>
          {day.issues.length > 0 ? <TicinoIssues issues={day.issues} /> : null}
          {day.rows.length > 0 ? (
            <>
              <p className="text-sm text-foreground/70">
                {t('swiss.file.ready', { count: day.rows.length })}
                {minors > 0 ? ` ${t('swiss.file.minors', { count: minors })}` : ''}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  disabled={download.isPending}
                  onClick={() => download.mutate({ reportDate: day.day, format: 'csv' })}
                  data-testid="ticino-download-csv"
                >
                  <Download aria-hidden="true" className="size-4" />
                  {download.isPending ? t('swiss.file.downloading') : t('swiss.file.download')}
                </Button>
                {day.xmlAvailable ? (
                  <Button type="button" variant="link" disabled={download.isPending} onClick={() => download.mutate({ reportDate: day.day, format: 'xml' })}>
                    {t('swiss.file.downloadXml')}
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
        </PlainSection>
      </li>
      <li>
        <PlainSection title={t('swiss.portal.title')}>
          <p className="text-sm text-foreground/70">{t('swiss.portal.body')}</p>
          <a
            href={day.portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-primary hover:underline"
          >
            {t('swiss.portal.open')}
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        </PlainSection>
      </li>
      <li>
        <PlainSection title={t('swiss.receipt.title')}>
          <form onSubmit={record} className="space-y-3">
            <p className="text-sm text-foreground/70">{t('swiss.receipt.body')}</p>
            <div className="space-y-2">
              <Label htmlFor="ticino-receipt">{t('swiss.receipt.file')}</Label>
              <Input
                id="ticino-receipt"
                type="file"
                accept="application/pdf,image/*"
                onChange={(event) => setReceipt(event.target.files?.[0] ?? null)}
              />
            </div>
            <Button type="submit" variant="outline" disabled={!receipt || upload.isPending}>
              <Upload aria-hidden="true" className="size-4" />
              {upload.isPending ? t('swiss.receipt.uploading') : t('swiss.receipt.upload')}
            </Button>
          </form>
        </PlainSection>
      </li>
    </ol>
  );
}

function TicinoIssues({ issues }: { issues: TicinoNotificationIssue[] }) {
  const { t } = useTranslation();
  const missingText = (codes: string[]) =>
    codes.map((code) => (MISSING_CODES.includes(code) ? t(`swiss.issues.missing.${code}`) : code)).join(', ');

  return (
    <div className="mb-4 space-y-2" role="status" data-testid="ticino-issues">
      <p className="text-sm font-medium">{t('swiss.issues.title', { count: issues.length })}</p>
      <ul className="space-y-1 text-sm">
        {issues.map((issue) => (
          <li key={`${issue.bookingId}-${issue.position ?? 'stay'}`}>
            <Link to={`/app/short-rent/bookings/${issue.bookingId}?tab=alloggiati`} className="text-primary hover:underline">
              {issue.guestName}
            </Link>
            {`: ${missingText(issue.missing)}`}
          </li>
        ))}
      </ul>
      <p className="text-sm text-foreground/70">{t('swiss.issues.body')}</p>
    </div>
  );
}
