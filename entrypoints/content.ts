import { MessageType, type Rule } from '../utils/types';

type InjectedToContentMessage =
  | {
      source: 'patchpilot-injected';
      type: 'GET_ACTIVE_RULES';
    }
  | {
      source: 'patchpilot-injected';
      type: 'LOG_MATCH';
      entry: {
        ruleId: string;
        ruleName: string;
        url: string;
        success: boolean;
        error?: string;
      };
    };

export default defineContentScript({
  matches: ['*://*/*'],
  runAt: 'document_start',
  async main() {
    const chromeApi = (globalThis as any).chrome as any;
    await injectScript('/injected.js', { keepInDom: true });

    chromeApi.runtime.onMessage.addListener((message: { type?: string }) => {
      if (message?.type === 'RULES_CHANGED') {
        window.postMessage({ source: 'patchpilot-content', type: 'RULES_CHANGED' }, '*');
      }
    });

    window.addEventListener('message', async (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data as InjectedToContentMessage;
      if (!data || data.source !== 'patchpilot-injected') return;

      if (data.type === 'GET_ACTIVE_RULES') {
        const response = await chromeApi.runtime.sendMessage({
          type: MessageType.GET_ACTIVE_RULES,
        });
        const rules = (response?.rules ?? []) as Rule[];
        window.postMessage({ source: 'patchpilot-content', type: 'ACTIVE_RULES', rules }, '*');
        return;
      }

      if (data.type === 'LOG_MATCH') {
        await chromeApi.runtime.sendMessage({
          type: MessageType.LOG_MATCH,
          entry: data.entry,
        });
      }
    });
  },
});
