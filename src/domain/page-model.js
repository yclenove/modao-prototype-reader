function toPascalCase(value) {
  return String(value || 'GeneratedPage')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function toKebabCase(value) {
  return String(value || 'generated-page')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function summarizeCollection(items, key) {
  return (items || [])
    .map((item) => item?.[key])
    .filter(Boolean)
    .slice(0, 20);
}

export function buildPageModelFromScaffold(scaffold, options = {}) {
  const pageName = scaffold.page?.name || options.name || 'Generated Page';
  const componentName = toPascalCase(options.componentName || pageName);
  const fileName = `${componentName}.vue`;
  const routeName = toKebabCase(options.routeName || pageName);

  return {
    meta: {
      pageName,
      componentName,
      fileName,
      routeName,
      width: scaffold.page?.width ?? null,
      height: scaffold.page?.height ?? null,
    },
    regions: {
      header: scaffold.regions?.header ?? [],
      filters: scaffold.regions?.filters ?? [],
      tables: scaffold.regions?.tables ?? [],
      dialogs: scaffold.regions?.dialogs ?? [],
      media: scaffold.regions?.media ?? [],
    },
    flags: {
      hasHeader: (scaffold.regions?.header ?? []).length > 0,
      hasFilters: (scaffold.regions?.filters ?? []).length > 0,
      hasTable: (scaffold.regions?.tables ?? []).length > 0,
      hasDialog: (scaffold.regions?.dialogs ?? []).length > 0,
      hasMedia: (scaffold.regions?.media ?? []).length > 0,
    },
    texts: {
      filters: summarizeCollection(scaffold.regions?.filters, 'text'),
      dialogs: summarizeCollection(scaffold.regions?.dialogs, 'display_name'),
      media: summarizeCollection(scaffold.regions?.media, 'display_name'),
    },
    states: scaffold.states ?? [],
    suggestedComponents: scaffold.suggestedComponents ?? {},
  };
}
