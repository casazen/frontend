import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGeneratePoliceXml, useGenerateOtrCsv, useUploadReceipt } from '@/queries/swissCompliance';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Select } from '@/components/ui/select';
import { Download, Upload, Info } from 'lucide-react';

export function SwissCompliancePage() {
  const { t } = useTranslation();
  const [propertyId, setPropertyId] = useState('');
  const [policeDate, setPoliceDate] = useState('');
  const [otrFromDate, setOtrFromDate] = useState('');
  const [otrToDate, setOtrToDate] = useState('');
  const [receiptType, setReceiptType] = useState('Police');
  const [receiptDate, setReceiptDate] = useState('');
  const [receiptReference, setReceiptReference] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const generatePoliceXml = useGeneratePoliceXml(propertyId);
  const generateOtrCsv = useGenerateOtrCsv(propertyId);
  const uploadReceipt = useUploadReceipt(propertyId);

  const handleDownloadPoliceXml = async () => {
    if (!propertyId || !policeDate) return;

    const result = await generatePoliceXml.mutateAsync({ reportDate: policeDate });

    // Download the file
    const blob = new Blob([result.content], { type: result.contentType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleDownloadOtrCsv = async () => {
    if (!propertyId || !otrFromDate || !otrToDate) return;

    const result = await generateOtrCsv.mutateAsync({
      fromDate: otrFromDate,
      toDate: otrToDate,
    });

    // Download the file
    const blob = new Blob([result.content], { type: result.contentType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleUploadReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId || !receiptFile || !receiptDate || !receiptReference) return;

    await uploadReceipt.mutateAsync({
      type: receiptType,
      reportDate: receiptDate,
      reference: receiptReference,
      file: receiptFile,
    });

    // Reset form
    setReceiptFile(null);
    setReceiptReference('');
    setReceiptDate('');
  };

  return (
    <AppShell>
      <div className="space-y-6 md:space-y-8" data-testid="swiss-compliance-page">
        <PageHeader
          title={t('swiss.title')}
          description={t('swiss.description')}
          crumbs="auto"
        />

        {/* Property selector */}
        <Card className="p-6">
          <Label htmlFor="propertyId">{t('swiss.selectProperty')}</Label>
          <Input
            id="propertyId"
            type="text"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            placeholder={t('swiss.propertyIdPlaceholder')}
            className="mt-2"
          />
        </Card>

        {/* Police XML Download */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Download className="h-5 w-5" />
            <h2 className="text-lg font-semibold">{t('swiss.police.title')}</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{t('swiss.police.description')}</p>

          <div className="space-y-4">
            <div>
              <Label htmlFor="policeDate">{t('swiss.police.date')}</Label>
              <Input
                id="policeDate"
                type="date"
                value={policeDate}
                onChange={(e) => setPoliceDate(e.target.value)}
                className="mt-2"
              />
            </div>

            <Button
              onClick={handleDownloadPoliceXml}
              disabled={!propertyId || !policeDate || generatePoliceXml.isPending}
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4 mr-2" />
              {generatePoliceXml.isPending ? t('swiss.police.downloading') : t('swiss.police.download')}
            </Button>
          </div>
        </Card>

        {/* OTR CSV Download */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Download className="h-5 w-5" />
            <h2 className="text-lg font-semibold">{t('swiss.otr.title')}</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{t('swiss.otr.description')}</p>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="otrFromDate">{t('swiss.otr.fromDate')}</Label>
                <Input
                  id="otrFromDate"
                  type="date"
                  value={otrFromDate}
                  onChange={(e) => setOtrFromDate(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="otrToDate">{t('swiss.otr.toDate')}</Label>
                <Input
                  id="otrToDate"
                  type="date"
                  value={otrToDate}
                  onChange={(e) => setOtrToDate(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>

            <Button
              onClick={handleDownloadOtrCsv}
              disabled={!propertyId || !otrFromDate || !otrToDate || generateOtrCsv.isPending}
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4 mr-2" />
              {generateOtrCsv.isPending ? t('swiss.otr.downloading') : t('swiss.otr.download')}
            </Button>
          </div>
        </Card>

        {/* Receipt Upload */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Upload className="h-5 w-5" />
            <h2 className="text-lg font-semibold">{t('swiss.receipt.title')}</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{t('swiss.receipt.description')}</p>

          <form onSubmit={handleUploadReceipt} className="space-y-4">
            <div>
              <Label htmlFor="receiptType">{t('swiss.receipt.type')}</Label>
              <Select
                id="receiptType"
                value={receiptType}
                onChange={(e) => setReceiptType(e.target.value)}
                className="mt-2"
              >
                <option value="Police">{t('swiss.receipt.typePolice')}</option>
                <option value="OTR">{t('swiss.receipt.typeOtr')}</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="receiptDate">{t('swiss.receipt.date')}</Label>
              <Input
                id="receiptDate"
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="receiptReference">{t('swiss.receipt.reference')}</Label>
              <Input
                id="receiptReference"
                type="text"
                value={receiptReference}
                onChange={(e) => setReceiptReference(e.target.value)}
                placeholder={t('swiss.receipt.referencePlaceholder')}
                maxLength={200}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="receiptFile">{t('swiss.receipt.file')}</Label>
              <Input
                id="receiptFile"
                type="file"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                className="mt-2"
              />
            </div>

            <Button
              type="submit"
              disabled={!propertyId || !receiptFile || !receiptDate || !receiptReference || uploadReceipt.isPending}
              className="w-full sm:w-auto"
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploadReceipt.isPending ? t('swiss.receipt.uploading') : t('swiss.receipt.upload')}
            </Button>
          </form>
        </Card>

        {/* Reminder info */}
        <Alert variant="info" icon={Info}>
          <div>
            <strong>{t('swiss.reminder.title')}</strong>
            <p className="text-sm mt-1">{t('swiss.reminder.description')}</p>
          </div>
        </Alert>
      </div>
    </AppShell>
  );
}
