import { ref } from 'vue';
import { MessageType, type GlobalState, type LogEntry, type AnyMessageRequest, type InterceptionMode } from '../utils/types';

// Helper to send typed messages
async function sendMessage<T>(msg: AnyMessageRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

export function useGlobalState() {
  const state = ref<GlobalState>({ enabled: false, mode: 'lite' });
  const loading = ref(false);

  async function refresh() {
    loading.value = true;
    try {
      const res = await sendMessage<{ state: GlobalState }>({ type: MessageType.GET_GLOBAL_STATE });
      if (res && res.state) {
        state.value = res.state;
      }
    } catch (e) {
      console.error('Failed to refresh global state:', e);
    } finally {
      loading.value = false;
    }
  }

  async function toggle() {
    const newState = !state.value.enabled;
    try {
      const res = await sendMessage<{ state: GlobalState }>({ 
        type: MessageType.TOGGLE_GLOBAL, 
        enabled: newState 
      });
      if (res && res.state) {
        state.value = res.state;
      }
    } catch (e) {
      console.error('Failed to toggle global state:', e);
    }
  }

  async function switchMode(mode: InterceptionMode) {
    try {
      const res = await sendMessage<{ state: GlobalState }>({ 
        type: MessageType.SWITCH_MODE, 
        mode 
      });
      if (res && res.state) {
        state.value = res.state;
      }
    } catch (e) {
      console.error('Failed to switch mode:', e);
    }
  }

  return { state, loading, refresh, toggle, switchMode };
}

export function useLogs() {
  const logs = ref<LogEntry[]>([]);
  const loading = ref(false);

  async function refresh() {
    loading.value = true;
    try {
      const res = await sendMessage<{ entries: LogEntry[] }>({ type: MessageType.GET_LOGS });
      if (res && res.entries) {
        logs.value = res.entries;
      }
    } catch (e) {
      console.error('Failed to refresh logs:', e);
    } finally {
      loading.value = false;
    }
  }

  async function clear() {
    try {
      await sendMessage({ type: MessageType.CLEAR_LOGS });
      logs.value = [];
    } catch (e) {
      console.error('Failed to clear logs:', e);
    }
  }

  return { logs, loading, refresh, clear };
}
