<script setup lang="ts">
import { ref, defineProps, defineEmits } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Group } from '@/utils/types';
import { createGroup, updateGroup, deleteGroup, toggleGroup } from '@/utils/storage';
import { MessageType } from '@/utils/types';

const { t } = useI18n();

const props = defineProps<{
  groups: Group[];
}>();

const emit = defineEmits(['groups-updated', 'select-group']);

const newGroupName = ref('');
const editingGroupId = ref<string | null>(null);
const editingName = ref('');

const handleAddGroup = async () => {
  if (!newGroupName.value.trim()) return;
  try {
    await createGroup({ name: newGroupName.value.trim() });
    newGroupName.value = '';
    emit('groups-updated');
    chrome.runtime.sendMessage({ type: MessageType.RULES_UPDATED });
  } catch (err) {
    console.error('Failed to create group:', err);
    alert(t('groups.createFailed', { error: (err as Error).message }));
  }
};

const handleToggleGroup = async (group: Group) => {
  try {
    await toggleGroup(group.id);
    emit('groups-updated');
    chrome.runtime.sendMessage({ type: MessageType.RULES_UPDATED });
  } catch (err) {
    console.error('Failed to toggle group:', err);
  }
};

const startEditing = (group: Group) => {
  editingGroupId.value = group.id;
  editingName.value = group.name;
};

const saveEditing = async () => {
  if (!editingGroupId.value || !editingName.value.trim()) return;
  try {
    await updateGroup(editingGroupId.value, { name: editingName.value.trim() });
    editingGroupId.value = null;
    editingName.value = '';
    emit('groups-updated');
    chrome.runtime.sendMessage({ type: MessageType.RULES_UPDATED });
  } catch (err) {
    console.error('Failed to update group:', err);
    alert(t('groups.updateFailed', { error: (err as Error).message }));
  }
};

const cancelEditing = () => {
  editingGroupId.value = null;
  editingName.value = '';
};

const handleDeleteGroup = async (group: Group) => {
  if (!confirm(t('groups.confirmDelete', { name: group.name }))) {
    return;
  }
  try {
    await deleteGroup(group.id);
    emit('groups-updated');
    chrome.runtime.sendMessage({ type: MessageType.RULES_UPDATED });
  } catch (err) {
    console.error('Failed to delete group:', err);
    alert(t('groups.deleteFailed', { error: (err as Error).message }));
  }
};

const selectGroup = (groupId: string) => {
  emit('select-group', groupId);
};
</script>

<template>
  <div class="group-manager">
    <h3>{{ $t('groups.title') }}</h3>
    <ul class="group-list">
      <li 
        v-for="group in groups" 
        :key="group.id" 
        class="group-item"
        @click="selectGroup(group.id)"
      >
        <div v-if="editingGroupId === group.id" class="edit-mode">
          <input 
            v-model="editingName" 
            @keyup.enter="saveEditing" 
            @keyup.esc="cancelEditing"
            class="edit-input"
            ref="editInput"
          />
          <button @click.stop="saveEditing" class="icon-btn save" :title="$t('groups.actions.save')">✓</button>
          <button @click.stop="cancelEditing" class="icon-btn cancel" :title="$t('groups.actions.cancel')">✕</button>
        </div>
        <div v-else class="view-mode">
          <span class="group-name" :class="{ disabled: !group.enabled }">{{ group.name }}</span>
          <div class="actions">
            <button @click.stop="handleToggleGroup(group)" class="icon-btn toggle" :title="group.enabled ? $t('groups.actions.disable') : $t('groups.actions.enable')">
              {{ group.enabled ? '🟢' : '⚪' }}
            </button>
            <button @click.stop="startEditing(group)" class="icon-btn edit" :title="$t('groups.actions.edit')">✎</button>
            <button @click.stop="handleDeleteGroup(group)" class="icon-btn delete" :title="$t('groups.actions.delete')">🗑</button>
          </div>
        </div>
      </li>
    </ul>
    <div class="add-group">
      <input 
        v-model="newGroupName" 
        :placeholder="$t('groups.placeholder')" 
        @keyup.enter="handleAddGroup"
        class="add-input"
      />
      <button @click="handleAddGroup" class="add-btn" :disabled="!newGroupName.trim()">+</button>
    </div>
  </div>
</template>

<style scoped>
.group-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
}

h3 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  color: #333;
  padding: 0 0.5rem;
}

.group-list {
  list-style: none;
  padding: 0;
  margin: 0;
  flex: 1;
  overflow-y: auto;
}

.group-item {
  padding: 0.5rem;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background-color 0.2s;
}

.group-item:hover {
  background-color: #f0f0f0;
}

.view-mode, .edit-mode {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.group-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 0.5rem;
}

.group-name.disabled {
  color: #999;
  text-decoration: line-through;
}

.actions {
  display: flex;
  gap: 0.25rem;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.group-item:hover .actions {
  opacity: 1;
}

.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 0.2rem;
  border-radius: 4px;
}

.icon-btn:hover {
  background-color: #e0e0e0;
}

.icon-btn.delete:hover {
  background-color: #ffebee;
  color: #c62828;
}

.add-group {
  padding: 1rem 0.5rem;
  border-top: 1px solid #ddd;
  display: flex;
  gap: 0.5rem;
}

.add-input, .edit-input {
  flex: 1;
  padding: 0.4rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.add-btn {
  padding: 0 0.8rem;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1.2rem;
}

.add-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.add-btn:hover:not(:disabled) {
  background-color: #45a049;
}
</style>
