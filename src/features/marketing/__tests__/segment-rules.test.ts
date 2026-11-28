import { beforeAll, describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import {
  conditionOf,
  describeCondition,
  describeRule,
  emptyCondition,
  isEditable,
  kindOfRule,
  lastStayRule,
  listRule,
  logicOf,
  readLastStay,
  readList,
  readSpend,
  readStays,
  rulesOf,
  spendRule,
  staysRule,
  type DescribeEnv,
} from '../segment-rules';
import { SEGMENT_RECIPES, propertyRecipes, recipeById } from '../segment-recipes';

let env: DescribeEnv;

beforeAll(async () => {
  await i18n.changeLanguage('it');
  env = { t: i18n.t.bind(i18n) as DescribeEnv['t'], language: 'it', propertyName: (id) => (id === 'house' ? 'Villa Sofia' : undefined) };
});

describe('rule builders', () => {
  it('stores "at least N" as the strict comparison the evaluator understands and reads it back', () => {
    const rule = staysRule('atLeast', 3);
    expect(rule).toEqual({ fieldId: 'totalStays', operator: 'greaterThan', value: 2 });
    expect(readStays(rule)).toEqual({ mode: 'atLeast', count: 3 });
  });

  it('keeps exact and lower-than stays as they are', () => {
    expect(staysRule('exactly', 1)).toEqual({ fieldId: 'totalStays', operator: 'equals', value: 1 });
    expect(readStays(staysRule('lessThan', 4))).toEqual({ mode: 'lessThan', count: 4 });
  });

  it('writes the recent window as a number of days and a fixed day as text', () => {
    expect(lastStayRule('inLast', '60')).toEqual({ fieldId: 'lastStayAt', operator: 'inLast', value: 60 });
    expect(readLastStay(lastStayRule('before', '2026-05-01'))).toEqual({ mode: 'before', value: '2026-05-01' });
  });

  it('reads lists and spend back, and refuses what the editors cannot represent', () => {
    expect(readList(listRule('stage', false, ['lost']))).toEqual({ include: false, values: ['lost'] });
    expect(readSpend(spendRule('moreThan', 500))).toEqual({ mode: 'moreThan', amount: 500 });
    expect(readStays({ fieldId: 'totalStays', operator: 'between', value: [1, 3] })).toBeNull();
    expect(isEditable({ fieldId: 'totalStays', operator: 'between', value: [1, 3] })).toBe(false);
    expect(isEditable(listRule('tag', true, ['skiers']))).toBe(true);
    expect(kindOfRule({ fieldId: 'firstStayAt', operator: 'inLast', value: 5 })).toBeNull();
  });
});

describe('conditions', () => {
  it('flattens every group and reports the operator of the first', () => {
    const condition = {
      version: '1.0',
      groups: [
        { operator: 'OR' as const, rules: [staysRule('atLeast', 2)] },
        { operator: 'AND' as const, rules: [spendRule('moreThan', 100)] },
      ],
    };
    expect(rulesOf(condition)).toHaveLength(2);
    expect(logicOf(condition)).toBe('OR');
    expect(logicOf({ version: '1.0', groups: [] })).toBe('AND');
    expect(rulesOf(emptyCondition())).toEqual([]);
    expect(conditionOf([staysRule('exactly', 2)], 'OR').groups[0].operator).toBe('OR');
  });
});

describe('plain words for a rule', () => {
  it.each([
    [staysRule('atLeast', 3), 'Hanno soggiornato almeno 3 volte'],
    [staysRule('atLeast', 1), 'Hanno soggiornato almeno 1 volta'],
    [staysRule('exactly', 2), 'Hanno soggiornato esattamente 2 volte'],
    [lastStayRule('inLast', 60), 'Ultimo soggiorno negli ultimi 60 giorni'],
    [listRule('stage', true, ['loyal', 'returning']), 'Ospiti fedeli e di ritorno'],
    [listRule('stage', false, ['lost']), 'Tutti tranne gli ospiti da riconquistare'],
    [listRule('language', true, ['de']), 'Parlano tedesco'],
    [listRule('country', true, ['Germania', 'Austria']), 'Vengono da Germania e Austria'],
    [listRule('propertyHistory', true, ['house']), 'Hanno soggiornato in Villa Sofia'],
    [listRule('propertyHistory', true, ['gone']), 'Hanno soggiornato in una tua casa'],
    [listRule('tag', true, ['sciatori']), "Hanno l'etichetta sciatori"],
  ])('%j reads as %s', (rule, sentence) => {
    expect(describeRule(rule, env)).toBe(sentence);
  });

  it('writes a spend rule with the euro sign and falls back to the catalog words for an unknown rule', () => {
    expect(describeRule(spendRule('moreThan', 1000), env)).toMatch(/Hanno speso più di\s*1\.?000\s*€/);
    expect(describeRule({ fieldId: 'country', operator: 'equals', value: 'IT' }, env)).toBe('Paese È uguale a IT');
  });

  it('describes a whole condition rule by rule', () => {
    const condition = conditionOf([staysRule('atLeast', 2), lastStayRule('inLast', 90)]);
    expect(describeCondition(condition, env)).toEqual(['Hanno soggiornato almeno 2 volte', 'Ultimo soggiorno negli ultimi 90 giorni']);
  });
});

describe('ready-made groups', () => {
  it('only use fields and operators the backend accepts for a segment', () => {
    const allowed: Record<string, string[]> = {
      totalStays: ['equals', 'greaterThan', 'lessThan', 'between'],
      country: ['in', 'notIn'],
      language: ['in', 'notIn'],
      totalSpend: ['equals', 'greaterThan', 'lessThan', 'between'],
      firstStayAt: ['before', 'after', 'between', 'inLast'],
      lastStayAt: ['before', 'after', 'between', 'inLast'],
      propertyHistory: ['in', 'notIn'],
      tag: ['in', 'notIn'],
      stage: ['in', 'notIn'],
    };
    const recipes = [...SEGMENT_RECIPES, ...propertyRecipes([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }])];
    for (const recipe of recipes) {
      for (const rule of rulesOf(recipe.condition)) expect(allowed[rule.fieldId]).toContain(rule.operator);
    }
  });

  it('offers one group per house only when there are at least two', () => {
    expect(propertyRecipes([{ id: 'a', name: 'A' }])).toEqual([]);
    const several = propertyRecipes(['a', 'b', 'c', 'd'].map((id) => ({ id, name: id.toUpperCase() })));
    expect(several.map((recipe) => recipe.id)).toEqual(['property:a', 'property:b', 'property:c']);
    expect(recipeById('property:b', [{ id: 'b', name: 'B' }, { id: 'c', name: 'C' }])?.propertyName).toBe('B');
    expect(recipeById('loyal')?.id).toBe('loyal');
    expect(recipeById('missing')).toBeUndefined();
  });
});
