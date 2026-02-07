<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Rule, Group } from '@/utils/types';
import { createRule, updateRule } from '@/utils/storage';
import { validatePattern } from '@/utils/matcher';
import { MessageType } from '@/utils/types';

const { t } = useI18n();

const props = defineProps<{
  rule?: Rule | null;
  groups: Group[];
  initialGroupId?: string;
}>();

const emit = defineEmits(['save', 'cancel']);

const formData = ref({
  name: '',
  urlPattern: '',
  script: '',
  groupId: '',
  enabled: true
});

const patternError = ref<string | null>(null);
const isSubmitting = ref(false);

const DEFAULT_SCRIPT = `function(content, url) {
  // Modify content here
  // return content.replace('foo', 'bar');
  return content;
}`;

// Initialize form data
watch(() => props.rule, (newRule) => {
  if (newRule) {
    formData.value = {
      name: newRule.name,
      urlPattern: newRule.urlPattern,
      script: newRule.script,
      groupId: newRule.groupId,
      enabled: newRule.enabled
    };
    validateUrlPattern();
  } else {
    resetForm();
  }
}, { immediate: true });

function resetForm() {
  formData.value = {
    name: '',
    urlPattern: '',
    script: DEFAULT_SCRIPT,
    groupId: props.initialGroupId || (props.groups.length > 0 ? props.groups[0].id : ''),
    enabled: true
  };
  patternError.value = null;
}

const validateUrlPattern = () => {
  if (!formData.value.urlPattern) {
    patternError.value = null;
    return;
  }
  const result = validatePattern(formData.value.urlPattern);
  patternError.value = result.valid ? null : (result.error || t('editor.validation.invalidRegex'));
};

const isValid = computed(() => {
  return (
    formData.value.name.trim() &&
    formData.value.urlPattern.trim() &&
    formData.value.groupId &&
    !patternError.value
  );
});

const handleSave = async () => {
  if (!isValid.value || isSubmitting.value) return;
  
  isSubmitting.value = true;
  try {
    if (props.rule) {
      await updateRule(props.rule.id, {
        name: formData.value.name.trim(),
        urlPattern: formData.value.urlPattern.trim(),
        script: formData.value.script,
        groupId: formData.value.groupId,
        enabled: formData.value.enabled
      });
    } else {
      await createRule({
        name: formData.value.name.trim(),
        urlPattern: formData.value.urlPattern.trim(),
        script: formData.value.script,
        groupId: formData.value.groupId,
        enabled: formData.value.enabled
      });
    }
    chrome.runtime.sendMessage({ type: MessageType.RULES_UPDATED });
    emit('save');
  } catch (err) {
    console.error('Failed to save rule:', err);
    alert(t('editor.saveFailed', { error: (err as Error).message }));
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="rule-editor">
    <div class="header">
      <h2>{{ rule ? $t('editor.titleEdit') : $t('editor.titleAdd') }}</h2>
    </div>
    
    <div class="form-group">
      <label>{{ $t('editor.labels.name') }} <span class="required">*</span></label>
      <input 
        v-model="formData.name" 
        type="text" 
        :placeholder="$t('editor.placeholders.name')"
        class="form-control"
      />
    </div>

    <div class="form-group">
      <label>{{ $t('editor.labels.group') }} <span class="required">*</span></label>
      <select v-model="formData.groupId" class="form-control">
        <option v-for="group in groups" :key="group.id" :value="group.id">
          {{ group.name }}
        </option>
      </select>
    </div>

    <div class="form-group">
      <label>{{ $t('editor.labels.urlPattern') }} <span class="required">*</span></label>
      <div class="input-wrapper">
        <input 
          v-model="formData.urlPattern" 
          type="text" 
          :placeholder="$t('editor.placeholders.urlPattern')"
          class="form-control"
          :class="{ 'is-invalid': patternError, 'is-valid': formData.urlPattern && !patternError }"
          @input="validateUrlPattern"
        />
        <span v-if="formData.urlPattern && !patternError" class="valid-icon">✓</span>
      </div>
      <div v-if="patternError" class="error-message">{{ patternError }}</div>
      <div class="help-text">{{ $t('editor.help.urlPattern') }}</div>
    </div>

    <div class="form-group script-group">
      <label>{{ $t('editor.labels.script') }} <span class="required">*</span></label>
      <textarea 
        v-model="formData.script" 
        class="form-control script-editor"
        spellcheck="false"
      ></textarea>
      <div class="help-text">{{ $t('editor.help.script') }}</div>
    </div>

    <div class="form-group checkbox-group">
      <label>
        <input type="checkbox" v-model="formData.enabled" />
        {{ $t('editor.labels.enableRule') }}
      </label>
    </div>

    <div class="actions">
      <button @click="$emit('cancel')" class="btn secondary">{{ $t('editor.actions.cancel') }}</button>
      <button 
        @click="handleSave" 
        class="btn primary" 
        :disabled="!isValid || isSubmitting"
      >
        {{ isSubmitting ? $t('editor.actions.saving') : $t('editor.actions.save') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.rule-editor {
  padding: 1.5rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  max-width: 800px;
  margin: 0 auto;
}

.header {
  margin-bottom: 1.5rem;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.5rem;
}

h2 {
  margin: 0;
  color: #333;
}

.form-group {
  margin-bottom: 1.2rem;
}

label {
  display: block;
  margin-bottom: 0.4rem;
  font-weight: 500;
  color: #555;
}

.required {
  color: #d32f2f;
}

.form-control {
  width: 100%;
  padding: 0.6rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-control:focus {
  border-color: #2196F3;
  outline: none;
}

.form-control.is-invalid {
  border-color: #d32f2f;
}

.form-control.is-valid {
  border-color: #388E3C;
}

.input-wrapper {
  position: relative;
}

.valid-icon {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #388E3C;
  font-weight: bold;
}

.error-message {
  color: #d32f2f;
  font-size: 0.85rem;
  margin-top: 0.25rem;
}

.help-text {
  color: #888;
  font-size: 0.85rem;
  margin-top: 0.25rem;
}

.script-editor {
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  min-height: 250px;
  line-height: 1.4;
  font-size: 0.9rem;
  background-color: #f8f9fa;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #eee;
}

.btn {
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn.secondary {
  background-color: #e0e0e0;
  color: #333;
}

.btn.secondary:hover {
  background-color: #d5d5d5;
}

.btn.primary {
  background-color: #2196F3;
  color: white;
}

.btn.primary:hover {
  background-color: #1976D2;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
