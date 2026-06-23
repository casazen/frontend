import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingScreen } from '@/components/shared/loading-screen';
import {
  useCompleteSupplierActivation,
  useSupplierActivation,
  useSupplierProfile,
  useUpdateSupplierProfile,
} from '@/queries/use-supplier';
import type { ActivationStatus, SupplierProfile } from '@/types/supplier';

const CATEGORY_OPTIONS = ['Pulizie', 'Manutenzione', 'Biancheria', 'Giardinaggio'];

interface SupplierActivationFormProps {
  profile: SupplierProfile;
  activation: ActivationStatus;
}

function SupplierActivationForm({ profile, activation }: SupplierActivationFormProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const updateProfile = useUpdateSupplierProfile();
  const completeActivation = useCompleteSupplierActivation();

  const [categories, setCategories] = useState<string[]>(profile.categories ?? []);
  const [comuni, setComuni] = useState((profile.comuni ?? []).join(', '));
  const [bio, setBio] = useState(profile.bio ?? '');
  const [tosAccepted, setTosAccepted] = useState(Boolean(profile.tosAcceptedAt));

  const toggleCategory = (category: string) => {
    setCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  };

  const saveProfileFields = async () => {
    await updateProfile.mutateAsync({
      categories,
      comuni: comuni
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
      bio,
    });
    toast.success(t('supplier.progressSaved'));
  };

  const handleComplete = async () => {
    try {
      await saveProfileFields();
      await completeActivation.mutateAsync(tosAccepted);
      toast.success(t('supplier.profileActivated'));
      navigate('/supplier/inbox', { replace: true });
    } catch {
      toast.error(t('supplier.completeAllSteps'));
    }
  };

  return (
    <div className="space-y-6" data-testid="supplier-activation-page">
      <PageHeader
        title={t('supplier.activationTitle')}
        description={t('supplier.activationDescription')}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('supplier.activationStatus')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(activation.steps ?? []).map((step) => (
            <div key={step.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
              <div>
                <p className="font-medium">{step.label}</p>
                {step.blocker ? <p className="text-sm text-muted-foreground">{step.blocker}</p> : null}
              </div>
              <span className="text-xs uppercase text-muted-foreground">{step.status}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('supplier.serviceCategories')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((category) => (
            <Button
              key={category}
              type="button"
              variant={categories.includes(category) ? 'default' : 'outline'}
              onClick={() => toggleCategory(category)}
            >
              {category}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('supplier.operatingMunicipalities')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="comuni">{t('supplier.municipalityCodesLabel')}</Label>
          <Input
            id="comuni"
            value={comuni}
            onChange={(e) => setComuni(e.target.value)}
            placeholder="H501, F205"
            className="mt-2"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('supplier.professionalProfile')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="bio">{t('supplier.description')}</Label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="mt-2 min-h-24 w-full rounded-md border px-3 py-2 text-sm"
            placeholder={t('supplier.describeServicesPlaceholder')}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-start gap-3 pt-6">
          <Checkbox
            id="tos"
            checked={tosAccepted}
            onCheckedChange={(checked) => setTosAccepted(checked === true)}
          />
          <Label htmlFor="tos" className="leading-relaxed">
            {t('supplier.acceptTos')}
          </Label>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={() => void saveProfileFields()} disabled={updateProfile.isPending}>
          {t('supplier.saveProgress')}
        </Button>
        <Button type="button" onClick={() => void handleComplete()} disabled={completeActivation.isPending}>
          {t('supplier.activateProfile')}
        </Button>
      </div>
    </div>
  );
}

export function SupplierActivationPage() {
  const { t } = useTranslation();
  const { data: activation, isLoading: activationLoading } = useSupplierActivation();
  const { data: profile, isLoading: profileLoading } = useSupplierProfile();

  if (activationLoading || profileLoading || !profile || !activation) {
    return <LoadingScreen message={t('supplier.activationLoading')} />;
  }

  if (activation.status === 'Active') {
    return <Navigate to="/supplier/inbox" replace />;
  }

  return <SupplierActivationForm key={profile.orgId} profile={profile} activation={activation} />;
}
