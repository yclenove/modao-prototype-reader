function escapeHtml(value) {
  return String(value).replace(/</g, '&lt;');
}

function renderList(items, emptyText) {
  if (!items.length) {
    return `    <p class="empty">${emptyText}</p>`;
  }

  return `    <ul>\n${items
    .map((item) => `      <li>${escapeHtml(item.label)}</li>`)
    .join('\n')}\n    </ul>`;
}

function collectTypeImports(component) {
  const paths = new Map();
  for (const spec of component.propsSpec || []) {
    if (spec.importPath && spec.importName) {
      if (!paths.has(spec.importPath)) paths.set(spec.importPath, new Set());
      paths.get(spec.importPath).add(spec.importName);
    }
  }
  const lines = [];
  for (const [importPath, names] of paths) {
    lines.push(`import type { ${Array.from(names).join(', ')} } from '${importPath}';`);
  }
  return lines.join('\n');
}

function renderPropsBlock(component) {
  if (!component.propsSpec?.length) return '';
  const body = component.propsSpec
    .map((spec) => `  ${spec.name}: ${spec.tsType};`)
    .join('\n');
  return `const props = defineProps<{\n${body}\n}>();\n`;
}

function renderEmitsBlock(component, model) {
  if (!component.emits?.length) return '';
  const lines = [];
  for (const event of component.emits) {
    if (event === 'update:modelValue') {
      const valueType =
        component.kind === 'filters'
          ? model.typeNames.filterForm
          : 'boolean';
      lines.push(`  (e: 'update:modelValue', value: ${valueType}): void;`);
    } else if (event === 'row-click') {
      lines.push(`  (e: 'row-click', row: ${model.typeNames.tableRow}): void;`);
    } else if (event === 'submit' && component.kind === 'dialog') {
      lines.push(`  (e: 'submit', payload: ${model.typeNames.dialogForm}): void;`);
    } else if (event === 'select' && component.kind === 'media') {
      lines.push(`  (e: 'select', item: { cid: string | null; label: string }): void;`);
    } else {
      lines.push(`  (e: '${event}'): void;`);
    }
  }
  return `const emit = defineEmits<{\n${lines.join('\n')}\n}>();\n`;
}

function renderTemplateByKind(component) {
  if (component.kind === 'filters') {
    return `  <section class="panel filters-panel">
    <div class="panel-header">
      <h2>Filters</h2>
      <div class="actions">
        <button type="button" @click="emit('search')">Search</button>
        <button type="button" class="ghost" @click="emit('reset')">Reset</button>
      </div>
    </div>
    <label class="field">
      <span>Keyword</span>
      <input
        type="text"
        :value="props.modelValue.keyword"
        @input="onKeywordInput"
      />
    </label>
    <label class="field">
      <span>Status</span>
      <select :value="props.modelValue.status" @change="onStatusChange">
        <option value="all">All</option>
        <option value="active">Active</option>
        <option value="draft">Draft</option>
      </select>
    </label>
${renderList(component.items, 'No extra filter controls listed in the scaffold.')}
  </section>`;
  }

  if (component.kind === 'table') {
    return `  <section class="panel table-panel">
    <div class="panel-header">
      <h2>Table</h2>
      <button type="button" :disabled="props.loading" @click="emit('refresh')">Refresh</button>
    </div>
    <p v-if="props.loading" class="hint">Loading…</p>
    <table v-else class="data-table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in props.rows" :key="row.id" @click="emit('row-click', row)">
          <td>{{ row.title }}</td>
          <td>{{ row.status }}</td>
        </tr>
      </tbody>
    </table>
    <template v-if="!props.loading && !props.rows.length">
${renderList(component.items, 'Scaffold referenced a table region; wire columns from export.json.')}
    </template>
  </section>`;
  }

  if (component.kind === 'dialog') {
    return `  <section v-if="props.modelValue" class="panel dialog-panel">
    <div class="panel-header">
      <h2>Dialog</h2>
      <button type="button" @click="emit('cancel')">Close</button>
    </div>
    <label class="field">
      <span>Title</span>
      <input type="text" v-model="localTitle" />
    </label>
    <label class="field">
      <span>Remark</span>
      <textarea v-model="localRemark" rows="3" />
    </label>
    <div class="actions">
      <button type="button" @click="submit">Submit</button>
    </div>
${renderList(component.items, 'No dialog widgets listed in the scaffold.')}
  </section>`;
  }

  if (component.kind === 'media') {
    return `  <section class="panel media-panel">
    <div class="panel-header">
      <h2>Media</h2>
    </div>
    <ul class="media-list">
      <li v-for="item in props.items" :key="item.cid || item.label">
        <button type="button" class="linkish" @click="emit('select', item)">{{ item.label }}</button>
      </li>
    </ul>
${renderList(component.items, 'No media widgets listed in the scaffold.')}
  </section>`;
  }

  return `  <section class="panel">
    <div class="panel-header">
      <h2>Header</h2>
    </div>
    <div class="header-copy">
      <h3>{{ props.title }}</h3>
      <p v-if="props.subtitle" class="subtitle">{{ props.subtitle }}</p>
    </div>
${renderList(component.items, 'No header widgets listed in the scaffold.')}
  </section>`;
}

function renderExtraScript(component) {
  if (component.kind === 'filters') {
    return `function onKeywordInput(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', { ...props.modelValue, keyword: target.value });
}

function onStatusChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  emit('update:modelValue', { ...props.modelValue, status: target.value });
}
`;
  }
  if (component.kind === 'dialog') {
    return `const localTitle = ref(props.form.title);
const localRemark = ref(props.form.remark);

watch(
  () => props.form,
  (next) => {
    localTitle.value = next.title;
    localRemark.value = next.remark;
  },
  { deep: true },
);

function submit() {
  emit('submit', { title: localTitle.value, remark: localRemark.value });
}
`;
  }
  return '';
}

function normalizePropsSpecForImports(component, model) {
  const typesFile = `../types/${model.meta.routeName}.types`;
  return (component.propsSpec || []).map((spec) => {
    if (spec.importPath) return spec;
    const needsFilter = spec.tsType === model.typeNames.filterForm;
    const needsRow = spec.tsType?.includes(model.typeNames.tableRow);
    const needsDialog = spec.tsType === model.typeNames.dialogForm;
    if (needsFilter) {
      return { ...spec, importPath: typesFile, importName: model.typeNames.filterForm };
    }
    if (needsRow) {
      return { ...spec, importPath: typesFile, importName: model.typeNames.tableRow };
    }
    if (needsDialog) {
      return { ...spec, importPath: typesFile, importName: model.typeNames.dialogForm };
    }
    return spec;
  });
}

export function renderVueComponent(model, component) {
  const enriched = { ...component, propsSpec: normalizePropsSpecForImports(component, model) };
  const typeImports = collectTypeImports(enriched);
  const propsBlock = renderPropsBlock(enriched);
  const emitsBlock = renderEmitsBlock(enriched, model);
  const extraScript = renderExtraScript(enriched);
  const vueImports =
    component.kind === 'dialog'
      ? `import { ref, watch } from 'vue';\n`
      : component.kind === 'filters'
        ? ''
        : '';

  const scriptBody = [
    typeImports ? `${typeImports}\n` : '',
    vueImports,
    propsBlock,
    emitsBlock,
    extraScript,
  ]
    .filter(Boolean)
    .join('');

  return `<script setup lang="ts">
${scriptBody}</script>

<template>
${renderTemplateByKind(enriched)}
</template>

<style scoped>
.panel {
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 16px;
  padding: 16px;
  background: rgba(15, 23, 42, 0.78);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.actions {
  display: flex;
  gap: 8px;
}

button {
  border: 0;
  border-radius: 10px;
  padding: 8px 12px;
  color: #e2e8f0;
  background: #2563eb;
}

button.ghost {
  background: rgba(148, 163, 184, 0.2);
}

button.linkish {
  background: transparent;
  color: #93c5fd;
  padding: 0;
}

.field {
  display: grid;
  gap: 6px;
  margin-top: 12px;
}

input,
select,
textarea {
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  padding: 8px 10px;
  background: rgba(15, 23, 42, 0.6);
  color: #e2e8f0;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
}

.data-table th,
.data-table td {
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  padding: 8px;
  text-align: left;
}

.media-list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.hint {
  margin-top: 8px;
  color: #94a3b8;
}

.header-copy h3 {
  margin: 0;
}

.subtitle {
  margin: 6px 0 0;
  color: #94a3b8;
}

ul {
  margin: 12px 0 0;
  padding-left: 18px;
}

.empty {
  margin: 12px 0 0;
  color: #94a3b8;
}
</style>
`;
}
