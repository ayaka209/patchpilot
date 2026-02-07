<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useGlobalState, useLogs } from '../../composables/useBackground';
import { MessageType } from '../../utils/types';
import LanguageSwitcher from '../../components/LanguageSwitcher.vue';

const { state: globalState, toggle: toggleGlobal, switchMode, refresh: refreshState } = useGlobalState();
const { logs, refresh: refreshLogs, clear: clearLogs } = useLogs();

const version = computed(() => chrome.runtime.getManifest().version);
const activeRuleCount = ref(0);

async function fetchActiveRuleCount() {
  try {
    const res = await chrome.runtime.sendMessage({ type: MessageType.GET_ACTIVE_RULES });
    if (res && res.rules) {
      activeRuleCount.value = res.rules.length;
    }
  } catch (e) {
    console.error('Failed to fetch active rules:', e);
  }
}

onMounted(() => {
  refreshState();
  refreshLogs();
  fetchActiveRuleCount();
});

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function truncateUrl(url: string, maxLength: number = 40): string {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength) + '...';
}

function openOptions() {
  chrome.runtime.openOptionsPage();
}

function handleModeSwitch(mode: 'lite' | 'full') {
  switchMode(mode);
}
</script>

<template>
  <div class="popup-container">
    <header class="header">
      <div class="brand">
        <h1>PatchPilot</h1>
        <span class="version">v{{ version }}</span>
      </div>
      <div class="header-actions">
        <LanguageSwitcher />
        <label class="switch">
          <input type="checkbox" :checked="globalState.enabled" @change="toggleGlobal">
          <span class="slider round"></span>
        </label>
      </div>
    </header>

    <div class="status-bar" :class="{ 'is-active': globalState.enabled }">
      <div class="status-indicator">
        <span class="dot" :class="globalState.enabled ? 'green' : 'red'"></span>
        {{ globalState.enabled ? $t('popup.status.active') : $t('popup.status.disabled') }}
      </div>
      <div class="active-count" v-if="globalState.enabled">
        {{ $t('popup.status.rulesActive', { count: activeRuleCount }) }}
      </div>
    </div>

    <div class="mode-switch-container">
      <div class="mode-switch">
        <button 
          class="mode-btn" 
          :class="{ active: globalState.mode === 'lite' }"
          @click="handleModeSwitch('lite')"
        >
          {{ $t('popup.mode.lite') }}
        </button>
        <button 
          class="mode-btn" 
          :class="{ active: globalState.mode === 'full' }"
          @click="handleModeSwitch('full')"
        >
          {{ $t('popup.mode.full') }}
        </button>
      </div>
      <div class="mode-description" v-if="globalState.mode === 'full'">
        <span class="warning-icon">⚠️</span> {{ $t('popup.mode.debugBanner') }}
      </div>
    </div>

    <div class="logs-section">
      <div class="section-header">
        <h2>{{ $t('popup.logs.title') }}</h2>
        <button class="icon-btn" @click="refreshLogs" :title="$t('popup.logs.refresh')">↻</button>
      </div>
      <div class="logs-list">
        <div v-if="logs.length === 0" class="empty-state">
          {{ $t('popup.logs.empty') }}
        </div>
        <div v-else v-for="log in logs" :key="log.id" class="log-entry">
          <div class="log-time">{{ formatTime(log.timestamp) }}</div>
          <div class="log-status">
            <span v-if="log.success" class="success-icon">✓</span>
            <span v-else class="error-icon">✗</span>
          </div>
          <div class="log-details">
            <div class="log-rule">{{ log.ruleName }}</div>
            <div class="log-url" :title="log.url">{{ truncateUrl(log.url) }}</div>
          </div>
        </div>
      </div>
    </div>

    <footer class="footer">
      <button class="btn btn-secondary" @click="clearLogs">{{ $t('popup.logs.clearLogs') }}</button>
      <button class="btn btn-primary" @click="openOptions">{{ $t('popup.actions.openOptions') }}</button>
    </footer>
  </div>
</template>

<style scoped>
:global(body) {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  width: 360px;
  background-color: #f9fafb;
}

.popup-container {
  display: flex;
  flex-direction: column;
  height: 500px;
  background-color: #ffffff;
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #111827;
}

.version {
  font-size: 12px;
  color: #6b7280;
  background-color: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
}

/* Toggle Switch */
.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #e5e7eb;
  transition: .3s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

input:checked + .slider {
  background-color: #10b981;
}

input:checked + .slider:before {
  transform: translateX(20px);
}

/* Status Bar */
.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  font-size: 13px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot.green { background-color: #10b981; }
.dot.red { background-color: #ef4444; }

.active-count {
  color: #6b7280;
}

/* Mode Switch */
.mode-switch-container {
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.mode-switch {
  display: flex;
  background-color: #f3f4f6;
  border-radius: 6px;
  padding: 2px;
}

.mode-btn {
  flex: 1;
  border: none;
  background: none;
  padding: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.mode-btn.active {
  background-color: #ffffff;
  color: #111827;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.mode-description {
  margin-top: 8px;
  font-size: 12px;
  color: #d97706;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Logs Section */
.logs-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px 8px;
}

h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  color: #9ca3af;
  padding: 0;
}

.icon-btn:hover {
  color: #4b5563;
}

.logs-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px;
}

.empty-state {
  text-align: center;
  padding: 32px 0;
  color: #9ca3af;
  font-size: 13px;
}

.log-entry {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
  font-size: 12px;
}

.log-time {
  color: #9ca3af;
  width: 60px;
  flex-shrink: 0;
}

.log-status {
  width: 24px;
  flex-shrink: 0;
  text-align: center;
}

.success-icon { color: #10b981; }
.error-icon { color: #ef4444; }

.log-details {
  flex: 1;
  min-width: 0;
}

.log-rule {
  font-weight: 500;
  color: #111827;
  margin-bottom: 2px;
}

.log-url {
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Footer */
.footer {
  padding: 12px 16px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  background-color: #f9fafb;
}

.btn {
  flex: 1;
  padding: 8px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background-color: #ffffff;
  border: 1px solid #d1d5db;
  color: #374151;
}

.btn-secondary:hover {
  background-color: #f3f4f6;
}

.btn-primary {
  background-color: #111827;
  border: 1px solid #111827;
  color: #ffffff;
}

.btn-primary:hover {
  background-color: #1f2937;
}
</style>
