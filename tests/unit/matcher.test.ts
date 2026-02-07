import { describe, it, expect } from 'vitest';

import { compilePattern, createMatcher, validatePattern } from '../../utils/matcher';

describe('URL Matcher Engine', () => {
  it('compilePattern: compiles a valid regex pattern', () => {
    const compiled = compilePattern('^https://example\\.com/.*$');
    expect(compiled.error).toBeUndefined();
    expect(compiled.regex).toBeInstanceOf(RegExp);
    expect(compiled.regex?.test('https://example.com/abc')).toBe(true);
    expect(compiled.regex?.test('https://other.com/abc')).toBe(false);
  });

  it('compilePattern: returns null + error for invalid regex pattern', () => {
    const compiled = compilePattern('[invalid');
    expect(compiled.regex).toBeNull();
    expect(compiled.error).toBeTypeOf('string');
  });

  it('validatePattern: returns valid:true for good patterns', () => {
    expect(validatePattern('^https://example\\.com/.*$')).toEqual({ valid: true });
  });

  it('validatePattern: returns valid:false + error for bad patterns', () => {
    const res = validatePattern('[invalid');
    expect(res.valid).toBe(false);
    expect(res.error).toBeTypeOf('string');
  });

  it('match: matches URL against a single rule', () => {
    const rule = {
      id: 'r1',
      urlPattern: '^https://example\\.com/a$',
      script: 'console.log(1)',
      enabled: true,
    };

    const matcher = createMatcher([rule]);
    expect(matcher.match('https://example.com/a')?.id).toBe('r1');
    expect(matcher.match('https://example.com/b')).toBeNull();
  });

  it('match: returns first matching enabled rule (skips disabled)', () => {
    const matcher = createMatcher([
      {
        id: 'disabled-first',
        urlPattern: '^https://example\\.com/.*$',
        script: '1',
        enabled: false,
      },
      {
        id: 'enabled-second',
        urlPattern: '^https://example\\.com/.*$',
        script: '2',
        enabled: true,
      },
      {
        id: 'enabled-third',
        urlPattern: '^https://example\\.com/.*$',
        script: '3',
        enabled: true,
      },
    ]);

    expect(matcher.match('https://example.com/whatever')?.id).toBe('enabled-second');
  });

  it('matchAll: returns all matching enabled rules', () => {
    const matcher = createMatcher([
      { id: 'a', urlPattern: '^https://x\\.com/1$', script: 'a', enabled: true },
      { id: 'b', urlPattern: '^https://x\\.com/1$', script: 'b', enabled: true },
      { id: 'c', urlPattern: '^https://x\\.com/1$', script: 'c', enabled: false },
    ]);

    expect(matcher.matchAll('https://x.com/1').map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('cache: same pattern string reuses the same RegExp instance', () => {
    const a = compilePattern('^a$').regex;
    const b = compilePattern('^a$').regex;
    const c = compilePattern('^b$').regex;
    expect(a).toBeInstanceOf(RegExp);
    expect(b).toBeInstanceOf(RegExp);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('empty/disabled rules: no match', () => {
    expect(createMatcher([]).match('https://example.com')).toBeNull();

    const matcher = createMatcher([
      { id: 'd', urlPattern: '^https://example\\.com$', script: 'd', enabled: false },
    ]);
    expect(matcher.match('https://example.com')).toBeNull();
    expect(matcher.matchAll('https://example.com')).toEqual([]);
  });

  it('real-world pattern: matches and rejects as expected', () => {
    const rule = {
      id: 'rw',
      urlPattern: 'https://h.+t.chanjet.com/tplus/UserFiles/tonggrid-.*\\.js$',
      script: 'rw',
      enabled: true,
    };
    const matcher = createMatcher([rule]);

    expect(
      matcher.match('https://host.chanjet.com/tplus/UserFiles/tonggrid-v2.1.js')?.id,
    ).toBe('rw');
    expect(matcher.match('https://other.com/script.js')).toBeNull();
  });

  it('performance: 100 rules x 1000 urls completes quickly', () => {
    const rules = Array.from({ length: 100 }, (_, i) => ({
      id: `r-${i}`,
      urlPattern: `^https://example\\.com/path-${i}/.*$`,
      script: String(i),
      enabled: true,
    }));

    const urls = Array.from({ length: 1000 }, (_, i) => `https://example.com/nope-${i}`);
    const matcher = createMatcher(rules);

    const start = Date.now();
    for (const url of urls) matcher.match(url);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100);
  });
});
