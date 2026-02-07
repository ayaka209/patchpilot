import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'PatchPilot',
    description: 'Dynamic override for web resources via URL pattern matching and user scripts',
    permissions: ['storage', 'scripting', 'webNavigation', 'tabs', 'debugger'],
    host_permissions: ['*://*/*'],
  },
});
