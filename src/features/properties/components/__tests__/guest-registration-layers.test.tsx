import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { DetailDrawerHost } from '@/components/shared/detail-drawer/detail-drawer-host';
import { registerDetail } from '@/components/shared/detail-drawer/detail-registry';
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/workspace-context';
import { SWISS_LAYER_KIND } from '@/features/compliance/swiss/swiss-layer-address';
import i18n from '@/i18n/config';
import { settleDrawer } from '@/test/drawer';
import { GUEST_REGISTER_LAYER_KIND } from '../../lib/guest-register-address';
import { GuestRegistrationLayers } from '../guest-registration-layers';
import { PROPERTY_ID, regime } from './guest-registration-fixtures';

function Where() {
  const location = useLocation();
  return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
}

const workspaceOf = (permissions: readonly string[]): WorkspaceContextValue => ({
  contexts: [],
  activeContext: 'short-rent',
  isReady: true,
  setActiveContext: vi.fn(),
  hasPermission: (contextKey, permission) => contextKey === 'short-rent' && permissions.includes(permission),
  getDefaultRoute: () => '/app',
});

afterEach(async () => {
  cleanup();
  await settleDrawer();
});

/**
 * The links of the card of the regime that open the guest register and the assisted notification (E31/F02/US02): in a page with the drawer of the shell they open the layer in place,
 * over the page the person is on, whose address keeps its other parameters; the host is never sent to another page.
 */
describe('GuestRegistrationLayers, the way from the card to the two layers (E31/F02/US02)', () => {
  it('GuestRegistrationLayers_PageWithTheDrawer_TheLinksOpenTheLayersInPlaceAndTheAddressKeepsTheOtherParameters', async () => {
    await i18n.changeLanguage('it');
    // The shell mounts the drawer once and registers the kinds: here a host and the kinds stand for it.
    const unregister = [
      registerDetail(GUEST_REGISTER_LAYER_KIND, { title: 'guestRegister.layer.title', Content: () => <p>register</p> }),
      registerDetail(SWISS_LAYER_KIND, { title: 'swissNotification.layer.title', Content: () => <p>notification</p> }),
    ];
    const zurich = regime({ code: 'CH-ZH', cantonCode: 'ZH', casaZenSupport: 'AssistedNotification' });
    render(
      <I18nextProvider i18n={i18n}>
        <WorkspaceContext.Provider value={workspaceOf(['guest.read', 'booking.read'])}>
          <MemoryRouter initialEntries={['/app/short-rent/properties/p1?section=documents']}>
            <GuestRegistrationLayers propertyId={PROPERTY_ID} regime={zurich} effectiveDuty="Ask" />
            <DetailDrawerHost />
            <Where />
          </MemoryRouter>
        </WorkspaceContext.Provider>
      </I18nextProvider>,
    );

    fireEvent.click(screen.getByTestId('guest-register-link'));

    // The page is the one the person was on: only the layer was added to its address.
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(`/app/short-rent/properties/p1?section=documents&detail=guest-register:${PROPERTY_ID}`));
    expect(await screen.findByRole('dialog', { name: 'Registro ospiti' })).toBeInTheDocument();

    // One drawer at a time: the notification takes the place of the register.
    fireEvent.click(screen.getByTestId('swiss-notification-link'));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(`/app/short-rent/properties/p1?section=documents&detail=swiss-notification:${PROPERTY_ID}`));
    expect(await screen.findByRole('dialog', { name: 'Notifica degli ospiti' })).toBeInTheDocument();

    for (const undo of unregister) undo();
  });

  it('GuestRegistrationLayers_ASwissRegimeThatOnlyKeepsARegister_OffersTheRegisterAndNotTheNotification', async () => {
    await i18n.changeLanguage('it');
    render(
      <I18nextProvider i18n={i18n}>
        <WorkspaceContext.Provider value={workspaceOf(['guest.read', 'booking.read'])}>
          <MemoryRouter>
            <GuestRegistrationLayers propertyId={PROPERTY_ID} regime={regime({ code: 'CH-BE', cantonCode: 'BE', obligation: 'KeepRegister', casaZenSupport: 'GuestRegister' })} effectiveDuty="Ask" />
          </MemoryRouter>
        </WorkspaceContext.Provider>
      </I18nextProvider>,
    );

    expect(screen.getByTestId('guest-register-link')).toBeInTheDocument();
    expect(screen.queryByTestId('swiss-notification-link')).not.toBeInTheDocument();
  });
});
