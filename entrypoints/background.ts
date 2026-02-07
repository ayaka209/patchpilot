import {
  createGroup,
  getActiveRules,
  getGlobalState,
  getGroups,
  getRules,
  setGlobalState,
} from '../utils/storage';
import { logger } from '../utils/logger';
import { MessageType, type AnyMessageRequest, type AnyMessageResponse, type LogEntry } from '../utils/types';

function getChrome(): typeof chrome {
  return (globalThis as unknown as { chrome: typeof chrome }).chrome;
}

async function broadcastToTabs(message: unknown): Promise<void> {
  const chromeApi = getChrome();
  if (!chromeApi?.tabs?.query || !chromeApi?.tabs?.sendMessage) return;

  const tabs = await chromeApi.tabs.query({});
  await Promise.all(
    tabs.map(async (tab) => {
      if (typeof tab.id !== 'number') return;
      try {
        await chromeApi.tabs.sendMessage(tab.id, message);
      } catch {
        // Ignore tabs that do not have a matching content script listener.
      }
    }),
  );
}

function isDebuggerAttached(_tabId?: number): boolean {
  return false;
}

async function injectRulesOnNavigation(tabId: number, frameId: number): Promise<void> {
  const chromeApi = getChrome();
  if (!chromeApi?.scripting?.executeScript) return;

  const state = await getGlobalState();
  if (!state.enabled) return;

  const rules = await getActiveRules();
  const serialized = JSON.stringify(rules);
  await chromeApi.scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    world: 'MAIN',
    func: (rawRules: string) => {
      (window as unknown as { __PATCHPILOT_RULES__?: unknown[] }).__PATCHPILOT_RULES__ =
        JSON.parse(rawRules);
    },
    args: [serialized],
  });
}

async function handleMessage(message: AnyMessageRequest, sender: chrome.runtime.MessageSender): Promise<AnyMessageResponse | undefined> {
  switch (message.type) {
    case MessageType.GET_ACTIVE_RULES: {
      const rules = await getActiveRules();
      return { rules };
    }
    case MessageType.GET_ALL_RULES: {
      const rules = await getRules();
      return { rules };
    }
    case MessageType.GET_GROUPS: {
      const groups = await getGroups();
      return { groups };
    }
    case MessageType.RULES_UPDATED: {
      await broadcastToTabs({ type: 'RULES_CHANGED' });
      return { ok: true };
    }
    case MessageType.LOG_MATCH: {
      logger.add(message.entry as Omit<LogEntry, 'id' | 'timestamp'>);
      return { ok: true };
    }
    case MessageType.GET_LOGS: {
      const entries = logger.getAll();
      return { entries };
    }
    case MessageType.CLEAR_LOGS: {
      logger.clear();
      return { ok: true };
    }
    case MessageType.TOGGLE_GLOBAL: {
      const state = await setGlobalState({ enabled: message.enabled });
      await broadcastToTabs({ type: 'GLOBAL_STATE_CHANGED', state });
      return { state };
    }
    case MessageType.GET_GLOBAL_STATE: {
      const state = await getGlobalState();
      return { state };
    }
    case MessageType.SWITCH_MODE: {
      const state = await setGlobalState({ mode: message.mode });
      return { state };
    }
    case MessageType.DEBUGGER_STATUS: {
      return { attached: isDebuggerAttached(sender.tab?.id) };
    }
    default:
      return undefined;
  }
}

export default defineBackground(() => {
  const chromeApi = getChrome();

  chromeApi.runtime.onInstalled.addListener(async () => {
    const groups = await getGroups();
    if (groups.length === 0) {
      await createGroup({ name: 'Default', enabled: true, order: 0 });
    }
    await setGlobalState({ enabled: true, mode: 'lite' });
  });

  chromeApi.runtime.onMessage.addListener((message: AnyMessageRequest, sender: chrome.runtime.MessageSender) => {
    return handleMessage(message, sender);
  });

  chromeApi.webNavigation.onCommitted.addListener(async (details) => {
    await injectRulesOnNavigation(details.tabId, details.frameId);
  });

  chromeApi.debugger?.onEvent?.addListener(() => {
    // Stub: debugger event handling will be implemented in Task 5B.
  });

  chromeApi.debugger?.onDetach?.addListener(() => {
    // Stub: debugger detach handling will be implemented in Task 5B.
  });

  chromeApi.tabs.onRemoved.addListener(() => {
    // Stub: debugger/session cleanup will be implemented in Task 5B.
  });
});
