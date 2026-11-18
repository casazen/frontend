import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n/config';
import { ORG_BILLING_ADMIN_PERMISSION } from '@/lib/org-billing-admin';
import { AiSettingsPage } from '../ai-settings-page';

const access = vi.hoisted(() => ({ addons: [] as string[], accountBilling: false }));
vi.mock('@/hooks/use-commercial-profile', () => ({
  useCommercialProfile: () => ({ commercialSignup: true, commercialEnabledAddons: access.addons }),
}));
vi.mock('@/hooks/use-feature-flags', () => ({ useFeatureFlags: () => ({ flags: { routines: true, messageAssistant: true } }) }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    hasPermission: (area: string, permission: string) =>
      (area === 'short-rent' && permission === 'property.write') ||
      (area === 'account' && permission === ORG_BILLING_ADMIN_PERMISSION && access.accountBilling),
  }),
}));
vi.mock('@/components/layout/page-header', () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));

function openSettings() {
  render(<MemoryRouter><AiSettingsPage /></MemoryRouter>);
}

describe('AI settings module cards', () => {
  beforeEach(async () => {
    access.addons = [];
    access.accountBilling = false;
    await i18n.changeLanguage('it');
  });

  it('explains unavailable modules to a property writer without an account billing destination', () => {
    openSettings();
    expect(screen.getByRole('heading', { name: 'AI Agents' })).toBeVisible();
    expect(screen.getAllByText(i18n.t('commercial.moduleRequiredText'))).toHaveLength(2);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('links a licensed writer directly to the included module', () => {
    access.addons = ['ai-agents'];
    openSettings();
    expect(screen.getByRole('link', { name: /AI Agents/ })).toHaveAttribute('href', '/app/short-rent/automations');
    expect(screen.queryByRole('link', { name: /Assistente/ })).not.toBeInTheDocument();
  });

  it('gives the billing administrator an entry to the plan for an excluded module', () => {
    access.accountBilling = true;
    openSettings();
    expect(screen.getByRole('link', { name: /AI Agents/ })).toHaveAttribute('href', '/app/account/billing');
  });
});
