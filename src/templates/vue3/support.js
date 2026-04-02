export function renderVueTypes(model) {
  return `export interface ${model.meta.componentName}State {
  pageTitle: string;
  routeName: string;
  states: Array<{
    cid: string | null;
    name: string | null;
    itemCount: number;
    widgetCount: number;
    interactionCount: number;
  }>;
}
`;
}

export function renderVueMock(model) {
  const states = JSON.stringify(model.states ?? [], null, 2);
  return `import type { ${model.meta.componentName}State } from './${model.meta.componentName}.types';

export function create${model.meta.componentName}MockState(): ${model.meta.componentName}State {
  return {
    pageTitle: ${JSON.stringify(model.meta.pageName)},
    routeName: ${JSON.stringify(model.meta.routeName)},
    states: ${states},
  };
}
`;
}

export function renderVueApi(model) {
  return `export async function fetch${model.meta.componentName}PageData() {
  return {
    pageName: ${JSON.stringify(model.meta.pageName)},
    routeName: ${JSON.stringify(model.meta.routeName)},
  };
}
`;
}
