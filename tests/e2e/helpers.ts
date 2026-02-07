import { chromium, type BrowserContext, type BrowserContextOptions, type Worker } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFixtureServer, type FixtureServer } from './server';

const execFileAsync = promisify(execFile);

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXTENSION_DIR = path.join(ROOT_DIR, '.output/chrome-mv3');
const CHROME_EXECUTABLE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG = process.env.PATCHPILOT_E2E_DEBUG === '1';
const SERVICE_WORKER_TIMEOUT_MS = 30000;
const EXTENSION_ID_TIMEOUT_MS = 10000;
const STORAGE_KEYS = {
  groups: 'patchpilot_groups',
  rules: 'patchpilot_rules',
  globalState: 'patchpilot_global_state',
} as const;

let buildPromise: Promise<void> | null = null;

export type E2ERule = {
  id?: string;
  groupId?: string;
  name: string;
  urlPattern: string;
  script: string;
  enabled?: boolean;
};

type ExtensionLaunchResult = {
  context: BrowserContext;
  extensionId: string;
  close: () => Promise<void>;
};

type LaunchStrategy = {
  name: string;
  launchOptions: BrowserContextOptions & {
    channel?: 'chrome' | 'chromium';
    executablePath?: string;
  };
};

function debugLog(message: string, payload?: unknown): void {
  if (!DEBUG) return;
  if (typeof payload === 'undefined') {
    console.log(`[patchpilot:e2e] ${message}`);
    return;
  }
  console.log(`[patchpilot:e2e] ${message}`, payload);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureExtensionBuilt(): Promise<void> {
  if (!buildPromise) {
    buildPromise = execFileAsync('pnpm', ['build'], { cwd: ROOT_DIR }).then(() => undefined);
  }
  await buildPromise;
}

export async function getExtensionId(context: BrowserContext): Promise<string> {
  const [serviceWorker] = context.serviceWorkers();
  if (serviceWorker) {
    const extensionId = serviceWorker.url().split('/')[2];
    if (extensionId) {
      return extensionId;
    }
  }

  return getExtensionIdFromExtensionsPage(context);
}

async function getExtensionIdFromExtensionsPage(context: BrowserContext): Promise<string> {
  const page = await context.newPage();
  try {
    await page.goto('chrome://extensions', { waitUntil: 'domcontentloaded', timeout: EXTENSION_ID_TIMEOUT_MS });
    const extensionId = await page.evaluate(() => {
      const manager = document.querySelector('extensions-manager') as HTMLElement & { shadowRoot: ShadowRoot };
      const managerRoot = manager?.shadowRoot;
      const itemList = managerRoot?.querySelector('extensions-item-list') as HTMLElement & { shadowRoot: ShadowRoot };
      const itemListRoot = itemList?.shadowRoot;
      const items = itemListRoot?.querySelectorAll('extensions-item') ?? [];

      for (const item of Array.from(items)) {
        const element = item as HTMLElement & { shadowRoot: ShadowRoot };
        const root = element.shadowRoot;
        const name = root?.querySelector('#name')?.textContent?.trim();
        if (name === 'PatchPilot') {
          return element.getAttribute('id') || '';
        }
      }

      return '';
    });

    if (!extensionId) {
      throw new Error('PatchPilot extension id was not found in chrome://extensions');
    }

    return extensionId;
  } finally {
    await page.close();
  }
}

async function ensureServiceWorker(context: BrowserContext): Promise<Worker> {
  const existing = context.serviceWorkers();
  if (existing.length > 0) {
    return existing[0];
  }

  const extensionId = await getExtensionId(context);
  const wakePage = await context.newPage();
  try {
    await wakePage.goto(`chrome-extension://${extensionId}/options.html`, {
      waitUntil: 'domcontentloaded',
      timeout: EXTENSION_ID_TIMEOUT_MS,
    });
  } finally {
    await wakePage.close();
  }

  const [serviceWorker] = context.serviceWorkers();
  if (serviceWorker) {
    return serviceWorker;
  }

  return await context.waitForEvent('serviceworker', {
    timeout: SERVICE_WORKER_TIMEOUT_MS,
  });
}

async function notifyRulesUpdated(context: BrowserContext): Promise<void> {
  const extensionId = await getExtensionId(context);
  const page = await context.newPage();
  try {
    await page.goto(`chrome-extension://${extensionId}/options.html`, {
      waitUntil: 'domcontentloaded',
      timeout: EXTENSION_ID_TIMEOUT_MS,
    });
    await page.evaluate(async () => {
      await chrome.runtime.sendMessage({ type: 'RULES_UPDATED' });
    });
  } finally {
    await page.close();
  }
}

function getLaunchStrategies(options?: BrowserContextOptions): LaunchStrategy[] {
  const extensionArgs = [
    '--no-sandbox',
    `--disable-extensions-except=${EXTENSION_DIR}`,
    `--load-extension=${EXTENSION_DIR}`,
  ];

  const headlessArgs = ['--headless=new'];

  return [
    {
      name: 'bundled-chromium',
      launchOptions: {
        headless: false,
        args: [...extensionArgs, ...headlessArgs],
        ...options,
      },
    },
    {
      name: 'chrome-channel',
      launchOptions: {
        headless: false,
        channel: 'chrome',
        args: [...extensionArgs, ...headlessArgs],
        ...options,
      },
    },
    {
      name: 'system-chrome-executable',
      launchOptions: {
        headless: false,
        executablePath: CHROME_EXECUTABLE,
        args: [...extensionArgs, ...headlessArgs],
        ...options,
      },
    },
  ];
}

export async function launchExtension(options?: BrowserContextOptions): Promise<ExtensionLaunchResult> {
  await ensureExtensionBuilt();

  const strategies = getLaunchStrategies(options);
  const errors: string[] = [];

  for (const strategy of strategies) {
    const userDataDir = await mkdtemp(path.join(tmpdir(), `patchpilot-e2e-${strategy.name}-`));
    debugLog(`launching extension with strategy ${strategy.name}`, {
      extensionDir: EXTENSION_DIR,
      launchOptions: strategy.launchOptions,
    });

    let context: BrowserContext | null = null;
    try {
      context = await chromium.launchPersistentContext(userDataDir, strategy.launchOptions);
      await sleep(500);
      const extensionId = await getExtensionId(context);
      debugLog(`extension launched with strategy ${strategy.name}`, {
        extensionId,
        serviceWorkers: context.serviceWorkers().map((worker) => worker.url()),
      });

      return {
        context,
        extensionId,
        close: async () => {
          await context?.close();
          await rm(userDataDir, { recursive: true, force: true });
        },
      };
    } catch (error) {
      const detail = `${strategy.name}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(detail);
      debugLog(`strategy ${strategy.name} failed`, detail);
      if (context) {
        await context.close();
      }
      await rm(userDataDir, { recursive: true, force: true });
    }
  }

  throw new Error(`Failed to launch extension in persistent context. Attempts: ${errors.join(' | ')}`);
}

export async function resetExtensionStorage(context: BrowserContext): Promise<void> {
  const worker = await ensureServiceWorker(context);

  await worker.evaluate(async ({ storageKeys }) => {
    const defaultGroup = {
      id: crypto.randomUUID(),
      name: 'Default',
      enabled: true,
      order: 0,
    };

    await chrome.storage.local.set({
      [storageKeys.groups]: [defaultGroup],
      [storageKeys.rules]: [],
      [storageKeys.globalState]: { enabled: true, mode: 'lite' },
    });
  }, { storageKeys: STORAGE_KEYS });
}

export async function createRuleViaStorage(context: BrowserContext, rule: E2ERule): Promise<void> {
  const worker = await ensureServiceWorker(context);

  await worker.evaluate(
    async ({ nextRule, storageKeys }) => {
      const existing = await chrome.storage.local.get([
        storageKeys.groups,
        storageKeys.rules,
        storageKeys.globalState,
      ]);

      const groups = Array.isArray(existing[storageKeys.groups]) ? existing[storageKeys.groups] : [];
      const rules = Array.isArray(existing[storageKeys.rules]) ? existing[storageKeys.rules] : [];

      const ensuredGroups = groups.length > 0
        ? groups
        : [{ id: crypto.randomUUID(), name: 'Default', enabled: true, order: 0 }];
      const groupId = nextRule.groupId ?? ensuredGroups[0].id;
      const now = Date.now();

      const created = {
        id: nextRule.id ?? crypto.randomUUID(),
        groupId,
        name: nextRule.name,
        urlPattern: nextRule.urlPattern,
        script: nextRule.script,
        enabled: nextRule.enabled ?? true,
        createdAt: now,
        updatedAt: now,
      };

      await chrome.storage.local.set({
        [storageKeys.groups]: ensuredGroups,
        [storageKeys.rules]: [...rules, created],
        [storageKeys.globalState]: existing[storageKeys.globalState] ?? { enabled: true, mode: 'lite' },
      });
    },
    { nextRule: rule, storageKeys: STORAGE_KEYS },
  );

  await notifyRulesUpdated(context);
}

export async function setGlobalEnabled(context: BrowserContext, enabled: boolean): Promise<void> {
  const worker = await ensureServiceWorker(context);

  await worker.evaluate(async ({ storageKeys, isEnabled }) => {
    const existing = await chrome.storage.local.get(storageKeys.globalState);
    const current = existing[storageKeys.globalState] ?? { enabled: true, mode: 'lite' };
    await chrome.storage.local.set({
      [storageKeys.globalState]: { ...current, enabled: isEnabled },
    });
  }, { storageKeys: STORAGE_KEYS, isEnabled: enabled });
}

export async function startTestServer(): Promise<FixtureServer> {
  return startFixtureServer();
}
