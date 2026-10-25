import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { leaseDocumentsApi } from '@/api/lease-documents.api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useReceiptReading } from '@/queries/use-lease-documents';
import { useDeclareManualRegistration } from '@/queries/use-leases';
import { formatDate, formatDateTime } from '@/lib/utils';
import { isStayDate, todayInRome } from '@/lib/stay-dates';
import { RLI_MAX_RECEIPT_BYTES, RLI_MAX_REGISTRATION_CODE_LENGTH } from '@/lib/rli-registration-state';
import type { ManualRegistrationInput } from '@/types';

interface ManualRegistrationDialogProps {
  leaseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Where the receipt comes from: one already among the documents of the lease, or a file sent now. */
type ReceiptSource = 'uploaded' | 'file';

/** The codes of what the receipt says that is not what the contract says; any other code says the general sentence. */
const RECEIPT_WARNINGS: ReadonlySet<string> = new Set([
  'receipt_comune_differs',
  'receipt_end_differs',
  'receipt_regime_differs',
  'receipt_rent_differs',
  'receipt_start_differs',
  'receipt_stipulation_differs',
  'receipt_type_differs',
]);

function isPdf(file: File | null): file is File {
  if (!file || file.size === 0 || file.size > RLI_MAX_RECEIPT_BYTES) return false;
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/**
 * Registration of a contract (LT-01, D15; CF-END): once the contract is registered (by the landlord on the official channel of the Agenzia
 * delle Entrate, or by the guided service that prepared it) the landlord enters the registration number or protocol, its date and the receipt
 * PDF, and confirms the declaration. Only then the lease becomes Registered. The receipt is the one already uploaded among the documents of the
 * lease (kind «Registrazione», preselected when it is the only one), so it is not sent twice, or a new file. The server checks the PDF content,
 * the date and that the document is one of this lease again.
 *
 * CF-DOCS-REAL: the receipt already uploaded is read (a digital PDF of the Agenzia delle Entrate) and its code and day fill the two fields,
 * marked «Letto dalla ricevuta — controlla» until the person changes them; what does not match the contract is told, and a request the
 * Agenzia discarded is told as an error and cannot be declared. The reading declares nothing: the person confirms with the box as before,
 * and a receipt that cannot be read leaves the fields to be typed.
 */
export function ManualRegistrationDialog({ leaseId, open, onOpenChange }: ManualRegistrationDialogProps) {
  const { t } = useTranslation();
  const declare = useDeclareManualRegistration();
  const today = todayInRome();
  // What the person typed; `null` while they have not touched the field (the value is then the one read from the receipt, if any).
  const [typedCode, setTypedCode] = useState<string | null>(null);
  const [typedDate, setTypedDate] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [chosenSource, setChosenSource] = useState<ReceiptSource | null>(null);
  const [chosenDocument, setChosenDocument] = useState('');

  // The documents of the lease are asked when the window opens (the receipt may have been uploaded since the last time). A list that cannot be
  // read is no list: the window then asks for the file, as it always did.
  const documents = useQuery({
    queryKey: ['lease-documents', leaseId],
    queryFn: () => leaseDocumentsApi.list(leaseId),
    enabled: open,
    staleTime: 0,
  });
  const uploaded = (documents.data ?? []).filter((document) => document.kind === 'Registration');
  const source: ReceiptSource = uploaded.length === 0 ? 'file' : (chosenSource ?? 'uploaded');
  // One receipt: it is the one. Several: the person chooses.
  const documentId = uploaded.some((document) => document.id === chosenDocument) ? chosenDocument : uploaded.length === 1 ? uploaded[0].id : '';

  // What the receipt says, once the one in use is known: its code and day are proposed, never declared.
  const reading = useReceiptReading(leaseId, open && source === 'uploaded' ? documentId : '');
  const receiptState = reading.data?.state;
  const read = receiptState === 'Read' ? reading.data?.receipt : null;
  const rejected = read?.outcome === 'Rejected';
  const readCode = !rejected && read ? (read.code ?? (read.number ? [read.number, read.series].filter(Boolean).join(' ') : '')) : '';
  const readDate = !rejected && read?.registrationDate ? read.registrationDate : '';
  const registrationCode = typedCode ?? readCode;
  const registrationDate = typedDate ?? (readDate || today);
  const warnings = !rejected && read ? read.warnings : [];

  const code = registrationCode.trim();
  const codeValid = code.length > 0 && code.length <= RLI_MAX_REGISTRATION_CODE_LENGTH;
  const dateValid = isStayDate(registrationDate) && registrationDate <= today;
  const receiptValid = source === 'uploaded' ? documentId !== '' && !rejected : isPdf(receipt);
  const canSubmit = codeValid && dateValid && receiptValid && confirmed && !declare.isPending;

  function reset() {
    setTypedCode(null);
    setTypedDate(null);
    setReceipt(null);
    setConfirmed(false);
    setChosenSource(null);
    setChosenDocument('');
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handleSubmit() {
    if (!canSubmit) return;
    const declared = { registrationCode: code, registrationDate };
    const input: ManualRegistrationInput | null =
      source === 'uploaded' ? { ...declared, receiptDocumentId: documentId } : receipt ? { ...declared, receipt } : null;
    if (!input) return;
    declare.mutate({ id: leaseId, input }, { onSuccess: () => handleOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="rli-manual-dialog">
        <DialogHeader>
          <DialogTitle>{t('leases.rli.manualDialog.title')}</DialogTitle>
          <DialogDescription>{t('leases.rli.manualDialog.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`rli-code-${leaseId}`}>{t('leases.rli.manualDialog.codeLabel')}</Label>
            <Input
              id={`rli-code-${leaseId}`}
              value={registrationCode}
              maxLength={RLI_MAX_REGISTRATION_CODE_LENGTH}
              onChange={(e) => setTypedCode(e.target.value)}
              aria-describedby={`rli-code-hint-${leaseId}`}
            />
            <p id={`rli-code-hint-${leaseId}`} className="text-xs text-muted-foreground">
              {t('leases.rli.manualDialog.codeHint')}
            </p>
            {typedCode === null && readCode !== '' ? (
              <p className="text-xs font-medium text-foreground/80" data-testid="rli-code-read">
                {t('leaseDocs.receipt.check')}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`rli-date-${leaseId}`}>{t('leases.rli.manualDialog.dateLabel')}</Label>
            <Input
              id={`rli-date-${leaseId}`}
              type="date"
              value={registrationDate}
              max={today}
              onChange={(e) => setTypedDate(e.target.value)}
            />
            {typedDate === null && readDate !== '' ? (
              <p className="text-xs font-medium text-foreground/80" data-testid="rli-date-read">
                {t('leaseDocs.receipt.check')}
              </p>
            ) : null}
            {!dateValid && (
              <p className="text-sm text-destructive" role="alert">
                {t('leases.rli.manualDialog.dateInvalid', { today: formatDate(today) })}
              </p>
            )}
          </div>
          <div className="space-y-3" data-testid="rli-receipt-source">
            {uploaded.length > 0 ? (
              <ChoiceGroup legend={t('leaseRound.receipt.legend')} legendVisible minCardWidth={12}>
                <ChoiceCard
                  name={`rli-receipt-source-${leaseId}`}
                  value="uploaded"
                  checked={source === 'uploaded'}
                  onChange={() => setChosenSource('uploaded')}
                  title={t('leaseRound.receipt.uploaded.title')}
                  description={t('leaseRound.receipt.uploaded.description')}
                  data-testid="rli-receipt-uploaded"
                />
                <ChoiceCard
                  name={`rli-receipt-source-${leaseId}`}
                  value="file"
                  checked={source === 'file'}
                  onChange={() => setChosenSource('file')}
                  title={t('leaseRound.receipt.file.title')}
                  data-testid="rli-receipt-new"
                />
              </ChoiceGroup>
            ) : null}
            {source === 'uploaded' ? (
              <div className="space-y-2">
                <Label htmlFor={`rli-document-${leaseId}`}>{t('leaseRound.receipt.documentLabel')}</Label>
                <Select
                  id={`rli-document-${leaseId}`}
                  value={documentId}
                  onChange={(e) => setChosenDocument(e.target.value)}
                  data-testid="rli-receipt-document"
                >
                  {documentId === '' ? <option value="">{t('leaseRound.receipt.documentPlaceholder')}</option> : null}
                  {uploaded.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.fileName} · {formatDateTime(document.uploadedAt)}
                    </option>
                  ))}
                </Select>
                {reading.isLoading ? (
                  <p role="status" className="text-xs text-muted-foreground" data-testid="rli-receipt-reading">
                    {t('leaseDocs.receipt.reading')}
                  </p>
                ) : null}
                {rejected ? (
                  <Alert variant="danger" data-testid="rli-receipt-rejected">
                    {t('leaseDocs.receipt.rejected')}
                  </Alert>
                ) : null}
                {warnings.length > 0 ? (
                  <Alert variant="warning" title={t('leaseDocs.receipt.warningsTitle')} data-testid="rli-receipt-warnings">
                    <ul className="list-disc space-y-1 ps-5">
                      {warnings.map((warning) => (
                        <li key={warning} className="break-words">
                          {t(`leaseDocs.receipt.warnings.${RECEIPT_WARNINGS.has(warning) ? warning : 'default'}`)}
                        </li>
                      ))}
                    </ul>
                  </Alert>
                ) : null}
                {receiptState === 'Unreadable' || receiptState === 'NotAReceipt' ? (
                  <p className="text-xs text-muted-foreground" data-testid="rli-receipt-unread">
                    {t(`leaseDocs.receipt.${receiptState === 'Unreadable' ? 'unreadable' : 'notAReceipt'}`)}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor={`rli-receipt-${leaseId}`}>{t('leases.rli.manualDialog.receiptLabel')}</Label>
                <Input
                  id={`rli-receipt-${leaseId}`}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
                />
                {receipt && !receiptValid && (
                  <p className="text-sm text-destructive" role="alert">
                    {t('leases.rli.manualDialog.receiptInvalid')}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id={`rli-confirm-${leaseId}`}
              checked={confirmed}
              onCheckedChange={(value) => setConfirmed(value === true)}
            />
            <Label htmlFor={`rli-confirm-${leaseId}`} className="text-sm font-normal leading-snug">
              {t('leases.rli.manualDialog.confirmation')}
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {t('leases.rli.manualDialog.cancel')}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {declare.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('leases.rli.manualDialog.saving')}
              </>
            ) : (
              t('leases.rli.manualDialog.submit')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
