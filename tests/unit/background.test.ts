import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from '@webext-core/fake-browser';

import { MessageType, type GlobalState, type Group, type LogEntry, type Rule } from '../../utils/types';

const storageMocks = vi.hoisted(() => ({
  getActiveRules: vi.fn<() => Promise<Rule[]>>(),
  getRules: vi.fn<() => Promise<Rule[]>>(),
  getGroups: vi.fn<() => Promise<Group[]>>(),
  createGroup: vi.fn<(input: { name: string; enabled?: boolean; order?: number }) => Promise<Group>>(),
  getGlobalState: vi.fn<() => Promise<GlobalState>>(),
  setGlobalState: vi.fn<(state: Partial<GlobalState>) => Promise<GlobalState>>(),
}));

const loggerMocks = vi.hoisted(() => ({
  add: vi.fn<(entry: Omit<LogEntry, 'id' | 'timestamp'>) => LogEntry>(),
  getAll: vi.fn<() => LogEntry[]>(),
  clear: vi.fn<() => void>(),
}));

vi.mock('../../utils/storage', () => storageMocks);
vi.mock('../../utils/logger', () => ({ logger: loggerMocks }));

async function loadBackground() {
  vi.resetModules();
  const mod = await import('../../entrypoints/background');
  (mod.default as { main?: () => void }).main?.();
}

async function sendMessage(message: unknown, sender: unknown = { tab: { id: 1 } }) {
  const responses = await fakeBrowser.runtime.onMessage.trigger(message, sender as any);
  return responses[0];
}

describe('background service worker', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    vi.restoreAllMocks();

    fakeBrowser.runtime.onInstalled.removeAllListeners();
    fakeBrowser.runtime.onMessage.removeAllListeners();
    fakeBrowser.webNavigation.onCommitted.removeAllListeners();
    fakeBrowser.tabs.onRemoved.removeAllListeners();

    const chromeAny = fakeBrowser as any;
    chromeAny.tabs.query = vi.fn().mockResolvedValue([{ id: 101 }, { id: 102 }]);
    chromeAny.tabs.sendMessage = vi.fn().mockResolvedValue(undefined);
    chromeAny.scripting = { executeScript: vi.fn().mockResolvedValue([]) };
    chromeAny.debugger = {
      onEvent: { addListener: vi.fn() },
      onDetach: { addListener: vi.fn() },
    };

    (globalThis as any).chrome = chromeAny;

    storageMocks.getActiveRules.mockResolvedValue([]);
    storageMocks.getRules.mockResolvedValue([]);
    storageMocks.getGroups.mockResolvedValue([]);
    storageMocks.createGroup.mockResolvedValue({
      id: 'default-group',
      name: 'Default',
      enabled: true,
      order: 0,
    });
    storageMocks.getGlobalState.mockResolvedValue({ enabled: true, mode: 'lite' });
    storageMocks.setGlobalState.mockImplementation(async (state) => ({
      enabled: state.enabled ?? true,
      mode: state.mode ?? 'lite',
    }));

    loggerMocks.add.mockImplementation((entry) => ({
      ...entry,
      id: 'log-1',
      timestamp: 123,
    }));
    loggerMocks.getAll.mockReturnValue([]);
    loggerMocks.clear.mockImplementation(() => undefined);

    await loadBackground();
  });

  it('onInstalled initializes default group and global state', async () => {
    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'install' } as any);

    expect(storageMocks.getGroups).toHaveBeenCalledTimes(1);
    expect(storageMocks.createGroup).toHaveBeenCalledWith({ name: 'Default', enabled: true, order: 0 });
    expect(storageMocks.setGlobalState).toHaveBeenCalledWith({ enabled: true, mode: 'lite' });
  });

  it('GET_ACTIVE_RULES returns active rules from storage', async () => {
    const rules: Rule[] = [
      {
        id: 'r1',
        groupId: 'g1',
        name: 'Rule 1',
        urlPattern: '^https://example.com$',
        script: '1',
        enabled: true,
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    storageMocks.getActiveRules.mockResolvedValueOnce(rules);

    const res = await sendMessage({ type: MessageType.GET_ACTIVE_RULES });
    expect(storageMocks.getActiveRules).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ rules });
  });

  it('GET_ALL_RULES returns all rules', async () => {
    const rules: Rule[] = [
      {
        id: 'r1',
        groupId: 'g1',
        name: 'Rule 1',
        urlPattern: '^https://example.com/a$',
        script: '1',
        enabled: true,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'r2',
        groupId: 'g1',
        name: 'Rule 2',
        urlPattern: '^https://example.com/b$',
        script: '2',
        enabled: false,
        createdAt: 2,
        updatedAt: 2,
      },
    ];
    storageMocks.getRules.mockResolvedValueOnce(rules);

    const res = await sendMessage({ type: MessageType.GET_ALL_RULES });
    expect(storageMocks.getRules).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ rules });
  });

  it('RULES_UPDATED broadcasts RULES_CHANGED to all tabs', async () => {
    const res = await sendMessage({ type: MessageType.RULES_UPDATED });

    expect((fakeBrowser as any).tabs.query).toHaveBeenCalledWith({});
    expect((fakeBrowser as any).tabs.sendMessage).toHaveBeenCalledTimes(2);
    expect((fakeBrowser as any).tabs.sendMessage).toHaveBeenCalledWith(101, { type: 'RULES_CHANGED' });
    expect((fakeBrowser as any).tabs.sendMessage).toHaveBeenCalledWith(102, { type: 'RULES_CHANGED' });
    expect(res).toEqual({ ok: true });
  });

  it('LOG_MATCH adds entry to logger', async () => {
    const entry = {
      ruleId: 'r1',
      ruleName: 'Rule 1',
      url: 'https://example.com',
      success: true,
    };

    const res = await sendMessage({ type: MessageType.LOG_MATCH, entry });
    expect(loggerMocks.add).toHaveBeenCalledWith(entry);
    expect(res).toEqual({ ok: true });
  });

  it('GET_LOGS returns log entries', async () => {
    const entries: LogEntry[] = [
      {
        id: 'l1',
        ruleId: 'r1',
        ruleName: 'Rule 1',
        url: 'https://example.com',
        timestamp: 11,
        success: true,
      },
    ];
    loggerMocks.getAll.mockReturnValueOnce(entries);

    const res = await sendMessage({ type: MessageType.GET_LOGS });
    expect(loggerMocks.getAll).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ entries });
  });

  it('TOGGLE_GLOBAL updates state and broadcasts to tabs', async () => {
    const nextState: GlobalState = { enabled: false, mode: 'lite' };
    storageMocks.setGlobalState.mockResolvedValueOnce(nextState);

    const res = await sendMessage({ type: MessageType.TOGGLE_GLOBAL, enabled: false });

    expect(storageMocks.setGlobalState).toHaveBeenCalledWith({ enabled: false });
    expect((fakeBrowser as any).tabs.sendMessage).toHaveBeenCalledWith(101, {
      type: 'GLOBAL_STATE_CHANGED',
      state: nextState,
    });
    expect(res).toEqual({ state: nextState });
  });

  it('GET_GLOBAL_STATE returns current state', async () => {
    const state: GlobalState = { enabled: true, mode: 'full' };
    storageMocks.getGlobalState.mockResolvedValueOnce(state);

    const res = await sendMessage({ type: MessageType.GET_GLOBAL_STATE });
    expect(storageMocks.getGlobalState).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ state });
  });

  it('webNavigation.onCommitted injects active rules when global enabled', async () => {
    const activeRules: Rule[] = [
      {
        id: 'r1',
        groupId: 'g1',
        name: 'Rule 1',
        urlPattern: '^https://example.com$',
        script: '1',
        enabled: true,
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    storageMocks.getGlobalState.mockResolvedValueOnce({ enabled: true, mode: 'lite' });
    storageMocks.getActiveRules.mockResolvedValueOnce(activeRules);

    await fakeBrowser.webNavigation.onCommitted.trigger({ tabId: 7, frameId: 0 } as any);

    expect((fakeBrowser as any).scripting.executeScript).toHaveBeenCalledTimes(1);
    const [payload] = (fakeBrowser as any).scripting.executeScript.mock.calls[0];
    expect(payload.target).toEqual({ tabId: 7, frameIds: [0] });
    expect(payload.world).toBe('MAIN');
  });
});
