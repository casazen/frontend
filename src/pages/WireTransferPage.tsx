import { useTranslation } from 'react-i18next';
import { useState, useMemo } from 'react';
import { useStatements } from '@/queries/statements';
import { useCreateBatch, useDownloadBatchFile, useConfirmDownload, useConfirmPayment } from '@/queries/wireTransfer';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Alert } from '@/components/ui/alert';
import { AlertCircle, Download, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { WireBatch, WireBatchStatus } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function WireTransferPage() {
  const { t } = useTranslation();
  const [selectedStatements, setSelectedStatements] = useState<Set<string>>(new Set());
  const [debitAccount, setDebitAccount] = useState('');
  const [createdBatch, setCreatedBatch] = useState<WireBatch | null>(null);
  const [batchStatus, setBatchStatus] = useState<WireBatchStatus>('Generated');

  const { data: statements, isLoading, error } = useStatements();
  const createBatch = useCreateBatch();
  const downloadFile = useDownloadBatchFile();
  const confirmDownload = useConfirmDownload();
  const confirmPayment = useConfirmPayment();

  const approvedStatements = useMemo(() => {
    if (!statements) return [];
    return statements.filter((s) => s.status === 'Approved');
  }, [statements]);

  const handleToggleStatement = (id: string) => {
    const newSelection = new Set(selectedStatements);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedStatements(newSelection);
  };

  const handleCreateBatch = async () => {
    if (selectedStatements.size === 0 || !debitAccount.trim()) {
      return;
    }

    const result = await createBatch.mutateAsync({
      statementIds: Array.from(selectedStatements),
      debitAccount: debitAccount.trim(),
    });

    setCreatedBatch({
      batchId: result.batchId,
      currency: result.currency,
      totalAmount: result.totalAmount,
      transferCount: result.transferCount,
    });
    setBatchStatus('Generated');
    setSelectedStatements(new Set());
    setDebitAccount('');
  };

  const handleDownload = async () => {
    if (!createdBatch) return;

    const fileName = `wire-batch-${createdBatch.batchId}-${createdBatch.currency}.xml`;
    await downloadFile.mutateAsync({ batchId: createdBatch.batchId, fileName });
  };

  const handleConfirmDownload = async () => {
    if (!createdBatch) return;

    await confirmDownload.mutateAsync(createdBatch.batchId);
    setBatchStatus('Downloaded');
  };

  const handleConfirmPayment = async () => {
    if (!createdBatch) return;

    await confirmPayment.mutateAsync(createdBatch.batchId);
    setBatchStatus('Paid');
  };

  if (isLoading) {
    return <LoadingScreen message={t('wire.loading')} />;
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="danger" title={t('shared.error')} icon={AlertCircle}>
          {t('wire.loadError')}
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('wire.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('wire.description')}
        </p>
      </div>

      {createdBatch ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('wire.batch.details')}</CardTitle>
            <CardDescription>{t('wire.batch.detailsDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">{t('wire.batch.id')}:</span>
                <p className="font-mono text-sm">{createdBatch.batchId}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">{t('wire.batch.currency')}:</span>
                <p className="font-medium">{createdBatch.currency}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">{t('wire.batch.totalAmount')}:</span>
                <p className="font-medium text-green-600">
                  {createdBatch.currency} {createdBatch.totalAmount.toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">{t('wire.batch.transferCount')}:</span>
                <p className="font-medium">{createdBatch.transferCount}</p>
              </div>
              <div className="col-span-2">
                <span className="text-sm text-muted-foreground">{t('wire.batch.status')}:</span>
                <div className="mt-1">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      batchStatus === 'Generated'
                        ? 'bg-blue-100 text-blue-800'
                        : batchStatus === 'Downloaded'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {t(`wire.status.${batchStatus.toLowerCase()}`)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-4">
              {batchStatus === 'Generated' && (
                <>
                  <Button
                    onClick={handleDownload}
                    disabled={downloadFile.isPending}
                    variant="default"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {t('wire.batch.download')}
                  </Button>
                  <Button
                    onClick={handleConfirmDownload}
                    disabled={confirmDownload.isPending}
                    variant="outline"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {t('wire.batch.confirmDownload')}
                  </Button>
                </>
              )}
              {batchStatus === 'Downloaded' && (
                <Button
                  onClick={handleConfirmPayment}
                  disabled={confirmPayment.isPending}
                  variant="default"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {t('wire.batch.confirmPaid')}
                </Button>
              )}
              {batchStatus === 'Paid' && (
                <Alert variant="success" icon={CheckCircle}>
                  {t('wire.batch.paidComplete')}
                </Alert>
              )}
              <Button
                onClick={() => setCreatedBatch(null)}
                variant="ghost"
              >
                {t('wire.batch.createAnother')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-6 space-y-4">
            <div>
              <Label htmlFor="debit-account">{t('wire.debitAccount')}</Label>
              <Input
                id="debit-account"
                type="text"
                value={debitAccount}
                onChange={(e) => setDebitAccount(e.target.value)}
                placeholder={t('wire.debitAccountPlaceholder')}
                className="mt-1"
              />
            </div>

            <Button
              onClick={handleCreateBatch}
              disabled={selectedStatements.size === 0 || !debitAccount.trim() || createBatch.isPending}
            >
              {t('wire.batch.create')}
            </Button>
          </div>

          {approvedStatements.length === 0 ? (
            <Alert variant="info" title={t('wire.noApprovedStatements')} icon={AlertCircle}>
              {t('wire.noApprovedStatementsDescription')}
            </Alert>
          ) : (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">{t('wire.selectStatements')}</h2>
              {approvedStatements.map((statement) => (
                <div
                  key={statement.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedStatements.has(statement.id)
                      ? 'bg-blue-50 border-blue-300'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => handleToggleStatement(statement.id)}
                >
                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      checked={selectedStatements.has(statement.id)}
                      onChange={() => handleToggleStatement(statement.id)}
                      className="mt-1 mr-3"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">
                          {statement.propertyName}
                        </h3>
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          {t('statement.status.approved')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {statement.ownerName}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">{t('statement.period')}:</span>{' '}
                          <span className="font-medium">
                            {statement.month}/{statement.year}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('statement.netPayable')}:</span>{' '}
                          <span className="font-medium text-green-600">
                            {statement.currency} {statement.netPayable.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
