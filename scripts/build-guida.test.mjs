// @vitest-environment node
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { buildGuida, diffGenerated, parseBlocks, slugify } from './build-guida.mjs';

test('slugify toglie accenti e simboli', () => {
  assert.equal(slugify('Creare una prenotazione manuale'), 'creare-una-prenotazione-manuale');
  assert.equal(slugify("Perché l'imposta è più alta?"), 'perche-l-imposta-e-piu-alta');
});

test('il parser legge elenchi numerati, tabelle e citazioni', () => {
  const blocks = parseBlocks('1. Apri **Prenotazioni**.\n2. Premi «Nuova».\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n> **Nota:** ciao');
  assert.deepEqual(blocks.map((b) => b.type), ['list', 'table', 'quote']);
  assert.equal(blocks[0].items.length, 2);
  assert.deepEqual(blocks[1].rows, [['1', '2']]);
});

test('i contenuti del manuale non hanno errori e le pagine generate sono aggiornate', () => {
  const result = buildGuida();
  assert.deepEqual(result.errors, [], `Errori nei contenuti:\n${result.errors.join('\n')}`);
  const stale = diffGenerated(result.files);
  assert.deepEqual(stale, [], `File non aggiornati: ${stale.join(', ')}. Esegui: npm run guida:build`);
});
