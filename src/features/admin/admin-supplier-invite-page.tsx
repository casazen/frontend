import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import i18n from '@/i18n/config';
import { useInviteSupplier } from '@/queries/use-supplier';
import { ServiceCategoryPicker } from '@/features/service-requests/components/service-category-picker';
import { useServiceCategories } from '@/queries/use-service-categories';
import { keepKnownCategories } from '@/lib/service-categories';
import { getProblemMessage } from '@/lib/api-errors';

export function AdminSupplierInvitePage() {
  const { t } = useTranslation();
  const invite = useInviteSupplier();
  const [email, setEmail] = useState('');
  const [comuneCode, setComuneCode] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const { data: categoryCodes } = useServiceCategories();

  const submit = async () => {
    try {
      const result = await invite.mutateAsync({
        email,
        comuneCode,
        // Optional: an invite without categories leaves the choice to the supplier's wizard.
        categories: categories.length > 0 ? keepKnownCategories(categories, categoryCodes) : undefined,
        message: message || undefined,
      });
      toast.success(t('admin.supplierInvite.toast.success', {
        expiresAt: new Date(result.expiresAt).toLocaleDateString(i18n.language),
      }));
      setEmail('');
      setComuneCode('');
      setCategories([]);
      setMessage('');
    } catch (error) {
      const code = isAxiosError(error)
        ? (error.response?.data as { code?: string } | undefined)?.code
        : undefined;
      if (code === 'duplicate_invite') {
        toast.error(t('admin.supplierInvite.toast.duplicate'));
      } else if (code === 'invite_email_failed') {
        toast.error(t('admin.supplierInvite.toast.emailFailed'));
      } else {
        toast.error(getProblemMessage(error, t) ?? t('admin.supplierInvite.toast.error'));
      }
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
            <Input
              id="email"
              type="email"
              data-testid="invite-email-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="comune">{t('admin.supplierInvite.comuneCode')}</Label>
            <Input
              id="comune"
              data-testid="invite-comune-input"
              value={comuneCode}
              onChange={(e) => setComuneCode(e.target.value)}
              placeholder="H501"
            />
          </div>
          <div>
            <Label>{t('admin.supplierInvite.categories')}</Label>
            <div className="mt-2">
              <ServiceCategoryPicker value={categories} onChange={setCategories} disabled={invite.isPending} />
            </div>
          </div>
          <div>
            <Label htmlFor="message">{t('admin.supplierInvite.message')}</Label>
            <Input id="message" value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <Button
            data-testid="invite-submit-btn"
            onClick={() => void submit()}
            disabled={invite.isPending || !email || !comuneCode}
          >
            {t('admin.supplierInvite.sendInvite')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
