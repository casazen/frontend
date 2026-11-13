import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { useOwnerFormat } from '@/features/owner-accounting/use-owner-format';
import { useExactMoney } from '@/hooks/use-exact-money';
import {
  useApproveStatement,
  usePublishStatement,
  useDownloadStatementPdf,
  useDownloadStatementCsv,
} from '@/queries/statements';
import type { OwnerStatement } from '@/types';

interface StatementDetailProps {
  statement: OwnerStatement;
  onBack: () => void;
}

type Step = 'approve' | 'publish';

/**
 * One statement of an owner, as the server has it: every amount in the currency of the statement and exactly as the server wrote it (nothing is added up,
 * rounded or signed here), the step it is at and the next one. Approving and publishing cannot be undone, so each asks to be confirmed with what it does; the
 * PDF and the CSV are the files the server stores (only an approved or a published statement has them). While any request of this statement is on its way
 * every button of it waits.
 */
export function StatementDetail({ statement, onBack }: StatementDetailProps) {
  const { t } = useTranslation();
  const { dateTime, locale } = useOwnerFormat();
  const money = useExactMoney();
  const approveStatement = useApproveStatement();
  const publishStatement = usePublishStatement();
  const downloadPdf = useDownloadStatementPdf();
  const downloadCsv = useDownloadStatementCsv();
  const [step, setStep] = useState<Step | null>(null);

  const busy = approveStatement.isPending || publishStatement.isPending || downloadPdf.isPending || downloadCsv.isPending;
  // The server refuses a file for a draft (422 `statement_not_exportable`): the button is not offered for it.
  const exportable = statement.status !== 'Draft';
  const fileName = `rendiconto-${statement.year}-${String(statement.month).padStart(2, '0')}-${statement.id.replace(/-/g, '')}`;
  const period = `${statement.month}/${statement.year}`;

  // The hooks tell a failure with a toast; what is left here is to let the finished request go, so that nothing of it stays in the cache of the mutations.
  const handleDownloadPdf = async () => {
    if (busy || !exportable) return;
    try {
      await downloadPdf.mutateAsync({ id: statement.id, fallbackName: `${fileName}.pdf` });
    } catch {
      // Told by the toast of the hook.
    } finally {
      downloadPdf.reset();
    }
  };

  const handleDownloadCsv = async () => {
    if (busy || !exportable) return;
    try {
      await downloadCsv.mutateAsync({ id: statement.id, fallbackName: `${fileName}.csv` });
    } catch {
      // Told by the toast of the hook.
    } finally {
      downloadCsv.reset();
    }
  };

  /** The step is the person's word, after the confirmation. Whatever the server answers the dialog is done: the hook tells a failure and the list is read again. */
  const confirmStep = async () => {
    try {
      if (step === 'approve') await approveStatement.mutateAsync(statement.id);
      else if (step === 'publish') await publishStatement.mutateAsync(statement.id);
    } catch {
      // Told by the toast of the hook; the statement on screen is the one the server answers on the next read.
    } finally {
      approveStatement.reset();
      publishStatement.reset();
    }
  };

  const dismissStep = (open: boolean) => {
    // The request is on its way: the dialog stays until the server has answered, so nobody asks for the same step twice.
    if (!open && !busy) setStep(null);
  };

  const confirmation = {
    description: t(`statement.${step ?? 'approve'}.confirmDescription`, {
      owner: statement.ownerName,
      property: statement.propertyName,
      period,
      amount: money(statement.netPayable, statement.currency),
    }),
    consequences: step === 'publish'
      ? [t('statement.publish.consequenceOwner'), t('statement.publish.consequenceImmutable')]
      : [t('statement.approve.consequenceLocked')],
  };

  return (
    <div className="space-y-6" data-testid="statement-detail">
      <div>
        <Button variant="ghost" onClick={onBack} disabled={busy} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('shared.back')}
        </Button>

        <PageHeader
          title={statement.propertyName}
          description={t('statement.detailSubtitle', {
            month: statement.month,
            year: statement.year,
            owner: statement.ownerName,
          })}
          crumbs="auto"
          action={
            <span
              data-testid="statement-status"
              className={`px-3 py-1 text-sm font-medium rounded-full ${
                statement.status === 'Draft'
                  ? 'bg-gray-100 text-gray-800'
                  : statement.status === 'Approved'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-green-100 text-green-800'
              }`}
            >
              {t(`statement.status.${statement.status.toLowerCase()}`)}
            </span>
          }
        />
      </div>

      <div className="grid gap-6">
        {/* Summary Section */}
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">{t('statement.summary')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{t('statement.revenue')}</p>
              <p className="text-2xl font-bold" data-testid="statement-revenue">
                {money(statement.totalRevenue, statement.currency)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('statement.commission')}</p>
              <p className="text-2xl font-bold" data-testid="statement-commission">
                {money(statement.commission, statement.currency)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('statement.expenses')}</p>
              <p className="text-2xl font-bold" data-testid="statement-expenses">
                {money(statement.expenses, statement.currency)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('statement.withholdingTax')}</p>
              <p className="text-2xl font-bold" data-testid="statement-withholding">
                {money(statement.withholdingTax, statement.currency)}
              </p>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t">
            <div className="flex justify-between items-center">
              <p className="text-lg font-semibold">{t('statement.netPayable')}</p>
              <p className="text-3xl font-bold" data-testid="statement-net">
                {money(statement.netPayable, statement.currency)}
              </p>
            </div>
            {statement.ownershipPercent < 100 && (
              <p className="text-sm text-muted-foreground mt-2">
                {t('statement.ownershipPercent', {
                  percent: new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(statement.ownershipPercent),
                })}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4">
          {statement.status === 'Draft' && (
            <Button onClick={() => setStep('approve')} disabled={busy} data-testid="statement-approve">
              {t('statement.approveButton')}
            </Button>
          )}
          {statement.status === 'Approved' && (
            <Button onClick={() => setStep('publish')} disabled={busy} data-testid="statement-publish">
              {t('statement.publishButton')}
            </Button>
          )}
          <Button variant="outline" onClick={() => void handleDownloadPdf()} disabled={busy || !exportable} data-testid="statement-download-pdf">
            <Download className="w-4 h-4 mr-2" />
            {t('statement.download.pdf')}
          </Button>
          <Button variant="outline" onClick={() => void handleDownloadCsv()} disabled={busy || !exportable} data-testid="statement-download-csv">
            <Download className="w-4 h-4 mr-2" />
            {t('statement.download.csv')}
          </Button>
        </div>
        {!exportable && (
          <p className="text-sm text-muted-foreground" data-testid="statement-download-draft">
            {t('statement.download.draft')}
          </p>
        )}

        {/* Additional Info */}
        {statement.publishedAt && (
          <div className="border rounded-lg p-4 bg-muted/30">
            <p className="text-sm">
              <span className="font-medium">{t('statement.publishedAt')}:</span>{' '}
              {dateTime(statement.publishedAt)}
            </p>
          </div>
        )}
      </div>

      <ConfirmationDialog
        open={step !== null}
        onOpenChange={dismissStep}
        title={t(`statement.${step ?? 'approve'}.confirmTitle`)}
        description={confirmation.description}
        consequences={confirmation.consequences}
        confirmLabel={step === 'publish' ? t('statement.publishButton') : t('statement.approveButton')}
        isLoading={busy}
        onConfirm={confirmStep}
      />
    </div>
  );
}
