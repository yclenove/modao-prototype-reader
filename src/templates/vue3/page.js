function renderRegion(title, items, emptyText) {
  if (!items.length) {
    return `      <section class="panel">\n        <h2>${title}</h2>\n        <p class="empty">${emptyText}</p>\n      </section>`;
  }

  const list = items
    .slice(0, 8)
    .map((item) => {
      const label = item.text || item.display_name || item.name || item.cid || 'unnamed';
      return `          <li>${String(label).replace(/</g, '&lt;')}</li>`;
    })
    .join('\n');

  return `      <section class="panel">\n        <h2>${title}</h2>\n        <ul>\n${list}\n        </ul>\n      </section>`;
}

export function renderVuePage(model) {
  const sections = [
    model.flags.hasFilters
      ? renderRegion('筛选区', model.regions.filters, '暂无筛选项')
      : renderRegion('筛选区', [], '该页面没有识别出筛选区域'),
    model.flags.hasTable
      ? renderRegion('表格区', model.regions.tables, '暂无表格项')
      : renderRegion('表格区', [], '该页面没有识别出表格区域'),
    model.flags.hasDialog
      ? renderRegion('弹窗区', model.regions.dialogs, '暂无弹窗项')
      : renderRegion('弹窗区', [], '该页面没有识别出弹窗区域'),
  ].join('\n');

  return `<script setup lang="ts">
import { computed } from 'vue';
import { create${model.meta.componentName}MockState } from './${model.meta.componentName}.mock';
import type { ${model.meta.componentName}State } from './${model.meta.componentName}.types';

const state = create${model.meta.componentName}MockState();

const pageTitle = computed(() => state.pageTitle);
</script>

<template>
  <div class="${model.meta.routeName}-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">Generated From Modao Scaffold</p>
        <h1>{{ pageTitle }}</h1>
      </div>
      <p class="meta">Viewport: ${model.meta.width ?? '-'} x ${model.meta.height ?? '-'}</p>
    </header>

    <main class="page-content">
${sections}
    </main>
  </div>
</template>

<style scoped>
.${model.meta.routeName}-page {
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
`;
}
