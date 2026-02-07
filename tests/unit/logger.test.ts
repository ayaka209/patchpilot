import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MatchLogger } from '../../utils/logger';

type InputEntry = {
  ruleId: string;
  ruleName: string;
  url: string;
  success: boolean;
  error?: string;
};

function makeEntry(overrides: Partial<InputEntry> = {}): InputEntry {
  return {
    ruleId: 'rule-1',
    ruleName: 'Rule 1',
    url: 'https://example.com',
    success: true,
    ...overrides,
  };
}

describe('MatchLogger (in-memory ring buffer)', () => {
  let log: MatchLogger;

  beforeEach(() => {
    log = new MatchLogger();
    vi.restoreAllMocks();
  });

  it('add() creates an entry with id/timestamp and stores it', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234567890);

    const created = log.add(makeEntry());
    expect(created.id).toEqual(expect.any(String));
    expect(created.id.length).toBeGreaterThan(0);
    expect(created.timestamp).toBe(1234567890);

    const all = log.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(created);
  });

  it('getAll() returns entries newest-first', () => {
    const first = log.add(makeEntry({ url: 'https://example.com/1' }));
    const second = log.add(makeEntry({ url: 'https://example.com/2' }));

    const all = log.getAll();
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe(second.id);
    expect(all[1].id).toBe(first.id);
  });

  it('ring buffer evicts the oldest entry at max size (500)', () => {
    for (let i = 0; i < 501; i++) {
      log.add(makeEntry({ url: `https://example.com/${i}` }));
    }

    expect(log.size).toBe(500);

    const all = log.getAll();
    expect(all).toHaveLength(500);
    expect(all.some((e) => e.url === 'https://example.com/0')).toBe(false);
    expect(all[all.length - 1].url).toBe('https://example.com/1');
  });

  it('clear() removes all entries', () => {
    log.add(makeEntry());
    log.add(makeEntry({ url: 'https://example.com/2' }));

    log.clear();
    expect(log.size).toBe(0);
    expect(log.getAll()).toEqual([]);
  });

  it('getRecent(count) returns only the N most recent entries', () => {
    for (let i = 0; i < 12; i++) {
      log.add(makeEntry({ url: `https://example.com/${i}` }));
    }

    const recent = log.getRecent(10);
    expect(recent).toHaveLength(10);
    expect(recent[0].url).toBe('https://example.com/11');
    expect(recent[recent.length - 1].url).toBe('https://example.com/2');
  });

  it('getByRule(ruleId) returns only entries matching that ruleId', () => {
    const a1 = log.add(makeEntry({ ruleId: 'A', url: 'https://example.com/a1' }));
    log.add(makeEntry({ ruleId: 'B', url: 'https://example.com/b1' }));
    const a2 = log.add(makeEntry({ ruleId: 'A', url: 'https://example.com/a2' }));

    const byRule = log.getByRule('A');
    expect(byRule).toHaveLength(2);
    expect(byRule[0].id).toBe(a2.id);
    expect(byRule[1].id).toBe(a1.id);
    expect(byRule.every((e) => e.ruleId === 'A')).toBe(true);
  });

  it('size getter reflects the current entry count', () => {
    expect(log.size).toBe(0);
    log.add(makeEntry());
    expect(log.size).toBe(1);
    log.add(makeEntry({ url: 'https://example.com/2' }));
    expect(log.size).toBe(2);
    log.clear();
    expect(log.size).toBe(0);
  });
});
