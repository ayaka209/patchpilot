import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from '@webext-core/fake-browser';

import type { Rule } from '../../utils/types';

type DebuggerMock = {
  attach: ReturnType<typeof vi.fn>;
  detach: ReturnType<typeof vi.fn>;
  sendCommand: ReturnType<typeof vi.fn>;
  onEvent: { addListener: ReturnType<typeof vi.fn>; removeListener: ReturnType<typeof vi.fn> };
  onDetach: { addListener: ReturnType<typeof vi.fn>; removeListener: ReturnType<typeof vi.fn> };
};

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'r1',
    groupId: 'g1',
    name: 'rule',
    urlPattern: '^https://example\\.com/.*$',
    script: 'return content;',
    enabled: true,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function createDebuggerMock(): DebuggerMock {
  return {
    attach: vi.fn().mockResolvedValue(undefined),
    detach: vi.fn().mockResolvedValue(undefined),
    sendCommand: vi.fn().mockResolvedValue(undefined),
    onEvent: { addListener: vi.fn(), removeListener: vi.fn() },
    onDetach: { addListener: vi.fn(), removeListener: vi.fn() },
  };
}

async function setup() {
  vi.resetModules();
  fakeBrowser.reset();
  const mockDebugger = createDebuggerMock();
  (globalThis as any).chrome = { ...fakeBrowser, debugger: mockDebugger };
  const engine = await import('../../utils/debugger-engine');
  return { engine, mockDebugger };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('debugger engine', () => {
  it('attachToTab attaches and enables Fetch response interception', async () => {
    const { engine, mockDebugger } = await setup();

    await engine.attachToTab(12, [makeRule()]);

    expect(mockDebugger.attach).toHaveBeenCalledWith({ tabId: 12 }, '1.3');
    expect(mockDebugger.sendCommand).toHaveBeenCalledWith({ tabId: 12 }, 'Fetch.enable', {
      patterns: [{ urlPattern: '*', requestStage: 'Response' }],
    });
    expect(engine.isAttached(12)).toBe(true);
  });

  it('detachFromTab detaches debugger and clears state', async () => {
    const { engine, mockDebugger } = await setup();

    await engine.attachToTab(21, [makeRule()]);
    await engine.detachFromTab(21);

    expect(mockDebugger.detach).toHaveBeenCalledWith({ tabId: 21 });
    expect(engine.isAttached(21)).toBe(false);
    expect(engine.getAttachedTabs()).toEqual([]);
  });

  it('handleDebuggerEvent continues request when URL does not match rules', async () => {
    const { engine, mockDebugger } = await setup();

    await engine.attachToTab(30, [makeRule({ urlPattern: '^https://match\\.com/.*$' })]);
    await engine.handleDebuggerEvent(
      { tabId: 30 },
      'Fetch.requestPaused',
      { requestId: 'req-1', request: { url: 'https://no-match.com/file.js' } },
    );

    expect(mockDebugger.sendCommand).toHaveBeenCalledWith(
      { tabId: 30 },
      'Fetch.continueRequest',
      { requestId: 'req-1' },
    );
  });

  it('handleDebuggerEvent modifies response body for matching rule and fulfills request', async () => {
    const { engine, mockDebugger } = await setup();

    mockDebugger.sendCommand.mockImplementation(async (_source: any, method: string) => {
      if (method === 'Fetch.getResponseBody') {
        return { body: 'hello', base64Encoded: false };
      }
      return undefined;
    });

    await engine.attachToTab(
      40,
      [makeRule({ script: 'return content + "-patched";' })],
    );

    await engine.handleDebuggerEvent(
      { tabId: 40 },
      'Fetch.requestPaused',
      {
        requestId: 'req-2',
        request: { url: 'https://example.com/abc.js' },
        responseStatusCode: 201,
        responseHeaders: [{ name: 'content-type', value: 'text/plain' }],
      },
    );

    expect(mockDebugger.sendCommand).toHaveBeenCalledWith(
      { tabId: 40 },
      'Fetch.getResponseBody',
      { requestId: 'req-2' },
    );
    expect(mockDebugger.sendCommand).toHaveBeenCalledWith(
      { tabId: 40 },
      'Fetch.fulfillRequest',
      {
        requestId: 'req-2',
        responseCode: 201,
        responseHeaders: [{ name: 'content-type', value: 'text/plain' }],
        body: Buffer.from('hello-patched', 'utf8').toString('base64'),
      },
    );
  });

  it('handleDebuggerEvent falls back to original body when user script throws', async () => {
    const { engine, mockDebugger } = await setup();

    const originalBodyBase64 = Buffer.from('original-body', 'utf8').toString('base64');
    mockDebugger.sendCommand.mockImplementation(async (_source: any, method: string) => {
      if (method === 'Fetch.getResponseBody') {
        return { body: originalBodyBase64, base64Encoded: true };
      }
      return undefined;
    });

    await engine.attachToTab(
      50,
      [makeRule({ script: 'throw new Error("boom");' })],
    );

    await engine.handleDebuggerEvent(
      { tabId: 50 },
      'Fetch.requestPaused',
      {
        requestId: 'req-3',
        request: { url: 'https://example.com/abc.js' },
        responseStatusCode: 200,
        responseHeaders: [],
      },
    );

    expect(mockDebugger.sendCommand).toHaveBeenCalledWith(
      { tabId: 50 },
      'Fetch.fulfillRequest',
      expect.objectContaining({
        requestId: 'req-3',
        responseCode: 200,
        body: originalBodyBase64,
      }),
    );
  });

  it('isAttached reflects attachment state by tab', async () => {
    const { engine } = await setup();

    expect(engine.isAttached(60)).toBe(false);
    await engine.attachToTab(60, [makeRule()]);
    expect(engine.isAttached(60)).toBe(true);
    await engine.detachFromTab(60);
    expect(engine.isAttached(60)).toBe(false);
  });

  it('getAttachedTabs returns all attached tab IDs', async () => {
    const { engine } = await setup();

    await engine.attachToTab(3, [makeRule({ id: 'r3' })]);
    await engine.attachToTab(9, [makeRule({ id: 'r9' })]);

    expect(engine.getAttachedTabs()).toEqual([3, 9]);
  });

  it('handleDebuggerEvent ignores non-Fetch.requestPaused methods', async () => {
    const { engine, mockDebugger } = await setup();

    await engine.attachToTab(70, [makeRule()]);
    await engine.handleDebuggerEvent({ tabId: 70 }, 'Network.requestWillBeSent', {});

    expect(mockDebugger.sendCommand).toHaveBeenCalledTimes(1);
    expect(mockDebugger.sendCommand).toHaveBeenCalledWith({ tabId: 70 }, 'Fetch.enable', {
      patterns: [{ urlPattern: '*', requestStage: 'Response' }],
    });
  });
});
