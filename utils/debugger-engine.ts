import { createMatcher, type UrlMatcher } from './matcher';
import type { Rule } from './types';

type DebuggerSource = { tabId: number };

type HeaderEntry = { name: string; value?: string };

type ChromeDebuggerApi = {
  attach: (target: DebuggerSource, requiredVersion: string) => Promise<void>;
  detach: (target: DebuggerSource) => Promise<void>;
  sendCommand: (target: DebuggerSource, method: string, commandParams?: unknown) => Promise<unknown>;
};

type FetchRequestPausedParams = {
  requestId: string;
  request: { url: string };
  responseStatusCode?: number;
  responseHeaders?: HeaderEntry[];
};

type TabSession = {
  rules: Rule[];
  matcher: UrlMatcher;
};

const sessions = new Map<number, TabSession>();

function getDebuggerApi(): ChromeDebuggerApi {
  const chromeAny = (globalThis as unknown as { chrome?: { debugger?: ChromeDebuggerApi } }).chrome;
  const debuggerApi = chromeAny?.debugger;
  if (!debuggerApi) throw new Error('chrome.debugger is not available');
  return debuggerApi;
}

function decodeBody(body: string, base64Encoded: boolean): string {
  if (!base64Encoded) return body;
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(body);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(body, 'base64').toString('utf8');
}

function encodeBody(body: string): string {
  if (typeof globalThis.btoa === 'function') {
    const bytes = new TextEncoder().encode(body);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return globalThis.btoa(binary);
  }
  return Buffer.from(body, 'utf8').toString('base64');
}

function logError(message: string, err: unknown): void {
  console.error(`[debugger-engine] ${message}`, err);
}

function createSession(rules: Rule[]): TabSession {
  return { rules, matcher: createMatcher(rules) };
}

export async function attachToTab(tabId: number, rules: Rule[]): Promise<void> {
  const debuggerApi = getDebuggerApi();
  const source = { tabId };

  await debuggerApi.attach(source, '1.3');
  await debuggerApi.sendCommand(source, 'Fetch.enable', {
    patterns: [{ urlPattern: '*', requestStage: 'Response' }],
  });

  sessions.set(tabId, createSession(rules));
}

export async function detachFromTab(tabId: number): Promise<void> {
  const debuggerApi = getDebuggerApi();
  try {
    await debuggerApi.detach({ tabId });
  } finally {
    sessions.delete(tabId);
  }
}

export async function handleDebuggerEvent(
  source: DebuggerSource,
  method: string,
  params: unknown,
): Promise<void> {
  if (method !== 'Fetch.requestPaused') return;

  const debuggerApi = getDebuggerApi();
  const requestPaused = params as FetchRequestPausedParams;
  const requestId = requestPaused?.requestId;
  const url = requestPaused?.request?.url ?? '';
  if (!requestId) return;

  const session = sessions.get(source.tabId);
  const match = session?.matcher.match(url);
  if (!match) {
    await debuggerApi.sendCommand(source, 'Fetch.continueRequest', { requestId });
    return;
  }

  const responseCode = requestPaused.responseStatusCode ?? 200;
  const responseHeaders = requestPaused.responseHeaders ?? [];
  let originalBody = '';

  try {
    const bodyResult = (await debuggerApi.sendCommand(source, 'Fetch.getResponseBody', {
      requestId,
    })) as { body?: string; base64Encoded?: boolean };

    originalBody = decodeBody(bodyResult.body ?? '', Boolean(bodyResult.base64Encoded));

    let modifiedBody = originalBody;
    try {
      const runScript = new Function('content', 'url', match.script) as (
        content: string,
        targetUrl: string,
      ) => unknown;
      const result = runScript(originalBody, url);
      modifiedBody = typeof result === 'string' ? result : String(result ?? '');
    } catch (err) {
      logError('User script execution failed, falling back to original body', err);
      modifiedBody = originalBody;
    }

    await debuggerApi.sendCommand(source, 'Fetch.fulfillRequest', {
      requestId,
      responseCode,
      responseHeaders,
      body: encodeBody(modifiedBody),
    });
  } catch (err) {
    logError('Fetch interception failed, fulfilling with original body', err);
    try {
      await debuggerApi.sendCommand(source, 'Fetch.fulfillRequest', {
        requestId,
        responseCode,
        responseHeaders,
        body: encodeBody(originalBody),
      });
    } catch (fulfillErr) {
      logError('Fallback fulfillRequest failed', fulfillErr);
    }
  }
}

export function updateRules(tabId: number, rules: Rule[]): void {
  if (!sessions.has(tabId)) return;
  sessions.set(tabId, createSession(rules));
}

export function isAttached(tabId: number): boolean {
  return sessions.has(tabId);
}

export function getAttachedTabs(): number[] {
  return Array.from(sessions.keys());
}
