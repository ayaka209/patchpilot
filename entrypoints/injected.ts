export interface InterceptorRule {
  id: string;
  urlPattern: string;
  script: string;
  enabled: boolean;
  name?: string;
}

type CompiledRule = {
  rule: InterceptorRule;
  regex: RegExp | null;
};

type LogPayload = {
  ruleId: string;
  ruleName: string;
  url: string;
  success: boolean;
  error?: string;
};

type UserScriptRunner = (content: string, url: string) => unknown;

export type InterceptionDeps = {
  windowObj?: any;
  documentObj?: any;
  reportLog?: (entry: LogPayload) => void;
  reportError?: (url: string, error: unknown, rule?: InterceptorRule | null) => void;
  createUserScriptRunner?: (script: string) => UserScriptRunner;
};

export function createRuleMatcher(rules: InterceptorRule[]) {
  const regexCache = new Map<string, RegExp>();
  let compiled = compileRules(rules, regexCache);

  const match = (url: string): InterceptorRule | null => {
    for (const item of compiled) {
      if (!item.rule.enabled || !item.regex) continue;
      item.regex.lastIndex = 0;
      if (item.regex.test(url)) return item.rule;
    }
    return null;
  };

  return {
    match,
    setRules(nextRules: InterceptorRule[]) {
      compiled = compileRules(nextRules, regexCache);
    },
    getCachedRegex(pattern: string): RegExp | undefined {
      return regexCache.get(pattern);
    },
  };
}

function compileRules(rules: InterceptorRule[], cache: Map<string, RegExp>): CompiledRule[] {
  return rules.map((rule) => ({
    rule,
    regex: compilePattern(rule.urlPattern, cache),
  }));
}

function compilePattern(pattern: string, cache: Map<string, RegExp>): RegExp | null {
  const cached = cache.get(pattern);
  if (cached) return cached;
  try {
    const regex = new RegExp(pattern);
    cache.set(pattern, regex);
    return regex;
  } catch {
    return null;
  }
}

export function createInterceptionEngine(deps: InterceptionDeps = {}) {
  const windowObj = deps.windowObj ?? window;
  const documentObj = deps.documentObj ?? document;
  const matcher = createRuleMatcher([]);
  const reportLog =
    deps.reportLog ??
    ((entry: LogPayload) => {
      windowObj.postMessage({ source: 'patchpilot-injected', type: 'LOG_MATCH', entry }, '*');
    });
  const reportError =
    deps.reportError ??
    ((url: string, error: unknown, rule?: InterceptorRule | null) => {
      const message = error instanceof Error ? error.message : String(error);
      reportLog({
        ruleId: rule?.id ?? 'unknown',
        ruleName: rule?.name ?? rule?.id ?? 'unknown',
        url,
        success: false,
        error: message,
      });
    });

  const createUserScriptRunner =
    deps.createUserScriptRunner ??
    ((script: string) => {
      const fnName = `__patchpilot_fn_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const el = documentObj.createElement('script');
      el.textContent = `window.${fnName} = function(content, url) { ${script} }`;
      (documentObj.documentElement || documentObj.head).appendChild(el);
      el.remove();
      const runner = (windowObj as unknown as Record<string, unknown>)[fnName] as UserScriptRunner;
      return (content: string, url: string) => {
        const result = runner(content, url);
        delete (windowObj as unknown as Record<string, unknown>)[fnName];
        return result;
      };
    });

  const executeUserScript = (script: string, content: string, url: string, rule?: InterceptorRule): string => {
    try {
      const runner = createUserScriptRunner(script);
      const result = runner(content, url);
      if (typeof result !== 'string') {
        throw new Error('User script must return a string');
      }
      return result;
    } catch (error) {
      reportError(url, error, rule ?? null);
      return content;
    }
  };

  const matchUrl = (url: string): InterceptorRule | null => matcher.match(url);

  const installFetchInterceptor = () => {
    const originalFetch = windowObj.fetch.bind(windowObj);
    windowObj.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = input instanceof Request ? input.url : String(input);
      const matchedRule = matchUrl(url);
      if (!matchedRule) return originalFetch(input, init);

      const response = await originalFetch(input, init);
      const body = await response.text();
      const modified = executeUserScript(matchedRule.script, body, url, matchedRule);
      const success = modified === body ? false : true;
      reportLog({
        ruleId: matchedRule.id,
        ruleName: matchedRule.name ?? matchedRule.id,
        url,
        success,
      });

      return new Response(modified, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    };
  };

  const installXHRInterceptor = () => {
    const xhrProto = windowObj.XMLHttpRequest?.prototype;
    if (!xhrProto) return;

    const originalOpen = xhrProto.open;
    const originalSend = xhrProto.send;

    xhrProto.open = function (method: string, url: string | URL, ...rest: unknown[]) {
      (this as XMLHttpRequest & { __patchpilotUrl?: string }).__patchpilotUrl = String(url);
      return originalOpen.apply(this, [method, url, ...rest]);
    };

    xhrProto.send = function (...args: unknown[]) {
      this.addEventListener('load', () => {
        const xhr = this as XMLHttpRequest & { __patchpilotUrl?: string };
        const url = xhr.__patchpilotUrl;
        if (!url) return;

        const matchedRule = matchUrl(url);
        if (!matchedRule) return;

        const currentText = typeof xhr.responseText === 'string' ? xhr.responseText : '';
        const modified = executeUserScript(matchedRule.script, currentText, url, matchedRule);

        Object.defineProperty(xhr, 'responseText', {
          configurable: true,
          get: () => modified,
        });

        if (xhr.responseType === '' || xhr.responseType === 'text') {
          Object.defineProperty(xhr, 'response', {
            configurable: true,
            get: () => modified,
          });
        }

        reportLog({
          ruleId: matchedRule.id,
          ruleName: matchedRule.name ?? matchedRule.id,
          url,
          success: modified !== currentText,
        });
      });

      return originalSend.apply(this, args as [Document | XMLHttpRequestBodyInit | null]);
    };
  };

  const processScriptNode = async (node: HTMLScriptElement) => {
    if (!node.src) return;
    const matchedRule = matchUrl(node.src);
    if (!matchedRule || !node.parentNode) return;

    try {
      const response = await windowObj.fetch(node.src);
      const source = await response.text();
      const modified = executeUserScript(matchedRule.script, source, node.src, matchedRule);
      const inlineScript = documentObj.createElement('script');
      inlineScript.textContent = modified;
      node.parentNode.replaceChild(inlineScript, node);
      reportLog({
        ruleId: matchedRule.id,
        ruleName: matchedRule.name ?? matchedRule.id,
        url: node.src,
        success: modified !== source,
      });
    } catch (error) {
      reportError(node.src, error, matchedRule);
    }
  };

  const processStylesheetNode = async (node: HTMLLinkElement) => {
    if (!node.href || node.rel !== 'stylesheet') return;
    const matchedRule = matchUrl(node.href);
    if (!matchedRule || !node.parentNode) return;

    try {
      const response = await windowObj.fetch(node.href);
      const source = await response.text();
      const modified = executeUserScript(matchedRule.script, source, node.href, matchedRule);
      const style = documentObj.createElement('style');
      style.textContent = modified;
      node.parentNode.replaceChild(style, node);
      reportLog({
        ruleId: matchedRule.id,
        ruleName: matchedRule.name ?? matchedRule.id,
        url: node.href,
        success: modified !== source,
      });
    } catch (error) {
      reportError(node.href, error, matchedRule);
    }
  };

  const processNode = (node: Node) => {
    if (node.nodeType !== 1) return;
    const element = node as Element;
    if (element.tagName === 'SCRIPT') {
      void processScriptNode(element as HTMLScriptElement);
      return;
    }
    if (element.tagName === 'LINK') {
      void processStylesheetNode(element as HTMLLinkElement);
    }
  };

  const installDOMInterceptor = () => {
    const Observer = windowObj.MutationObserver;
    if (!Observer || !documentObj.documentElement) return;
    const observer = new Observer((mutations: any[]) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node: any) => processNode(node));
      }
    });
    observer.observe(documentObj.documentElement, { childList: true, subtree: true });
    return observer;
  };

  return {
    updateRules(rules: InterceptorRule[]) {
      matcher.setRules(rules);
    },
    matchUrl,
    executeUserScript,
    installFetchInterceptor,
    installXHRInterceptor,
    installDOMInterceptor,
  };
}

declare global {
  interface Window {
    __PATCHPILOT_RULES__?: InterceptorRule[];
  }
}

function bootstrap(): void {
  const engine = createInterceptionEngine();

  const applyRules = (rules: InterceptorRule[]) => {
    engine.updateRules(rules);
  };

  const preloadedRules = Array.isArray(window.__PATCHPILOT_RULES__) ? window.__PATCHPILOT_RULES__ : null;
  if (preloadedRules) {
    applyRules(preloadedRules);
  } else {
    window.postMessage({ source: 'patchpilot-injected', type: 'GET_ACTIVE_RULES' }, '*');
  }

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) return;
    const payload = event.data as { source?: string; type?: string; rules?: InterceptorRule[] };
    if (payload?.source !== 'patchpilot-content') return;

    if (payload.type === 'ACTIVE_RULES' && Array.isArray(payload.rules)) {
      applyRules(payload.rules);
      return;
    }

    if (payload.type === 'RULES_CHANGED') {
      window.postMessage({ source: 'patchpilot-injected', type: 'GET_ACTIVE_RULES' }, '*');
    }
  });

  engine.installFetchInterceptor();
  engine.installXHRInterceptor();
  engine.installDOMInterceptor();
}

export default defineUnlistedScript(() => {
  bootstrap();
});
