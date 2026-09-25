import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { BadgeCheck, Loader2, Pencil, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  ltrReferenceDataApi,
  type AdminAgreementDetail,
  type AdminAgreementSummary,
  type AdminImuChannel,
  type MarkVerifiedInput,
} from '@/api/ltr-reference-data.api';
import { getProblemMessage } from '@/lib/api-errors';
import { formatDate } from '@/lib/utils';
import type { DataCompleteness } from '@/types';
import { LtrAgreementDialog } from './components/ltr-agreement-dialog';
import { LtrImuChannelDialog } from './components/ltr-imu-channel-dialog';
import { LtrVerifyDialog } from './components/ltr-verify-dialog';
import { LTR_AGREEMENTS_KEY, LTR_IMU_CHANNELS_KEY, ltrAuditKey } from './lib/ltr-query-keys';

const COMPLETENESS_BADGE: Record<DataCompleteness, string> = {
  Complete: 'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200',
  Partial: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  Missing: 'border-muted bg-muted/40 text-muted-foreground',
};

type VerifyTarget =
  | { kind: 'agreement'; id: string; comune: string }
  | { kind: 'imu'; id: string; comune: string };

/**
 * Reference data of long-term leases (LT-13, A7-22): territorial agreements (status, expiry, rules, bands and zones)
 * and the comune offices receiving the IMU communication. Admins edit them and record each verification with its date
 * and source; every change is kept in the audit log. No deploy is needed to update a PEC or a band.
 */
export function AdminLtrReferenceDataPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [onlyWithData, setOnlyWithData] = useState(true);
  const [openAgreement, setOpenAgreement] = useState<string | null>(null);
  const [editingChannel, setEditingChannel] = useState<AdminImuChannel | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<VerifyTarget | null>(null);

  const agreements = useQuery({ queryKey: LTR_AGREEMENTS_KEY, queryFn: () => ltrReferenceDataApi.getAgreements() });
  const channels = useQuery({ queryKey: LTR_IMU_CHANNELS_KEY, queryFn: () => ltrReferenceDataApi.getImuChannels() });

  // Explicit union: the two branches resolve to different DTOs (agreement vs channel), never read here (onSuccess
  // only invalidates queries), so the mutation's own data type is left as the union rather than narrowed to one.
  const verify = useMutation<
    AdminAgreementDetail | AdminImuChannel,
    unknown,
    { target: VerifyTarget; input: MarkVerifiedInput }
  >({
    mutationFn: ({ target, input }) =>
      target.kind === 'agreement'
        ? ltrReferenceDataApi.markAgreementVerified(target.id, input)
        : ltrReferenceDataApi.markImuChannelVerified(target.id, input),
    onSuccess: (_data, { target }) => {
      void queryClient.invalidateQueries({ queryKey: target.kind === 'agreement' ? LTR_AGREEMENTS_KEY : LTR_IMU_CHANNELS_KEY });
      void queryClient.invalidateQueries({ queryKey: ltrAuditKey(target.id) });
      toast.success(t('ltrReferenceData.toast.verified'));
    },
    onError: (error) => toast.error(getProblemMessage(error, t) ?? t('ltrReferenceData.toast.verifyFailed')),
  });

  const agreementRows = (agreements.data ?? []).filter(
    (a) => !onlyWithData || a.dataCompleteness !== 'Missing' || a.bandCount > 0,
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t('ltrReferenceData.title')} description={t('ltrReferenceData.description')} />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>{t('ltrReferenceData.agreementsTitle')}</CardTitle>
          <div className="flex items-center gap-2">
            <Checkbox id="ltr-only-with-data" checked={onlyWithData} onCheckedChange={(v) => setOnlyWithData(v === true)} />
            <Label htmlFor="ltr-only-with-data">{t('ltrReferenceData.onlyWithData')}</Label>
          </div>
        </CardHeader>
        <CardContent>
          <QueryState query={agreements} testId="ltr-agreements">
            {agreementRows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground" data-testid="ltr-agreements-empty">
                {t('ltrReferenceData.agreementsEmpty')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">{t('ltrReferenceData.columns.comune')}</th>
                      <th className="px-3 py-2 font-medium">{t('ltrReferenceData.columns.status')}</th>
                      <th className="px-3 py-2 font-medium">{t('ltrReferenceData.columns.zones')}</th>
                      <th className="px-3 py-2 font-medium">{t('ltrReferenceData.columns.expiry')}</th>
                      <th className="px-3 py-2 font-medium">{t('ltrReferenceData.columns.verification')}</th>
                      <th className="px-3 py-2 text-right font-medium">{t('ltrReferenceData.columns.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agreementRows.map((row) => (
                      <AgreementRow
                        key={row.id}
                        row={row}
                        onOpen={() => setOpenAgreement(row.id)}
                        onVerify={() => setVerifyTarget({ kind: 'agreement', id: row.id, comune: row.comune })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </QueryState>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('ltrReferenceData.imuTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <QueryState query={channels} testId="ltr-imu-channels">
            {(channels.data ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground" data-testid="ltr-imu-empty">
                {t('ltrReferenceData.imuEmpty')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">{t('ltrReferenceData.columns.comune')}</th>
                      <th className="px-3 py-2 font-medium">{t('ltrReferenceData.columns.recipient')}</th>
                      <th className="px-3 py-2 font-medium">{t('ltrReferenceData.columns.rate')}</th>
                      <th className="px-3 py-2 font-medium">{t('ltrReferenceData.columns.status')}</th>
                      <th className="px-3 py-2 font-medium">{t('ltrReferenceData.columns.verification')}</th>
                      <th className="px-3 py-2 text-right font-medium">{t('ltrReferenceData.columns.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(channels.data ?? []).map((channel) => (
                      <tr key={channel.id} className="border-b last:border-0" data-testid="ltr-imu-row">
                        <td className="px-3 py-2 font-medium">{channel.comune}</td>
                        <td className="px-3 py-2">
                          {channel.recipientOffice}
                          {[channel.email, channel.pec].filter(Boolean).map((address) => (
                            <span key={address} className="block text-xs text-muted-foreground">
                              {address}
                            </span>
                          ))}
                        </td>
                        <td className="px-3 py-2">
                          {channel.ratePercent != null && channel.rateYear != null
                            ? t(`ltrReferenceData.imu.rate.${channel.rateKind ?? 'Official'}`, {
                                rate: channel.ratePercent,
                                year: channel.rateYear,
                              })
                            : t('ltrReferenceData.imu.rateUnknown')}
                        </td>
                        <td className="px-3 py-2">
                          <CompletenessBadge value={channel.dataCompleteness} />
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <Verification lastVerifiedAt={channel.lastVerifiedAt} source={channel.verificationSource} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <RowActions
                            onEdit={() => setEditingChannel(channel)}
                            onVerify={() => setVerifyTarget({ kind: 'imu', id: channel.id, comune: channel.comune })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </QueryState>
        </CardContent>
      </Card>

      {openAgreement && <LtrAgreementDialog agreementId={openAgreement} onClose={() => setOpenAgreement(null)} />}
      {editingChannel && (
        <LtrImuChannelDialog key={editingChannel.id} channel={editingChannel} onClose={() => setEditingChannel(null)} />
      )}
      {verifyTarget && (
        <LtrVerifyDialog
          key={`${verifyTarget.kind}-${verifyTarget.id}`}
          open
          subject={t(`ltrReferenceData.verify.subject.${verifyTarget.kind}`, { comune: verifyTarget.comune })}
          isSubmitting={verify.isPending}
          onOpenChange={(open) => !open && setVerifyTarget(null)}
          onConfirm={(input) => verify.mutateAsync({ target: verifyTarget, input })}
        />
      )}
    </div>
  );
}

function AgreementRow({
  row,
  onOpen,
  onVerify,
}: {
  row: AdminAgreementSummary;
  onOpen: () => void;
  onVerify: () => void;
}) {
  const { t } = useTranslation();
  return (
    <tr className="border-b last:border-0" data-testid="ltr-agreement-row">
      <td className="px-3 py-2 font-medium">
        {row.comune}
        <span className="block text-xs font-normal text-muted-foreground">{row.agreementName}</span>
      </td>
      <td className="px-3 py-2">
        <CompletenessBadge value={row.dataCompleteness} />
      </td>
      <td className="px-3 py-2 text-xs">{row.zoneNames.length > 0 ? row.zoneNames.join(', ') : '—'}</td>
      <td className="px-3 py-2 text-xs">
        {row.expiresAt
          ? t(row.remainsInForceUntilReplaced ? 'ltrReferenceData.expiryUntilReplaced' : 'ltrReferenceData.expiry', {
              date: formatDate(row.expiresAt),
            })
          : t('ltrReferenceData.expiryUnknown')}
      </td>
      <td className="px-3 py-2 text-xs">
        <Verification lastVerifiedAt={row.lastVerifiedAt} source={row.verificationSource} />
      </td>
      <td className="px-3 py-2 text-right">
        <RowActions onEdit={onOpen} onVerify={onVerify} />
      </td>
    </tr>
  );
}

function RowActions({ onEdit, onVerify }: { onEdit: () => void; onVerify: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-end gap-1">
      <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
        <Pencil className="mr-1 h-4 w-4" />
        {t('ltrReferenceData.edit')}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onVerify}>
        <BadgeCheck className="mr-1 h-4 w-4" />
        {t('ltrReferenceData.markVerified')}
      </Button>
    </div>
  );
}

function Verification({ lastVerifiedAt, source }: { lastVerifiedAt: string | null; source: string | null }) {
  const { t } = useTranslation();
  if (!lastVerifiedAt) return <span className="text-muted-foreground">{t('ltrReferenceData.neverVerified')}</span>;
  return (
    <span>
      {formatDate(lastVerifiedAt)}
      {source && <span className="block text-muted-foreground">{source}</span>}
    </span>
  );
}

function CompletenessBadge({ value }: { value: DataCompleteness }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${COMPLETENESS_BADGE[value]}`}>
      {t(`ltrReferenceData.completeness.${value}`)}
    </span>
  );
}

/** Loading and error states of a list: an API error is never shown as an empty list. */
function QueryState({
  query,
  testId,
  children,
}: {
  query: { isLoading: boolean; isError: boolean; error: unknown; isRefetching: boolean; refetch: () => unknown };
  testId: string;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center py-8" data-testid={`${testId}-loading`}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="py-8 text-center" role="alert" data-testid={`${testId}-error`}>
        <p className="mb-3 text-sm text-destructive">{getProblemMessage(query.error, t) ?? t('ltrReferenceData.loadError')}</p>
        <Button type="button" variant="outline" onClick={() => void query.refetch()} disabled={query.isRefetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${query.isRefetching ? 'animate-spin' : ''}`} />
          {t('ltrReferenceData.retry')}
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}
