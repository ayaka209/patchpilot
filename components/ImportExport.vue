<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { exportConfig, importConfig } from '@/utils/storage';
import { MessageType } from '@/utils/types';

const { t } = useI18n();

const fileInput = ref<HTMLInputElement | null>(null);
const message = ref('');
const messageType = ref<'success' | 'error'>('success');

const handleExport = async () => {
  try {
    const data = await exportConfig();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patchpilot-config-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showMessage(t('importExport.exportSuccess'), 'success');
  } catch (err) {
    console.error('Export failed:', err);
    showMessage(t('importExport.exportFailed', { error: (err as Error).message }), 'error');
  }
};

const triggerImport = () => {
  fileInput.value?.click();
};

const handleImport = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (!confirm(t('importExport.confirmImport'))) {
    target.value = '';
    return;
  }

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await importConfig(data);
    chrome.runtime.sendMessage({ type: MessageType.RULES_UPDATED });
    showMessage(t('importExport.importSuccess'), 'success');
    // Emit event to parent to reload data
    emit('config-imported');
  } catch (err) {
    console.error('Import failed:', err);
    showMessage(t('importExport.importFailed', { error: (err as Error).message }), 'error');
  } finally {
    target.value = '';
  }
};

const showMessage = (msg: string, type: 'success' | 'error') => {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => {
    message.value = '';
  }, 3000);
};

const emit = defineEmits(['config-imported']);
</script>

<template>
  <div class="import-export">
    <div class="actions">
      <button @click="handleExport" class="btn">{{ $t('importExport.export') }}</button>
      <button @click="triggerImport" class="btn">{{ $t('importExport.import') }}</button>
      <input
        ref="fileInput"
        type="file"
        accept=".json"
        class="hidden"
        @change="handleImport"
      />
    </div>
    <div v-if="message" :class="['message', messageType]">
      {{ message }}
    </div>
  </div>
</template>

<style scoped>
.import-export {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  background-color: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.btn:hover {
  background-color: #f5f5f5;
  border-color: #ccc;
}

.hidden {
  display: none;
}

.message {
  font-size: 0.9rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.message.success {
  color: #155724;
  background-color: #d4edda;
}

.message.error {
  color: #721c24;
  background-color: #f8d7da;
}
</style>
