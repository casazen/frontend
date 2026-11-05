import { useState } from 'react';
import { Link, generatePath, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Home } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PlainSection } from '@/components/shared/calm';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { STATUS_TONE_CLASSES } from '@/components/shared/status/status-view';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { ComplianceRow, ROW_BUTTON } from '@/features/compliance/components/compliance-row';
import { cn } from '@/lib/utils';
import { useAccessCodeStatus } from '@/queries/use-access-codes';
import type { AccessCodeStatusItem } from '@/types';
import { LockCodeDialog } from './lock-code-dialog';

const PROPERTIES_PATH = '/app/short-rent/properties';
/** The printable QR of the entrance of one property: the page of `src/pages/PropertyQrCode.tsx`, registered in the route manifest. */
const ENTRANCE_QR_PATH = `${PROPERTIES_PATH}/:propertyId/qr`;
/**
 * `?property=<id>` opens the window of one property as the page opens. This is how a page that lists what is still to do (Adempimenti, the
 * «Da fare» of the Home) leads to «Codice mancante» of a property: the state is an item that can be linked to.
 */
const PROPERTY_PARAM = 'property';

/** When the code was last set, in the words of the language of the page; nothing for a date that cannot be read. */
function updatedOn(value: string | null, language: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : new Intl.DateTimeFormat(language, { dateStyle: 'long' }).format(date);
}

/** «Codice impostato» / «Codice mancante»: an icon and a word on a soft background, the same tones as the other states of the app. */
function CodeState({ isSet }: { isSet: boolean }) {
  const { t } = useTranslation();
  const Icon = isSet ? CheckCircle2 : AlertCircle;

  return (
    <span
      data-testid="identification-state"
      data-state={isSet ? 'set' : 'missing'}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        STATUS_TONE_CLASSES[isSet ? 'success' : 'warning'],
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="min-w-0 break-words">{t(isSet ? 'compliance.identification.state.set' : 'compliance.identification.state.missing')}</span>
    </span>
  );
}

interface IdentificationRowProps {
  item: AccessCodeStatusItem;
  onEditCode: () => void;
}

/** One property: its name (to its page), the city, whether the lock code is set, and the two things the host does here. */
function IdentificationRow({ item, onEditCode }: IdentificationRowProps) {
  const { t, i18n } = useTranslation();
  const codeLabel = t(item.accessCodeSet ? 'compliance.identification.row.changeCode' : 'compliance.identification.row.setCode');
  const qrLabel = t('compliance.identification.row.qr');
  const updated = item.accessCodeSet ? updatedOn(item.updatedAt, i18n.language) : undefined;

  let detail: string | undefined;
  if (!item.accessCodeSet) detail = t('compliance.identification.row.missingHint');
  else if (updated) detail = t('compliance.identification.row.updated', { date: updated });

  return (
    <ComplianceRow
      testId={`identification-row-${item.propertyId}`}
      title={item.name}
      to={`${PROPERTIES_PATH}/${item.propertyId}`}
      sub={item.city || undefined}
      detail={detail}
      badge={<CodeState isSet={item.accessCodeSet} />}
      action={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={ROW_BUTTON}
            onClick={onEditCode}
            aria-label={t('dashboard.row.actionFor', { action: codeLabel, name: item.name })}
            data-testid={`identification-code-${item.propertyId}`}
          >
            {codeLabel}
          </Button>
          <Button asChild variant="outline" size="sm" className={ROW_BUTTON}>
            <Link
              to={generatePath(ENTRANCE_QR_PATH, { propertyId: item.propertyId })}
              aria-label={t('dashboard.row.actionFor', { action: qrLabel, name: item.name })}
              data-testid={`identification-qr-${item.propertyId}`}
            >
              {qrLabel}
            </Link>
          </Button>
        </>
      }
    />
  );
}

/**
 * «Identificazione e accesso» (E03/F01/US03, NF-50): the properties the host reaches, each with its lock code «impostato» or «mancante», the
 * button that sets or changes the code (a write-only window: the code is never shown, here or after) and the way to the printable QR of its
 * entrance. The code reaches a guest only after the identity check has passed; the page says so in one sentence and does not enforce it
 * (the release of the code belongs to the verification, E03/F04). Everything comes from `GET api/properties/access-codes`.
 */
export function IdentificationPage() {
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch } = useAccessCodeStatus();
  const [searchParams, setSearchParams] = useSearchParams();

  // The window that is open: for the property a button asked for, or the one a link names. It keeps the property while it closes, so that
  // the window does not empty out while it fades; `open` says whether it is on screen.
  const [dialog, setDialog] = useState<{ propertyId: string; open: boolean } | null>(() => {
    const linked = searchParams.get(PROPERTY_PARAM);
    return linked ? { propertyId: linked, open: true } : null;
  });

  const items = data ?? [];
  const target = dialog ? items.find((item) => item.propertyId === dialog.propertyId) : undefined;

  const closeDialog = () => {
    setDialog((current) => (current ? { ...current, open: false } : current));
    if (searchParams.has(PROPERTY_PARAM)) {
      const next = new URLSearchParams(searchParams);
      next.delete(PROPERTY_PARAM);
      setSearchParams(next, { replace: true });
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 md:space-y-8" data-testid="identification-page">
        <PageHeader title={t('compliance.identification.title')} description={t('compliance.identification.description')} crumbs="auto" />

        {isError && !data ? (
          // An API error is never shown as "no properties".
          <ErrorState title={t('compliance.identification.loadError')} error={error} onRetry={() => void refetch()} testId="identification-error" />
        ) : isLoading ? (
          <SkeletonLine lines={4} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Home}
            title={t('compliance.identification.empty.title')}
            description={t('compliance.identification.empty.description')}
            action={{ label: t('compliance.identification.empty.action'), href: `${PROPERTIES_PATH}/create` }}
          />
        ) : (
          <PlainSection title={t('compliance.identification.list.title')} count={items.length}>
            <ul role="list" className="divide-y divide-border border-y border-border" data-testid="identification-list">
              {items.map((item) => (
                <IdentificationRow
                  key={item.propertyId}
                  item={item}
                  onEditCode={() => setDialog({ propertyId: item.propertyId, open: true })}
                />
              ))}
            </ul>
          </PlainSection>
        )}

        <LockCodeDialog property={target} open={dialog?.open === true} onClose={closeDialog} />
      </div>
    </AppShell>
  );
}
