export function renderVueMock(model) {
  const states = JSON.stringify(model.states ?? [], null, 2);
  return `import type {
  ${model.typeNames.filterForm},
  ${model.typeNames.pageState},
  ${model.typeNames.tableRow},
} from '../types/${model.meta.routeName}.types';

export function create${model.meta.componentName}FilterDefaults(): ${model.typeNames.filterForm} {
  return {
    keyword: '',
    status: 'all',
  };
}

export function create${model.meta.componentName}MockRows(): ${model.typeNames.tableRow}[] {
  return [
    {
      id: 'demo-1',
      title: ${JSON.stringify(model.meta.pageName)},
      status: 'draft',
    },
  ];
}

export function create${model.meta.componentName}MockState(): ${model.typeNames.pageState} {
  return {
    pageTitle: ${JSON.stringify(model.meta.pageName)},
    routeName: ${JSON.stringify(model.meta.routeName)},
    filters: create${model.meta.componentName}FilterDefaults(),
    dialogVisible: false,
    states: ${states},
    rows: create${model.meta.componentName}MockRows(),
  };
}
`;
}
