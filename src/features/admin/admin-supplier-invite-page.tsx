import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import i18n from '@/i18n/config';
import { useInviteSupplier } from '@/queries/use-supplier';

export function AdminSupplierInvitePage() {
  const { t } = useTranslation();
  const invite = useInviteSupplier();
  const [email, setEmail] = useState('');
  const [comuneCode, setComuneCode] = useState('');
  const [message, setMessage] = useState('');

  const submit = async () => {
    try {
      const result = await invite.mutateAsync({
        email,
        comuneCode,
        categories: ['Pulizie'],
        message: message || undefined,
      });
      toast.success(t('admin.supplierInvite.toast.success', {
        expiresAt: new Date(result.expiresAt).toLocaleDateString(i18n.language),
      }));
      setEmail('');
      setComuneCode('');
      setMessage('');
    } catch {
      toast.error(t('admin.supplierInvite.toast.error'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.supplierInvite.title')}
        description={t('admin.supplierInvite.description')}
      />
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.supplierInvite.newInvite')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="email">{t('admin.supplierInvite.email')}</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="comune">{t('admin.supplierInvite.comuneCode')}</Label>
            <Input id="comune" value={comuneCode} onChange={(e) => setComuneCode(e.target.value)} placeholder="H501" />
          </div>
          <div>
            <Label htmlFor="message">{t('admin.supplierInvite.message')}</Label>
            <Input id="message" value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <Button onClick={() => void submit()} disabled={invite.isPending || !email || !comuneCode}>
            {t('admin.supplierInvite.sendInvite')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
