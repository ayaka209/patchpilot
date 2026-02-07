<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { setLocale } from '@/utils/i18n';

const { locale } = useI18n();

function handleChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  setLocale(target.value);
}
</script>

<template>
  <select class="lang-switcher" :value="locale" @change="handleChange">
    <option value="en">EN</option>
    <option value="zh-CN">中文</option>
  </select>
</template>

<style scoped>
.lang-switcher {
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background-color: #fff;
  font-size: 12px;
  color: #374151;
  cursor: pointer;
  outline: none;
}

.lang-switcher:hover {
  border-color: #9ca3af;
}

.lang-switcher:focus {
  border-color: #2196F3;
}
</style>
