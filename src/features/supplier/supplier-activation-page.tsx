import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { LoadingScreen } from '@/components/shared/loading-screen';
import {
  useCompleteSupplierActivation,
  useSupplierActivation,
  useSupplierProfile,
  useUpdateSupplierProfile,
} from '@/queries/use-supplier';
import type { SupplierProfile } from '@/types/supplier';
import { Calendar, Smartphone, CheckCircle2, ArrowRight } from 'lucide-react';

const CATEGORY_OPTIONS = ['Pulizie', 'Manutenzione', 'Giardinaggio', 'Eventi', 'Noleggio', 'Escursioni'];

interface Step1Props {
  profile: SupplierProfile;
  onNext: () => void;
}

function Step1Registration({ profile, onNext }: Step1Props) {
  const { t } = useTranslation();
  const updateProfile = useUpdateSupplierProfile();

  const [categories, setCategories] = useState<string[]>(profile.categories ?? []);
  const [comuneInput, setComuneInput] = useState((profile.comuni ?? []).join(', '));
  const [saving, setSaving] = useState(false);

  const toggleCategory = (c: string) => {
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const handleSaveAndNext = async () => {
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        categories,
        comuni: comuneInput.split(',').map((x) => x.trim()).filter(Boolean),
      });
      toast.success(t('supplier.progressSaved'));
      onNext();
    } catch {
      toast.error(t('supplier.progressSaveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('supplier.step1Title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t('supplier.serviceCategories')}</Label>
            <p className="mb-2 text-xs text-muted-foreground">{t('supplier.categoriesHint')}</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((category) => (
                <Button
                  key={category}
                  type="button"
                  size="sm"
                  variant={categories.includes(category) ? 'default' : 'outline'}
                  onClick={() => toggleCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="comuni">{t('supplier.operatingMunicipalities')}</Label>
            <p className="mb-2 text-xs text-muted-foreground">{t('supplier.comuniHint')}</p>
            <Input
              id="comuni"
              value={comuneInput}
              onChange={(e) => setComuneInput(e.target.value)}
              placeholder={t('supplier.comuniPlaceholder')}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => void handleSaveAndNext()} disabled={saving} className="w-full">
        {t('supplier.continueToCalendar')} <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

function Step2Calendar({ profile }: { profile: SupplierProfile }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const completeActivation = useCompleteSupplierActivation();
  const [tosAccepted, setTosAccepted] = useState(Boolean(profile.tosAcceptedAt));
  const [activating, setActivating] = useState(false);

  const handleActivate = async () => {
    setActivating(true);
    try {
      await completeActivation.mutateAsync(tosAccepted);
      toast.success(t('supplier.profileActivated'));
      navigate('/app/supplier/dashboard', { replace: true });
    } catch {
      toast.error(t('supplier.acceptTosFirst'));
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('supplier.step2Title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('supplier.calendarSyncDescription')}</p>

          <div className="grid gap-3">
            <div className="flex items-start gap-3 rounded-md border p-3">
              <Calendar className="mt-0.5 h-5 w-5 text-primary shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{t('supplier.googleCalendar')}</p>
                <p className="text-xs text-muted-foreground">{t('supplier.googleCalendarHint')}</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => navigate('/app/supplier/calendar')}>
                  {t('supplier.connectLater')}
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-md border p-3">
              <Calendar className="mt-0.5 h-5 w-5 text-primary shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{t('supplier.icalFeed')}</p>
                <p className="text-xs text-muted-foreground">{t('supplier.icalFeedHint')}</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => navigate('/app/supplier/calendar')}>
                  {t('supplier.connectLater')}
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-md border p-3">
              <Smartphone className="mt-0.5 h-5 w-5 text-primary shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{t('supplier.whatsappOption')}</p>
                <p className="text-xs text-muted-foreground">{t('supplier.whatsappHint')}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-start gap-3 pt-6">
          <Checkbox
            id="tos"
            checked={tosAccepted}
            onCheckedChange={(checked) => setTosAccepted(checked === true)}
          />
          <Label htmlFor="tos" className="leading-relaxed text-sm">
            {t('supplier.acceptTos')}
          </Label>
        </CardContent>
      </Card>

      <div className="flex flex-col items-center gap-3">
        <Button onClick={() => void handleActivate()} disabled={activating || !tosAccepted} className="w-full">
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {t('supplier.activateProfile')}
        </Button>
        <p className="text-xs text-muted-foreground">{t('supplier.completeLaterHint')}</p>
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
    return <Navigate to="/app/supplier/dashboard" replace />;
  }

  const [step, setStep] = useState<'registration' | 'calendar'>('registration');

  return (
    <div className="max-w-lg mx-auto" data-testid="supplier-activation-page">
      <PageHeader
        title={t('supplier.activationTitle')}
        description={t('supplier.activationNewDescription')}
      />

      {step === 'registration' ? (
        <Step1Registration profile={profile} onNext={() => setStep('calendar')} />
      ) : (
        <Step2Calendar profile={profile} />
      )}
    </div>
  );
}
