import { createRoot } from 'react-dom/client';
import { useForm, useWatch } from 'react-hook-form';
import '@/styles/globals.css';
import '@/i18n/config';
import { setApiAuthHandlers } from '@/lib/axios';
import { ListingTextCard } from '@/features/properties/wizard/steps/listing-text-card';
import { NEW_PROPERTY_DEFAULTS, type PropertyWizardValues } from '@/features/properties/wizard/property-wizard-model';

setApiAuthHandlers({ getAccessToken: async () => 'visual-fixture-only' });
export function Fixture() {
  const form = useForm<PropertyWizardValues>({ defaultValues: { ...NEW_PROPERTY_DEFAULTS, listingTitle: 'La mia casa', description: 'La descrizione che voglio conservare.', texts: { ...NEW_PROPERTY_DEFAULTS.texts, en: { title: 'My previous title', description: 'My previous description.' } } } });
  const english = useWatch({ control: form.control, name: 'texts.en' });
  const houseRules = useWatch({ control: form.control, name: 'houseRules' });
  return <main className="mx-auto max-w-3xl space-y-6 p-5 sm:p-10">
    <h1 className="text-2xl font-semibold">Racconta la casa</h1>
    <ListingTextCard form={form} propertyId="fixture" photos={[]} />
    <p data-testid="fixture-rules">{houseRules}</p>
    <section aria-label="Versione inglese" className="space-y-2"><h2 className="font-semibold">Versione inglese</h2><p data-testid="fixture-en-title">{english?.title}</p><p data-testid="fixture-en-description">{english?.description}</p></section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
