import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { ltrReferenceDataApi } from '@/api/ltr-reference-data.api';
import { getProblemMessage } from '@/lib/api-errors';
import { formatDateTime } from '@/lib/utils';
import { ltrAuditKey } from '../lib/ltr-query-keys';

/** Audit log of a reference-data row (LT-13): every admin change and verification, newest first. */
export function LtrAuditTrail({ entityId }: { entityId: string }) {
  const { t } = useTranslation();
  const audit = useQuery({
    queryKey: ltrAuditKey(entityId),
    queryFn: () => ltrReferenceDataApi.getAudit(entityId),
  });

  return (
    <section className="space-y-2" data-testid="ltr-audit-trail">
      <h3 className="text-sm font-medium">{t('ltrReferenceData.audit.title')}</h3>
      {audit.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      {audit.isError && (
        <p className="text-sm text-destructive" role="alert">
          {getProblemMessage(audit.error, t) ?? t('ltrReferenceData.audit.loadError')}
        </p>
      )}
      {audit.data && audit.data.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('ltrReferenceData.audit.empty')}</p>
      )}
      {audit.data && audit.data.length > 0 && (
        <ul className="space-y-2 text-xs">
          {audit.data.map((entry, index) => (
            <li key={`${entry.occurredAt}-${index}`} className="rounded-md border p-2">
              <p className="font-medium">
                {t(`ltrReferenceData.audit.action.${entry.action}`)} · {formatDateTime(entry.occurredAt)}
              </p>
              <p className="text-muted-foreground">{entry.changedByUserId}</p>
              <pre className="whitespace-pre-wrap break-all text-muted-foreground">{entry.changes}</pre>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
