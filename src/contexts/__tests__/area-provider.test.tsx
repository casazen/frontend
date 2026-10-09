import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { AreaProvider } from '@/contexts/area-provider';

const root = document.documentElement;
const area = () => root.getAttribute('data-area');

function Links() {
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => void navigate('/app/long-rent/leases')}>long</button>
      <button onClick={() => void navigate('/app/choose-context')}>picker</button>
      <button onClick={() => void navigate('/app/supplier')}>supplier</button>
    </>
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/app/*"
          element={
            <AreaProvider>
              <Links />
            </AreaProvider>
          }
        />
        <Route path="*" element={<AreaProvider>outside the app</AreaProvider>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  root.removeAttribute('data-area');
  root.removeAttribute('data-ui');
});

describe('AreaProvider (data-area on <html>)', () => {
  it.each([
    ['/app/short-rent', 'short-rent'],
    ['/app/short-rent/properties/7', 'short-rent'],
    ['/app/long-rent/leases', 'long-rent'],
    ['/app/supplier/inbox', 'supplier'],
    ['/app/admin/users', 'admin'],
  ])('AreaProvider_%s_SetsTheArea%s', (path, expected) => {
    renderAt(path);
    expect(area()).toBe(expected);
  });

  it.each(['/app/choose-context', '/app/no-access', '/login', '/book/villa'])('AreaProvider_%s_HasNoArea', (path) => {
    renderAt(path);
    expect(area()).toBeNull();
  });

  it('AreaProvider_Unmount_RemovesTheArea', () => {
    const { unmount } = renderAt('/app/short-rent');
    expect(area()).toBe('short-rent');
    unmount();
    expect(root.hasAttribute('data-area')).toBe(false);
  });

  it('AreaProvider_MovingBetweenAreasAndOut_FollowsTheLocation', async () => {
    renderAt('/app/short-rent');
    expect(area()).toBe('short-rent');

    fireEvent.click(screen.getByText('long'));
    await waitFor(() => expect(area()).toBe('long-rent'));

    fireEvent.click(screen.getByText('picker'));
    await waitFor(() => expect(area()).toBeNull());

    fireEvent.click(screen.getByText('supplier'));
    await waitFor(() => expect(area()).toBe('supplier'));
  });

  it('AreaProvider_RendersItsChildrenAndNeverTouchesDataUi', () => {
    renderAt('/book/villa');
    expect(screen.getByText('outside the app')).toBeInTheDocument();
    // The area is inert without the redesign: the provider never sets `data-ui` (UiVersionSync does).
    expect(root.hasAttribute('data-ui')).toBe(false);
    expect(root.hasAttribute('data-area')).toBe(false);

    renderAt('/app/short-rent');
    expect(root.hasAttribute('data-ui')).toBe(false);
  });
});
