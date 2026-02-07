import { describe, it, expect, beforeEach, vi } from 'vitest';

import { fakeBrowser } from '@webext-core/fake-browser';

import type { ExportData, GlobalState } from '../../utils/types';
import {
  createGroup,
  createRule,
  deleteGroup,
  deleteRule,
  exportConfig,
  getActiveRules,
  getGlobalState,
  getGroups,
  getRule,
  getRules,
  getRulesByGroup,
  importConfig,
  setGlobalState,
  toggleGroup,
  toggleRule,
  updateGroup,
  updateRule,
} from '../../utils/storage';

function stubUuids(...uuids: string[]) {
  const fn = vi.fn();
  for (const id of uuids) fn.mockReturnValueOnce(id);
  vi.stubGlobal('crypto', { randomUUID: fn } as unknown as Crypto);
  return fn;
}

describe('storage layer (chrome.storage.local)', () => {
  beforeEach(() => {
    // Provide the `chrome` global expected by the storage layer.
    // fakeBrowser implements the `browser` API, but is close enough for Promise-based
    // `chrome.storage` usage when assigned to `globalThis.chrome`.
    (globalThis as unknown as { chrome?: unknown }).chrome = fakeBrowser as unknown;
    fakeBrowser.reset();
    vi.restoreAllMocks();
  });

  it('createGroup() creates a group with id + defaults', async () => {
    stubUuids('g1');

    const created = await createGroup({ name: 'Group A', order: 10 });
    expect(created).toEqual({ id: 'g1', name: 'Group A', enabled: true, order: 10 });

    expect(await getGroups()).toEqual([created]);
  });

  it('createGroup() rejects empty name', async () => {
    stubUuids('g1');
    await expect(createGroup({ name: '' })).rejects.toThrow(/name/i);
    await expect(createGroup({ name: '   ' })).rejects.toThrow(/name/i);
  });

  it('updateGroup() updates fields by id', async () => {
    stubUuids('g1');
    await createGroup({ name: 'Old', order: 1, enabled: true });

    const updated = await updateGroup('g1', { name: 'New', order: 99 });
    expect(updated).toEqual({ id: 'g1', name: 'New', enabled: true, order: 99 });
    expect(await getGroups()).toEqual([updated]);
  });

  it('toggleGroup() flips enabled', async () => {
    stubUuids('g1');
    await createGroup({ name: 'G', enabled: true, order: 0 });

    const disabled = await toggleGroup('g1');
    expect(disabled.enabled).toBe(false);

    const enabled = await toggleGroup('g1');
    expect(enabled.enabled).toBe(true);
  });

  it('deleteGroup() removes group and cascades rules', async () => {
    stubUuids('g1', 'r1', 'r2');
    await createGroup({ name: 'G', order: 0 });
    await createRule({
      groupId: 'g1',
      name: 'R1',
      urlPattern: '^https://a$',
      script: '1',
      enabled: true,
    });
    await createRule({
      groupId: 'g1',
      name: 'R2',
      urlPattern: '^https://b$',
      script: '2',
      enabled: true,
    });

    await deleteGroup('g1');
    expect(await getGroups()).toEqual([]);
    expect(await getRules()).toEqual([]);
  });

  it('createRule() creates a rule with timestamps', async () => {
    stubUuids('g1', 'r1');
    vi.spyOn(Date, 'now').mockReturnValue(1111);
    await createGroup({ name: 'G', order: 0 });

    const created = await createRule({
      groupId: 'g1',
      name: 'Rule A',
      urlPattern: '^https://example\\.com$',
      script: 'console.log(1)',
      enabled: true,
    });

    expect(created).toEqual({
      id: 'r1',
      groupId: 'g1',
      name: 'Rule A',
      urlPattern: '^https://example\\.com$',
      script: 'console.log(1)',
      enabled: true,
      createdAt: 1111,
      updatedAt: 1111,
    });
  });

  it('createRule() rejects empty name', async () => {
    stubUuids('g1');
    await createGroup({ name: 'G', order: 0 });

    await expect(
      createRule({
        groupId: 'g1',
        name: '',
        urlPattern: '^x$',
        script: '1',
        enabled: true,
      }),
    ).rejects.toThrow(/name/i);
  });

  it('getRule() returns null for non-existent id', async () => {
    expect(await getRule('missing')).toBeNull();
  });

  it('updateRule() updates fields and bumps updatedAt', async () => {
    stubUuids('g1', 'r1');
    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);
    await createGroup({ name: 'G', order: 0 });

    await createRule({
      groupId: 'g1',
      name: 'Old',
      urlPattern: '^a$',
      script: '1',
      enabled: true,
    });

    const updated = await updateRule('r1', { name: 'New', enabled: false });
    expect(updated.createdAt).toBe(1000);
    expect(updated.updatedAt).toBe(2000);
    expect(updated.name).toBe('New');
    expect(updated.enabled).toBe(false);
  });

  it('toggleRule() flips enabled, rejects missing id', async () => {
    stubUuids('g1', 'r1');
    await createGroup({ name: 'G', order: 0 });
    await createRule({
      groupId: 'g1',
      name: 'R',
      urlPattern: '^a$',
      script: '1',
      enabled: true,
    });

    const disabled = await toggleRule('r1');
    expect(disabled.enabled).toBe(false);

    await expect(toggleRule('missing')).rejects.toThrow(/not found/i);
  });

  it('getRulesByGroup() returns only rules for that group', async () => {
    stubUuids('g1', 'g2', 'r1', 'r2');
    await createGroup({ name: 'G1', order: 0 });
    await createGroup({ name: 'G2', order: 1 });
    await createRule({
      groupId: 'g1',
      name: 'R1',
      urlPattern: '^a$',
      script: '1',
      enabled: true,
    });
    await createRule({
      groupId: 'g2',
      name: 'R2',
      urlPattern: '^b$',
      script: '2',
      enabled: true,
    });

    const g1Rules = await getRulesByGroup('g1');
    expect(g1Rules).toHaveLength(1);
    expect(g1Rules[0].groupId).toBe('g1');
  });

  it('deleteRule() removes a rule', async () => {
    stubUuids('g1', 'r1');
    await createGroup({ name: 'G', order: 0 });
    await createRule({
      groupId: 'g1',
      name: 'R',
      urlPattern: '^a$',
      script: '1',
      enabled: true,
    });

    await deleteRule('r1');
    expect(await getRules()).toEqual([]);
    expect(await getRule('r1')).toBeNull();
  });

  it('exportConfig()/importConfig() round-trip restores groups + rules', async () => {
    stubUuids('g1', 'r1');
    await createGroup({ name: 'G', order: 0, enabled: true });
    await createRule({
      groupId: 'g1',
      name: 'R',
      urlPattern: '^a$',
      script: '1',
      enabled: true,
    });

    const exported = await exportConfig();
    expect(exported.version).toBeTypeOf('number');
    expect(exported.groups).toHaveLength(1);
    expect(exported.rules).toHaveLength(1);

    fakeBrowser.reset();
    await importConfig(exported);
    expect((await exportConfig()).groups).toEqual(exported.groups);
    expect((await exportConfig()).rules).toEqual(exported.rules);
  });

  it('importConfig() validates shape and rejects invalid data', async () => {
    const bad: ExportData = { version: -1, groups: [] as any, rules: [] as any };
    await expect(importConfig(bad)).rejects.toThrow(/version/i);
  });

  it('getActiveRules() returns enabled rules in enabled groups and respects global enabled', async () => {
    stubUuids('g1', 'g2', 'r1', 'r2', 'r3');
    await createGroup({ name: 'G1', enabled: true, order: 0 });
    await createGroup({ name: 'G2', enabled: false, order: 1 });

    await createRule({ groupId: 'g1', name: 'R1', urlPattern: '^a$', script: '1', enabled: true });
    await createRule({ groupId: 'g1', name: 'R2', urlPattern: '^b$', script: '2', enabled: false });
    await createRule({ groupId: 'g2', name: 'R3', urlPattern: '^c$', script: '3', enabled: true });

    await setGlobalState({ enabled: true });
    const active = await getActiveRules();
    expect(active.map((r) => r.name)).toEqual(['R1']);

    await setGlobalState({ enabled: false });
    expect(await getActiveRules()).toEqual([]);
  });

  it('getGlobalState()/setGlobalState() provide defaults and merge partial updates', async () => {
    const defaults = await getGlobalState();
    expect(defaults).toEqual({ enabled: true, mode: 'lite' } satisfies GlobalState);

    const next = await setGlobalState({ mode: 'full' });
    expect(next).toEqual({ enabled: true, mode: 'full' } satisfies GlobalState);
  });
});
