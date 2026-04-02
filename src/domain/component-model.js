function toPascalCase(value) {
  return String(value || 'GeneratedPage')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function createComponentModel(pageComponentName, kind, items, propsSpec, emits) {
  const suffixMap = {
    header: 'HeaderSection',
    filters: 'FiltersPanel',
    table: 'TableSection',
    dialog: 'DialogPanel',
    media: 'MediaPanel',
  };
  const fileStem = `${pageComponentName}${suffixMap[kind] || 'Section'}`;
  return {
    kind,
    name: fileStem,
    fileName: `${fileStem}.vue`,
    importName: fileStem,
    importPath: `../components/${fileStem}.vue`,
    propsSpec,
    emits,
    itemCount: items.length,
    items: items.slice(0, 12).map((item) => ({
      cid: item?.cid ?? null,
      label: item?.text || item?.display_name || item?.name || item?.cid || 'unnamed',
      normalizedType: item?.normalizedType ?? null,
    })),
  };
}

export function buildComponentModels(scaffold, ctx) {
  const { componentName, typeNames } = ctx;
  const pageComponentName = `${toPascalCase(componentName || scaffold.page?.name || 'GeneratedPage')}Page`;
  const components = [];
  const typesFile = `../types/${ctx.routeName}.types`;

  const regionDefinitions = [
    {
      enabled: (scaffold.regions?.header ?? []).length > 0,
      kind: 'header',
      items: scaffold.regions?.header ?? [],
      propsSpec: [
        { name: 'title', tsType: 'string' },
        { name: 'subtitle', tsType: 'string | null' },
      ],
      emits: [],
    },
    {
      enabled: Boolean(scaffold.suggestedComponents?.filters),
      kind: 'filters',
      items: scaffold.regions?.filters ?? [],
      propsSpec: [
        {
          name: 'modelValue',
          tsType: typeNames.filterForm,
          importPath: typesFile,
          importName: typeNames.filterForm,
        },
      ],
      emits: ['search', 'reset', 'update:modelValue'],
    },
    {
      enabled: Boolean(scaffold.suggestedComponents?.table),
      kind: 'table',
      items: scaffold.regions?.tables ?? [],
      propsSpec: [
        {
          name: 'rows',
          tsType: `${typeNames.tableRow}[]`,
          importPath: typesFile,
          importName: typeNames.tableRow,
        },
        { name: 'loading', tsType: 'boolean' },
      ],
      emits: ['refresh', 'row-click'],
    },
    {
      enabled: Boolean(scaffold.suggestedComponents?.dialog),
      kind: 'dialog',
      items: scaffold.regions?.dialogs ?? [],
      propsSpec: [
        { name: 'modelValue', tsType: 'boolean' },
        {
          name: 'form',
          tsType: typeNames.dialogForm,
          importPath: typesFile,
          importName: typeNames.dialogForm,
        },
      ],
      emits: ['submit', 'cancel', 'update:modelValue'],
    },
    {
      enabled: Boolean(scaffold.suggestedComponents?.imageAssets),
      kind: 'media',
      items: scaffold.regions?.media ?? [],
      propsSpec: [
        {
          name: 'items',
          tsType: 'Array<{ cid: string | null; label: string }>',
        },
      ],
      emits: ['select'],
    },
  ];

  for (const definition of regionDefinitions) {
    if (!definition.enabled) continue;
    components.push(
      createComponentModel(
        pageComponentName,
        definition.kind,
        definition.items,
        definition.propsSpec,
        definition.emits,
      ),
    );
  }

  return components;
}
