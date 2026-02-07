import type { ExportData, GlobalState, Group, InterceptionMode, Rule } from './types';

const STORAGE_KEYS = {
  groups: 'patchpilot_groups',
  rules: 'patchpilot_rules',
  globalState: 'patchpilot_global_state',
} as const;

const EXPORT_VERSION = 1;

function getChromeStorageLocal() {
  const chromeAny = (globalThis as unknown as { chrome?: any }).chrome;
  const local = chromeAny?.storage?.local;
  if (!local) throw new Error('chrome.storage.local is not available');
  return local as {
    get: (keys?: any) => Promise<Record<string, any>>;
    set: (items: Record<string, any>) => Promise<void>;
    remove: (keys: string | string[]) => Promise<void>;
  };
}

function ensureNonEmpty(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} must not be empty`);
  return trimmed;
}

function ensureMode(mode: string): InterceptionMode {
  if (mode === 'lite' || mode === 'full') return mode;
  throw new Error('Invalid mode');
}

function ensureUuid(): string {
  const cryptoAny = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (!cryptoAny || typeof cryptoAny.randomUUID !== 'function') {
    throw new Error('crypto.randomUUID is not available');
  }
  return cryptoAny.randomUUID();
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const local = getChromeStorageLocal();
  const res = await local.get(key);
  const value = (res as any)[key];
  return (value ?? fallback) as T;
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  const local = getChromeStorageLocal();
  await local.set({ [key]: value });
}

async function getGroupsRaw(): Promise<Group[]> {
  const groups = await readJson<Group[]>(STORAGE_KEYS.groups, []);
  return Array.isArray(groups) ? groups : [];
}

async function setGroupsRaw(groups: Group[]): Promise<void> {
  await writeJson(STORAGE_KEYS.groups, groups);
}

async function getRulesRaw(): Promise<Rule[]> {
  const rules = await readJson<Rule[]>(STORAGE_KEYS.rules, []);
  return Array.isArray(rules) ? rules : [];
}

async function setRulesRaw(rules: Rule[]): Promise<void> {
  await writeJson(STORAGE_KEYS.rules, rules);
}

export async function getRules(): Promise<Rule[]> {
  return await getRulesRaw();
}

export async function getRule(id: string): Promise<Rule | null> {
  const rules = await getRulesRaw();
  return rules.find((r) => r.id === id) ?? null;
}

export type CreateRuleInput = {
  groupId: string;
  name: string;
  urlPattern: string;
  script: string;
  enabled: boolean;
};

export async function createRule(data: CreateRuleInput): Promise<Rule> {
  ensureNonEmpty(data.groupId, 'groupId');
  const name = ensureNonEmpty(data.name, 'name');
  const urlPattern = ensureNonEmpty(data.urlPattern, 'urlPattern');

  const groups = await getGroupsRaw();
  if (!groups.some((g) => g.id === data.groupId)) {
    throw new Error('Group not found');
  }

  const now = Date.now();
  const created: Rule = {
    id: ensureUuid(),
    groupId: data.groupId,
    name,
    urlPattern,
    script: data.script,
    enabled: data.enabled,
    createdAt: now,
    updatedAt: now,
  };

  const rules = await getRulesRaw();
  rules.push(created);
  await setRulesRaw(rules);
  return created;
}

export type UpdateRuleInput = Partial<Pick<Rule, 'groupId' | 'name' | 'urlPattern' | 'script' | 'enabled'>>;

export async function updateRule(id: string, data: UpdateRuleInput): Promise<Rule> {
  const rules = await getRulesRaw();
  const idx = rules.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error('Rule not found');

  if (typeof data.name === 'string') ensureNonEmpty(data.name, 'name');
  if (typeof data.urlPattern === 'string') ensureNonEmpty(data.urlPattern, 'urlPattern');

  if (typeof data.groupId === 'string') {
    ensureNonEmpty(data.groupId, 'groupId');
    const groups = await getGroupsRaw();
    if (!groups.some((g) => g.id === data.groupId)) {
      throw new Error('Group not found');
    }
  }

  const prev = rules[idx];
  const updated: Rule = {
    ...prev,
    ...data,
    name: typeof data.name === 'string' ? data.name.trim() : prev.name,
    urlPattern: typeof data.urlPattern === 'string' ? data.urlPattern.trim() : prev.urlPattern,
    groupId: typeof data.groupId === 'string' ? data.groupId.trim() : prev.groupId,
    updatedAt: Date.now(),
  };

  rules[idx] = updated;
  await setRulesRaw(rules);
  return updated;
}

export async function deleteRule(id: string): Promise<void> {
  const rules = await getRulesRaw();
  const next = rules.filter((r) => r.id !== id);
  await setRulesRaw(next);
}

export async function toggleRule(id: string): Promise<Rule> {
  const existing = await getRule(id);
  if (!existing) throw new Error('Rule not found');
  return await updateRule(id, { enabled: !existing.enabled });
}

export async function getRulesByGroup(groupId: string): Promise<Rule[]> {
  const rules = await getRulesRaw();
  return rules.filter((r) => r.groupId === groupId);
}

export async function getGroups(): Promise<Group[]> {
  return await getGroupsRaw();
}

export type CreateGroupInput = {
  name: string;
  enabled?: boolean;
  order?: number;
};

export async function createGroup(data: CreateGroupInput): Promise<Group> {
  const name = ensureNonEmpty(data.name, 'name');
  const created: Group = {
    id: ensureUuid(),
    name,
    enabled: data.enabled ?? true,
    order: data.order ?? 0,
  };

  const groups = await getGroupsRaw();
  groups.push(created);
  await setGroupsRaw(groups);
  return created;
}

export type UpdateGroupInput = Partial<Pick<Group, 'name' | 'enabled' | 'order'>>;

export async function updateGroup(id: string, data: UpdateGroupInput): Promise<Group> {
  const groups = await getGroupsRaw();
  const idx = groups.findIndex((g) => g.id === id);
  if (idx === -1) throw new Error('Group not found');

  if (typeof data.name === 'string') ensureNonEmpty(data.name, 'name');

  const prev = groups[idx];
  const updated: Group = {
    ...prev,
    ...data,
    name: typeof data.name === 'string' ? data.name.trim() : prev.name,
  };

  groups[idx] = updated;
  await setGroupsRaw(groups);
  return updated;
}

export async function deleteGroup(id: string): Promise<void> {
  const groups = await getGroupsRaw();
  const nextGroups = groups.filter((g) => g.id !== id);
  await setGroupsRaw(nextGroups);

  const rules = await getRulesRaw();
  const nextRules = rules.filter((r) => r.groupId !== id);
  await setRulesRaw(nextRules);
}

export async function toggleGroup(id: string): Promise<Group> {
  const groups = await getGroupsRaw();
  const group = groups.find((g) => g.id === id);
  if (!group) throw new Error('Group not found');
  return await updateGroup(id, { enabled: !group.enabled });
}

export async function exportConfig(): Promise<ExportData> {
  const [groups, rules] = await Promise.all([getGroupsRaw(), getRulesRaw()]);
  return {
    version: EXPORT_VERSION,
    groups,
    rules,
  };
}

function validateImportData(data: ExportData): void {
  if (data.version !== EXPORT_VERSION) throw new Error('Invalid version');
  if (!Array.isArray(data.groups)) throw new Error('Invalid groups');
  if (!Array.isArray(data.rules)) throw new Error('Invalid rules');

  const groupIds = new Set<string>();
  for (const g of data.groups) {
    if (!g || typeof g.id !== 'string') throw new Error('Invalid group');
    groupIds.add(g.id);
    if (typeof g.name !== 'string') throw new Error('Invalid group');
    if (typeof g.enabled !== 'boolean') throw new Error('Invalid group');
    if (typeof g.order !== 'number') throw new Error('Invalid group');
  }

  for (const r of data.rules) {
    if (!r || typeof r.id !== 'string') throw new Error('Invalid rule');
    if (typeof r.groupId !== 'string') throw new Error('Invalid rule');
    if (!groupIds.has(r.groupId)) throw new Error('Invalid rule groupId');
    if (typeof r.name !== 'string') throw new Error('Invalid rule');
    if (typeof r.urlPattern !== 'string') throw new Error('Invalid rule');
    if (typeof r.script !== 'string') throw new Error('Invalid rule');
    if (typeof r.enabled !== 'boolean') throw new Error('Invalid rule');
    if (typeof r.createdAt !== 'number') throw new Error('Invalid rule');
    if (typeof r.updatedAt !== 'number') throw new Error('Invalid rule');
  }
}

export async function importConfig(data: ExportData): Promise<void> {
  validateImportData(data);
  await Promise.all([setGroupsRaw(data.groups), setRulesRaw(data.rules)]);
}

export async function getActiveRules(): Promise<Rule[]> {
  const state = await getGlobalState();
  if (!state.enabled) return [];

  const [groups, rules] = await Promise.all([getGroupsRaw(), getRulesRaw()]);
  const enabledGroupIds = new Set(groups.filter((g) => g.enabled).map((g) => g.id));
  return rules.filter((r) => r.enabled && enabledGroupIds.has(r.groupId));
}

const DEFAULT_GLOBAL_STATE: GlobalState = {
  enabled: true,
  mode: 'lite',
};

export async function getGlobalState(): Promise<GlobalState> {
  const stored = await readJson<Partial<GlobalState> | null>(STORAGE_KEYS.globalState, null);
  if (!stored) return { ...DEFAULT_GLOBAL_STATE };

  const enabled = typeof stored.enabled === 'boolean' ? stored.enabled : DEFAULT_GLOBAL_STATE.enabled;
  const mode =
    typeof stored.mode === 'string' ? ensureMode(stored.mode) : DEFAULT_GLOBAL_STATE.mode;
  return { enabled, mode };
}

export async function setGlobalState(state: Partial<GlobalState>): Promise<GlobalState> {
  const current = await getGlobalState();
  const next: GlobalState = {
    enabled: typeof state.enabled === 'boolean' ? state.enabled : current.enabled,
    mode: typeof state.mode === 'string' ? ensureMode(state.mode) : current.mode,
  };
  await writeJson(STORAGE_KEYS.globalState, next);
  return next;
}
