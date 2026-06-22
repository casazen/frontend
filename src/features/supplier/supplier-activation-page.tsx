import { useState } from 'react';
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
    toast.success('Progresso salvato');
  };

  const handleComplete = async () => {
    try {
      await saveProfileFields();
      await completeActivation.mutateAsync(tosAccepted);
      toast.success('Profilo fornitore attivato');
      navigate('/supplier/inbox', { replace: true });
    } catch {
      toast.error('Completa tutti i passaggi prima di attivare il profilo');
    }
  };

  return (
    <div className="space-y-6" data-testid="supplier-activation-page">
      <PageHeader
        title="Attivazione profilo fornitore"
        description="Completa i 5 passaggi per comparire nel marketplace host"
      />

      <Card>
        <CardHeader>
          <CardTitle>Stato attivazione</CardTitle>
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
          <CardTitle>Categorie di servizio</CardTitle>
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
          <CardTitle>Comuni di operatività</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="comuni">Codici comune (separati da virgola)</Label>
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
          <CardTitle>Profilo professionale</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="bio">Descrizione</Label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="mt-2 min-h-24 w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Descrivi i tuoi servizi..."
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
            Accetto i termini di servizio fornitore CasaZen
          </Label>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={() => void saveProfileFields()} disabled={updateProfile.isPending}>
          Salva progresso
        </Button>
        <Button type="button" onClick={() => void handleComplete()} disabled={completeActivation.isPending}>
          Attiva profilo
        </Button>
      </div>
    </div>
  );
}

export function SupplierActivationPage() {
  const { data: activation, isLoading: activationLoading } = useSupplierActivation();
  const { data: profile, isLoading: profileLoading } = useSupplierProfile();

  if (activationLoading || profileLoading || !profile || !activation) {
    return <LoadingScreen message="Caricamento attivazione..." />;
  }

  if (activation.status === 'Active') {
    return <Navigate to="/supplier/inbox" replace />;
  }

  return <SupplierActivationForm key={profile.orgId} profile={profile} activation={activation} />;
}
