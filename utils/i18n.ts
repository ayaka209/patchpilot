import { createI18n } from 'vue-i18n';
import en from '../locales/en.json';
import zhCN from '../locales/zh-CN.json';

const STORAGE_KEY = 'patchpilot_locale';

function getDefaultLocale(): string {
  const nav = globalThis.navigator;
  if (nav) {
    const lang = nav.language || (nav as any).userLanguage || 'en';
    if (lang.startsWith('zh')) return 'zh-CN';
  }
  return 'en';
}

export const i18n = createI18n({
  legacy: false,
  locale: getDefaultLocale(),
  fallbackLocale: 'en',
  messages: {
    en,
    'zh-CN': zhCN,
  },
});

export async function loadSavedLocale(): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      if (result[STORAGE_KEY]) {
        (i18n.global.locale as any).value = result[STORAGE_KEY];
      }
    }
  } catch {
  }
}

export async function setLocale(locale: string): Promise<void> {
  (i18n.global.locale as any).value = locale;
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [STORAGE_KEY]: locale });
    }
  } catch {
  }
}
