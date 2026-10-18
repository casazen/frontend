import { createRef, useRef, useState, type Ref } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expectNoAxeViolations } from '@/test/axe';
import { PhotoList, type PhotoListHandle, type PhotoListItem, type PhotoListLabels, type PhotoListProps } from '../photo-list';

const LABELS: PhotoListLabels = {
  add: 'Aggiungi foto',
  adding: 'Carico le foto…',
  counter: '3 foto su 6',
  empty: 'Non ci sono ancora foto.',
  cover: 'Copertina',
  unavailable: 'Foto non disponibile',
  moveEarlier: (n) => `Sposta la foto ${n} prima`,
  moveLater: (n) => `Sposta la foto ${n} dopo`,
  remove: (n) => `Togli la foto ${n}`,
};

const ITEMS: PhotoListItem[] = ['a', 'b', 'c'].map((name) => ({ url: `https://cdn.example/${name}.jpg`, alt: `Foto ${name}` }));

function renderList(props: Partial<PhotoListProps> = {}) {
  const onChange = vi.fn();
  const view = render(<PhotoList items={ITEMS} max={6} labels={LABELS} onChange={onChange} {...props} />);
  return { onChange, ...view };
}

/** The owner of the list: it saves the new order and passes it back, as a screen does after the answer of the API. */
function Owner({ initial = ITEMS, ...props }: Partial<PhotoListProps> & { initial?: PhotoListItem[] }) {
  const [items, setItems] = useState(initial);
  return (
    <PhotoList
      items={items}
      max={6}
      labels={LABELS}
      onChange={(next) => setItems(next.map((url) => items.find((item) => item.url === url)!))}
      {...props}
    />
  );
}

/**
 * An owner that answers later, as a server does: busy while it saves, the new order only once it has answered (or never, when it
 * refuses). `outcomes` says what each save does, in turn.
 */
function SlowOwner({ outcomes }: { outcomes: ('saved' | 'refused')[] }) {
  const [items, setItems] = useState(ITEMS);
  const [busy, setBusy] = useState(false);
  const saves = useRef(0);
  return (
    <PhotoList
      items={items}
      max={6}
      labels={LABELS}
      busy={busy}
      onChange={(next) => {
        const outcome = outcomes[saves.current++] ?? 'saved';
        setBusy(true);
        setTimeout(() => {
          if (outcome === 'saved') setItems(next.map((url) => items.find((item) => item.url === url)!));
          setBusy(false);
        }, 20);
      }}
    />
  );
}

describe('PhotoList', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('PhotoList_Photos_AreInOrderTheFirstIsTheCoverAndTheCounterIsShown', () => {
    renderList();

    const tiles = screen.getAllByTestId('photo-list-item');
    expect(tiles).toHaveLength(3);
    expect(within(tiles[0]!).getByTestId('photo-list-cover')).toHaveTextContent('Copertina');
    expect(within(tiles[1]!).queryByTestId('photo-list-cover')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Foto a' })).toHaveAttribute('src', 'https://cdn.example/a.jpg');
    expect(screen.getByTestId('photo-list-counter')).toHaveTextContent('3 foto su 6');
  });

  it('PhotoList_NoPhotos_SaysSoAndHasNoTiles', () => {
    renderList({ items: [] });

    expect(screen.getByTestId('photo-list-empty')).toHaveTextContent('Non ci sono ancora foto.');
    expect(screen.queryByTestId('photo-list-item')).not.toBeInTheDocument();
  });

  it('PhotoList_MoveLater_GivesTheNewOrderToTheOwner', () => {
    const { onChange } = renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Sposta la foto 1 dopo' }));

    expect(onChange).toHaveBeenCalledWith([ITEMS[1]!.url, ITEMS[0]!.url, ITEMS[2]!.url]);
  });

  it('PhotoList_MoveEarlier_GivesTheNewOrderToTheOwner', () => {
    const { onChange } = renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Sposta la foto 3 prima' }));

    expect(onChange).toHaveBeenCalledWith([ITEMS[0]!.url, ITEMS[2]!.url, ITEMS[1]!.url]);
  });

  it('PhotoList_FirstCannotGoEarlierNorTheLastLater_AndTheButtonsSayIt', () => {
    const { onChange } = renderList();

    const first = screen.getByRole('button', { name: 'Sposta la foto 1 prima' });
    const last = screen.getByRole('button', { name: 'Sposta la foto 3 dopo' });
    expect(first).toHaveAttribute('aria-disabled', 'true');
    expect(last).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(first);
    fireEvent.click(last);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('PhotoList_AfterAMove_TheFocusStaysOnThePhotoThatMoved', () => {
    render(<Owner />);

    const later = screen.getByRole('button', { name: 'Sposta la foto 1 dopo' });
    later.focus();
    fireEvent.click(later);

    // The photo is second now, and its "later" button has the focus: the keyboard can go on moving it.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Sposta la foto 2 dopo' }));
    expect(screen.getAllByRole('img').map((img) => img.getAttribute('alt'))).toEqual(['Foto b', 'Foto a', 'Foto c']);
  });

  it('PhotoList_OwnerThatAnswersLater_GivesTheFocusBackWhenTheNewOrderArrivesNotAtTheNextRender', async () => {
    render(<SlowOwner outcomes={['saved']} />);

    const later = screen.getByRole('button', { name: 'Sposta la foto 1 dopo' });
    later.focus();
    fireEvent.click(later);
    // Saving: nothing has moved yet, and the list says it is busy.
    expect(screen.getAllByRole('img').map((img) => img.getAttribute('alt'))).toEqual(['Foto a', 'Foto b', 'Foto c']);
    expect(screen.getByRole('list')).toHaveAttribute('aria-busy', 'true');

    await waitFor(() => expect(screen.getAllByRole('img').map((img) => img.getAttribute('alt'))).toEqual(['Foto b', 'Foto a', 'Foto c']));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Sposta la foto 2 dopo' }));
  });

  it('PhotoList_MoveThatWasRefused_DoesNotTakeTheFocusLaterWhenAnotherActionChangesTheOrder', async () => {
    render(<SlowOwner outcomes={['refused', 'saved']} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sposta la foto 1 dopo' }));
    await waitFor(() => expect(screen.getByRole('list')).not.toHaveAttribute('aria-busy'));
    expect(screen.getAllByRole('img').map((img) => img.getAttribute('alt'))).toEqual(['Foto a', 'Foto b', 'Foto c']);

    fireEvent.click(screen.getByRole('button', { name: 'Togli la foto 3' }));
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2));

    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Sposta la foto 1 dopo' }));
  });

  it('PhotoList_PhotoThatReachesTheEnd_GivesTheFocusToTheOtherDirection', () => {
    render(<Owner />);

    fireEvent.click(screen.getByRole('button', { name: 'Sposta la foto 1 dopo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sposta la foto 2 dopo' }));

    // Photo "a" is last: it cannot go later any more, so the focus is on "earlier", which it can still do.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Sposta la foto 3 prima' }));
    expect(screen.getAllByRole('img').map((img) => img.getAttribute('alt'))).toEqual(['Foto b', 'Foto c', 'Foto a']);
  });

  it('PhotoList_Remove_WithoutAnOwnerQuestion_GivesTheListWithoutIt', () => {
    const { onChange } = renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Togli la foto 2' }));

    expect(onChange).toHaveBeenCalledWith([ITEMS[0]!.url, ITEMS[2]!.url]);
  });

  it('PhotoList_Remove_WithAnOwnerQuestion_AsksTheOwnerAndChangesNothing', () => {
    const onRemove = vi.fn();
    const { onChange } = renderList({ onRemove });

    fireEvent.click(screen.getByRole('button', { name: 'Togli la foto 3' }));

    expect(onRemove).toHaveBeenCalledWith(ITEMS[2]!.url);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('PhotoList_Busy_IgnoresClicksButKeepsTheButtonsWhereTheyAre', () => {
    const onRemove = vi.fn();
    const onAdd = vi.fn();
    const { onChange } = renderList({ busy: true, onRemove, onAdd });
    const click = vi.spyOn(HTMLInputElement.prototype, 'click');

    const later = screen.getByRole('button', { name: 'Sposta la foto 1 dopo' });
    expect(later).toHaveAttribute('aria-disabled', 'true');
    expect(later).not.toBeDisabled();
    fireEvent.click(later);
    fireEvent.click(screen.getByRole('button', { name: 'Togli la foto 1' }));
    fireEvent.click(screen.getByTestId('photo-list-add'));

    expect(onChange).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

  it('PhotoList_Add_OpensThePickerAndGivesTheFilesToTheOwner', () => {
    const onAdd = vi.fn();
    renderList({ onAdd, accept: 'image/jpeg,image/png,image/webp' });
    const click = vi.spyOn(HTMLInputElement.prototype, 'click');

    fireEvent.click(screen.getByTestId('photo-list-add'));
    expect(click).toHaveBeenCalledTimes(1);

    const input = screen.getByTestId('photo-list-input') as HTMLInputElement;
    expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
    expect(input.multiple).toBe(true);
    const file = new File(['x'], 'cucina.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(onAdd).toHaveBeenCalledWith([file]);
  });

  it('PhotoList_NoOwnerOfFiles_HasNoAddButton', () => {
    renderList();

    expect(screen.queryByTestId('photo-list-add')).not.toBeInTheDocument();
  });

  it('PhotoList_Full_DoesNotOpenThePicker', () => {
    const onAdd = vi.fn();
    renderList({ onAdd, max: 3 });
    const click = vi.spyOn(HTMLInputElement.prototype, 'click');

    const add = screen.getByTestId('photo-list-add');
    expect(add).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(add);

    expect(click).not.toHaveBeenCalled();
  });

  it('PhotoList_Uploading_SaysSoOnTheButton', () => {
    renderList({ onAdd: vi.fn(), uploading: true });

    const add = screen.getByTestId('photo-list-add');
    expect(add).toHaveTextContent('Carico le foto…');
    expect(add).toHaveAttribute('aria-busy', 'true');
  });

  it('PhotoList_ErrorOfTheOwner_IsAnnounced', () => {
    renderList({ error: 'Il file non è una foto valida.' });

    expect(screen.getByRole('alert')).toHaveTextContent('Il file non è una foto valida.');
  });

  it('PhotoList_PhotoThatDoesNotLoadOrIsARelativePath_ShowsTheFallbackNotABrokenImage', () => {
    renderList({ items: [{ url: 'https://cdn.example/rotta.jpg', alt: 'Foto rotta' }, { url: '/uploads/vecchia.jpg', alt: 'Foto vecchia' }] });

    // A relative path (the old disk of the container) is never an <img>: on the web host it would load index.html.
    expect(screen.queryByRole('img', { name: 'Foto vecchia' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Foto non disponibile')).toHaveLength(1);

    fireEvent.error(screen.getByRole('img', { name: 'Foto rotta' }));

    expect(screen.queryByRole('img', { name: 'Foto rotta' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Foto non disponibile')).toHaveLength(2);
  });

  it('PhotoList_EveryButton_HasAName_AndOfAtLeastAFinger', async () => {
    const { container } = renderList({ onAdd: vi.fn(), error: 'Errore.' });

    await expectNoAxeViolations(container);
    for (const button of screen.getAllByRole('button')) {
      expect(button.className, button.getAttribute('aria-label') ?? button.textContent ?? '').toMatch(/size-11|min-h-11/);
    }
  });

  it('PhotoList_ChangeOfOrder_ReturnsUrlsInTheSameOrderAsTheItems', () => {
    // The items come in the order c, b, a: moving the first one later swaps c and b.
    const { onChange } = renderList({ items: [...ITEMS].reverse() });

    fireEvent.click(screen.getByRole('button', { name: 'Sposta la foto 1 dopo' }));

    expect(onChange).toHaveBeenCalledWith(['https://cdn.example/b.jpg', 'https://cdn.example/c.jpg', 'https://cdn.example/a.jpg']);
  });

  it('PhotoList_Counter_IsAStatusSoThatAScreenReaderSaysWhenItChanges', () => {
    renderList();

    expect(screen.getByTestId('photo-list-counter')).toHaveAttribute('role', 'status');
  });

  describe('focusAfterRemoval (the owner has asked, removed, and the dialog has closed)', () => {
    const [a, b, c] = ITEMS as [PhotoListItem, PhotoListItem, PhotoListItem];
    const listWith = (ref: Ref<PhotoListHandle>, items: PhotoListItem[]) => (
      <PhotoList ref={ref} items={items} max={6} labels={LABELS} onChange={vi.fn()} onAdd={vi.fn()} />
    );

    it('PhotoList_FocusAfterRemoval_GoesToThePhotoThatTookThePlaceOfTheRemovedOne', () => {
      const ref = createRef<PhotoListHandle>();
      const view = render(listWith(ref, [a, b, c]));
      view.rerender(listWith(ref, [a, c]));

      act(() => ref.current?.focusAfterRemoval(1));

      // "c" is the second photo now, and it is its "remove" button that has the focus: the keyboard can go on.
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Togli la foto 2' }));
    });

    it('PhotoList_FocusAfterRemoval_OfTheLastPhoto_GoesToThePhotoBeforeIt', () => {
      const ref = createRef<PhotoListHandle>();
      const view = render(listWith(ref, [a, b, c]));
      view.rerender(listWith(ref, [a, b]));

      act(() => ref.current?.focusAfterRemoval(2));

      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Togli la foto 2' }));
    });

    it('PhotoList_FocusAfterRemoval_OfTheOnlyPhoto_GoesToAdd', () => {
      const ref = createRef<PhotoListHandle>();
      const view = render(listWith(ref, [a]));
      view.rerender(listWith(ref, []));

      act(() => ref.current?.focusAfterRemoval(0));

      expect(document.activeElement).toBe(screen.getByTestId('photo-list-add'));
    });
  });
});
