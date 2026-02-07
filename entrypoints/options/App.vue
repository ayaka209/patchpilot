<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import type { Rule, Group } from '@/utils/types';
import { getGroups, getRules } from '@/utils/storage';
import { MessageType } from '@/utils/types';
import GroupManager from '@/components/GroupManager.vue';
import RuleList from '@/components/RuleList.vue';
import RuleEditor from '@/components/RuleEditor.vue';
import ImportExport from '@/components/ImportExport.vue';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';

const groups = ref<Group[]>([]);
const rules = ref<Rule[]>([]);
const selectedGroupId = ref<string | null>(null);
const view = ref<'list' | 'editor'>('list');
const editingRule = ref<Rule | null>(null);

const loadData = async () => {
  try {
    const [g, r] = await Promise.all([getGroups(), getRules()]);
    groups.value = g.sort((a, b) => a.order - b.order);
    rules.value = r;
  } catch (err) {
    console.error('Failed to load data:', err);
  }
};

onMounted(() => {
  loadData();
  
  // Listen for updates from other parts of the extension
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === MessageType.RULES_UPDATED) {
      loadData();
    }
  });
});

const handleGroupSelect = (groupId: string) => {
  selectedGroupId.value = groupId;
  view.value = 'list';
  editingRule.value = null;
};

const handleAddRule = () => {
  editingRule.value = null;
  view.value = 'editor';
};

const handleEditRule = (rule: Rule) => {
  editingRule.value = rule;
  view.value = 'editor';
};

const handleSaveRule = () => {
  view.value = 'list';
  editingRule.value = null;
  loadData();
};

const handleCancelRule = () => {
  view.value = 'list';
  editingRule.value = null;
};

const handleGroupsUpdated = () => {
  loadData();
};
</script>

<template>
  <div class="app-container">
    <header class="top-bar">
      <div class="logo">
        <h1>{{ $t('app.options') }}</h1>
      </div>
      <div class="top-actions">
        <ImportExport @config-imported="loadData" />
        <LanguageSwitcher />
      </div>
    </header>
    
    <div class="main-content">
      <aside class="sidebar">
        <div class="sidebar-header" @click="selectedGroupId = null; view = 'list'">
          <span :class="{ active: selectedGroupId === null }">{{ $t('options.allRules') }}</span>
        </div>
        <GroupManager 
          :groups="groups" 
          @groups-updated="handleGroupsUpdated"
          @select-group="handleGroupSelect"
        />
      </aside>
      
      <main class="content-area">
        <RuleList 
          v-if="view === 'list'"
          :rules="rules"
          :groups="groups"
          :selected-group-id="selectedGroupId"
          @add-rule="handleAddRule"
          @edit-rule="handleEditRule"
          @rules-updated="loadData"
        />
        
        <RuleEditor 
          v-else
          :rule="editingRule"
          :groups="groups"
          :initial-group-id="selectedGroupId || ''"
          @save="handleSaveRule"
          @cancel="handleCancelRule"
        />
      </main>
    </div>
  </div>
</template>

<style>
/* Global Reset & Base Styles */
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  background-color: #f5f5f5;
  color: #333;
  height: 100vh;
  overflow: hidden;
}

#app {
  height: 100%;
}
</style>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 1200px;
  margin: 0 auto;
  background-color: white;
  box-shadow: 0 0 20px rgba(0,0,0,0.05);
}

.top-bar {
  height: 60px;
  background-color: #fff;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 1.5rem;
}

.logo h1 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
  color: #2c3e50;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar {
  width: 250px;
  background-color: #f8f9fa;
  border-right: 1px solid #eee;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.sidebar-header {
  padding: 1rem;
  cursor: pointer;
  font-weight: 600;
  border-bottom: 1px solid #eee;
}

.sidebar-header span.active {
  color: #2196F3;
}

.content-area {
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
  background-color: #fff;
}
</style>
