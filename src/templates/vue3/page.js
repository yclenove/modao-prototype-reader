function renderComponentUsageLine(component) {
  const name = component.importName;
  switch (component.kind) {
    case 'header':
      return `      <${name} :title="state.pageTitle" :subtitle="state.routeName" />`;
    case 'filters':
      return `      <${name} v-model="state.filters" @search="onFiltersSearch" @reset="onFiltersReset" />`;
    case 'table':
      return `      <${name} :rows="state.rows" :loading="tableLoading" @refresh="onTableRefresh" @row-click="onRowClick" />`;
    case 'dialog':
      return `      <${name} v-model="state.dialogVisible" :form="dialogForm" @submit="onDialogSubmit" @cancel="onDialogCancel" />`;
    case 'media':
      return `      <${name} :items="mediaItems" @select="onMediaSelect" />`;
    default:
      return `      <${name} />`;
  }
}

function buildMediaSeed(model) {
  const items = (model.regions.media || []).slice(0, 12).map((w) => ({
    cid: w?.cid ?? null,
    label: String(w?.text || w?.display_name || w?.name || w?.cid || 'item'),
  }));
  return JSON.stringify(items);
}

export function renderVuePage(model) {
  const comps = model.components;
  const hasFilters = comps.some((c) => c.kind === 'filters');
  const hasTable = comps.some((c) => c.kind === 'table');
  const hasDialog = comps.some((c) => c.kind === 'dialog');
  const hasMedia = comps.some((c) => c.kind === 'media');
  const needsTableLoading = hasTable || hasFilters;

  const componentImports = comps
    .map((c) => `import ${c.importName} from '../components/${c.name}.vue';`)
    .join('\n');

  const componentSections = comps.length
    ? comps.map((c) => renderComponentUsageLine(c)).join('\n')
    : '      <section class="empty-state">No child components were planned from this scaffold.</section>';

  const typeImport = hasDialog
    ? `import type { ${model.typeNames.dialogForm} } from '../types/${model.meta.routeName}.types';`
    : '';

  const filterDefaultsFn = `create${model.meta.componentName}FilterDefaults`;
  const mockStateFn = `create${model.meta.componentName}MockState`;
  const listFn = model.api.listFunctionName;

  const mockImportNames = [mockStateFn];
  if (hasFilters) mockImportNames.push(filterDefaultsFn);

  const decls = [`const state = ${mockStateFn}();`];
  if (needsTableLoading) decls.push('const tableLoading = ref(false);');
  if (hasDialog) {
    decls.push(`const dialogForm = ref<${model.typeNames.dialogForm}>({ title: '', remark: '' });`);
  }
  if (hasMedia) decls.push(`const mediaItems = ref(${buildMediaSeed(model)});`);

  decls.push('const pageTitle = computed(() => state.pageTitle);');

  const fns = [];
  if (hasFilters) {
    fns.push(`async function onFiltersSearch() {
  tableLoading.value = true;
  try {
    await ${listFn}({
      keyword: state.filters.keyword,
      page: 1,
      pageSize: 20,
    });
  } finally {
    tableLoading.value = false;
  }
}`);

    fns.push(`function onFiltersReset() {
  state.filters = ${filterDefaultsFn}();
}`);
  }

  if (hasTable) {
    if (hasFilters) {
      fns.push(`async function onTableRefresh() {
  await onFiltersSearch();
}`);
    } else {
      fns.push(`async function onTableRefresh() {
  tableLoading.value = true;
  try {
    await ${listFn}({ page: 1, pageSize: 20 });
  } finally {
    tableLoading.value = false;
  }
}`);
    }
  }

  if (hasTable) {
    if (hasDialog) {
      fns.push(`function onRowClick() {
  state.dialogVisible = true;
}`);
    } else {
      fns.push(`function onRowClick() {
  void 0;
}`);
    }
  }

  if (hasDialog) {
    fns.push(`function onDialogSubmit(payload: ${model.typeNames.dialogForm}) {
  void payload;
  state.dialogVisible = false;
}`);

    fns.push(`function onDialogCancel() {
  state.dialogVisible = false;
}`);
  }

  if (hasMedia) {
    fns.push(`function onMediaSelect(item: { cid: string | null; label: string }) {
  void item;
}`);
  }

  const listUsed = hasFilters || hasTable;

  const scriptLines = [];
  if (typeImport) scriptLines.push(typeImport);
  scriptLines.push(`import { computed, ref } from 'vue';`);
  scriptLines.push(
    `import { ${mockImportNames.join(', ')} } from '../mock/${model.meta.routeName}.mock';`,
  );
  scriptLines.push(`import { ${listFn} } from '../api/${model.meta.routeName}.api';`);
  if (componentImports) scriptLines.push(componentImports);
  scriptLines.push('');
  scriptLines.push(...decls);
  if (fns.length) {
    scriptLines.push('');
    scriptLines.push(...fns);
  }
  if (!listUsed) {
    scriptLines.push('');
    scriptLines.push(`void ${listFn};`);
  }

  return `<script setup lang="ts">
${scriptLines.join('\n')}
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
${componentSections}
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
.meta {
  color: #8ea4c5;
}

.empty-state {
  border: 1px dashed rgba(148, 163, 184, 0.35);
  border-radius: 16px;
  padding: 24px;
  color: #94a3b8;
}
</style>
`;
}
