import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createRuleMatcher,
  createInterceptionEngine,
  type InterceptorRule,
} from '../../entrypoints/injected';

const makeRule = (overrides: Partial<InterceptorRule> = {}): InterceptorRule => ({
  id: overrides.id ?? 'rule-1',
  urlPattern: overrides.urlPattern ?? '^https://example\\.com/.*$',
  script: overrides.script ?? 'return content + "-patched";',
  enabled: overrides.enabled ?? true,
});

const makeDocumentStub = (): any =>
  ({
    documentElement: { appendChild: vi.fn() },
    head: { appendChild: vi.fn() },
    createElement: vi.fn(() => ({ textContent: '', remove: vi.fn() })),
  });

describe('interceptor engine', () => {
  const originalDateNow = Date.now;
  const originalRandom = Math.random;

  beforeEach(() => {
    Date.now = () => 123;
    Math.random = () => 0.5;
  });

  afterEach(() => {
    Date.now = originalDateNow;
    Math.random = originalRandom;
  });

  it('fetch interceptor wraps fetch and applies user script on matching URL', async () => {
    const text = vi.fn().mockResolvedValue('original');
    const fetchMock = vi.fn().mockResolvedValue({
      status: 201,
      statusText: 'Created',
      headers: new Headers({ 'x-test': '1' }),
      text,
    });

    const win = { fetch: fetchMock, postMessage: vi.fn() } as any;
    const engine = createInterceptionEngine({
      windowObj: win,
      documentObj: makeDocumentStub(),
      createUserScriptRunner: () => (content) => `${content}-patched`,
      reportLog: vi.fn(),
    });
    engine.updateRules([makeRule()]);
    engine.installFetchInterceptor();

    const response = await win.fetch('https://example.com/api/data');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(text).toHaveBeenCalledTimes(1);
    expect(await response.text()).toBe('original-patched');
  });

  it('XHR interceptor modifies responseText for matching URLs', () => {
    class FakeXHR {
      public responseText = 'payload';
      public response: unknown = 'payload';
      public responseType = '';
      public __url = '';

      private listeners = new Map<string, Array<() => void>>();

      open(_method: string, url: string): void {
        this.__url = url;
      }

      send(): void {
        const handlers = this.listeners.get('load') ?? [];
        handlers.forEach((fn) => fn.call(this));
      }

      addEventListener(type: string, fn: () => void): void {
        const handlers = this.listeners.get(type) ?? [];
        handlers.push(fn);
        this.listeners.set(type, handlers);
      }
    }

    const win = { XMLHttpRequest: FakeXHR, postMessage: vi.fn() } as any;
    const engine = createInterceptionEngine({
      windowObj: win,
      documentObj: makeDocumentStub(),
      createUserScriptRunner: () => (content) => `${content}-xhr`,
      reportLog: vi.fn(),
    });

    engine.updateRules([makeRule()]);
    engine.installXHRInterceptor();

    const xhr = new win.XMLHttpRequest();
    xhr.open('GET', 'https://example.com/resource');
    xhr.send();

    expect(xhr.responseText).toBe('payload-xhr');
    expect(xhr.response).toBe('payload-xhr');
  });

  it('non-matching URLs pass through without reading response body', async () => {
    const text = vi.fn().mockResolvedValue('original');
    const response = {
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      text,
    };

    const fetchMock = vi.fn().mockResolvedValue(response);
    const win = { fetch: fetchMock, postMessage: vi.fn() } as any;
    const engine = createInterceptionEngine({
      windowObj: win,
      documentObj: makeDocumentStub(),
      createUserScriptRunner: () => (content) => `${content}-patched`,
      reportLog: vi.fn(),
    });

    engine.updateRules([makeRule({ urlPattern: '^https://matched\\.example/.*$' })]);
    engine.installFetchInterceptor();

    const result = await win.fetch('https://example.com/no-match');
    expect(result).toBe(response);
    expect(text).not.toHaveBeenCalled();
  });

  it('user script error returns original content', async () => {
    const text = vi.fn().mockResolvedValue('raw');
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      text,
    });
    const win = { fetch: fetchMock, postMessage: vi.fn() } as any;
    const reportError = vi.fn();
    const engine = createInterceptionEngine({
      windowObj: win,
      documentObj: makeDocumentStub(),
      reportError,
      reportLog: vi.fn(),
      createUserScriptRunner: () => {
        throw new Error('boom');
      },
    });

    engine.updateRules([makeRule()]);
    engine.installFetchInterceptor();

    const response = await win.fetch('https://example.com/err');
    expect(await response.text()).toBe('raw');
    expect(reportError).toHaveBeenCalledTimes(1);
  });

  it('non-string user script result falls back to original content', () => {
    const reportError = vi.fn();
    const engine = createInterceptionEngine({
      windowObj: { postMessage: vi.fn() } as any,
      documentObj: makeDocumentStub(),
      reportError,
      reportLog: vi.fn(),
      createUserScriptRunner: () => () => 123,
    });

    const result = engine.executeUserScript('return 123;', 'source', 'https://example.com/test');
    expect(result).toBe('source');
    expect(reportError).toHaveBeenCalledTimes(1);
  });

  it('DOM interceptor detects added script tags and replaces matching node', async () => {
    let observerCallback: ((records: any[], observer: any) => void) | null = null;
    const observe = vi.fn();
    class FakeMutationObserver {
      constructor(cb: (records: any[], observer: any) => void) {
        observerCallback = cb;
      }
      observe = observe;
      disconnect = vi.fn();
    }

    const parent = { replaceChild: vi.fn() } as any;
    const addedScript = {
      nodeType: 1,
      tagName: 'SCRIPT',
      src: 'https://example.com/dynamic.js',
      textContent: '',
      parentNode: parent,
      removeAttribute: vi.fn(),
    } as any;

    const fetchMock = vi.fn().mockResolvedValue({ text: vi.fn().mockResolvedValue('dom-source') });
    const doc = {
      documentElement: {},
      createElement: vi.fn((tag: string) => ({
        tagName: tag.toUpperCase(),
        textContent: '',
        parentNode: null,
      })),
    } as any;

    const win = {
      fetch: fetchMock,
      MutationObserver: FakeMutationObserver,
      postMessage: vi.fn(),
    } as any;

    const engine = createInterceptionEngine({
      windowObj: win,
      documentObj: doc,
      createUserScriptRunner: () => (content) => `${content}-dom`,
      reportLog: vi.fn(),
    });
    engine.updateRules([makeRule()]);
    engine.installDOMInterceptor();

    expect(observe).toHaveBeenCalledTimes(1);
    expect(observerCallback).not.toBeNull();
    if (observerCallback) {
      (observerCallback as any)(
        [
          {
            addedNodes: [addedScript],
          } as any,
        ],
        {} as any,
      );
    }

    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/dynamic.js');
    expect((parent as any).replaceChild).toHaveBeenCalledTimes(1);
  });

  it('regex cache reuses same RegExp instance per pattern', () => {
    const matcher = createRuleMatcher([
      makeRule({ id: 'a', urlPattern: '^https://one\\.example/.*$' }),
      makeRule({ id: 'b', urlPattern: '^https://one\\.example/.*$' }),
    ]);

    const first = matcher.getCachedRegex('^https://one\\.example/.*$');
    const second = matcher.getCachedRegex('^https://one\\.example/.*$');
    expect(first).toBeInstanceOf(RegExp);
    expect(first).toBe(second);
  });
});
