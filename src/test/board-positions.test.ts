import { describe, expect, it } from 'vitest';
import { needsRebalance, positionBetween, suggestKey } from '@/features/projects/lib';

describe('positionBetween()', () => {
  it('starts an empty column at 1024', () => {
    expect(positionBetween()).toBe(1024);
  });

  it('places cards before the first and after the last with a 1024 gap', () => {
    expect(positionBetween(undefined, 1024)).toBe(0);
    expect(positionBetween(2048)).toBe(3072);
  });

  it('bisects between neighbours', () => {
    expect(positionBetween(1024, 2048)).toBe(1536);
  });

  it('keeps order across many inserts at the same spot', () => {
    let low = 1024;
    const high = 2048;
    for (let i = 0; i < 30; i++) {
      const next = positionBetween(low, high);
      expect(next).toBeGreaterThan(low);
      expect(next).toBeLessThan(high);
      low = next;
    }
  });
});

describe('needsRebalance()', () => {
  it('only asks for a rebalance when neighbours are nearly equal', () => {
    expect(needsRebalance(1024, 2048)).toBe(false);
    expect(needsRebalance(undefined, 2048)).toBe(false);
    expect(needsRebalance(1, 1 + 1e-7)).toBe(true);
  });

  it('kicks in long before floating point runs out of room', () => {
    let low = 1024;
    let rounds = 0;
    while (!needsRebalance(low, 2048) && rounds < 200) {
      low = positionBetween(low, 2048);
      rounds++;
    }
    expect(rounds).toBeGreaterThan(20);
    expect(rounds).toBeLessThan(60);
  });
});

describe('suggestKey()', () => {
  it('builds a key that the database accepts', () => {
    const valid = /^[A-Z][A-Z0-9]{1,5}$/;
    expect(suggestKey('Operations')).toBe('OPER');
    expect(suggestKey('Flow Test Board')).toBe('FTB');
    expect(suggestKey('2027 roadmap plan')).toBe('P2RP');
    for (const name of ['Operations', 'Flow Test Board', '2027 roadmap plan', 'Sales & marketing team']) {
      expect(suggestKey(name)).toMatch(valid);
    }
  });

  it('returns nothing for a name without letters or digits', () => {
    expect(suggestKey('!!!')).toBe('');
  });
});
