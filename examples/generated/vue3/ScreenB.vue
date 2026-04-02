<script setup lang="ts">
import { computed } from 'vue';
import { createScreenBMockState } from './ScreenB.mock';
import type { ScreenBState } from './ScreenB.types';

const state = createScreenBMockState();

const pageTitle = computed(() => state.pageTitle);
</script>

<template>
  <div class="screen-b-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">Generated From Modao Scaffold</p>
        <h1>{{ pageTitle }}</h1>
      </div>
      <p class="meta">Viewport: 1440 x 900</p>
    </header>

    <main class="page-content">
      <section class="panel">
        <h2>筛选区</h2>
        <ul>
          <li>Query</li>
        </ul>
      </section>
      <section class="panel">
        <h2>表格区</h2>
        <ul>
          <li>w2</li>
        </ul>
      </section>
      <section class="panel">
        <h2>弹窗区</h2>
        <ul>
          <li>w3</li>
        </ul>
      </section>
    </main>
  </div>
</template>

<style scoped>
.screen-b-page {
  display: grid;
  gap: 16px;
  padding: 24px;
  color: #e7eefc;
  background: #0b1220;
}

.page-header,
.panel {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
}

.page-content {
  display: grid;
  gap: 16px;
}

.eyebrow,
.meta,
.empty {
  color: #8ea4c5;
}

ul {
  margin: 12px 0 0;
  padding-left: 20px;
}
</style>
