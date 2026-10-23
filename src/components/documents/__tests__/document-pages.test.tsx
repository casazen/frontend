import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import i18n from '@/i18n/config';
import { DocumentPages } from '../document-pages';
import { EMPTY_DOCUMENT, documentReady, prepareDocument, type DocumentSelection } from '@/lib/document-pdf';

function Editor() {
  const [value, setValue] = useState<DocumentSelection>(EMPTY_DOCUMENT);
  return <><DocumentPages value={value} onChange={setValue} /><button disabled={!documentReady(value)}>Submit</button><output data-testid="order">{value.pages.map(page => `${page.file.name}:${page.rotation}`).join(',')}</output></>;
}
const photo = (name: string, type = 'image/jpeg') => new File(['jpeg'], name, { type });
function select(files: File[]) { fireEvent.change(screen.getByLabelText(i18n.t('documentPages.select')), { target: { files } }); }
function drop(files: File[]) {
  const dataTransfer = { files, types: ['Files'], dropEffect: 'none' };
  const zone = screen.getByTestId('document-drop-zone');
  fireEvent.dragEnter(zone, { dataTransfer });
  fireEvent.dragOver(zone, { dataTransfer });
  fireEvent.drop(zone, { dataTransfer });
}

describe('multi-page document assembly', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    URL.createObjectURL = vi.fn(() => 'blob:test'); URL.revokeObjectURL = vi.fn();
  });
  it('adds pages across selections, reorders and rotates them, and resets completeness confirmation after edits', () => {
    render(<Editor />); select([photo('one.jpg'), photo('two.png', 'image/png')]); select([photo('three.jpeg')]);
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('documentPages.moveUp', { page: 3 }) }));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('documentPages.rotate', { page: 1 }) }));
    expect(screen.getByTestId('order')).toHaveTextContent('one.jpg:90,three.jpeg:0,two.png:0');
    fireEvent.click(screen.getByRole('checkbox')); expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('documentPages.remove', { page: 2 }) }));
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
    expect(screen.getByTestId('order')).toHaveTextContent('one.jpg:90,two.png:0');
  });
  it('takes the photos dropped on the box, as the five pages of an APE photographed with a phone', () => {
    render(<Editor />);
    drop([1, 2, 3, 4, 5].map((page) => photo(`WhatsApp Image 2026-10-23 at 11.38.3${page}.jpeg`)));
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('takes a photo without extension by its type, and says which file it cannot take and why', () => {
    render(<Editor />);
    select([photo('scansione', 'image/jpeg')]);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    select([new File(['heic'], 'IMG_0001.HEIC', { type: 'image/heic' })]);
    expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('documentPages.unsupported', { name: 'IMG_0001.HEIC' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
  it('rejects mixed PDF and images rather than silently dropping pages', () => {
    render(<Editor />); select([photo('one.jpg')]); select([new File(['pdf'], 'existing.pdf')]);
    expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('documentPages.mixed'));
    expect(screen.getByTestId('order')).toHaveTextContent('one.jpg:0');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
  it('leaves an existing PDF unchanged and enforces the destination limit', async () => {
    const file = new File(['%PDF-original-signed'], 'signed.pdf', { type: 'application/pdf' });
    const selection = { pages: [{ id: '1', file, rotation: 0 }], confirmed: false };
    expect(await prepareDocument(selection, 100)).toBe(file);
    await expect(prepareDocument(selection, 2)).rejects.toThrow('documentPages.tooLarge');
  });
  it('does not create a PDF until all photo pages are confirmed', async () => {
    await expect(prepareDocument({ pages: [{ id: '1', file: photo('ape.jpg'), rotation: 0 }], confirmed: false }, 1000)).rejects.toThrow('documentPages.incomplete');
  });
});
