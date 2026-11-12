import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { TenantBankDetails } from '@/types';

/** Account holder, IBAN, amount, due date and the unique reference, with a copy of the reference. */
export function TenantBankDetailsCard({ bank, currency }: { bank: TenantBankDetails; currency: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  async function copyReference() {
    await navigator.clipboard.writeText(bank.reference);
    setCopied(true);
    toast.success(t('tenantArea.bank.copied'));
  }

  return (
    <Card data-testid="tenant-bank">
      <CardHeader>
        <CardTitle className="text-base">{t('tenantArea.bank.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 break-words text-sm">
        <p>
          <span className="text-foreground/70">{t('tenantArea.bank.holder')}</span> {bank.accountHolder}
        </p>
        <p className="break-all">
          <span className="text-foreground/70">{t('tenantArea.bank.iban')}</span> {bank.iban}
        </p>
        <p>
          <span className="text-foreground/70">{t('tenantArea.bank.amount')}</span> {formatCurrency(bank.amount, currency)}
        </p>
        <p>
          <span className="text-foreground/70">{t('tenantArea.bank.due')}</span> {formatDate(bank.dueDate)}
        </p>
        <p className="break-all" data-testid="tenant-bank-reference">
          <span className="text-foreground/70">{t('tenantArea.bank.reference')}</span> {bank.reference}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void copyReference()} data-testid="tenant-copy-reference">
          {copied ? t('tenantArea.bank.copied') : t('tenantArea.bank.copy')}
        </Button>
      </CardContent>
    </Card>
  );
}
