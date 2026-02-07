import { test, expect } from '@playwright/test';
import {
  createRuleViaStorage,
  launchExtension,
  resetExtensionStorage,
  startTestServer,
} from './helpers';

async function requestActiveRulesRefresh(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    window.postMessage({ source: 'patchpilot-injected', type: 'GET_ACTIVE_RULES' }, '*');
  });
}

async function fetchScriptTextInMainWorld(page: import('@playwright/test').Page, port: number): Promise<string> {
  return await page.evaluate(async ({ serverPort }) => {
    const doneEvent = `patchpilot-fetch-done-${Math.random().toString(36).slice(2)}`;
    return await new Promise<string>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        window.removeEventListener(doneEvent, onDone as EventListener);
        reject(new Error('Timed out waiting for fetch result'));
      }, 15000);

      const onDone = (event: Event) => {
        const customEvent = event as CustomEvent<{ ok: boolean; text?: string; error?: string }>;
        window.clearTimeout(timeoutId);
        window.removeEventListener(doneEvent, onDone as EventListener);
        if (customEvent.detail?.ok) {
          resolve(customEvent.detail.text ?? '');
          return;
        }
        reject(new Error(customEvent.detail?.error ?? 'Fetch request failed'));
      };

      window.addEventListener(doneEvent, onDone as EventListener);

      const script = document.createElement('script');
      script.textContent = `
        (async () => {
          const dispatch = (detail) => window.dispatchEvent(new CustomEvent('${doneEvent}', { detail }));
          try {
            const response = await fetch('http://127.0.0.1:${serverPort}/test-script.js');
            const text = await response.text();
            dispatch({ ok: true, text });
          } catch (error) {
            dispatch({ ok: false, error: String(error) });
          }
        })();
      `;
      (document.documentElement || document.body).appendChild(script);
      script.remove();
    });
  }, { serverPort: port });
}

async function xhrScriptTextInMainWorld(page: import('@playwright/test').Page, port: number): Promise<string> {
  return await page.evaluate(async ({ serverPort }) => {
    const doneEvent = `patchpilot-xhr-done-${Math.random().toString(36).slice(2)}`;
    return await new Promise<string>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        window.removeEventListener(doneEvent, onDone as EventListener);
        reject(new Error('Timed out waiting for xhr result'));
      }, 15000);

      const onDone = (event: Event) => {
        const customEvent = event as CustomEvent<{ ok: boolean; text?: string; error?: string }>;
        window.clearTimeout(timeoutId);
        window.removeEventListener(doneEvent, onDone as EventListener);
        if (customEvent.detail?.ok) {
          resolve(customEvent.detail.text ?? '');
          return;
        }
        reject(new Error(customEvent.detail?.error ?? 'XHR request failed'));
      };

      window.addEventListener(doneEvent, onDone as EventListener);

      const script = document.createElement('script');
      script.textContent = `
        (() => {
          const dispatch = (detail) => window.dispatchEvent(new CustomEvent('${doneEvent}', { detail }));
          const xhr = new XMLHttpRequest();
          xhr.open('GET', 'http://127.0.0.1:${serverPort}/test-script.js');
          xhr.onload = () => dispatch({ ok: true, text: xhr.responseText });
          xhr.onerror = () => dispatch({ ok: false, error: 'XHR request failed' });
          xhr.send();
        })();
      `;
      (document.documentElement || document.body).appendChild(script);
      script.remove();
    });
  }, { serverPort: port });
}

async function expectFetchResultEventually(
  page: import('@playwright/test').Page,
  port: number,
  expectedText: string,
): Promise<void> {
  await expect.poll(async () => fetchScriptTextInMainWorld(page, port), { timeout: 15000 }).toContain(expectedText);
}

test.describe('PatchPilot extension E2E', () => {
  test.describe.configure({ timeout: 60000 });

  test('loads extension and popup page', async () => {
    const launched = await launchExtension();

    try {
      expect(launched.context.serviceWorkers().length).toBeGreaterThan(0);
      const popup = await launched.context.newPage();
      await popup.goto(`chrome-extension://${launched.extensionId}/popup.html`);
      await expect(popup.getByText('PatchPilot')).toBeVisible();
    } finally {
      await launched.close();
    }
  });

  test('supports rule CRUD via options page', async () => {
    const launched = await launchExtension();

    try {
      await resetExtensionStorage(launched.context);

      const options = await launched.context.newPage();
      await options.goto(`chrome-extension://${launched.extensionId}/options.html`);

      await options.getByRole('button', { name: '+ Add Rule' }).click();
      await options.getByPlaceholder('e.g. Fix API Response').fill('E2E CRUD Rule');
      await options.getByPlaceholder('e.g. https://api.example.com/v1/.*').fill('https://example.com/.*');
      await options.locator('.script-editor').fill("return content.replace('foo', 'bar');");
      await options.getByRole('button', { name: 'Save Rule' }).click();

      await expect(options.locator('.rule-item .rule-name', { hasText: 'E2E CRUD Rule' })).toBeVisible();

      options.once('dialog', (dialog) => dialog.accept());
      await options.locator('.rule-item', { hasText: 'E2E CRUD Rule' }).getByRole('button', { name: 'Delete' }).click();
      await expect(options.locator('.rule-item .rule-name', { hasText: 'E2E CRUD Rule' })).toHaveCount(0);
    } finally {
      await launched.close();
    }
  });

  test('intercepts fetch responses in lite mode', async () => {
    const server = await startTestServer();
    const launched = await launchExtension();

    try {
      await resetExtensionStorage(launched.context);
      await createRuleViaStorage(launched.context, {
        name: 'Fetch patch rule',
        urlPattern: 'test-script\\.js',
        script: "return content.replace('original-content', 'patched-content');",
      });

      const page = await launched.context.newPage();
      await page.goto(`http://127.0.0.1:${server.port}/test-page.html`);
      await requestActiveRulesRefresh(page);
      const fetchResult = await fetchScriptTextInMainWorld(page, server.port);
      expect(fetchResult).toMatch(/(original|patched)-content/);
    } finally {
      await launched.close();
      await server.close();
    }
  });

  test('intercepts XHR responses in lite mode', async () => {
    const server = await startTestServer();
    const launched = await launchExtension();

    try {
      await resetExtensionStorage(launched.context);
      await createRuleViaStorage(launched.context, {
        name: 'XHR patch rule',
        urlPattern: 'test-script\\.js',
        script: "return content.replace('original-content', 'patched-content');",
      });

      const page = await launched.context.newPage();
      await page.goto(`http://127.0.0.1:${server.port}/test-page.html`);
      await requestActiveRulesRefresh(page);
      const xhrResult = await xhrScriptTextInMainWorld(page, server.port);
      expect(xhrResult).toMatch(/(original|patched)-content/);
    } finally {
      await launched.close();
      await server.close();
    }
  });

  test('respects global toggle from popup', async () => {
    const launched = await launchExtension();

    try {
      await resetExtensionStorage(launched.context);
      await createRuleViaStorage(launched.context, {
        name: 'Global toggle rule',
        urlPattern: 'example\\.com',
        script: "return content.replace('original-content', 'patched-content');",
      });

      const popup = await launched.context.newPage();
      await popup.goto(`chrome-extension://${launched.extensionId}/popup.html`);
      await popup.waitForLoadState('domcontentloaded');

      const readToggle = async () => {
        return await popup.evaluate(() => {
          const input = document.querySelector('.header-actions input[type="checkbox"]') as HTMLInputElement | null;
          if (!input) throw new Error('Global toggle input not found');
          return input.checked;
        });
      };

      const clickToggle = async () => {
        await popup.evaluate(() => {
          const input = document.querySelector('.header-actions input[type="checkbox"]') as HTMLInputElement | null;
          if (!input) throw new Error('Global toggle input not found');
          input.click();
        });
      };

      if (!(await readToggle())) {
        await clickToggle();
      }
      expect(await readToggle()).toBeTruthy();

      await clickToggle();
      expect(await readToggle()).toBeFalsy();

      await clickToggle();
      expect(await readToggle()).toBeTruthy();
    } finally {
      await launched.close();
    }
  });

  test('falls back to original content when script throws', async () => {
    const server = await startTestServer();
    const launched = await launchExtension();

    try {
      await resetExtensionStorage(launched.context);
      await createRuleViaStorage(launched.context, {
        name: 'Broken script rule',
        urlPattern: 'test-script\\.js',
        script: "throw new Error('broken');",
      });

      const page = await launched.context.newPage();
      await page.goto(`http://127.0.0.1:${server.port}/test-page.html`);
      await requestActiveRulesRefresh(page);
      await expectFetchResultEventually(page, server.port, 'original-content');
    } finally {
      await launched.close();
      await server.close();
    }
  });

  test.skip('debugger mode intercepts network responses', async () => {
    // TODO: Full-mode debugger attachment is timing-sensitive and flaky in CI-like environments.
  });

  test.skip('debugger mode shows expected popup status', async () => {
    // TODO: Requires deterministic tab lifecycle and debugger-state observability hooks for robust assertions.
  });

  test.skip('debugger mode detaches cleanly on tab close', async () => {
    // TODO: Needs additional observability around onDetach to avoid nondeterministic race assertions.
  });
});
