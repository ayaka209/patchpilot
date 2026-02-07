import { test, expect } from '@playwright/test';
import { launchExtension } from './helpers';

test('diagnostic: extension service worker is discoverable', async () => {
  const launched = await launchExtension();
  try {
    const workers = launched.context.serviceWorkers().map((worker) => worker.url());
    console.log('[patchpilot:e2e] diagnostic workers', workers);
    console.log('[patchpilot:e2e] diagnostic extension id', launched.extensionId);
    expect(workers.length).toBeGreaterThan(0);
  } finally {
    await launched.close();
  }
});
