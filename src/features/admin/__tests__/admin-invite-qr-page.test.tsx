import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminInviteQrPage } from '../admin-invite-qr-page';

describe('AdminInviteQrPage', () => {
  it('redirects legacy generic QR entry points to the personal agency invitation form', async () => {
    render(<MemoryRouter initialEntries={['/app/admin/invite-qr']}><Routes>
      <Route path="/app/admin/invite-qr" element={<AdminInviteQrPage />} />
      <Route path="/app/admin/suppliers/invite" element={<div>Invita nuova agenzia</div>} />
    </Routes></MemoryRouter>);
    expect(await screen.findByText('Invita nuova agenzia')).toBeInTheDocument();
    expect(screen.queryByTestId('qr-supplier')).not.toBeInTheDocument();
  });
});
