import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ListCardBody, SwipeSurface } from '../list-card';
import { SWIPE_FIRE_AT, SWIPE_MAX_DISTANCE } from '../use-swipe';
import type { ListSwipeAction } from '../list-types';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

function setup(props: { right?: ListSwipeAction | null; left?: ListSwipeAction | null; enabled?: boolean } = {}) {
  const onInner = vi.fn();
  render(
    <MemoryRouter>
      <SwipeSurface {...props}>
        <div className="p-4">
          <a href="/inner" onClick={(event) => { event.preventDefault(); onInner(); }}>
            Mario Rossi
          </a>
          <span data-no-swipe="">
            <button type="button">Accept</button>
          </span>
        </div>
      </SwipeSurface>
      <Where />
    </MemoryRouter>,
  );
  const surface = screen.getByTestId('swipe-card').children[1] as HTMLElement;
  return { surface, onInner };
}

const touch = { pointerId: 3, pointerType: 'touch', isPrimary: true };
const down = (target: Element, x: number, y = 40) => fireEvent.pointerDown(target, { ...touch, clientX: x, clientY: y });
const move = (target: Element, x: number, y = 40) => fireEvent.pointerMove(target, { ...touch, clientX: x, clientY: y });
const up = (target: Element) => fireEvent.pointerUp(target, touch);

/** What the finger does: goes down, moves along `path` (x values), is lifted. */
function swipe(surface: Element, from: number, path: number[], y = 40) {
  down(surface, from, y);
  for (const x of path) move(surface, x, y);
  up(surface);
}

const FIRE = Math.ceil(SWIPE_MAX_DISTANCE * SWIPE_FIRE_AT);

describe('SwipeSurface', () => {
  it('shows what is under the card for a screen to see, and hides it from a screen reader', () => {
    setup({ right: { label: 'Write', icon: Mail, tone: 'neutral' }, left: { label: 'Arrival', tone: 'success' } });

    const under = screen.getByTestId('swipe-card').children[0];
    expect(under).toHaveAttribute('aria-hidden', 'true');
    expect(under).toHaveTextContent('Write');
    expect(under).toHaveTextContent('Arrival');
  });

  it('follows the finger, up to a limit', () => {
    const { surface } = setup({ right: { label: 'Write' }, left: { label: 'Arrival' } });

    down(surface, 200);
    move(surface, 170);
    expect(surface.style.transform).toBe('translateX(-30px)');
    move(surface, 20);
    expect(surface.style.transform).toBe(`translateX(-${SWIPE_MAX_DISTANCE}px)`);
    move(surface, 400);
    expect(surface.style.transform).toBe(`translateX(${SWIPE_MAX_DISTANCE}px)`);
  });

  it('runs the action of the side when the card is let go far enough, and puts the card back', () => {
    const onLeft = vi.fn();
    const onRight = vi.fn();
    const { surface } = setup({ right: { label: 'Write', onSelect: onRight }, left: { label: 'Arrival', onSelect: onLeft } });

    swipe(surface, 200, [180, 150, 200 - FIRE - 2]);
    expect(surface.style.transform).toBe('');
    // A moment later, so that the card has started back before the page changes.
    expect(onLeft).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(150));
    expect(onLeft).toHaveBeenCalledTimes(1);
    expect(onRight).not.toHaveBeenCalled();

    swipe(surface, 100, [140, 100 + FIRE + 2]);
    act(() => void vi.advanceTimersByTime(150));
    expect(onRight).toHaveBeenCalledTimes(1);
  });

  it('does not run it when the card is let go before the threshold', () => {
    const onLeft = vi.fn();
    const { surface } = setup({ left: { label: 'Arrival', onSelect: onLeft } });

    swipe(surface, 200, [180, 200 - FIRE + 10]);
    act(() => void vi.advanceTimersByTime(500));

    expect(onLeft).not.toHaveBeenCalled();
    expect(surface.style.transform).toBe('');
  });

  it('goes to the address of an action that has one', () => {
    const { surface } = setup({ left: { label: 'Open', href: '/app/short-rent/bookings/s1' } });

    swipe(surface, 200, [150, 200 - FIRE - 4]);
    act(() => void vi.advanceTimersByTime(150));

    expect(screen.getByTestId('where')).toHaveTextContent('/app/short-rent/bookings/s1');
  });

  it('does not move toward a side that has no action', () => {
    const { surface } = setup({ left: { label: 'Arrival' } });

    down(surface, 200);
    move(surface, 260);

    expect(surface.style.transform).toBe('');
  });

  it('is not for the mouse: on a computer there is the menu', () => {
    const onLeft = vi.fn();
    const { surface } = setup({ left: { label: 'Arrival', onSelect: onLeft } });

    fireEvent.pointerDown(surface, { pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: 200, clientY: 40 });
    fireEvent.pointerMove(surface, { pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: 100, clientY: 40 });
    fireEvent.pointerUp(surface, { pointerId: 1, pointerType: 'mouse' });
    act(() => void vi.advanceTimersByTime(500));

    expect(surface.style.transform).toBe('');
    expect(onLeft).not.toHaveBeenCalled();
  });

  it('gives way to the page scrolling: a move that starts down or up is not a swipe', () => {
    const onLeft = vi.fn();
    const { surface } = setup({ left: { label: 'Arrival', onSelect: onLeft } });

    down(surface, 200, 40);
    move(surface, 196, 80);
    move(surface, 100, 90);
    up(surface);
    act(() => void vi.advanceTimersByTime(500));

    expect(surface.style.transform).toBe('');
    expect(onLeft).not.toHaveBeenCalled();
  });

  it('leaves a press on a button of the card to the button', () => {
    const onLeft = vi.fn();
    const { surface } = setup({ left: { label: 'Arrival', onSelect: onLeft } });
    const button = screen.getByRole('button', { name: 'Accept' });

    down(button, 200);
    move(surface, 100);
    up(surface);
    act(() => void vi.advanceTimersByTime(500));

    expect(onLeft).not.toHaveBeenCalled();
    expect(surface.style.transform).toBe('');
  });

  it('takes the click that follows a swipe, so that the link under the finger is not followed, and not the next one', () => {
    const { surface, onInner } = setup({ left: { label: 'Arrival', onSelect: vi.fn() } });
    const link = screen.getByRole('link', { name: 'Mario Rossi' });

    swipe(surface, 200, [150, 100]);
    fireEvent.click(link);
    expect(onInner).not.toHaveBeenCalled();

    fireEvent.click(link);
    expect(onInner).toHaveBeenCalledTimes(1);
  });

  it('does not take a plain tap', () => {
    const { surface, onInner } = setup({ left: { label: 'Arrival', onSelect: vi.fn() } });
    const link = screen.getByRole('link', { name: 'Mario Rossi' });

    down(surface, 200);
    up(surface);
    fireEvent.click(link);

    expect(onInner).toHaveBeenCalledTimes(1);
  });

  it('comes back when the browser takes the gesture over (a cancelled pointer)', () => {
    const onLeft = vi.fn();
    const { surface } = setup({ left: { label: 'Arrival', onSelect: onLeft } });

    down(surface, 200);
    move(surface, 120);
    expect(surface.style.transform).toBe('translateX(-80px)');
    fireEvent.pointerCancel(surface, touch);
    act(() => void vi.advanceTimersByTime(500));

    expect(surface.style.transform).toBe('');
    expect(onLeft).not.toHaveBeenCalled();
  });

  it('is off while the person selects rows', () => {
    const onLeft = vi.fn();
    const { surface } = setup({ left: { label: 'Arrival', onSelect: onLeft }, enabled: false });

    swipe(surface, 200, [150, 100]);
    act(() => void vi.advanceTimersByTime(500));

    expect(onLeft).not.toHaveBeenCalled();
  });

  it('does not animate the way back for a person who asked for less motion', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) => ({ matches: query === '(prefers-reduced-motion: reduce)', media: query, addEventListener: () => undefined, removeEventListener: () => undefined }) as MediaQueryList,
    );
    const { surface } = setup({ left: { label: 'Arrival' } });

    swipe(surface, 200, [150]);

    expect(surface.style.transition).toBe('none');
  });

  it('animates the way back otherwise', () => {
    const { surface } = setup({ left: { label: 'Arrival' } });

    swipe(surface, 200, [150]);

    expect(surface.style.transition).toContain('transform');
  });

  it('is only its content when it has nothing to swipe to', () => {
    render(
      <MemoryRouter>
        <SwipeSurface>
          <p>content</p>
        </SwipeSurface>
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('swipe-card')).not.toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
  });
});

describe('ListCardBody', () => {
  it('puts the title and the line under it on the left and the state on the right', () => {
    render(
      <ListCardBody
        title={<a href="/x">Mario Rossi</a>}
        content={{ title: 'unused', sub: 'Casa Bianca', status: <span>Pending</span>, lead: <b>MR</b> }}
      />,
    );

    expect(screen.getByRole('link', { name: 'Mario Rossi' })).toBeInTheDocument();
    expect(screen.getByText('Casa Bianca')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('MR')).toBeInTheDocument();
  });

  it('shows the small items in a line, each with the name of what it is for a screen reader and an icon that is only a picture', () => {
    render(
      <ListCardBody
        title="Mario Rossi"
        content={{
          title: 'x',
          meta: [
            { icon: Mail, text: 'mario@example.com', label: 'Email' },
            { text: '€ 450' },
          ],
          foot: <span>foot</span>,
        }}
      />,
    );

    const email = screen.getByText('mario@example.com').parentElement!;
    expect(email).toHaveTextContent('Email: mario@example.com');
    expect(email.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('€ 450')).toBeInTheDocument();
    // They are not a list: a card in a list of cards would announce one each time.
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByText('foot')).toBeInTheDocument();
  });

  it('has no list when there is nothing to list', () => {
    render(<ListCardBody title="Mario Rossi" content={{ title: 'x', meta: [] }} />);

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
