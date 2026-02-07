// Minimal Rule interface for matcher - intentionally a subset of Rule from types.ts
// Used internally by matcher; compatible with Rule but doesn't require all fields
export interface MatchableRule {
  id: string;
  urlPattern: string;
  script: string;
  enabled: boolean;
}

export type CompiledPattern = {
  regex: RegExp | null;
  error?: string;
};

const regexCache = new Map<string, RegExp>();

export function compilePattern(pattern: string): CompiledPattern {
  const cached = regexCache.get(pattern);
  if (cached) return { regex: cached };

  try {
    const regex = new RegExp(pattern);
    regexCache.set(pattern, regex);
    return { regex };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { regex: null, error };
  }
}

export function validatePattern(pattern: string): { valid: boolean; error?: string } {
  const compiled = compilePattern(pattern);
  if (compiled.regex) return { valid: true };
  return { valid: false, error: compiled.error ?? 'Invalid pattern' };
}

export interface UrlMatcher {
  match(url: string): MatchableRule | null;
  matchAll(url: string): MatchableRule[];
}

type CompiledRule = {
  rule: MatchableRule;
  regex: RegExp | null;
};

class DefaultUrlMatcher implements UrlMatcher {
  private readonly compiled: CompiledRule[];

  constructor(rules: MatchableRule[]) {
    this.compiled = rules.map((rule) => ({
      rule,
      regex: compilePattern(rule.urlPattern).regex,
    }));
  }

  match(url: string): MatchableRule | null {
    for (const { rule, regex } of this.compiled) {
      if (!rule.enabled || !regex) continue;
      regex.lastIndex = 0;
      if (regex.test(url)) return rule;
    }
    return null;
  }

  matchAll(url: string): MatchableRule[] {
    const matches: MatchableRule[] = [];
    for (const { rule, regex } of this.compiled) {
      if (!rule.enabled || !regex) continue;
      regex.lastIndex = 0;
      if (regex.test(url)) matches.push(rule);
    }
    return matches;
  }
}

export function createMatcher(rules: MatchableRule[]): UrlMatcher {
  return new DefaultUrlMatcher(rules);
}
