import type { Page } from '@playwright/test';

interface SupplierProfile {
  orgId: string;
  status: string;
  legalName: string;
  phone: string;
  email: string;
  categories: string[];
  comuni: string[];
  bio?: string | null;
  photoUrls: string[];
  tosAcceptedAt?: string | null;
}

interface ActivationStatus {
  status: string;
  steps: Array<{ id: string; label: string; status: string; blocker?: string | null }>;
}

const demoSupplierProfile: SupplierProfile = {
  orgId: '22222222-2222-2222-2222-222222222202',
  status: 'Pending',
  legalName: 'Pulizie Demo Srl',
  phone: '+39 06 1234567',
  email: 'supplier@demo.casazen.com',
  categories: [],
  comuni: [],
  bio: null,
  photoUrls: [],
  tosAcceptedAt: null,
};

const demoActivationPending: ActivationStatus = {
  status: 'Pending',
  steps: [
    { id: 'identity', label: 'Identità e contatti', status: 'completed' },
    { id: 'categories', label: 'Categorie di servizio', status: 'pending', blocker: 'Scegli almeno una categoria' },
    { id: 'comuni', label: 'Comuni di operatività', status: 'pending', blocker: 'Seleziona almeno un comune' },
    { id: 'profile', label: 'Profilo professionale', status: 'pending', blocker: 'Aggiungi una descrizione professionale' },
    { id: 'tos', label: 'Termini di servizio', status: 'pending', blocker: 'Accetta i termini di servizio' },
  ],
};

const demoActivationActive: ActivationStatus = {
  status: 'Active',
  steps: demoActivationPending.steps.map((step) => ({ ...step, status: 'completed', blocker: null })),
};

export async function mockSupplierConsoleApi(page: Page, options?: { active?: boolean }): Promise<void> {
  const active = options?.active ?? false;
  const profile: SupplierProfile = active
    ? { ...demoSupplierProfile, status: 'Active', categories: ['Pulizie'], comuni: ['H501'], bio: 'Servizi demo', tosAcceptedAt: new Date().toISOString() }
    : demoSupplierProfile;
  const activation = active ? demoActivationActive : demoActivationPending;

  await page.route('**/api/supplier/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/profile/activation') && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(activation) });
      return;
    }

    if (url.includes('/profile/activation/complete') && method === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'Active' }) });
      return;
    }

    if (url.includes('/profile') && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(profile) });
      return;
    }

    if (url.includes('/profile') && method === 'PUT') {
      const body = route.request().postDataJSON() as Partial<SupplierProfile>;
      const merged = {
        ...profile,
        ...body,
        categories: body.categories ?? profile.categories,
        comuni: body.comuni ?? profile.comuni,
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(merged) });
      return;
    }

    if (url.includes('/inbox')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0 }) });
      return;
    }

    if (url.includes('/availability') && method === 'PUT') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ updated: 1 }) });
      return;
    }

    await route.continue();
  });
}
