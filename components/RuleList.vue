<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Rule, Group } from '@/utils/types';
import { deleteRule, toggleRule } from '@/utils/storage';
import { MessageType } from '@/utils/types';

const { t } = useI18n();

const props = defineProps<{
  rules: Rule[];
  groups: Group[];
  selectedGroupId: string | null;
}>();

const emit = defineEmits(['edit-rule', 'add-rule', 'rules-updated']);

const filteredRules = computed(() => {
  if (!props.selectedGroupId) return props.rules;
  return props.rules.filter(r => r.groupId === props.selectedGroupId);
});

const getGroupName = (groupId: string) => {
  const group = props.groups.find(g => g.id === groupId);
  return group ? group.name : t('options.unknownGroup');
};

const handleToggleRule = async (rule: Rule) => {
  try {
    await toggleRule(rule.id);
    emit('rules-updated');
    chrome.runtime.sendMessage({ type: MessageType.RULES_UPDATED });
  } catch (err) {
    console.error('Failed to toggle rule:', err);
  }
};

const handleDeleteRule = async (rule: Rule) => {
  if (!confirm(t('rules.confirmDelete', { name: rule.name }))) {
    return;
  }
  try {
    await deleteRule(rule.id);
    emit('rules-updated');
    chrome.runtime.sendMessage({ type: MessageType.RULES_UPDATED });
  } catch (err) {
    console.error('Failed to delete rule:', err);
    alert(t('rules.deleteFailed', { error: (err as Error).message }));
  }
};
</script>

<template>
  <div class="rule-list-container">
    <div class="header">
      <h2>{{ selectedGroupId ? getGroupName(selectedGroupId) : $t('options.allRules') }}</h2>
      <button @click="$emit('add-rule')" class="btn primary add-btn">
        + {{ $t('rules.addRule') }}
      </button>
    </div>

    <div v-if="filteredRules.length === 0" class="empty-state">
      <p>{{ $t('rules.empty.title') }}</p>
      <p>{{ $t('rules.empty.hint') }}</p>
    </div>

    <div v-else class="rule-list">
      <div 
        v-for="rule in filteredRules" 
        :key="rule.id" 
        class="rule-item"
        :class="{ disabled: !rule.enabled }"
      >
        <div class="rule-main">
          <div class="rule-header">
            <span class="rule-name">{{ rule.name }}</span>
            <span v-if="!selectedGroupId" class="group-badge">
              {{ getGroupName(rule.groupId) }}
            </span>
          </div>
          <div class="rule-pattern" :title="rule.urlPattern">
            {{ rule.urlPattern }}
          </div>
        </div>
        
        <div class="rule-actions">
          <button 
            @click="handleToggleRule(rule)" 
            class="icon-btn toggle"
            :class="{ active: rule.enabled }"
            :title="rule.enabled ? $t('rules.toggle.disable') : $t('rules.toggle.enable')"
          >
            {{ rule.enabled ? $t('rules.toggle.on') : $t('rules.toggle.off') }}
          </button>
          <button @click="$emit('edit-rule', rule)" class="icon-btn edit" :title="$t('rules.actions.edit')">
            {{ $t('rules.actions.edit') }}
          </button>
          <button @click="handleDeleteRule(rule)" class="icon-btn delete" :title="$t('rules.actions.delete')">
            {{ $t('rules.actions.delete') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rule-list-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #eee;
}

h2 {
  margin: 0;
  color: #333;
}

.btn.primary {
  background-color: #2196F3;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn.primary:hover {
  background-color: #1976D2;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #888;
  background: #f9f9f9;
  border-radius: 8px;
  border: 1px dashed #ddd;
}

.rule-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.rule-item {
  background: white;
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: box-shadow 0.2s;
}

.rule-item:hover {
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
}

.rule-item.disabled {
  opacity: 0.7;
  background-color: #fcfcfc;
}

.rule-main {
  flex: 1;
  min-width: 0; /* Allow truncation */
  margin-right: 1rem;
}

.rule-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.rule-name {
  font-weight: 600;
  font-size: 1.05rem;
  color: #333;
}

.group-badge {
  font-size: 0.75rem;
  background-color: #e0e0e0;
  color: #555;
  padding: 0.1rem 0.4rem;
  border-radius: 10px;
}

.rule-pattern {
  font-family: monospace;
  color: #666;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rule-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.icon-btn {
  background: white;
  border: 1px solid #ddd;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.icon-btn:hover {
  background-color: #f5f5f5;
  border-color: #ccc;
}

.icon-btn.toggle {
  min-width: 3rem;
  font-weight: bold;
}

.icon-btn.toggle.active {
  background-color: #e8f5e9;
  color: #2e7d32;
  border-color: #a5d6a7;
}

.icon-btn.delete:hover {
  background-color: #ffebee;
  color: #c62828;
  border-color: #ffcdd2;
}
</style>
