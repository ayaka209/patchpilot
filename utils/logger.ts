import type { LogEntry } from './types';

let fallbackIdCounter = 0;

function generateId(): string {
  const cryptoAny = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (cryptoAny && typeof cryptoAny.randomUUID === 'function') {
    return cryptoAny.randomUUID();
  }

  fallbackIdCounter += 1;
  return `log_${fallbackIdCounter}`;
}

export class MatchLogger {
  private entries: LogEntry[] = [];
  private maxSize: number = 500;

  add(entry: Omit<LogEntry, 'id' | 'timestamp'>): LogEntry {
    const created: LogEntry = {
      ...entry,
      id: generateId(),
      timestamp: Date.now(),
    };

    if (this.entries.length >= this.maxSize) {
      this.entries.shift();
    }

    this.entries.push(created);
    return created;
  }

  getAll(): LogEntry[] {
    return [...this.entries].reverse();
  }

  getRecent(count: number): LogEntry[] {
    return this.getAll().slice(0, count);
  }

  getByRule(ruleId: string): LogEntry[] {
    return this.getAll().filter((e) => e.ruleId === ruleId);
  }

  clear(): void {
    this.entries = [];
  }

  get size(): number {
    return this.entries.length;
  }
}

export const logger = new MatchLogger();
